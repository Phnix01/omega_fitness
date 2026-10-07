/**
 * OMEGA FITNESS : comportements de la landing (vanilla JS, aucune dépendance)
 * ---------------------------------------------------------------------------
 * Principe (INTEGRATION_NOTES §0) : le CSS porte tous les états. Ce fichier ne
 * fait qu'ajouter/retirer des classes, des attributs ARIA et des variables CSS.
 *
 *  1. Splash Lottie (≤ 1,6 s) → html.splash-done + html.hero-in + "omega:splash-done"
 *  2. Header : pilule (.is-scrolled), masquage au scroll (.is-hidden), --page-progress
 *  3. Menu mobile accessible (focus trap, Échap, verrouillage du scroll)
 *  4. Lien actif selon la section visible
 *  5. Reveals au scroll (un seul IntersectionObserver) + compteur « 5 programmes »
 *  6. Marquee : boost de vitesse selon la vélocité de scroll (playbackRate)
 *  7. Effets pointeur : boutons magnétiques, spotlight des tuiles (pointer: fine)
 *  8. Statut ouvert/fermé en temps réel (fuseau Africa/Niamey)
 *  9. Programmes / formules → préremplissage du formulaire
 * 10. Formulaire : validation accessible + envoi (Netlify Forms ou Web3Forms)
 * 11. Boutons store + toast
 *
 * Scroll : un seul listener passif, tout le travail dans un rAF (lectures puis
 * écritures). prefers-reduced-motion : tout est désactivé ou instantané.
 */
(function () {
  'use strict';

  var html = document.documentElement;
  // Signal obligatoire (sinon le filet de sécurité du <head> repasse en no-js au bout de 5 s)
  html.classList.add('main-ready');

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  var mqDesktop = window.matchMedia('(min-width: 1024px)');
  var reduced = function () { return mqReduced.matches; };

  // main.js arrivé après le filet de sécurité (réseau très lent) : on ne remet
  // pas .js (le contenu se re-masquerait), on ne branche que les comportements.
  var degraded = html.classList.contains('js-failed');

  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  function storageSet(key, value) {
    try { window.sessionStorage.setItem(key, value); } catch (e) { /* mode privé, cookies bloqués… */ }
  }

  /** Appelle cb une fois le scroll (smooth) terminé, avec un délai de secours. */
  function afterScroll(cb) {
    var done = false;
    var fire = function () {
      if (done) return;
      done = true;
      window.removeEventListener('scrollend', fire);
      cb();
    };
    if ('onscrollend' in window) window.addEventListener('scrollend', fire, { once: true });
    setTimeout(fire, reduced() ? 60 : 1100);
  }

  /* ------------------------------------------------------------------ */
  /* 1. Splash                                                           */
  /* ------------------------------------------------------------------ */
  var SPLASH_MAX_MS = 1600;      // plafond absolu depuis le début de la navigation
  var SPLASH_EXIT_FALLBACK = 750; // si transitionend (clip-path) ne vient pas

  var introDone = false;
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    html.classList.add('splash-done', 'hero-in');
    window.__omegaSplashDone = true;
    window.dispatchEvent(new CustomEvent('omega:splash-done'));
    storageSet('omega-splash', '1');
  }

  var domReady = new Promise(function (resolve) {
    if (document.readyState !== 'loading') resolve();
    else document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  function loadLottieLib() {
    return new Promise(function (resolve, reject) {
      if (window.lottie) return resolve(window.lottie);
      var tag = document.getElementById('lottie-lib');
      if (!tag) return reject(new Error('lottie-lib absent'));
      tag.addEventListener('load', function () { window.lottie ? resolve(window.lottie) : reject(new Error('lottie vide')); }, { once: true });
      tag.addEventListener('error', reject, { once: true });
    });
  }

  // Recolorage à la charte (sans modifier le JSON) + masquage du calque « LOADING ».
  // lottie arrondit les couleurs (ex. rgb(86,3,3)) : comparaison avec tolérance.
  var LOTTIE_COLORS = [
    { rgb: [107, 0, 115], to: '#1db954' }, // violet
    { rgb: [87, 3, 3], to: '#1db954' },    // bordeaux
    { rgb: [5, 13, 28], to: '#eef2ef' }    // marine (invisible sur noir)
  ];
  function mapLottieColor(value) {
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value || '');
    if (!m) return null;
    for (var i = 0; i < LOTTIE_COLORS.length; i++) {
      var c = LOTTIE_COLORS[i].rgb;
      if (Math.abs(c[0] - m[1]) <= 3 && Math.abs(c[1] - m[2]) <= 3 && Math.abs(c[2] - m[3]) <= 3) return LOTTIE_COLORS[i].to;
    }
    return null;
  }
  function brandLottie(anim, container) {
    $$('[fill],[stroke]', container).forEach(function (el) {
      ['fill', 'stroke'].forEach(function (attr) {
        var mapped = mapLottieColor(el.getAttribute(attr));
        if (mapped) el.setAttribute(attr, mapped);
      });
    });
    try {
      (anim.renderer.elements || []).forEach(function (layer) {
        if (layer && layer.data && layer.data.nm === 'LOADING Outlines') {
          var node = layer.layerElement || layer.baseElement;
          if (node) node.style.display = 'none';
        }
      });
    } catch (e) { /* structure interne de lottie inattendue : on garde la Lottie telle quelle */ }
  }

  function playSplash(splash) {
    var container = $('#lottie-container', splash);
    var anim = null;

    var lottieDone = loadLottieLib().then(function (lottie) {
      if (splash.classList.contains('is-leaving')) return; // plafond déjà atteint : inutile de lancer la Lottie
      return new Promise(function (resolve) {
        anim = lottie.loadAnimation({
          container: container,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          path: 'assets/animations/loading_hand.json',
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet', progressiveLoad: false }
        });
        anim.setSpeed(1.15);
        anim.addEventListener('DOMLoaded', function () { brandLottie(anim, container); });
        anim.addEventListener('complete', resolve);
        anim.addEventListener('data_failed', resolve);
      });
    }).catch(function () { /* lib ou JSON indisponible : on sort dès que le DOM est prêt */ });

    var cap = new Promise(function (resolve) {
      setTimeout(resolve, Math.max(0, SPLASH_MAX_MS - performance.now()));
    });

    Promise.race([Promise.all([lottieDone, domReady]), cap]).then(function () {
      leaveSplash(splash, anim);
    });
  }

  function leaveSplash(splash, anim) {
    if (splash.classList.contains('is-leaving')) return;
    splash.classList.add('is-leaving');
    var ended = false;
    var end = function (e) {
      if (ended) return;
      if (e && e.target !== splash) return; // transitions de la Lottie (opacity/transform)
      if (e && e.propertyName && e.propertyName !== 'clip-path') return;
      ended = true;
      splash.removeEventListener('transitionend', end);
      splash.classList.add('is-done');
      if (anim) { try { anim.destroy(); } catch (err) { /* déjà détruite */ } }
      finishIntro();
    };
    splash.addEventListener('transitionend', end);
    setTimeout(function () { end(); }, SPLASH_EXIT_FALLBACK);
  }

  function initSplash() {
    var splash = document.getElementById('splashscreen');
    if (degraded || !splash || html.classList.contains('splash-skip') || reduced()) {
      if (splash) splash.classList.add('is-done');
      finishIntro();
      return;
    }
    playSplash(splash);
  }

  /* ------------------------------------------------------------------ */
  /* 2. Scroll : header, progression, marquee (un seul rAF)              */
  /* ------------------------------------------------------------------ */
  var header = $('[data-header]');
  var scrollState = {
    lastY: window.scrollY,
    lastT: performance.now(),
    maxScroll: 1,
    ticking: false
  };

  function measure() {
    // lecture groupée, appelée hors des frames de scroll (resize / ResizeObserver)
    scrollState.maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  // Focus clavier uniquement : un lien cliqué à la souris garde le focus sans devoir bloquer le masquage
  function focusVisible(el) {
    try { return el.matches(':focus-visible'); } catch (e) { return true; }
  }

  function onScrollFrame() {
    scrollState.ticking = false;
    // --- lectures ---
    var y = window.scrollY;
    var now = performance.now();
    var dy = y - scrollState.lastY;
    var dt = Math.max(1, now - scrollState.lastT);
    var progress = clamp(y / scrollState.maxScroll, 0, 1);
    var menuOpen = html.classList.contains('menu-open');
    var focusInHeader = header && header.contains(document.activeElement) && focusVisible(document.activeElement);

    // --- écritures ---
    if (header) {
      header.style.setProperty('--page-progress', progress.toFixed(4));
      header.classList.toggle('is-scrolled', y > 80);
      if (y <= 80 || menuOpen || reduced()) {
        header.classList.remove('is-hidden');
      } else if (dy > 8 && !focusInHeader) {
        header.classList.add('is-hidden');
      } else if (dy < -8) {
        header.classList.remove('is-hidden');
      }
    }
    marquee.feed(Math.abs(dy) / dt);

    // on ne met à jour la référence que sur un mouvement significatif (seuil de 8 px)
    if (Math.abs(dy) > 8 || y <= 80) scrollState.lastY = y;
    scrollState.lastT = now;
  }

  function requestScrollFrame() {
    if (scrollState.ticking) return;
    scrollState.ticking = true;
    requestAnimationFrame(onScrollFrame);
  }

  function initScroll() {
    measure();
    window.addEventListener('scroll', requestScrollFrame, { passive: true });
    window.addEventListener('resize', function () { measure(); requestScrollFrame(); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(function () { measure(); }).observe(document.body);
    window.addEventListener('load', measure, { once: true });
    if (header) header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    onScrollFrame();
  }

  /* ------------------------------------------------------------------ */
  /* 6. Marquee : vitesse modulée par la vélocité de scroll              */
  /* ------------------------------------------------------------------ */
  var marquee = (function () {
    var root = $('[data-marquee]');
    var track = root && $('.marquee__track', root);
    var boost = 1;
    var target = 1;
    var visible = false;
    var raf = 0;
    var last = 0;

    function getAnim() {
      if (!track || typeof track.getAnimations !== 'function') return null;
      var list = track.getAnimations();
      return list.length ? list[0] : null;
    }

    function setRate(rate) {
      var a = getAnim();
      if (!a) return;
      if (typeof a.updatePlaybackRate === 'function') a.updatePlaybackRate(rate);
      else a.playbackRate = rate;
    }

    function tick(now) {
      var dt = Math.min(64, now - (last || now));
      last = now;
      // approche rapide vers la cible, puis la cible revient à 1 (≈ 600 ms)
      boost += (target - boost) * Math.min(1, dt / 90);
      target += (1 - target) * Math.min(1, dt / 200);
      if (Math.abs(boost - 1) < 0.01 && Math.abs(target - 1) < 0.01) {
        boost = target = 1;
        setRate(1);
        raf = 0;
        last = 0;
        return;
      }
      setRate(boost);
      raf = requestAnimationFrame(tick);
    }

    if (root && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
      }).observe(root);
    }

    return {
      /** v : vélocité de scroll en px/ms */
      feed: function (v) {
        if (!track || !visible || reduced()) return;
        var t = clamp(1 + v * 0.75, 1, 2.5);
        if (t > target) target = t;
        if (!raf && target > 1.01) raf = requestAnimationFrame(tick);
      }
    };
  })();

  /* ------------------------------------------------------------------ */
  /* 3. Menu mobile                                                      */
  /* ------------------------------------------------------------------ */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var menu = $('[data-menu]');
    if (!toggle || !menu) return;
    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

    function isOpen() { return menu.classList.contains('is-open'); }

    function focusables() {
      return [toggle].concat($$(FOCUSABLE, menu));
    }

    function open() {
      if (isOpen()) return;
      menu.classList.add('is-open');
      html.classList.add('menu-open');
      if (header) header.classList.remove('is-hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Fermer le menu');
      if (window.OmegaHero) window.OmegaHero.pause();
      var first = $('.mobile-menu__link', menu);
      if (first) first.focus({ preventScroll: true });
      document.addEventListener('keydown', onKey);
    }

    function close(restoreFocus) {
      if (!isOpen()) return;
      menu.classList.remove('is-open');
      html.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Ouvrir le menu');
      if (window.OmegaHero) window.OmegaHero.resume();
      document.removeEventListener('keydown', onKey);
      if (restoreFocus !== false) toggle.focus({ preventScroll: true });
    }

    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      var items = focusables();
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;
      if (items.indexOf(active) === -1) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    toggle.addEventListener('click', function () { isOpen() ? close() : open(); });

    // Clic sur un lien : fermeture, l'ancre fait le scroll (focus laissé à la navigation)
    $$('.mobile-menu__link', menu).forEach(function (link) {
      link.addEventListener('click', function () { close(false); });
    });

    var onDesktop = function (e) { if (e.matches) close(false); };
    if (mqDesktop.addEventListener) mqDesktop.addEventListener('change', onDesktop);
    else if (mqDesktop.addListener) mqDesktop.addListener(onDesktop);
  }

  /* ------------------------------------------------------------------ */
  /* 4. Lien actif selon la section visible                              */
  /* ------------------------------------------------------------------ */
  function initActiveLink() {
    var links = $$('[data-nav-link]').concat($$('.mobile-menu__link'));
    if (!links.length || !('IntersectionObserver' in window)) return;
    var byId = {};
    links.forEach(function (link) {
      var id = (link.getAttribute('href') || '').slice(1);
      if (!id) return;
      (byId[id] = byId[id] || []).push(link);
    });
    var sections = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var current = null;
    var inView = {};

    function setActive(id) {
      if (id === current) return;
      current = id;
      links.forEach(function (link) {
        var on = link.getAttribute('href') === '#' + id;
        link.classList.toggle('is-active', on);
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    // bande d'observation au milieu de l'écran : la section qui la traverse est « active »
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { inView[e.target.id] = e.isIntersecting; });
      var active = null;
      for (var i = 0; i < sections.length; i++) {
        if (inView[sections[i].id]) active = sections[i].id; // la plus basse dans l'ordre du DOM l'emporte
      }
      setActive(active);
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { io.observe(s); });
  }

  /* ------------------------------------------------------------------ */
  /* 5. Reveals au scroll + compteur                                     */
  /* ------------------------------------------------------------------ */
  function animateCounter(el) {
    var n = $$('.program-list > li').length || parseInt(el.getAttribute('data-counter'), 10) || 0;
    if (reduced() || n <= 1) { el.textContent = String(n); return; }
    var start = performance.now();
    var dur = 800;
    el.textContent = '0';
    (function step(now) {
      var t = clamp((now - start) / dur, 0, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(eased * n));
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = String(n); // la valeur réelle, toujours
    })(start);
  }

  function initReveals() {
    var targets = $$('[data-reveal]');
    var counters = $$('[data-counter]');
    // reduced-motion : reveals instantanés (le CSS ne masque déjà rien, on pose quand même l'état final)
    if (!('IntersectionObserver' in window) || degraded || reduced()) {
      counters.forEach(function (el) { if (reduced()) animateCounter(el); });
      targets.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    // Un h2 masqué en clip-path: inset(0 0 100% 0) n'a aucune surface visible pour
    // l'IntersectionObserver de Chromium : on observe donc son parent (en-tête de section).
    var map = new Map(); // élément observé -> éléments à révéler
    function watch(observed, target) {
      if (!map.has(observed)) map.set(observed, []);
      map.get(observed).push(target);
    }
    targets.forEach(function (el) {
      watch(el.getAttribute('data-reveal') === 'mask' && el.parentElement ? el.parentElement : el, el);
    });
    counters.forEach(function (el) { watch(el, el); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        (map.get(entry.target) || []).forEach(function (el) {
          if (el.hasAttribute('data-counter')) animateCounter(el);
          else el.classList.add('is-visible');
        });
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });
    map.forEach(function (_, observed) { io.observe(observed); });
  }

  /* ------------------------------------------------------------------ */
  /* 7. Effets pointeur (pointer: fine, sans reduced-motion)             */
  /* ------------------------------------------------------------------ */
  function pointerFxAllowed() { return mqFine.matches && !reduced(); }

  // Cache de getBoundingClientRect, invalidé au scroll / resize (une seule lecture par survol)
  var rectEpoch = 0;
  var bumpEpoch = function () { rectEpoch++; };
  window.addEventListener('scroll', bumpEpoch, { passive: true });
  window.addEventListener('resize', bumpEpoch, { passive: true });
  function cachedRect(el, cache) {
    if (!cache.rect || cache.epoch !== rectEpoch) {
      cache.rect = el.getBoundingClientRect();
      cache.epoch = rectEpoch;
    }
    return cache.rect;
  }

  function initMagnetic() {
    var MAX = 6;
    $$('[data-magnetic]').forEach(function (el) {
      var cache = {};
      var cur = { x: 0, y: 0 };
      var tgt = { x: 0, y: 0 };
      var raf = 0;

      function loop() {
        cur.x += (tgt.x - cur.x) * 0.2;
        cur.y += (tgt.y - cur.y) * 0.2;
        var settled = Math.abs(tgt.x - cur.x) < 0.05 && Math.abs(tgt.y - cur.y) < 0.05;
        if (settled) { cur.x = tgt.x; cur.y = tgt.y; }
        el.style.setProperty('--mag-x', cur.x.toFixed(2) + 'px');
        el.style.setProperty('--mag-y', cur.y.toFixed(2) + 'px');
        raf = settled ? 0 : requestAnimationFrame(loop);
      }
      function kick() { if (!raf) raf = requestAnimationFrame(loop); }

      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || !pointerFxAllowed()) return;
        var rect = cachedRect(el, cache);
        var dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        var dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        tgt.x = clamp(dx, -1, 1) * MAX;
        tgt.y = clamp(dy, -1, 1) * MAX;
        kick();
      });
      el.addEventListener('pointerleave', function () {
        cache.rect = null;
        tgt.x = tgt.y = 0;
        kick();
      });
    });
  }

  function initSpotlight() {
    $$('[data-spotlight]').forEach(function (el) {
      var cache = {};
      var pending = null;
      var raf = 0;
      function write() {
        raf = 0;
        if (!pending) return;
        el.style.setProperty('--mx', pending.x.toFixed(1) + 'px');
        el.style.setProperty('--my', pending.y.toFixed(1) + 'px');
      }
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse' || !pointerFxAllowed()) return;
        var rect = cachedRect(el, cache);
        pending = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (!raf) raf = requestAnimationFrame(write);
      });
      el.addEventListener('pointerleave', function () { cache.rect = null; });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 8. Statut ouvert / fermé (Africa/Niamey, horaires lus dans le DOM)  */
  /* ------------------------------------------------------------------ */
  var DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function niameyNow() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Niamey', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
      }).formatToParts(new Date());
      var get = function (type) {
        for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
        return '';
      };
      var day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
      var hour = parseInt(get('hour'), 10) % 24;
      var minute = parseInt(get('minute'), 10);
      if (day >= 0 && !isNaN(hour) && !isNaN(minute)) return { day: day, minutes: hour * 60 + minute };
    } catch (e) { /* Intl sans fuseaux : repli UTC+1 (Niger, sans heure d'été) */ }
    var d = new Date(Date.now() + 3600 * 1000);
    return { day: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }

  function readSchedule(rows) {
    var schedule = {};
    rows.forEach(function (row) {
      var open = parseFloat(row.getAttribute('data-open'));
      var close = parseFloat(row.getAttribute('data-close'));
      (row.getAttribute('data-days') || '').split(',').forEach(function (d) {
        var day = parseInt(d, 10);
        if (!isNaN(day)) schedule[day] = { open: open, close: close, row: row };
      });
    });
    return schedule;
  }

  function fmtHour(h) {
    var hh = Math.floor(h);
    var mm = Math.round((h - hh) * 60);
    return hh + 'h' + (mm ? String(mm).padStart(2, '0') : '');
  }

  function initStatus() {
    var rows = $$('[data-hours] .hours__row');
    var statuses = $$('[data-status]');
    var today = $('[data-today-hours]');
    if (!rows.length) return;
    var schedule = readSchedule(rows);

    function update() {
      var now = niameyNow();
      var t = schedule[now.day];
      var text;
      var isOpen = false;
      if (t && now.minutes >= t.open * 60 && now.minutes < t.close * 60) {
        isOpen = true;
        text = 'Ouvert maintenant, ferme à ' + fmtHour(t.close);
      } else if (t && now.minutes < t.open * 60) {
        text = 'Fermé, ouvre à ' + fmtHour(t.open);
      } else {
        // prochain jour d'ouverture
        text = 'Fermé';
        for (var i = 1; i <= 7; i++) {
          var next = schedule[(now.day + i) % 7];
          if (!next) continue;
          text = 'Fermé, ouvre ' + (i === 1 ? 'demain' : DAY_NAMES[(now.day + i) % 7]) + ' à ' + fmtHour(next.open);
          break;
        }
      }
      statuses.forEach(function (el) {
        el.classList.toggle('is-open', isOpen);
        el.classList.toggle('is-closed', !isOpen);
        var label = $('.status__text', el);
        if (label && label.textContent !== text) label.textContent = text;
      });
      rows.forEach(function (row) { row.classList.toggle('is-today', !!t && row === t.row); });
      if (today) today.textContent = t ? 'Aujourd’hui : ' + fmtHour(t.open) + ' - ' + fmtHour(t.close) : 'Fermé aujourd’hui';
    }

    update();
    setInterval(update, 60 * 1000);
  }

  /* ------------------------------------------------------------------ */
  /* 11. Toast                                                           */
  /* ------------------------------------------------------------------ */
  var toastEl = $('[data-toast]');
  var toastTimers = [];
  function showToast(message) {
    if (!toastEl) return;
    toastTimers.forEach(clearTimeout);
    toastTimers = [];
    // 1) la région devient visible (dans l'arbre d'accessibilité), 2) puis on y écrit :
    //    le lecteur d'écran annonce le changement, sans vol de focus.
    toastEl.textContent = '';
    toastEl.classList.add('is-visible');
    toastTimers.push(setTimeout(function () {
      toastEl.innerHTML = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-circle-check"/></svg>';
      toastEl.appendChild(document.createTextNode(message));
    }, 80));
    toastTimers.push(setTimeout(function () {
      toastEl.classList.remove('is-visible');
      toastTimers.push(setTimeout(function () { toastEl.textContent = ''; }, 400));
    }, 4000));
  }

  function initStores() {
    $$('[data-store]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var os = btn.getAttribute('data-store') === 'ios' ? 'iOS' : 'Android';
        showToast('L’application ' + os + ' sera bientôt disponible !');
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 9. Programmes / formules → formulaire                               */
  /* ------------------------------------------------------------------ */
  function focusNameAfterScroll() {
    afterScroll(function () {
      var name = document.getElementById('f-name');
      if (name) name.focus({ preventScroll: true });
    });
  }

  function initPrefill() {
    var select = document.getElementById('f-program');
    $$('[data-program]').forEach(function (link) {
      link.addEventListener('click', function () {
        var value = link.getAttribute('data-program');
        if (select) {
          for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].text === value || select.options[i].value === value) { select.selectedIndex = i; break; }
          }
        }
        focusNameAfterScroll();
      });
    });

    var input = $('[data-plan-input]');
    var chip = $('[data-plan-chip]');
    var chipName = $('[data-plan-chip-name]');
    var chipRemove = $('[data-plan-chip-remove]');
    $$('[data-plan]').forEach(function (link) {
      link.addEventListener('click', function () {
        var value = link.getAttribute('data-plan');
        if (input) input.value = value;
        if (chipName) chipName.textContent = value;
        if (chip) chip.hidden = false;
        focusNameAfterScroll();
      });
    });
    if (chipRemove) {
      chipRemove.addEventListener('click', function () {
        clearPlan();
        var name = document.getElementById('f-name');
        if (name) name.focus();
      });
    }
    function clearPlan() {
      if (input) input.value = '';
      if (chipName) chipName.textContent = '';
      if (chip) chip.hidden = true;
    }
    return clearPlan;
  }

  /* ------------------------------------------------------------------ */
  /* 10. Formulaire                                                      */
  /* ------------------------------------------------------------------ */
  /**
   * Fournisseur d'envoi, configurable sur le <form> sans toucher au JS :
   *  - par défaut : Netlify Forms (POST urlencoded vers l'action, "/")
   *  - Web3Forms  : <form data-provider="web3forms" data-access-key="VOTRE_CLE">
   *  - en local (localhost / 127.0.0.1 / file:) : simulation explicite, rien n'est envoyé
   *    et le message le dit (jamais de faux succès en production).
   */
  var PROVIDERS = {
    netlify: function (form) {
      var data = new FormData(form);
      return fetch(form.getAttribute('action') || '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(data).toString()
      }).then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); });
    },
    web3forms: function (form) {
      var data = new FormData(form);
      data.set('access_key', form.getAttribute('data-access-key') || '');
      data.set('subject', 'Nouvelle demande depuis le site Omega Fitness');
      data.set('botcheck', data.get('bot-field') || '');
      data.delete('bot-field');
      data.delete('form-name');
      return fetch(form.getAttribute('data-endpoint') || 'https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: data
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          if (!res.ok || json.success === false) throw new Error(json.message || 'HTTP ' + res.status);
        });
      });
    },
    simulate: function () {
      return new Promise(function (resolve) { setTimeout(resolve, 900); });
    }
  };

  function resolveProvider(form) {
    var explicit = form.getAttribute('data-provider');
    if (explicit && PROVIDERS[explicit]) return explicit;
    var host = location.hostname;
    if (location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '') return 'simulate';
    return 'netlify';
  }

  var MESSAGES = {
    name: 'Indiquez votre nom.',
    contact: 'Indiquez votre email ou votre téléphone pour qu’on puisse vous répondre.',
    email: 'Vérifiez votre adresse email (exemple : nom@domaine.com).',
    phone: 'Vérifiez votre numéro de téléphone (chiffres, espaces, + uniquement).',
    sending: 'Envoi…',
    success: 'Demande envoyée. Nous vous recontactons rapidement.',
    simulated: 'Simulation locale : la demande n’a pas été transmise (aucun serveur de formulaire en local).',
    error: 'L’envoi a échoué. Réessayez ou écrivez-nous à contact@omegafitness.ne.'
  };

  function initForm(clearPlan) {
    var form = $('[data-contact-form]');
    if (!form) return;
    form.setAttribute('novalidate', '');

    var fName = document.getElementById('f-name');
    var fEmail = document.getElementById('f-email');
    var fPhone = document.getElementById('f-phone');
    var errName = document.getElementById('f-name-error');
    var errContact = document.getElementById('f-contact-error');
    var submit = $('[data-submit]', form);
    var label = submit && $('.btn__label', submit);
    var iconUse = submit && $('.btn__icon use', submit);
    var status = $('[data-form-status]', form);
    var defaultLabel = label ? label.textContent : '';
    var defaultIcon = iconUse ? iconUse.getAttribute('href') : '';
    var sending = false;

    function setError(fields, errEl, message) {
      fields.forEach(function (f) { if (f) f.setAttribute('aria-invalid', 'true'); });
      if (errEl) { errEl.textContent = message; errEl.hidden = false; }
    }
    function clearError(fields, errEl) {
      fields.forEach(function (f) { if (f) f.removeAttribute('aria-invalid'); });
      if (errEl) { errEl.textContent = ''; errEl.hidden = true; }
    }

    function validate() {
      var firstInvalid = null;
      var name = fName ? fName.value.trim() : '';
      var email = fEmail ? fEmail.value.trim() : '';
      var phone = fPhone ? fPhone.value.trim() : '';

      if (!name) { setError([fName], errName, MESSAGES.name); firstInvalid = firstInvalid || fName; }
      else clearError([fName], errName);

      clearError([fEmail, fPhone], errContact);
      if (!email && !phone) {
        setError([fEmail, fPhone], errContact, MESSAGES.contact);
        firstInvalid = firstInvalid || fEmail;
      } else if (email && fEmail && (fEmail.validity.typeMismatch || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        setError([fEmail], errContact, MESSAGES.email);
        firstInvalid = firstInvalid || fEmail;
      } else if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) {
        setError([fPhone], errContact, MESSAGES.phone);
        firstInvalid = firstInvalid || fPhone;
      }
      return firstInvalid;
    }

    // nettoyage à la saisie
    if (fName) fName.addEventListener('input', function () { if (fName.value.trim()) clearError([fName], errName); });
    [fEmail, fPhone].forEach(function (f) {
      if (!f) return;
      f.addEventListener('input', function () {
        if (f.getAttribute('aria-invalid') === 'true' || (fEmail && fEmail.getAttribute('aria-invalid') === 'true') || (fPhone && fPhone.getAttribute('aria-invalid') === 'true')) {
          if ((fEmail && fEmail.value.trim()) || (fPhone && fPhone.value.trim())) clearError([fEmail, fPhone], errContact);
        }
      });
    });

    function setStatus(kind, message) {
      if (!status) return;
      status.classList.toggle('is-success', kind === 'success');
      status.classList.toggle('is-error', kind === 'error');
      status.textContent = message;
    }

    function setSending(on) {
      sending = on;
      if (!submit) return;
      if (on) {
        submit.setAttribute('aria-busy', 'true');
        submit.disabled = true;
        if (label) label.textContent = MESSAGES.sending;
        if (iconUse) iconUse.setAttribute('href', '#i-spinner');
      } else {
        submit.removeAttribute('aria-busy');
        submit.disabled = false;
        if (label) label.textContent = defaultLabel;
        if (iconUse) iconUse.setAttribute('href', defaultIcon);
      }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      var invalid = validate();
      if (invalid) {
        setStatus('', '');
        invalid.focus();
        return;
      }
      var provider = resolveProvider(form);
      setStatus('', '');
      setSending(true);
      PROVIDERS[provider](form).then(function () {
        setStatus('success', provider === 'simulate' ? MESSAGES.simulated : MESSAGES.success);
        form.reset();
        if (clearPlan) clearPlan();
      }).catch(function () {
        setStatus('error', MESSAGES.error);
      }).then(function () {
        var hadFocus = document.activeElement === submit || document.activeElement === document.body || !document.activeElement;
        setSending(false);
        if (hadFocus && submit) submit.focus({ preventScroll: true });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* 12. Placement du Ω du hero (SVG statique ET scène 3D)               */
  /* ------------------------------------------------------------------ */
  // Source unique : on mesure le texte du hero et on pose sur .hero les variables
  // --omega-x / --omega-y (centre du cercle, px depuis le coin haut-gauche du hero) et
  // --omega-r (rayon du cercle, px). Le CSS place le SVG avec, hero-scene.js place le Ω 3D
  // avec (événement "omega:layout") : les deux coïncident et ne recouvrent jamais le texte.
  //  - « haut » (mobile, ou portrait ≥ 768) : Ω centré dans la bande header → H1 − 24 px
  //  - « côté » (desktop) : Ω à droite du bloc de texte, à ≥ 40 px du H1 et du chapeau
  // Les rapports reprennent la géométrie du Ω 3D : demi-largeur 1,36 r, hauteur visible 2,3 r.
  var OMEGA_TOP_MQ = '(max-width: 767.98px), (max-aspect-ratio: 17/20)';
  function initOmegaPlacement() {
    var hero = $('.hero');
    var title = hero && $('.hero__title', hero);
    var lead = hero && $('.hero__lead', hero);
    if (!hero || !title) return;
    var mqTop = window.matchMedia(OMEGA_TOP_MQ);
    var range = lead ? document.createRange() : null;
    if (range) range.selectNodeContents(lead);
    var last = '';
    var raf = 0;

    function place() {
      raf = 0;
      var hr = hero.getBoundingClientRect();
      var W = hr.width;
      var H = hr.height;
      if (!W || !H) return;
      var t = title.getBoundingClientRect();
      var x;
      var y;
      var r;
      if (mqTop.matches) {
        var bandTop = 72; // sous le logo / bouton menu
        var bandBot = t.top - hr.top - 24;
        r = Math.min(0.2647 * W, Math.max(0, bandBot - bandTop) / 2.3, 0.2074 * H);
        x = W / 2;
        y = (bandTop + bandBot) / 2;
      } else {
        var textRight = t.right - hr.left;
        if (range) textRight = Math.max(textRight, range.getBoundingClientRect().right - hr.left);
        var containerLeft = t.left - hr.left;
        var containerRight = W - containerLeft;
        var zoneL = textRight + Math.max(40, 0.03 * W);
        // le Ω peut déborder à moitié dans la marge du container (grands écrans)
        var zoneR = Math.min(W - 24, containerRight + 0.5 * containerLeft);
        // taille « idéale » = ancienne règle (≈ 36 % de la demi-largeur, bornée par la hauteur)
        r = Math.max(0.1464 * H, Math.min(0.2562 * H, 0.1324 * W, 0.2952 * H));
        r = Math.min(r, (zoneR - zoneL) / 2 / 1.36);
        x = Math.max(0.68 * W, zoneL + 1.36 * r);
        y = 0.488 * H;
      }
      r = Math.max(r, 24);
      var key = mqTop.matches + '|' + Math.round(x) + '|' + Math.round(y) + '|' + Math.round(r);
      if (key === last) return;
      last = key;
      hero.style.setProperty('--omega-x', x.toFixed(1) + 'px');
      hero.style.setProperty('--omega-y', y.toFixed(1) + 'px');
      hero.style.setProperty('--omega-r', r.toFixed(1) + 'px');
      hero.setAttribute('data-omega-layout', mqTop.matches ? 'top' : 'side');
      hero.classList.add('omega-placed');
      window.dispatchEvent(new CustomEvent('omega:layout'));
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(place); }

    place();
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(schedule);
      ro.observe(hero);
      ro.observe(title);
      if (lead) ro.observe(lead);
    } else {
      window.addEventListener('resize', schedule, { passive: true });
    }
    if (mqTop.addEventListener) mqTop.addEventListener('change', schedule);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  function safe(fn, arg) {
    try { return fn(arg); } catch (err) {
      if (window.console && console.error) console.error('[omega]', err);
    }
  }

  safe(initOmegaPlacement);
  safe(initSplash);
  safe(initScroll);
  safe(initMenu);
  safe(initActiveLink);
  safe(initReveals);
  if (!degraded) {
    safe(initMagnetic);
    safe(initSpotlight);
  }
  safe(initStatus);
  safe(initStores);
  var clearPlan = safe(initPrefill);
  safe(initForm, clearPlan);
})();
