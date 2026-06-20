// script/cursor.js - Shared custom cursor + magnetic hover effect
// Include on any page that has <div class="custom-cursor" id="customCursor"></div>
//   <script src="../script/cursor.js"></script>   (from a one-level-deep page)
//   <script src="script/cursor.js"></script>      (from a root page)
//
// Plain script (not a module) — load order vs. type="module" scripts doesn't matter.

(function () {
  const cursor = document.getElementById('customCursor');
  if (!cursor) return;

  document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });

  // Expand the cursor ring over anything clickable.
  const interactiveSelector =
    'a, button, input, textarea, select, .service-item, .med-card, .magnetic-btn, .auth-tab, .filter-btn';

  function wireHoverTargets() {
    document.querySelectorAll(interactiveSelector).forEach((el) => {
      if (el.dataset.cursorWired) return;
      el.dataset.cursorWired = 'true';
      el.addEventListener('mouseenter', () => cursor.classList.add('hovering'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovering'));
    });
  }
  wireHoverTargets();

  // Magnetic pull for nav links, logo, and pill buttons.
  document.querySelectorAll('.nav-link, .navbar-logo, .magnetic-btn').forEach((item) => {
    item.addEventListener('mousemove', (e) => {
      const rect = item.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      item.style.transform = `translate(${dx * 0.3}px, ${dy * 0.3}px)`;
    });
    item.addEventListener('mouseleave', () => {
      item.style.transform = 'translate(0px, 0px)';
    });
  });

  // Re-scan periodically for elements added after load (e.g. catalogue cards,
  // chat messages) so newly-inserted buttons/links still get the hover effect.
  window.wireCursorHoverTargets = wireHoverTargets;
})();