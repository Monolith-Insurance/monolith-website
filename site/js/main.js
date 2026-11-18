(function () {
  'use strict';

  /* ── Nav scroll border ───────────────────────────── */
  var nav = document.getElementById('nav');
  function updateNav() {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  /* ── Fade-in on scroll ───────────────────────────── */
  var fadeEls = document.querySelectorAll('.fade-in');
  function checkFades() {
    var vh = window.innerHeight;
    fadeEls.forEach(function (el) {
      if (el.getBoundingClientRect().top < vh * 0.9) {
        el.classList.add('visible');
      }
    });
  }
  window.addEventListener('scroll', checkFades, { passive: true });
  checkFades();

  /* ── MONOLITH animated SVG ───────────────────────── */
  /* animateForward collapses the bracket from its full
     size to a near-zero end path. fill="freeze" keeps
     it collapsed so nothing stays visible. */
  function triggerHeroAnim() {
    var svg = document.getElementById('monolith-anim-svg');
    if (!svg) return;
    svg.querySelectorAll('animate[data-animate-id="animateForward"]').forEach(function (el) {
      try { el.beginElement(); } catch (e) {}
    });
  }
  /* Small delay so SMIL is ready before we begin */
  setTimeout(triggerHeroAnim, 200);

  /* ── Mobile nav hamburger ───────────────────────── */
  var hamburger = document.querySelector('.nav-hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', function () {
      var open = nav.classList.toggle('menu-open');
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      hamburger.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('menu-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open navigation');
        document.body.style.overflow = '';
      });
    });
  }

  /* ── Smooth scroll for anchor links ─────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (id === '#') return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ── Contact form ────────────────────────────────── */
  var form = document.getElementById('contact-form');
  var success = document.getElementById('form-success');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* Honeypot: discard silently if filled */
      var hp = form.querySelector('.honeypot-field');
      if (hp && hp.value) return;

      /* Validate required fields */
      var valid = true;
      form.querySelectorAll('input[required], textarea[required]').forEach(function (f) {
        var empty = !f.value.trim();
        f.style.borderColor = empty ? '#c0392b' : '';
        if (empty) valid = false;
      });
      if (!valid) return;

      /* Clear any previous send error */
      var prevErr = form.querySelector('.form-send-error');
      if (prevErr) prevErr.remove();

      /* Disable button while sending */
      var btn = form.querySelector('.btn-send');
      btn.disabled = true;
      btn.textContent = 'Sending\u2026';

      var payload = {
        firstName: form.querySelector('[name="first_name"]').value.trim(),
        lastName:  form.querySelector('[name="last_name"]').value.trim(),
        company:   form.querySelector('[name="company"]').value.trim(),
        email:     form.querySelector('[name="email"]').value.trim(),
        message:   form.querySelector('[name="message"]').value.trim(),
        website:   hp ? hp.value : ''
      };

      function showSendError() {
        var el = document.createElement('p');
        el.className = 'form-send-error';
        el.style.cssText = 'margin-top:0.75rem;font-size:0.85rem;color:#a84040;';
        el.textContent = 'Sorry, your message couldn\u2019t be sent. Please email us at hello@monolithrisk.com.';
        form.querySelector('.form-submit').appendChild(el);
      }

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok && data.ok === true };
          });
        })
        .then(function (result) {
          if (result.ok) {
            form.style.display = 'none';
            if (success) success.classList.add('visible');
          } else {
            showSendError();
            btn.disabled = false;
            btn.textContent = 'Send';
          }
        })
        .catch(function () {
          showSendError();
          btn.disabled = false;
          btn.textContent = 'Send';
        });
    });
  }
})();
