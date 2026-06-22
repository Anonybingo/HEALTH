// settings/settings.js - Account security settings
import { requireAuth, changePassword } from "../firebase/auth-guard.js";

await requireAuth({ redirectTo: "../auth/auth.html" });

const toast = document.getElementById("settingsToast");
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

document.getElementById("passwordForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const current = document.getElementById("pwCurrent").value;
  const next = document.getElementById("pwNew").value;
  const confirmVal = document.getElementById("pwConfirm").value;

  if (next !== confirmVal) {
    showToast("New passwords don't match.", true);
    return;
  }

  const submitBtn = document.getElementById("pwSubmitBtn");
  submitBtn.disabled = true;

  try {
    await changePassword(current, next);
    showToast("Password updated.");
    e.target.reset();
  } catch (err) {
    const map = {
      "auth/wrong-password": "Current password is incorrect.",
      "auth/invalid-credential": "Current password is incorrect.",
      "auth/weak-password": "New password should be at least 6 characters.",
      "auth/too-many-requests": "Too many attempts — try again shortly.",
    };
    showToast(map[err.code] || err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});
