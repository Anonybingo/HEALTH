// auth/auth.js
import { auth, db } from "../firebase/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { watchAuth } from "../firebase/auth-guard.js";

/* ── Element refs ──────────────────────────────────────────────────── */
const tabs       = document.querySelectorAll(".auth-tab");
const forms      = document.querySelectorAll(".auth-form");
const errorBox   = document.getElementById("authError");
const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");

const forgotBtn     = document.getElementById("forgotPasswordBtn");
const forgotPanel   = document.getElementById("forgotPanel");
const forgotForm    = document.getElementById("forgotForm");
const forgotBackBtn = document.getElementById("forgotBackBtn");
const forgotSuccess = document.getElementById("forgotSuccess");
const forgotError   = document.getElementById("forgotError");

/* ── Tab switching ─────────────────────────────────────────────────── */
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    // Show the correct auth form, hide the other
    forms.forEach((f) => f.classList.toggle("active", f.id === `${tab.dataset.tab}Form`));

    // Hide the forgot panel WITHOUT touching signinForm's active class —
    // the line above already handled that correctly. Calling hideForgotPanel()
    // here was the bug: it was adding "active" back to signinForm after the
    // tab switcher had just removed it.
    forgotPanel.hidden = true;

    clearError();
  });
});

/* ── Eye toggle ────────────────────────────────────────────────────── */
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input     = document.getElementById(btn.dataset.target);
    const eyeOpen   = btn.querySelector(".eye-open");
    const eyeClosed = btn.querySelector(".eye-closed");
    const showing   = input.type === "text";

    input.type = showing ? "password" : "text";
    eyeOpen.classList.toggle("eye-hidden", !showing);
    eyeClosed.classList.toggle("eye-hidden", showing);
  });
});

/* ── Helpers ───────────────────────────────────────────────────────── */
function showError(msg) { errorBox.textContent = msg; errorBox.classList.add("show"); }
function clearError()   { errorBox.textContent = "";  errorBox.classList.remove("show"); }

/* ── Skip page if already signed in ───────────────────────────────── */
let alreadyRedirected = false;
let isSigningUp       = false;
watchAuth((user, profile) => {
  if (alreadyRedirected || !user || isSigningUp) return;
  alreadyRedirected = true;
  redirectAfterAuth(profile);
});

function redirectAfterAuth(profile) {
  window.location.href = profile?.role === "admin"
    ? "../admin/admin.html"
    : "../pharmacy/pharmacy.html";
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email":         "That email address doesn't look right.",
    "auth/user-not-found":        "No account found with that email.",
    "auth/wrong-password":        "Incorrect password. Try again.",
    "auth/invalid-credential":    "Email or password is incorrect.",
    "auth/email-already-in-use":  "An account already exists with that email.",
    "auth/weak-password":         "Password should be at least 6 characters.",
    "auth/network-request-failed":"Network error — check your connection.",
    "auth/too-many-requests":     "Too many attempts — try again shortly.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* ── Sign in ───────────────────────────────────────────────────────── */
signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  const submitBtn = signinForm.querySelector(".auth-submit");
  submitBtn.classList.add("loading");

  const email    = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    redirectAfterAuth(snap.exists() ? snap.data() : null);
  } catch (err) {
    showError(friendlyError(err.code));
    submitBtn.classList.remove("loading");
  }
});

/* ── Sign up ───────────────────────────────────────────────────────── */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  const submitBtn = signupForm.querySelector(".auth-submit");

  const name     = document.getElementById("signupName").value.trim();
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirm  = document.getElementById("signupConfirm").value;

  if (password !== confirm) { showError("Passwords don't match."); return; }

  submitBtn.classList.add("loading");
  isSigningUp = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name, email, role: "customer", createdAt: serverTimestamp(),
    });
    redirectAfterAuth({ role: "customer" });
  } catch (err) {
    isSigningUp = false;
    showError(friendlyError(err.code));
    submitBtn.classList.remove("loading");
  }
});

/* ── Forgot password ───────────────────────────────────────────────── */
forgotBtn.addEventListener("click", () => {
  signinForm.classList.remove("active");
  forgotPanel.hidden = false;
  forgotSuccess.hidden = true;
  forgotError.hidden   = true;
  forgotForm.reset();
  clearError();
});

forgotBackBtn.addEventListener("click", () => {
  forgotPanel.hidden = true;
  signinForm.classList.add("active");
});

forgotForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("forgotSubmitBtn");
  const email = document.getElementById("forgotEmail").value.trim();

  forgotSuccess.hidden = true;
  forgotError.hidden   = true;
  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  try {
    await sendPasswordResetEmail(auth, email);
    // Always show success even if the email isn't registered —
    // prevents account enumeration (security best practice).
    forgotSuccess.hidden = false;
    forgotForm.reset();
  } catch (err) {
    const map = {
      "auth/invalid-email":          "That email address doesn't look right.",
      "auth/network-request-failed": "Network error — check your connection.",
      "auth/too-many-requests":      "Too many attempts — try again shortly.",
    };
    forgotError.textContent = map[err.code] || "Could not send the reset email. Try again.";
    forgotError.hidden = false;
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
});
