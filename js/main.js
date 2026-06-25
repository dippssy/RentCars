// ===== LUXDRIVE - Main JavaScript =====

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initNavbar();
  initParallax();
  initMobileMenu();
  initCountUp();
  initSlider();
  initFilterTabs();
  initPasswordStrength();
  initRentalCalc();
  AOS.init({ duration: 800, easing: 'ease-out-cubic', once: true, offset: 80 });
});

// ===== THEME TOGGLE =====
function initThemeToggle() {
  const saved = localStorage.getItem('luxdrive-theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
  }
  updateToggleIcons();

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('luxdrive-theme', next);
      updateToggleIcons();
    });
  });
}

function updateToggleIcons() {
  const isLight = document.documentElement.dataset.theme === 'light';
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = isLight ? '🌙' : '☀️';
    btn.title = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';
  });
}

// ===== NAVBAR SCROLL =====
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== PARALLAX =====
function initParallax() {
  const bg = document.querySelector('.parallax-bg');
  const car = document.querySelector('.parallax-car');
  if (!bg && !car) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (bg) bg.style.transform = `translate3d(0, ${y * 0.4}px, 0)`;
        if (car) car.style.transform = `translate3d(0, ${y * -0.15}px, 0) scale(${1 + y * 0.0002})`;
        ticking = false;
      });
      ticking = true;
    }
  });
}

// ===== MOBILE MENU =====
function initMobileMenu() {
  const toggle = document.querySelector('.mobile-toggle');
  const menu = document.querySelector('.mobile-menu');
  const close = document.querySelector('.mobile-close');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => menu.classList.add('open'));
  if (close) close.addEventListener('click', () => menu.classList.remove('open'));
  menu.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => menu.classList.remove('open'));
  });
}

// ===== COUNT UP ANIMATION =====
function initCountUp() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const increment = target / 60;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) {
            current = target;
            clearInterval(timer);
          }
          el.textContent = Math.floor(current) + suffix;
        }, 25);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

// ===== TESTIMONIAL SLIDER =====
function initSlider() {
  const track = document.querySelector('.slider-track');
  if (!track) return;

  const slides = track.querySelectorAll('.slider-slide');
  const dotsContainer = document.querySelector('.slider-dots');
  const prevBtn = document.querySelector('.slider-prev');
  const nextBtn = document.querySelector('.slider-next');
  let current = 0;
  const total = slides.length;

  function goTo(index) {
    current = (index + total) % total;
    track.style.transform = `translateX(-${current * 100}%)`;
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.slider-dot').forEach((d, i) => {
        d.classList.toggle('active', i === current);
      });
    }
  }

  if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
  if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

  if (dotsContainer && total > 0) {
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('button');
      dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => goTo(i));
      dotsContainer.appendChild(dot);
    }
  }

  // Auto-slide
  setInterval(() => goTo(current + 1), 5000);
}

// ===== FILTER TABS =====
function initFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  const cards = document.querySelectorAll('[data-category]');
  if (!tabs.length || !cards.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      cards.forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = '';
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.transition = 'all 0.4s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// ===== PASSWORD STRENGTH =====
function initPasswordStrength() {
  const passInput = document.querySelector('#password');
  const bars = document.querySelectorAll('.strength-bar');
  if (!passInput || !bars.length) return;

  passInput.addEventListener('input', () => {
    const val = passInput.value;
    let strength = 0;
    if (val.length >= 6) strength++;
    if (val.length >= 10) strength++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) strength++;
    if (/[^A-Za-z0-9]/.test(val)) strength++;

    bars.forEach((bar, i) => {
      bar.className = 'strength-bar';
      if (i < strength) {
        if (strength <= 1) bar.classList.add('weak');
        else if (strength <= 2) bar.classList.add('medium');
        else bar.classList.add('strong');
      }
    });
  });
}

// ===== RENTAL PRICE CALCULATOR =====
function initRentalCalc() {
  const startDate = document.querySelector('#start-date');
  const endDate = document.querySelector('#end-date');
  const carSelect = document.querySelector('#car-select');
  const totalEl = document.querySelector('#rental-total');
  if (!startDate || !endDate || !totalEl) return;

  function calc() {
    const s = new Date(startDate.value);
    const e = new Date(endDate.value);
    if (isNaN(s) || isNaN(e) || e <= s) { totalEl.textContent = '-'; return; }
    const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
    const prices = { avanza: 350000, innova: 500000, fortuner: 850000, pajero: 900000, alphard: 1500000, hiace: 1200000 };
    const car = carSelect ? carSelect.value : 'avanza';
    const price = (prices[car] || 350000) * days;
    totalEl.textContent = 'Rp ' + price.toLocaleString('id-ID');
    const daysEl = document.querySelector('#rental-days');
    if (daysEl) daysEl.textContent = days + ' day(s)';
  }

  startDate.addEventListener('change', calc);
  endDate.addEventListener('change', calc);
  if (carSelect) carSelect.addEventListener('change', calc);
}

// ===== SMOOTH SCROLL FOR ANCHOR LINKS =====
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;
  e.preventDefault();
  const target = document.querySelector(link.getAttribute('href'));
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
