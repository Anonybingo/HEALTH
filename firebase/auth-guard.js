// firebase/auth-guard.js
// ── Shared auth-state helpers ───────────────────────────────────────────
// Used by any page that needs to know who's signed in, gate access, or log out.

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// Reads the user's profile doc from Firestore (contains role: "customer" | "admin")
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Fires callback(user, profile) on sign-in/sign-out and once on load.
// `user` and `profile` are both null when signed out. If the profile read
// fails (offline, rules issue, etc.) we still call back with profile=null
// instead of hanging forever — the page can then decide what to do.
export function watchAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    try {
      const profile = await getUserProfile(user.uid);
      callback(user, profile);
    } catch (err) {
      console.error("[auth-guard] Could not load profile for", user.uid, "—", err.message);
      callback(user, null);
    }
  });
}

// Call on a protected page. Redirects to the sign-in page if nobody's logged in.
// Resolves with { user, profile } once it's safe to render the page.
export function requireAuth({ redirectTo = "../auth/auth.html" } = {}) {
  return new Promise((resolve) => {
    watchAuth((user, profile) => {
      if (!user) {
        console.warn(`[auth-guard] Not signed in — redirecting to ${redirectTo}`);
        window.location.href = redirectTo;
        return;
      }
      resolve({ user, profile });
    });
  });
}

// Call on an admin-only page. Redirects non-admins back to the homepage.
// If this is bouncing you unexpectedly, open the browser console (F12) —
// it logs exactly why: not signed in, no profile doc, or role !== "admin".
export function requireAdmin({ redirectTo = "../index.html" } = {}) {
  return new Promise((resolve) => {
    watchAuth((user, profile) => {
      if (!user) {
        console.warn(`[auth-guard] Not signed in — redirecting to ${redirectTo}`);
        window.location.href = redirectTo;
        return;
      }
      if (profile?.role !== "admin") {
        console.warn(
          `[auth-guard] Signed in as ${user.email}, but role is "${profile?.role ?? "(no profile doc found at users/" + user.uid + ")"}" — ` +
          `needs to be exactly "admin". Redirecting to ${redirectTo}.`
        );
        window.location.href = redirectTo;
        return;
      }
      resolve({ user, profile });
    });
  });
}

export function logout() {
  return signOut(auth);
}

// Re-authenticates with the current password, then sets the new one.
// Firebase Auth never stores plaintext passwords — it salts and hashes
// them (scrypt) server-side. This just rotates the credential through
// Firebase's own auth backend; there's no separate hash for us to manage.
export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in.");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}