// auth/auth.js - Sign up / sign in logic backed by Firebase Auth + Firestore
import { auth, db } from "../firebase/firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { watchAuth } from "../firebase/auth-guard.js";

const tabs = document.querySelectorAll(".auth-tab");
const forms = document.querySelectorAll(".auth-form");
const errorBox = document.getElementById("authError");

const signinForm = document.getElementById("signinForm");
const signupForm = document.getElementById("signupForm");

/* ── Tab switching ─────────────────────────────────────────────────── */
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");

    const target = tab.dataset.tab; // "signin" | "signup"
    forms.forEach((f) => f.classList.toggle("active", f.id === `${target}Form`));
    clearError();
  });
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add("show");
}

function clearError() {
  errorBox.textContent = "";
  errorBox.classList.remove("show");
}

function setLoading(form, isLoading) {
  form.querySelector(".auth-submit").classList.toggle("loading", isLoading);
}

/* ── If already signed in, skip straight past this page ──────────────── */
let alreadyRedirected = false;
let isSigningUp = false;
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

/* ── Friendly error messages ──────────────────────────────────────────── */
function friendlyError(code) {
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Try again.",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists with that email.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/network-request-failed": "Network error — check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

/* ── Sign in ── */
signinForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  setLoading(signinForm, true);

  const email = document.getElementById("signinEmail").value.trim();
  const password = document.getElementById("signinPassword").value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    redirectAfterAuth(snap.exists() ? snap.data() : null);
  } catch (err) {
    showError(friendlyError(err.code));
    setLoading(signinForm, false);
  }
});

/* ── Sign up ── */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirm").value;

  if (password !== confirm) {
    showError("Passwords don't match.");
    return;
  }

  setLoading(signupForm, true);
  isSigningUp = true; // ADDED THIS TO PAUSE THE WATCHAUTH REDIRECT

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    await setDoc(doc(db, "users", cred.user.uid), {
      fullName: name,
      email,
      role: "customer", // first admin is promoted manually in the Firestore console — see ARCHITECTURE.md
      createdAt: serverTimestamp(),
    });

    redirectAfterAuth({ role: "customer" });
  } catch (err) {
    isSigningUp = false; // RESET THE FLAG IF THERE IS AN ERROR
    showError(friendlyError(err.code));
    setLoading(signupForm, false);
  }
});
