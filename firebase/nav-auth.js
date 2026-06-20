// firebase/nav-auth.js

import { watchAuth, logout } from "./auth-guard.js";

export function initNavAuth(basePath = "") {
  const link = document.getElementById("navAuthLink");
  const dropdown = document.getElementById("authDropdown");
  let isCustomer = false;

  if (link) {
    // HANDLE THE CLICK EVENT FOR THE TOGGLE
    link.addEventListener("click", (e) => {
      if (isCustomer) {
        e.preventDefault(); // STOP FROM NAVIGATING AWAY
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        }
      }
    });

    watchAuth((user, profile) => {
      if (!user) {
        isCustomer = false;
        link.textContent = "Sign In";
        link.href = `${basePath}auth/auth.html`;
        if (dropdown) dropdown.style.display = "none";
        return;
      }

      if (profile?.role === "admin") {
        isCustomer = false;
        link.textContent = "Admin";
        link.href = `${basePath}admin/admin.html`;
        if (dropdown) dropdown.style.display = "none";
      } else {
        isCustomer = true;
        link.textContent = "My Account";
        link.href = "#"; // PREVENT DEFAULT NAVIGATION
      }
    });
  }

  // CLOSE DROPDOWN WHEN CLICKING OUTSIDE OF IT
  document.addEventListener("click", (e) => {
    if (isCustomer && link && dropdown && !link.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  window.addEventListener("scroll", () => {
    if (isCustomer && dropdown && dropdown.style.display === "block") {
      dropdown.style.display = "none";
    }
  }, { passive: true }); // PASSIVE HELPS TO PRESERVE PERFORMANCE DURING SCROLLS

  // INITIALIZE LOGOUT BUTTONS
  document.querySelectorAll("[data-logout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await logout();
      window.location.href = `${basePath}index.html`;
    });
  });
}
