/* SkillSync — minimal, dependency-free navigation behaviour.
   Handles the mobile menu toggle: aria-expanded sync, Escape to
   close, click-outside to close, and auto-close on link follow.
*/
(function () {
    "use strict";

    var toggle = document.getElementById("nav-toggle");
    var menu = document.getElementById("primary-menu");
    if (!toggle || !menu) return;

    var desktopMQ = window.matchMedia("(min-width: 900px)");

    function isOpen() {
        return toggle.getAttribute("aria-expanded") === "true";
    }

    function open() {
        menu.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
        toggle.setAttribute("aria-label", "Close menu");
    }

    function close() {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
    }

    toggle.addEventListener("click", function () {
        isOpen() ? close() : open();
    });

    // Close on Escape
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isOpen()) {
            close();
            toggle.focus();
        }
    });

    // Close when clicking outside the menu/toggle
    document.addEventListener("click", function (e) {
        if (!isOpen()) return;
        if (!menu.contains(e.target) && !toggle.contains(e.target)) {
            close();
        }
    });

    // Auto-close after following an in-page link (mobile)
    menu.addEventListener("click", function (e) {
        var link = e.target.closest("a");
        if (link && link.getAttribute("href") && link.getAttribute("href").charAt(0) === "#") {
            close();
        }
    });

    // Reset state when resizing into desktop view
    desktopMQ.addEventListener("change", function (e) {
        if (e.matches) close();
    });
})();
