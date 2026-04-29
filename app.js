// ==========================================
// MA FITNESS - Main JavaScript Module
// ==========================================

// ==========================================
// 1. MOBILE MENU MODULE
// ==========================================
const MobileMenu = {
  init() {
    this.menuBtn = document.querySelector('.mobile-menu-btn');
    this.navLinks = document.querySelector('.nav-links');
    this.bindEvents();
  },

  bindEvents() {
    this.menuBtn.addEventListener('click', () => this.toggle());

    // Close menu when clicking on a link
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => this.close());
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.menuBtn.contains(e.target) && !this.navLinks.contains(e.target)) {
        this.close();
      }
    });
  },

  toggle() {
    const isActive = this.navLinks.classList.toggle('active');
    this.menuBtn.innerHTML = isActive
      ? '<i class="fas fa-times"></i>'
      : '<i class="fas fa-bars"></i>';
    this.menuBtn.setAttribute('aria-expanded', isActive);
  },

  close() {
    this.navLinks.classList.remove('active');
    this.menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    this.menuBtn.setAttribute('aria-expanded', 'false');
  }
};

// ==========================================
// 2. NAVBAR SCROLL MODULE
// ==========================================
const NavbarScroll = {
  init() {
    this.navbar = document.querySelector('.navbar');
    this.bindEvents();
  },

  bindEvents() {
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 50) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }

      lastScroll = currentScroll;
    });
  }
};

// ==========================================
// 3. SMOOTH SCROLL MODULE
// ==========================================
const SmoothScroll = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));

        if (target) {
          const offsetTop = target.offsetTop - 80;
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      });
    });
  }
};

// ==========================================
// 4. INTERSECTION OBSERVER MODULE
// ==========================================
const AnimationObserver = {
  init() {
    this.observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      this.observerOptions
    );

    this.observeElements();
  },

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');

        // Add staggered delays for child elements
        this.addStaggeredDelays(entry.target);
      }
    });
  },

  addStaggeredDelays(element) {
    if (element.classList.contains('feature-list')) {
      const listItems = element.querySelectorAll('li');
      listItems.forEach((item, index) => {
        item.style.transitionDelay = `${index * 0.1}s`;
      });
    }

    if (element.classList.contains('grid')) {
      const cards = element.querySelectorAll('.card');
      cards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.2}s`;
      });
    }

    if (element.classList.contains('testimonial-grid')) {
      const testimonials = element.querySelectorAll('.testimonial-card');
      testimonials.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.2}s`;
      });
    }

    if (element.classList.contains('blog-grid')) {
      const blogCards = element.querySelectorAll('.blog-card');
      blogCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * 0.2}s`;
      });
    }
  },

  observeElements() {
    document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right').forEach(element => {
      this.observer.observe(element);
    });
  }
};

// ==========================================
// 5. GSAP ANIMATIONS MODULE
// ==========================================
const GSAPAnimations = {
  init() {
    // Check if GSAP is loaded
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded');
      return;
    }

    this.registerScrollTrigger();
    this.heroAnimations();
    this.sectionAnimations();
    this.pricingCardsAnimations();
    this.blogCardsAnimations();
  },

  registerScrollTrigger() {
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }
  },

  heroAnimations() {
    const tl = gsap.timeline();

    tl.from('.hero h1', {
      duration: 1,
      y: 100,
      opacity: 0,
      ease: 'power4.out'
    })
    .from('.hero p', {
      duration: 0.8,
      y: 50,
      opacity: 0,
      ease: 'power3.out'
    }, '-=0.5')
    .from('.app-buttons .app-btn', {
      duration: 0.6,
      y: 30,
      opacity: 0,
      stagger: 0.2,
      ease: 'back.out(1.7)'
    }, '-=0.3');
  },

  sectionAnimations() {
    // Animate section titles
    gsap.utils.toArray('.section-title').forEach(title => {
      gsap.from(title, {
        scrollTrigger: {
          trigger: title,
          start: 'top 80%',
          toggleActions: 'play none none none'
        },
        duration: 0.8,
        x: -100,
        opacity: 0,
        ease: 'power3.out'
      });
    });

    // Animate cards
    gsap.utils.toArray('.card').forEach((card, index) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        duration: 0.6,
        y: 60,
        opacity: 0,
        delay: index * 0.1,
        ease: 'power3.out'
      });
    });

    // Animate feature list items
    gsap.utils.toArray('.feature-list li').forEach((item, index) => {
      gsap.from(item, {
        scrollTrigger: {
          trigger: item,
          start: 'top 90%',
          toggleActions: 'play none none none'
        },
        duration: 0.5,
        x: -50,
        opacity: 0,
        delay: index * 0.1,
        ease: 'power2.out'
      });
    });
  },

  pricingCardsAnimations() {
    gsap.utils.toArray('.pricing-card').forEach((card, index) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 80%',
          toggleActions: 'play none none none'
        },
        duration: 0.8,
        y: 80,
        opacity: 0,
        delay: index * 0.15,
        ease: 'power3.out'
      });

      // Add hover animation
      card.addEventListener('mouseenter', () => {
        gsap.to(card, {
          duration: 0.3,
          y: -15,
          rotationX: 5,
          ease: 'power2.out'
        });
      });

      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          duration: 0.3,
          y: 0,
          rotationX: 0,
          ease: 'power2.out'
        });
      });
    });
  },

  blogCardsAnimations() {
    gsap.utils.toArray('.blog-card').forEach((card, index) => {
      gsap.from(card, {
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        duration: 0.7,
        y: 60,
        opacity: 0,
        delay: index * 0.15,
        ease: 'power3.out'
      });
    });
  }
};

// ==========================================
// 6. FORM HANDLING MODULE
// ==========================================
const FormHandler = {
  init() {
    this.contactForm = document.getElementById('contactForm');
    this.bookingForm = document.getElementById('bookingForm');

    if (this.contactForm) {
      this.bindContactForm();
    }

    if (this.bookingForm) {
      this.bindBookingForm();
    }
  },

  bindContactForm() {
    this.contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(this.contactForm, 'demande d\'information');
    });
  },

  bindBookingForm() {
    this.bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit(this.bookingForm, 'réservation');
    });
  },

  async handleSubmit(form, type) {
    const submitBtn = form.querySelector('.btn');
    const originalText = submitBtn.innerHTML;

    // Disable button and show loading
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
    submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        // Success
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Message envoyé !';
        submitBtn.style.background = '#2ecc71';

        this.showNotification(`Votre ${type} a été envoyée avec succès !`, 'success');

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.disabled = false;
          submitBtn.style.background = '';
          form.reset();
        }, 2000);
      } else {
        throw new Error('Erreur lors de l\'envoi');
      }
    } catch (error) {
      // Error
      submitBtn.innerHTML = '<i class="fas fa-times"></i> Erreur';
      submitBtn.style.background = '#e74c3c';

      this.showNotification('Une erreur est survenue. Veuillez réessayer.', 'error');

      setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.style.background = '';
      }, 2000);
    }
  },

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      animation: slideIn 0.5s ease-out;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      max-width: 400px;
    `;
    notification.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${message}`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.5s ease-out forwards';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
};

// ==========================================
// 7. APP BUTTONS MODULE
// ==========================================
const AppButtons = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    document.querySelectorAll('.app-btn').forEach(btn => {
      // Skip if button has target="_blank" (real store links)
      if (btn.getAttribute('target') === '_blank' &&
          (btn.href.includes('play.google.com') || btn.href.includes('apps.apple.com'))) {
        return;
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleClick(btn);
      });
    });
  },

  handleClick(btn) {
    const platform = btn.classList.contains('android-btn') ? 'Android' : 'iOS';
    const textElement = btn.querySelector('.text');
    const iconElement = btn.querySelector('.icon');

    if (!textElement || !iconElement) return;

    const originalText = textElement.innerHTML;
    const originalIcon = iconElement.innerHTML;

    // Show loading state
    textElement.innerHTML = platform === 'Android'
      ? '<span>Téléchargement...</span><span>Google Play</span>'
      : '<span>Téléchargement...</span><span>App Store</span>';

    iconElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    // Simulate download
    setTimeout(() => {
      textElement.innerHTML = originalText;
      iconElement.innerHTML = originalIcon;

      // Show notification
      this.showNotification(platform);
    }, 1500);
  },

  showNotification(platform) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--accent-red);
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      z-index: 10000;
      animation: slideIn 0.5s ease-out;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    `;
    notification.innerHTML = `<i class="fas fa-check-circle"></i> L'application ${platform} sera bientôt disponible !`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.5s ease-out forwards';
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }
};

// ==========================================
// 8. PERFORMANCE OPTIMIZATION MODULE
// ==========================================
const PerformanceOptimizer = {
  init() {
    this.lazyLoadImages();
    this.preloadCriticalResources();
  },

  lazyLoadImages() {
    if ('loading' in HTMLImageElement.prototype) {
      // Browser supports native lazy loading
      const images = document.querySelectorAll('img[loading="lazy"]');
      images.forEach(img => {
        img.src = img.src;
      });
    } else {
      // Fallback for browsers that don't support lazy loading
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lazysizes/5.3.2/lazysizes.min.js';
      document.body.appendChild(script);
    }
  },

  preloadCriticalResources() {
    // Preload hero image
    const heroImage = new Image();
    heroImage.src = 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=2070&q=80';
  }
};

// ==========================================
// 9. BOOKING DATE RESTRICTIONS MODULE
// ==========================================
const BookingRestrictions = {
  init() {
    const dateInput = document.getElementById('booking-date');
    if (!dateInput) return;

    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);

    // Set maximum date to 3 months from now
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 3);
    dateInput.setAttribute('max', maxDate.toISOString().split('T')[0]);
  }
};

// ==========================================
// 10. INITIALIZE ALL MODULES
// ==========================================
const App = {
  init() {
    // Wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initModules());
    } else {
      this.initModules();
    }
  },

  initModules() {
    console.log('🚀 MA FITNESS - Initializing...');

    // Initialize all modules
    MobileMenu.init();
    NavbarScroll.init();
    SmoothScroll.init();
    AnimationObserver.init();
    FormHandler.init();
    AppButtons.init();
    PerformanceOptimizer.init();
    BookingRestrictions.init();

    // Initialize GSAP animations after a short delay
    setTimeout(() => {
      GSAPAnimations.init();
    }, 100);

    // Trigger hero animations on page load
    this.triggerHeroAnimations();

    console.log('✅ MA FITNESS - Ready!');
  },

  triggerHeroAnimations() {
    const heroElements = document.querySelectorAll('.hero .fade-in');
    heroElements.forEach((element, index) => {
      element.style.transitionDelay = `${index * 0.3}s`;
      element.classList.add('visible');
    });
  }
};

// Start the application
App.init();

// ==========================================
// EXPORT FOR MODULE USAGE (if needed)
// ==========================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
