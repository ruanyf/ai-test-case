/**
 * SkillSync landing page — lightweight interactive helpers.
 * No frameworks. Accessible by default.
 *   1. Mobile navigation toggle (with click-outside + Escape)
 *   2. Email capture form validation
 *   3. Section-aware nav highlighting
 *   4. Pricing billing-period toggle (monthly <-> annual)
 */

(function () {
    'use strict';

    /* ------------------------------------------------------------------
     * 1. Mobile navigation toggle
     * ------------------------------------------------------------------ */
    function initNavToggle() {
        const toggle = document.querySelector('.nav-toggle');
        const menu = document.getElementById('nav-menu');
        if (!toggle || !menu) return;

        function openMenu() {
            menu.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Close navigation');
        }

        function closeMenu() {
            menu.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation');
        }

        toggle.addEventListener('click', function () {
            if (menu.classList.contains('is-open')) closeMenu();
            else openMenu();
        });

        menu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('click', function (event) {
            if (!menu.classList.contains('is-open')) return;
            if (!toggle.contains(event.target) && !menu.contains(event.target)) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && menu.classList.contains('is-open')) {
                closeMenu();
                toggle.focus();
            }
        });

        let resizeRaf;
        window.addEventListener('resize', function () {
            cancelAnimationFrame(resizeRaf);
            resizeRaf = requestAnimationFrame(function () {
                if (window.innerWidth >= 768 && menu.classList.contains('is-open')) {
                    closeMenu();
                }
            });
        });
    }

    /* ------------------------------------------------------------------
     * 2. Email capture form
     * ------------------------------------------------------------------ */
    function initCtaForm() {
        const form = document.getElementById('cta-form');
        const input = document.getElementById('cta-email');
        const error = document.getElementById('cta-email-error');
        const success = document.getElementById('cta-success');
        const successEmail = document.getElementById('cta-success-email');
        if (!form || !input || !error || !success || !successEmail) return;

        const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        function showError(message) {
            error.textContent = message;
            input.setAttribute('aria-invalid', 'true');
        }

        function clearError() {
            error.textContent = '';
            input.removeAttribute('aria-invalid');
        }

        input.addEventListener('input', clearError);

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            const value = input.value.trim();
            if (!value) {
                showError('Please enter your email address.');
                input.focus();
                return;
            }
            if (!EMAIL_RE.test(value)) {
                showError('Please enter a valid email address.');
                input.focus();
                return;
            }
            clearError();
            form.setAttribute('hidden', '');
            success.removeAttribute('hidden');
            successEmail.textContent = value;
            success.focus();
        });
    }

    /* ------------------------------------------------------------------
     * 3. Section-aware nav highlighting
     * ------------------------------------------------------------------ */
    function initSectionNav() {
        const sections = document.querySelectorAll('main section[id]');
        const links = document.querySelectorAll('.nav-links a[href^="#"]');
        if (!sections.length || !links.length) return;
        if (!('IntersectionObserver' in window)) return;

        const observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                const id = '#' + entry.target.id;
                links.forEach(function (link) {
                    if (link.getAttribute('href') === id) {
                        link.setAttribute('aria-current', 'page');
                    } else {
                        link.removeAttribute('aria-current');
                    }
                });
            });
        }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

        sections.forEach(function (section) {
            observer.observe(section);
        });
    }

    /* ------------------------------------------------------------------
     * 4. Pricing billing-period toggle
     * ------------------------------------------------------------------ */
    function initBillingToggle() {
        const toggle = document.querySelector('.billing-toggle');
        if (!toggle) return;

        const options = toggle.querySelectorAll('.billing-option');
        const amounts = document.querySelectorAll('.plan-price .amount');
        const notes = document.querySelectorAll('.plan-billing .billing-note');
        if (!options.length) return;

        function applyBilling(period) {
            options.forEach(function (opt) {
                const isActive = opt.dataset.billing === period;
                opt.classList.toggle('is-active', isActive);
                opt.setAttribute('aria-pressed', String(isActive));
            });

            amounts.forEach(function (el) {
                const next = el.dataset[period];
                if (next) el.textContent = next;
            });

            notes.forEach(function (el) {
                const next = el.dataset[period];
                if (next) el.textContent = next;
            });
        }

        options.forEach(function (opt) {
            opt.addEventListener('click', function () {
                applyBilling(opt.dataset.billing || 'monthly');
            });
        });
    }

    /* Boot */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initNavToggle();
            initCtaForm();
            initSectionNav();
            initBillingToggle();
        });
    } else {
        initNavToggle();
        initCtaForm();
        initSectionNav();
        initBillingToggle();
    }
})();
