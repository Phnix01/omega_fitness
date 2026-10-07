/**
 * OMEGA FITNESS : scène 3D du hero, « L'anneau d'effort »
 * ---------------------------------------------------------------------------
 * Un Ω procédural (tube + halo + flux de particules) qui se « charge » en vert
 * au fil du scroll, jusqu'à « la dernière rep » (flash + impulsion radiale).
 *
 * Contrat d'intégration :
 *  - canvas #hero-canvas (dans .hero), three@0.170.0 via l'importmap ("three")
 *  - html.hero-3d-ready après la 1re frame rendue (+ .has-webgl sur .hero)
 *  - html.no-webgl si WebGL2 indisponible, si three ne charge pas, si la création
 *    du renderer échoue ou si le contexte est perdu
 *  - prefers-reduced-motion: reduce → three n'est pas téléchargé, le SVG statique reste
 *    (préférence activée en cours de visite : scènes libérées, le SVG revient)
 *  - placement : variables --omega-x/-y/-r posées sur .hero par main.js (événement
 *    "omega:layout"), partagées avec le SVG statique ; règle de secours sinon
 *  - window.OmegaHero = { pause(), resume(), dispose(), info() }
 *  - écoute window "omega:splash-done" (secours : 5 s) pour lancer l'intro
 *  - 2e scène optionnelle : #finale-canvas (Ω mini chargé), desktop uniquement,
 *    créée paresseusement à sa première intersection
 *
 * three n'est importé (import() dynamique) qu'une fois les conditions vérifiées :
 * pas de téléchargement de three sans WebGL2 ni en mode économie de données.
 * Perf (chemin critique) : ce module est chargé en async + fetchpriority=low ; three
 * n'est demandé qu'après l'événement load (+ requestIdleCallback), pour ne jamais
 * concurrencer le CSS, les polices et main.js sur réseau lent, et le travail lourd
 * (évaluation de three, création du renderer, 1re frame / compilation des shaders)
 * est découpé en tâches séparées (yield entre chaque) pour limiter les long tasks.
 * Les particules sont animées entièrement sur le GPU (LUT de la courbe dans une
 * DataTexture) : aucune écriture de buffer ni aucune allocation par frame.
 */

const html = document.documentElement;
// Lus dans boot() : le module est async, il peut s'exécuter avant la fin du parsing.
let heroCanvas = null;
let finaleCanvas = null;

const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
const mqMobile = window.matchMedia('(max-width: 767px)');

const cores = navigator.hardwareConcurrency || 4;
const isMobile = mqMobile.matches || (!mqFine.matches && Math.min(screen.width, screen.height) < 768);

/* ------------------------------------------------------------------------ */
/* Réglages                                                                 */
/* ------------------------------------------------------------------------ */
const CFG = {
  dprCap: isMobile ? 1.25 : 1.75,
  antialias: !isMobile,
  fov: 35,
  camZ: 6.5,
  camZOut: 7.2,
  lutSize: 512,
  tube: isMobile ? [240, 12] : [480, 24],   // segments le long / autour
  halo: isMobile ? [160, 10] : [240, 16],
  particles: (() => {
    if (isMobile) return cores <= 4 ? 600 : 900;
    if (cores <= 4) return 1200;
    return window.innerWidth >= 1280 ? 2400 : 1800;
  })(),
  dust: isMobile ? 0 : 500,
  rings: !isMobile,
  // Charge pilotée par le scroll : 0,18 au repos, 1 avant que le Ω ne quitte l'écran
  chargeIdle: 0.18,
  chargeFullAt: isMobile ? 0.35 : 0.5,
  // Part du scroll compensée par le Ω (il « traîne » derrière la page)
  pin: 0.5,
  // Watchdog : 20 frames consécutives > 24 ms → particules ÷ 2 et DPR 1
  slowFrameMs: 24,
  slowFrameCount: 20,
};

const GLSL_COLORS = /* glsl */ `
  const vec3 GREEN    = vec3(0.1137, 0.7255, 0.3294); // #1db954
  const vec3 GREEN300 = vec3(0.5569, 0.9412, 0.6941); // #8ef0b1
  const vec3 MINT     = vec3(0.6588, 1.0000, 0.7882); // #a8ffc9
  const vec3 GRAPHITE = vec3(0.0941, 0.1255, 0.1059); // #18201b
  const vec3 BONE     = vec3(0.9137, 0.9412, 0.9216); // #e9f0eb
`;

/* ------------------------------------------------------------------------ */
/* Splash : l'intro démarre à "omega:splash-done" (secours 5 s)             */
/* ------------------------------------------------------------------------ */
let splashDone = false; // évalué dans boot() (DOM complet), ou via l'événement
const splashCallbacks = [];
function markSplashDone() {
  if (splashDone) return;
  splashDone = true;
  for (let i = 0; i < splashCallbacks.length; i++) splashCallbacks[i]();
  splashCallbacks.length = 0;
}
window.addEventListener('omega:splash-done', markSplashDone, { once: true });
setTimeout(markSplashDone, 5000);
function whenSplashDone(cb) {
  if (splashDone) cb();
  else splashCallbacks.push(cb);
}

/* ------------------------------------------------------------------------ */
/* Pointeur partagé (écouté sur window, le canvas est pointer-events:none)  */
/* ------------------------------------------------------------------------ */
const pointer = { x: 0, y: 0, cx: 0, cy: 0, active: false, energy: 0 };
function onPointerMove(e) {
  if (e.pointerType === 'touch') return;
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  if (pointer.active) {
    const dx = nx - pointer.x;
    const dy = ny - pointer.y;
    pointer.energy = Math.min(1, pointer.energy + Math.sqrt(dx * dx + dy * dy) * 1.5);
  }
  pointer.x = nx;
  pointer.y = ny;
  pointer.cx = e.clientX;
  pointer.cy = e.clientY;
  pointer.active = true;
}
function onPointerOut(e) {
  if (!e.relatedTarget) pointer.active = false;
}
function onBlur() {
  pointer.active = false;
}

/* ------------------------------------------------------------------------ */
/* Boucle partagée : une seule rAF pour toutes les scènes actives           */
/* ------------------------------------------------------------------------ */
const scenes = [];
let rafId = 0;
let lastNow = 0;
let manualPause = false;

function tick(now) {
  rafId = 0;
  const rawMs = now - lastNow;
  lastNow = now;
  const dt = Math.min(rawMs / 1000, 1 / 30);
  let any = false;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (s.shouldRun()) {
      s.frame(dt, rawMs, now);
      any = true;
    }
  }
  if (any) rafId = requestAnimationFrame(tick);
}
function wake() {
  if (rafId || manualPause || document.hidden) return;
  for (let i = 0; i < scenes.length; i++) {
    if (scenes[i].shouldRun()) {
      lastNow = performance.now();
      for (let j = 0; j < scenes.length; j++) scenes[j].onWake();
      rafId = requestAnimationFrame(tick);
      return;
    }
  }
}
function sleep() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
}
document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : wake()));

/* ------------------------------------------------------------------------ */
/* Géométrie : la courbe Ω (spec §4.3)                                      */
/* ------------------------------------------------------------------------ */
function buildCurve(THREE) {
  const V = THREE.Vector3;
  const rad = THREE.MathUtils.degToRad;
  const pts = [new V(1.3, -0.98, -0.18), new V(1.0, -0.98, -0.18), new V(0.78, -0.93, -0.18)];
  for (let i = 0; i <= 72; i++) {
    const u = i / 72;
    const a = rad(-50 + 280 * u); // de -50° à 230°, par le haut
    const z = -0.18 + 0.36 * u + 0.1 * Math.sin(Math.PI * u);
    pts.push(new V(Math.cos(a), Math.sin(a), z));
  }
  pts.push(new V(-0.78, -0.93, 0.18), new V(-1.0, -0.98, 0.18), new V(-1.3, -0.98, 0.18));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

/** LUT 512×3 (RGBA32F) : ligne 0 = position, 1 = normale, 2 = binormale (repères de Frenet). */
function buildLut(THREE, curve, n) {
  const data = new Float32Array(n * 3 * 4);
  const frames = curve.computeFrenetFrames(n - 1, false);
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    curve.getPointAt(i / (n - 1), p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    let o = i * 4;
    data[o] = p.x; data[o + 1] = p.y; data[o + 2] = p.z; data[o + 3] = 1;
    o = (n + i) * 4;
    data[o] = N.x; data[o + 1] = N.y; data[o + 2] = N.z; data[o + 3] = 0;
    o = (2 * n + i) * 4;
    data[o] = B.x; data[o + 1] = B.y; data[o + 2] = B.z; data[o + 3] = 0;
  }
  const tex = new THREE.DataTexture(data, n, 3, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function gaussian() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------------ */
/* Shaders                                                                  */
/* ------------------------------------------------------------------------ */
const TUBE_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vView;
  varying float vU;
  void main() {
    vU = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const TUBE_FRAG = /* glsl */ `
  uniform float uCharge;
  uniform float uTime;
  uniform float uFlash;
  uniform float uFade;
  uniform float uFull;
  varying vec3 vN;
  varying vec3 vView;
  varying float vU;
  ${GLSL_COLORS}
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(-vView);
    vec3 L = normalize(vec3(0.4, 0.8, 0.6));
    float ndv = max(dot(N, V), 0.0);
    float lambert = max(dot(N, L), 0.0);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 32.0);
    float fres = pow(1.0 - ndv, 3.0);

    // métal satiné graphite + rim vert
    vec3 col = GRAPHITE * (0.75 + 2.4 * lambert) + vec3(0.25 * spec) + GREEN * 0.9 * fres;

    // charge : du pied droit (u = 0) vers le pied gauche, par le haut
    float charged = 1.0 - smoothstep(uCharge - 0.035, uCharge, vU);
    float beat = 0.9 + 0.1 * sin(uTime * 6.0 - vU * 40.0);
    vec3 emissive = GREEN * 1.5 * beat * (0.8 + 0.2 * lambert) + vec3(0.18 * spec) + GREEN300 * 0.5 * fres;
    col = mix(col, emissive, charged);

    // bord d'attaque : étincelle qui avance (éteinte une fois plein)
    float d = (vU - uCharge) * 60.0;
    col += GREEN300 * 2.2 * exp(-d * d) * (1.0 - uFull);

    // « dernière rep »
    col = mix(col, vec3(0.78, 1.0, 0.86), uFlash * 0.65);

    gl_FragColor = vec4(col, uFade);
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform float uCharge;
  uniform float uFade;
  uniform float uFlash;
  varying vec3 vN;
  varying vec3 vView;
  varying float vU;
  ${GLSL_COLORS}
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(-vView);
    float g = pow(abs(dot(N, V)), 2.0);          // fresnel inversé : coeur dense, bords nuls
    float charged = 1.0 - smoothstep(uCharge - 0.035, uCharge, vU);
    float ends = smoothstep(0.0, 0.03, vU) * (1.0 - smoothstep(0.97, 1.0, vU)); // pas de coupe nette aux pieds
    float a = (0.16 * (0.4 + 0.6 * charged) + 0.25 * uFlash) * g * ends * uFade;
    gl_FragColor = vec4(GREEN, a);
  }
`;

const FLOW_VERT = /* glsl */ `
  uniform sampler2D uLut;
  uniform float uFlow;
  uniform float uTime;
  uniform float uCharge;
  uniform float uFull;
  uniform float uIntro;
  uniform float uFade;
  uniform float uPR;
  uniform float uSizeK;
  uniform float uPulse;
  uniform float uPointerAmt;
  uniform vec3 uPointer;
  attribute vec4 aData0; // t0, vitesse, offset N, offset B
  attribute vec4 aData1; // phase, taille, mélange couleur, aléa
  varying vec3 vColor;
  varying float vAlpha;
  ${GLSL_COLORS}
  const float LUT_LAST = ${CFG.lutSize - 1}.0;

  vec3 lutRow(int row, int i0, int i1, float f) {
    return mix(texelFetch(uLut, ivec2(i0, row), 0).xyz, texelFetch(uLut, ivec2(i1, row), 0).xyz, f);
  }

  void main() {
    float t = fract(aData0.x + aData0.y * uFlow);
    float x = t * LUT_LAST;
    int i0 = int(x);
    int i1 = min(i0 + 1, int(LUT_LAST));
    float f = x - float(i0);
    vec3 P = lutRow(0, i0, i1, f);
    vec3 N = lutRow(1, i0, i1, f);
    vec3 B = lutRow(2, i0, i1, f);

    // hélice autour du tube + respiration du rayon
    float ang = aData1.x + t * 9.0 + uTime * 0.25;
    float c = cos(ang), s = sin(ang);
    vec2 o = vec2(c * aData0.z - s * aData0.w, s * aData0.z + c * aData0.w);
    o *= 1.0 + 0.18 * sin(uTime * 1.7 + aData1.x);
    vec3 dir = N * o.x + B * o.y;
    float r = length(o);
    vec3 pos = P + dir;

    // impulsion radiale de la « dernière rep »
    pos += (dir / max(r, 1e-4)) * uPulse * (0.25 + 0.45 * aData1.w);

    // répulsion du pointeur (plan z = 0 du groupe)
    vec2 dp = pos.xy - uPointer.xy;
    float dist = length(dp);
    float k = clamp(1.0 - dist / 0.6, 0.0, 1.0);
    pos.xy += (dp / max(dist, 1e-4)) * 0.25 * k * k * uPointerAmt;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float charged = 1.0 - smoothstep(uCharge - 0.02, uCharge + 0.02, t);
    float ends = smoothstep(0.0, 0.035, t) * (1.0 - smoothstep(0.965, 1.0, t));
    float sd = (t - uCharge) * 40.0;
    float spark = exp(-sd * sd) * (1.0 - uFull);
    float twinkle = 0.7 + 0.3 * sin(uTime * 3.0 + aData1.x * 7.0);

    vColor = mix(GREEN, MINT, aData1.z) + GREEN300 * spark;
    vAlpha = mix(0.25, 1.0, charged) * ends * twinkle * uIntro * uFade;
    gl_PointSize = aData1.y * uPR * (uSizeK / -mv.z) * (1.0 + 0.8 * spark);
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float a = 1.0 - smoothstep(0.2, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

const DUST_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPR;
  uniform float uIntro;
  uniform float uFade;
  attribute vec2 aDust; // taille, phase
  varying vec3 vColor;
  varying float vAlpha;
  ${GLSL_COLORS}
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aDust.x * uPR;
    vColor = GREEN;
    vAlpha = 0.18 * (0.6 + 0.4 * sin(uTime * 0.8 + aDust.y)) * uIntro * uFade;
  }
`;

const RING_VERT = /* glsl */ `
  void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const RING_FRAG = /* glsl */ `
  uniform float uFade;
  ${GLSL_COLORS}
  void main() { gl_FragColor = vec4(BONE, 0.06 * uFade); }
`;

/* ------------------------------------------------------------------------ */
/* Easing / maths                                                           */
/* ------------------------------------------------------------------------ */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/* ------------------------------------------------------------------------ */
/* Scène Ω (mode "hero" ou "mini")                                          */
/* ------------------------------------------------------------------------ */
function createOmegaScene(THREE, canvas, mode, context) {
  const isHero = mode === 'hero';
  const reduced = () => mqReduced.matches;
  const host = isHero ? canvas.closest('.hero') || canvas.parentElement : canvas.parentElement;

  // --- Renderer (try/catch → html.no-webgl) ---
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: context || undefined, // contexte déjà créé par start() (hero) : une seule création
      antialias: CFG.antialias,
      alpha: true,
      premultipliedAlpha: true,
      stencil: false,
      depth: true,
      powerPreference: 'default',
    });
  } catch (err) {
    if (isHero) html.classList.add('no-webgl');
    return null;
  }
  const basePR = Math.min(window.devicePixelRatio || 1, isHero ? CFG.dprCap : Math.min(CFG.dprCap, 1.5));
  renderer.setPixelRatio(basePR);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; // couleurs écrites telles quelles par nos shaders

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.fov, 1, 0.1, 50);
  camera.position.set(0, 0, CFG.camZ);

  const omega = new THREE.Group();
  scene.add(omega);

  const disposables = [];
  const curve = buildCurve(THREE);
  const lut = buildLut(THREE, curve, CFG.lutSize);
  disposables.push(lut);

  // Uniforms partagés entre matériaux (mêmes objets → une seule mise à jour)
  const U = {
    uCharge: { value: isHero ? 0 : 1 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uFade: { value: 1 },
    uFull: { value: isHero ? 0 : 1 },
    uIntro: { value: isHero ? 0 : 1 },
    uPR: { value: basePR },
  };

  // 1. Tube coeur
  const tubeGeo = new THREE.TubeGeometry(curve, CFG.tube[0], 0.055, CFG.tube[1], false);
  const tubeMat = new THREE.ShaderMaterial({
    vertexShader: TUBE_VERT,
    fragmentShader: TUBE_FRAG,
    uniforms: { uCharge: U.uCharge, uTime: U.uTime, uFlash: U.uFlash, uFade: U.uFade, uFull: U.uFull },
    transparent: true,
    depthWrite: true,
  });
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  tube.renderOrder = 2;
  omega.add(tube);
  disposables.push(tubeGeo, tubeMat);

  // 2. Halo additif (faux bloom), hero seulement
  if (isHero) {
    const haloGeo = new THREE.TubeGeometry(curve, CFG.halo[0], 0.16, CFG.halo[1], false);
    const haloMat = new THREE.ShaderMaterial({
      vertexShader: TUBE_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uCharge: U.uCharge, uFade: U.uFade, uFlash: U.uFlash },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.renderOrder = 3;
    omega.add(halo);
    disposables.push(haloGeo, haloMat);
  }

  // 3. Flux de particules (animé sur GPU)
  const maxParticles = isHero ? CFG.particles : 600;
  const sigma = isHero ? 0.12 : 0.1;
  const flowGeo = new THREE.BufferGeometry();
  {
    const d0 = new Float32Array(maxParticles * 4);
    const d1 = new Float32Array(maxParticles * 4);
    for (let i = 0; i < maxParticles; i++) {
      const o = i * 4;
      const gx = Math.max(-3, Math.min(3, gaussian()));
      const gy = Math.max(-3, Math.min(3, gaussian()));
      const rnd = Math.random();
      d0[o] = Math.random();
      d0[o + 1] = 0.02 + 0.04 * Math.random();
      d0[o + 2] = gx * sigma;
      d0[o + 3] = gy * sigma;
      d1[o] = Math.random() * Math.PI * 2;
      d1[o + 1] = 2 + 3 * rnd * rnd;
      d1[o + 2] = Math.pow(Math.random(), 1.5);
      d1[o + 3] = Math.random();
    }
    // "position" factice : three s'en sert pour le compte de sommets
    flowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxParticles * 3), 3));
    flowGeo.setAttribute('aData0', new THREE.BufferAttribute(d0, 4));
    flowGeo.setAttribute('aData1', new THREE.BufferAttribute(d1, 4));
  }
  const flowU = {
    uLut: { value: lut },
    uFlow: { value: Math.random() * 20 },
    uTime: U.uTime,
    uCharge: U.uCharge,
    uFull: U.uFull,
    uIntro: U.uIntro,
    uFade: U.uFade,
    uPR: U.uPR,
    uSizeK: { value: CFG.camZ },
    uPulse: { value: 0 },
    uPointerAmt: { value: 0 },
    uPointer: { value: new THREE.Vector3(99, 99, 0) },
  };
  const flowMat = new THREE.ShaderMaterial({
    vertexShader: FLOW_VERT,
    fragmentShader: POINT_FRAG,
    uniforms: flowU,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flow = new THREE.Points(flowGeo, flowMat);
  flow.frustumCulled = false;
  flow.renderOrder = 4;
  omega.add(flow);
  disposables.push(flowGeo, flowMat);

  // 4. Poussière ambiante (hero desktop)
  let dust = null;
  if (isHero && CFG.dust > 0) {
    const n = CFG.dust;
    const p = new Float32Array(n * 3);
    const a = new Float32Array(n * 2);
    let i = 0;
    while (i < n) {
      const x = (Math.random() * 2 - 1) * 6;
      const y = (Math.random() * 2 - 1) * 6;
      const z = (Math.random() * 2 - 1) * 6;
      if (x * x + y * y + z * z > 36 || z > 2.5) continue;
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      a[i * 2] = 1 + Math.random();
      a[i * 2 + 1] = Math.random() * Math.PI * 2;
      i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aDust', new THREE.BufferAttribute(a, 2));
    const m = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: { uTime: U.uTime, uPR: U.uPR, uIntro: U.uIntro, uFade: U.uFade },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    dust = new THREE.Points(g, m);
    dust.frustumCulled = false;
    dust.renderOrder = 1;
    scene.add(dust);
    disposables.push(g, m);
  }

  // 5. Anneaux « disques de fonte » (hero desktop) : 1 seul draw call
  if (isHero && CFG.rings) {
    const radii = [1.6, 1.95, 2.4];
    const seg = 128;
    const p = new Float32Array(radii.length * seg * 2 * 3);
    let o = 0;
    for (const r of radii) {
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2;
        const a1 = ((i + 1) / seg) * Math.PI * 2;
        p[o++] = Math.cos(a0) * r; p[o++] = Math.sin(a0) * r; p[o++] = 0;
        p[o++] = Math.cos(a1) * r; p[o++] = Math.sin(a1) * r; p[o++] = 0;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: { uFade: U.uFade },
      transparent: true,
      depthWrite: false,
    });
    const rings = new THREE.LineSegments(g, m);
    rings.position.z = -0.6;
    rings.rotation.x = 0.15;
    rings.renderOrder = 0;
    rings.frustumCulled = false;
    omega.add(rings);
    disposables.push(g, m);
  }

  /* ---------------- état (aucune allocation dans frame()) ---------------- */
  const st = {
    w: 1, h: 1,
    heroH: 1, hostLeft: 0, hostTop: 0,
    baseX: 0, baseY: 0, baseScale: 1, halfH: 1,
    rotX: 0, rotY: 0,
    p: 0, pS: 0,
    time: 0,
    introStart: -1,
    armed: true, flashStart: -1,
    pointerAmt: 0,
    visible: true,
    lost: false,
    ready: false,
    disposed: false,
    degraded: false,
    slowRun: 0, warmup: 30,
    avgMs: 16.7,
    count: maxParticles,
  };

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const invMat = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  function layout() {
    const w = canvas.clientWidth || host.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || host.clientHeight || window.innerHeight;
    if (!w || !h) return false;
    st.w = w;
    st.h = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const halfH = Math.tan(THREE.MathUtils.degToRad(CFG.fov / 2)) * CFG.camZ;
    const halfW = halfH * camera.aspect;
    st.halfH = halfH;
    const OMEGA_HALF_W = 1.36; // demi-largeur du Ω (pieds compris)

    // Placement mesuré par main.js (initOmegaPlacement) sur le texte du hero : centre et
    // rayon du cercle en px, partagés avec le SVG statique (pas de saut au fondu enchaîné).
    const placed = isHero ? readPlacement() : null;
    const wpp = (2 * halfH) / h; // unités monde par px (plan z = 0, caméra au repos)
    if (!isHero) {
      st.baseX = 0;
      st.baseY = 0.02;
      st.baseScale = Math.min(1.6, (halfW * 0.76) / OMEGA_HALF_W, (halfH * 0.8) / 1.08);
    } else if (placed) {
      st.baseScale = placed.r * wpp;
      st.baseX = (placed.x - w / 2) * wpp;
      st.baseY = (h / 2 - placed.y) * wpp;
    } else if (w < 768 || camera.aspect < 0.85) {
      // secours (main.js absent) : Ω en haut, centré, dans la bande header → H1
      const title = document.querySelector('.hero__title');
      const hostTop = host.getBoundingClientRect().top;
      const bandTop = 72;
      const bandBot = title ? title.getBoundingClientRect().top - hostTop - 24 : h * 0.3;
      const bandH = Math.max(0, bandBot - bandTop) * wpp;
      st.baseScale = Math.max(0.1, Math.min(0.85, (0.72 * halfW) / OMEGA_HALF_W, bandH / 2.3));
      st.baseX = 0;
      st.baseY = halfH - ((bandTop + bandBot) / 2) * wpp;
    } else {
      // secours desktop : Ω vers x ≈ 70 %, plus petit entre 1024 et 1279 px
      const cap = w < 1280 ? (halfW * 0.3) / OMEGA_HALF_W : 1.05;
      st.baseScale = Math.max(0.6, Math.min(1.05, cap, (halfW * 0.36) / OMEGA_HALF_W, (halfH * 0.62) / 1.05));
      st.baseX = halfW * 0.4;
      st.baseY = 0.05;
    }
    flowU.uSizeK.value = CFG.camZ * Math.max(0.65, Math.min(1, st.baseScale));

    const r = host.getBoundingClientRect();
    st.heroH = host.offsetHeight || h;
    st.hostLeft = r.left;
    st.hostTop = r.top + window.scrollY;
    return true;
  }

  /** Variables --omega-x/-y/-r posées par main.js sur .hero (px), ou null. */
  function readPlacement() {
    if (!host || !host.classList.contains('omega-placed')) return null;
    const x = parseFloat(host.style.getPropertyValue('--omega-x'));
    const y = parseFloat(host.style.getPropertyValue('--omega-y'));
    const r = parseFloat(host.style.getPropertyValue('--omega-r'));
    return x > 0 && y > 0 && r > 0 ? { x, y, r } : null;
  }

  /** Projette le pointeur sur le plan z = 0 du groupe Ω (espace local). */
  function updatePointerLocal() {
    const top = st.hostTop - window.scrollY;
    ndc.x = ((pointer.cx - st.hostLeft) / st.w) * 2 - 1;
    ndc.y = -((pointer.cy - top) / st.h) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    invMat.copy(omega.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(invMat);
    if (localRay.intersectPlane(zPlane, hit)) flowU.uPointer.value.copy(hit);
    return ndc.x > -1.05 && ndc.x < 1.05 && ndc.y > -1.05 && ndc.y < 1.05;
  }

  /** Met à jour l'état. dt = 0 → frame statique (reduced-motion). */
  function update(dt, now) {
    const still = reduced();
    st.time += dt;
    const t = st.time;
    U.uTime.value = t;

    // Respiration
    const breathe = still ? 1 : 1 + 0.012 * Math.sin(t * 1.25);
    const k = 1 - Math.exp(-dt * 4);

    // Scroll (hero seulement)
    if (isHero) {
      st.p = clamp01(window.scrollY / st.heroH);
      st.pS = still || dt === 0 ? st.p : st.pS + (st.p - st.pS) * (1 - Math.exp(-dt * 6));
    }
    const pS = st.pS;

    // Intro
    let introCharge = CFG.chargeIdle;
    let intro = 1;
    if (isHero && !still) {
      if (st.introStart < 0) {
        introCharge = 0;
        intro = 0;
      } else {
        const e = (now - st.introStart) / 1000;
        introCharge = CFG.chargeIdle * easeOutExpo(Math.min(e / 1.1, 1));
        intro = easeOutCubic(Math.min(e / 0.6, 1));
      }
    }
    U.uIntro.value = intro;

    // Charge + « dernière rep »
    if (isHero) {
      const scrollCharge = (1 - CFG.chargeIdle) * smoothstep(0.02, CFG.chargeFullAt, pS);
      const charge = Math.min(1, introCharge + scrollCharge);
      U.uCharge.value = charge;
      U.uFull.value = smoothstep(0.985, 1, charge);
      if (!still && st.armed && charge >= 0.998) {
        st.armed = false;
        st.flashStart = now;
      }
      if (!st.armed && pS < 0.3) st.armed = true;
      if (st.flashStart >= 0) {
        const e = (now - st.flashStart) / 1000;
        U.uFlash.value = e < 0.25 ? 1 - (e / 0.25) * 0.15 : Math.max(0, 0.85 * (1 - (e - 0.25) / 0.6));
        const x = e / 0.18;
        flowU.uPulse.value = e < 1.2 ? x * Math.exp(1 - x) : 0;
        if (e > 1.2) {
          st.flashStart = -1;
          U.uFlash.value = 0;
          flowU.uPulse.value = 0;
        }
      }
      U.uFade.value = 1 - smoothstep(0.7, 1, pS);
    }

    // Énergie du pointeur → vitesse du flux (×1 à ×1,8, retour ~600 ms)
    pointer.energy *= Math.exp(-dt * 5);
    flowU.uFlow.value += dt * (1 + 0.8 * pointer.energy);
    if (flowU.uFlow.value > 1e4) flowU.uFlow.value -= 1e4;

    // Rotation : souris (fine) ou oscillation (tactile)
    let tx = 0;
    let ty = 0;
    if (!still) {
      if (mqFine.matches) {
        if (pointer.active) {
          ty = pointer.x * 0.35;
          tx = -pointer.y * 0.2;
        }
      } else if (isHero) {
        ty = 0.15 * Math.sin(t * 0.4);
      }
    }
    st.rotX += (tx - st.rotX) * k;
    st.rotY += (ty - st.rotY) * k;

    // Transformations du groupe : parallaxe de sortie (le Ω traîne derrière la page)
    const s = st.baseScale * breathe;
    omega.scale.set(s, s, s);
    omega.position.set(st.baseX, st.baseY - CFG.pin * pS * 2 * st.halfH, 0);
    omega.rotation.set(st.rotX, st.rotY, isHero ? pS * 0.2 : 0);
    camera.position.z = isHero ? CFG.camZ + (CFG.camZOut - CFG.camZ) * pS : CFG.camZ;
    camera.updateMatrixWorld();
    omega.updateMatrixWorld();
    if (dust) dust.rotation.y += dt * 0.01;

    // Répulsion du pointeur
    let amtTarget = 0;
    if (isHero && !still && mqFine.matches && pointer.active) {
      if (updatePointerLocal()) amtTarget = 1;
    }
    st.pointerAmt += (amtTarget - st.pointerAmt) * (1 - Math.exp(-dt * 6));
    flowU.uPointerAmt.value = st.pointerAmt;
  }

  function render() {
    renderer.render(scene, camera);
    if (!st.ready) {
      st.ready = true;
      requestAnimationFrame(() => {
        if (st.disposed || st.lost) return;
        if (isHero) {
          html.classList.add('hero-3d-ready');
          if (host) host.classList.add('has-webgl');
        } else {
          html.classList.add('finale-3d-ready');
        }
        canvas.classList.add('is-ready');
      });
    }
  }

  /** Une frame isolée (1re frame, reduced-motion, resize en reduced-motion). */
  function renderStatic() {
    if (st.disposed || st.lost || !st.w) return;
    update(0, performance.now());
    render();
  }

  function degrade() {
    if (st.degraded) return;
    st.degraded = true;
    st.count = Math.floor(maxParticles / 2);
    flowGeo.setDrawRange(0, st.count);
    renderer.setPixelRatio(1);
    U.uPR.value = 1;
    renderer.setSize(st.w, st.h, false);
  }

  const api = {
    mode,
    shouldRun() {
      return !st.disposed && !st.lost && st.visible && !reduced() && (!isHero || st.introStart >= 0 || splashDone);
    },
    onWake() {
      st.warmup = 30;
      st.slowRun = 0;
    },
    frame(dt, rawMs, now) {
      if (isHero && st.introStart < 0) st.introStart = now;
      update(dt, now);
      render();
      // watchdog perf (hero)
      st.avgMs += (rawMs - st.avgMs) * 0.05;
      if (isHero && !st.degraded) {
        if (st.warmup > 0) st.warmup--;
        else if (rawMs > CFG.slowFrameMs) {
          if (++st.slowRun >= CFG.slowFrameCount) degrade();
        } else st.slowRun = 0;
      }
    },
    info() {
      return {
        mode,
        running: !!rafId && api.shouldRun(),
        particles: st.count,
        pixelRatio: renderer.getPixelRatio(),
        degraded: st.degraded,
        avgFrameMs: Math.round(st.avgMs * 100) / 100,
        drawCalls: renderer.info.render.calls,
        charge: Math.round(U.uCharge.value * 1000) / 1000,
        scroll: Math.round(st.pS * 1000) / 1000,
      };
    },
    dispose,
  };

  // --- Resize (ResizeObserver + debounce 150 ms) ---
  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (st.disposed) return;
      if (layout() && (reduced() || !rafId)) renderStatic();
    }, 150);
  });
  ro.observe(canvas);

  // --- Placement recalculé par main.js (polices chargées, H1 qui change de hauteur…) ---
  function onPlacement() {
    if (st.disposed || st.lost) return;
    if (layout() && (reduced() || !rafId)) renderStatic();
  }
  if (isHero) window.addEventListener('omega:layout', onPlacement);

  // --- Visibilité (IntersectionObserver) ---
  const io = new IntersectionObserver(
    (entries) => {
      st.visible = entries[entries.length - 1].isIntersecting;
      if (st.visible) wake();
    },
    { rootMargin: '64px 0px' }
  );
  io.observe(host || canvas);

  // --- Perte de contexte ---
  function onLost(e) {
    e.preventDefault();
    st.lost = true;
    if (isHero) {
      html.classList.remove('hero-3d-ready');
      html.classList.add('no-webgl');
    } else {
      html.classList.remove('finale-3d-ready');
    }
    canvas.classList.remove('is-ready');
  }
  function onRestored() {
    st.lost = false;
    st.ready = false;
    if (isHero) html.classList.remove('no-webgl');
    layout();
    renderStatic();
    wake();
  }
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  function onReducedChange() {
    if (reduced()) {
      renderStatic();
    } else {
      if (isHero && st.introStart < 0 && splashDone) st.introStart = performance.now();
      wake();
    }
  }
  mqReduced.addEventListener('change', onReducedChange);

  function dispose() {
    if (st.disposed) return;
    st.disposed = true;
    clearTimeout(resizeTimer);
    ro.disconnect();
    io.disconnect();
    mqReduced.removeEventListener('change', onReducedChange);
    window.removeEventListener('omega:layout', onPlacement);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    for (const d of disposables) d.dispose();
    renderer.dispose();
    const i = scenes.indexOf(api);
    if (i >= 0) scenes.splice(i, 1);
    if (isHero) {
      html.classList.remove('hero-3d-ready');
      if (host) host.classList.remove('has-webgl');
    } else {
      html.classList.remove('finale-3d-ready');
    }
    canvas.classList.remove('is-ready');
  }

  // --- Démarrage ---
  layout();
  api.start = async () => {
    // Compilation asynchrone des shaders (KHR_parallel_shader_compile) : pas de jank pendant le splash
    try {
      if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) {
        await renderer.compileAsync(scene, camera);
      }
    } catch (e) {
      /* compilation synchrone au premier rendu */
    }
    if (st.disposed) return;
    // 1re frame (compilation synchrone des shaders sans KHR_parallel_shader_compile) dans sa propre tâche
    await yieldToMain();
    if (st.disposed) return;
    renderStatic();
    if (isHero) {
      whenSplashDone(() => {
        if (st.introStart < 0 && !reduced()) st.introStart = performance.now();
        wake();
      });
    } else {
      wake();
    }
  };
  return api;
}

/* ------------------------------------------------------------------------ */
/* Boot                                                                     */
/* ------------------------------------------------------------------------ */
function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
    if (!gl) return false;
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    return true;
  } catch (e) {
    return false;
  }
}

function idle(cb) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(cb, { timeout: 1200 });
  else setTimeout(cb, 200);
}

/** Rend la main au navigateur entre deux gros blocs de travail (INP / long tasks). */
function yieldToMain() {
  if (window.scheduler && typeof window.scheduler.yield === 'function') return window.scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function onLoad(cb) {
  if (document.readyState === 'complete') cb();
  else window.addEventListener('load', cb, { once: true });
}

let heroScene = null;
let miniScene = null;
let miniObserver = null;

function miniAllowed() {
  return (
    !!finaleCanvas &&
    window.innerWidth >= 1024 &&
    mqFine.matches &&
    !mqReduced.matches
  );
}

/** Attributs identiques à ceux que demanderait WebGLRenderer (le contexte lui est ensuite passé). */
function heroContext() {
  try {
    return heroCanvas.getContext('webgl2', {
      alpha: true,
      depth: true,
      stencil: false,
      antialias: CFG.antialias,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e) {
    return null;
  }
}

let starting = false;
// MediaQueryList dédiée à l'écoute : Chromium ne déclenche pas "change" si .matches a déjà été
// relu entre-temps (la boucle lit mqReduced à chaque frame), d'où une 2e instance jamais lue.
const mqReducedWatch = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * prefers-reduced-motion (§4.1, §6) : pas de three.js, le SVG statique reste affiché.
 * Préférence activée en cours de visite → scènes libérées (le SVG revient) ;
 * désactivée → la scène démarre à ce moment-là.
 */
function onReducedPref(e) {
  if (e.matches) {
    if (heroScene || miniScene || miniObserver) window.OmegaHero.dispose();
  } else if (!heroScene && !starting) {
    onLoad(() => idle(start));
  }
}

async function start() {
  if (starting || heroScene || mqReduced.matches) return;
  starting = true;
  try {
    await startScenes();
  } finally {
    starting = false;
  }
}

async function startScenes() {
  // Vrai test WebGL2 avant de télécharger three. Pour le hero, le contexte de test EST celui du
  // renderer (pas de contexte jetable : sa création, coûteuse, n'est payée qu'une fois).
  const heroGl = heroCanvas ? heroContext() : null;
  if (heroCanvas ? !heroGl : !hasWebGL2()) {
    html.classList.add('no-webgl');
    return;
  }
  await yieldToMain();
  let THREE;
  try {
    THREE = await import('three');
  } catch (err) {
    html.classList.add('no-webgl');
    return;
  }
  await yieldToMain(); // évaluation de three et création du renderer dans deux tâches distinctes
  if (mqReduced.matches) return; // préférence changée pendant le téléchargement

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('mouseout', onPointerOut, { passive: true });
  window.addEventListener('blur', onBlur);

  if (heroCanvas) {
    heroScene = createOmegaScene(THREE, heroCanvas, 'hero', heroGl);
    if (heroScene) {
      scenes.push(heroScene);
      heroScene.start();
    }
  }

  // 2e scène : Ω mini du footer, créée à la première intersection
  if (miniAllowed()) {
    miniObserver = new IntersectionObserver(
      (entries) => {
        if (!entries[entries.length - 1].isIntersecting) return;
        miniObserver.disconnect();
        miniObserver = null;
        miniScene = createOmegaScene(THREE, finaleCanvas, 'mini');
        if (miniScene) {
          scenes.push(miniScene);
          miniScene.start();
        }
      },
      { rootMargin: '200px 0px' }
    );
    miniObserver.observe(finaleCanvas);
  }
}

function boot() {
  heroCanvas = document.getElementById('hero-canvas');
  finaleCanvas = document.getElementById('finale-canvas');
  if (
    html.classList.contains('splash-skip') ||
    html.classList.contains('splash-done') ||
    window.__omegaSplashDone === true ||
    !document.getElementById('splashscreen')
  ) {
    markSplashDone();
  }
  if (!heroCanvas && !finaleCanvas) return;
  // Test gratuit ici ; le vrai test (création d'un contexte WebGL2, coûteuse : initialisation
  // du GPU) est fait plus tard, après load, juste avant de télécharger three.
  if (!('WebGL2RenderingContext' in window)) {
    html.classList.add('no-webgl');
    return;
  }
  const conn = navigator.connection;
  if (conn && conn.saveData) return; // fallback statique, sans télécharger three
  mqReducedWatch.addEventListener('change', onReducedPref);
  if (mqReduced.matches) return; // SVG statique, three n'est pas téléchargé
  // Connexion à jsDelivr ouverte tout de suite (3 allers-retours de moins plus tard), mais three
  // n'est téléchargé qu'après load : il ne concurrence ni le CSS, ni les polices, ni main.js.
  const hint = document.createElement('link');
  hint.rel = 'preconnect';
  hint.href = 'https://cdn.jsdelivr.net';
  hint.crossOrigin = 'anonymous';
  document.head.appendChild(hint);
  onLoad(() => idle(start));
}

/* ------------------------------------------------------------------------ */
/* API publique                                                             */
/* ------------------------------------------------------------------------ */
window.OmegaHero = {
  /** Met la boucle en pause (ex. menu mobile ouvert). */
  pause() {
    manualPause = true;
    sleep();
  },
  /** Reprend la boucle si une scène est visible. */
  resume() {
    manualPause = false;
    wake();
  },
  /** Libère GPU + écouteurs (SPA / tests). */
  dispose() {
    sleep();
    if (miniObserver) miniObserver.disconnect();
    if (heroScene) heroScene.dispose();
    if (miniScene) miniScene.dispose();
    heroScene = miniScene = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('mouseout', onPointerOut);
    window.removeEventListener('blur', onBlur);
  },
  /** Diagnostic (QA) : particules, DPR, temps moyen par frame, draw calls… */
  info() {
    return {
      hero: heroScene ? heroScene.info() : null,
      mini: miniScene ? miniScene.info() : null,
      paused: manualPause,
    };
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
