// Splash Screen
const splashScreen = document.getElementById('splashscreen');
let playCount = 0;

const splashAnim = lottie.loadAnimation({
  container: document.getElementById('lottie-container'),
  renderer: 'svg',
  loop: false,
  autoplay: true,
  path: 'assets/animations/loading_hand.json'
});

splashAnim.setSpeed(0.9);
const splashTimeout = setTimeout(hideSplash, 4400);

splashAnim.addEventListener('complete', () => {
  playCount++;
  if (playCount < 2) {
    splashAnim.goToAndPlay(0);
  } else {
    hideSplash();
  }
});

function hideSplash() {
  clearTimeout(splashTimeout);
  splashScreen.classList.add('hidden');
}

// Mobile Menu Toggle
const menuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

menuBtn.addEventListener('click', () => {
  navLinks.classList.toggle('active');
  menuBtn.innerHTML = navLinks.classList.contains('active')
    ? '<i class="fas fa-times"></i>'
    : '<i class="fas fa-bars"></i>';
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();

    if (navLinks.classList.contains('active')) {
      navLinks.classList.remove('active');
      menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }

    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth'
    });
  });
});

// Intersection Observer for scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    entry.target.classList.add('visible');

    if (entry.target.classList.contains('feature-list')) {
      entry.target.querySelectorAll('li').forEach((item, i) => {
        item.style.transitionDelay = `${i * 0.1}s`;
      });
    }

    if (entry.target.classList.contains('grid')) {
      entry.target.querySelectorAll('.card').forEach((card, i) => {
        card.style.transitionDelay = `${i * 0.2}s`;
      });
    }

    if (entry.target.classList.contains('testimonial-grid')) {
      entry.target.querySelectorAll('.testimonial-card').forEach((card, i) => {
        card.style.transitionDelay = `${i * 0.2}s`;
      });
    }
  });
}, observerOptions);

document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right').forEach(el => {
  observer.observe(el);
});

// Hero entrance animations on page load
window.addEventListener('load', () => {
  document.querySelectorAll('.hero .fade-in').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.3}s`;
    el.classList.add('visible');
  });
});

// Form submission
const contactForm = document.querySelector('form');
if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const submitBtn = this.querySelector('.btn');
    const originalText = submitBtn.innerHTML;

    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
    submitBtn.disabled = true;

    setTimeout(() => {
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Message envoyé !';
      submitBtn.style.background = '#2ecc71';

      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.style.background = '';
        contactForm.reset();
      }, 2000);
    }, 1500);
  });
}

// Pricing card 3D hover effect
document.querySelectorAll('.pricing-card').forEach(card => {
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-15px) rotateX(5deg)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = 'translateY(0) rotateX(0)';
  });
});

// App buttons interaction
document.querySelectorAll('.app-btn').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    const platform = this.classList.contains('android-btn') ? 'Android' : 'iOS';
    const textEl = this.querySelector('.text');
    const iconEl = this.querySelector('.icon');
    const originalText = textEl.innerHTML;

    textEl.innerHTML = `<span>Téléchargement...</span><span>${platform === 'Android' ? 'Google Play' : 'App Store'}</span>`;
    iconEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    setTimeout(() => {
      textEl.innerHTML = originalText;
      iconEl.innerHTML = platform === 'Android'
        ? '<i class="fab fa-android"></i>'
        : '<i class="fab fa-apple"></i>';

      showToast(`L'application ${platform} sera bientôt disponible !`);
    }, 1500);
  });
});

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: var(--accent-red, #1db954); color: white;
    padding: 1rem 1.5rem; border-radius: 8px;
    z-index: 10000; animation: slideIn 0.5s ease-out;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  `;
  toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.5s ease-out forwards';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
