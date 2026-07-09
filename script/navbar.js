// script/navbar.js - Mobile hamburger menu
// Plain script — include on every page after cursor.js.
// No changes to any HTML file's existing markup needed;
// this injects the toggle button itself.
(function () {
  const container = document.querySelector(".navbar-container");
  const menu      = document.querySelector(".nav-menu");
  if (!container || !menu) return;

  // Inject hamburger button
  const btn = document.createElement("button");
  btn.type      = "button";
  btn.className = "nav-toggle";
  btn.setAttribute("aria-label", "Toggle navigation");
  btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = `<span></span><span></span><span></span>`;
  container.appendChild(btn);

  function openMenu() {
    menu.classList.add("open");
    btn.classList.add("active");
    btn.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    menu.classList.remove("open");
    btn.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.contains("open") ? closeMenu() : openMenu();
  });

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!container.contains(e.target)) closeMenu();
  });

  // Close on nav link click (useful for same-page anchor links)
  menu.querySelectorAll("a.nav-link").forEach((a) => {
    a.addEventListener("click", () => {
      // Small delay so the link can register before the menu closes
      setTimeout(closeMenu, 80);
    });
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
})();
