// setup/setup.js
// Lets the first signed-in user claim admin role.
// Security: the Firestore rule allows a user to update their own profile doc
// (isOwner = request.auth.uid == userId). Once ANY admin exists in the system,
// this page shows "SETUP COMPLETE" and refuses to do anything.
import { auth, db } from "../firebase/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  doc, getDoc, updateDoc,
  collection, query, where, limit, getDocs,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// ── UI state helpers ──────────────────────────────────────────────────
const STATES = ["stateLoading","stateSignedOut","stateLocked","stateAlreadyAdmin","stateClaim","stateSuccess"];
function showState(id) {
  STATES.forEach((s) => {
    const el = document.getElementById(s);
    if (el) el.hidden = (s !== id);
  });
}

function showError(msg) {
  const el = document.getElementById("setupError");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  el.hidden = false;
}

// ── Check whether any admin already exists ────────────────────────────
// We query users where role == "admin". The Firestore rule allows:
//   allow read: if isOwner(userId) || isAdmin()
// The signed-in user can only read their OWN doc, not all users.
// BUT — if we only ever need to read OUR OWN doc to know our own role,
// we don't need to query all users. Instead:
//   • If our own role is "admin"  → already admin.
//   • If our own role is anything else → we let them claim admin.
// This is intentionally simple — the page is only meant to be used once
// during initial project setup, not as an ongoing feature.

onAuthStateChanged(auth, async (user) => {
  if (!user) { showState("stateSignedOut"); return; }

  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    // Already admin → show "already admin" state
    if (profile.role === "admin") {
      document.getElementById("alreadyAdminEmail").textContent = user.email;
      showState("stateAlreadyAdmin");
      return;
    }

    // Not admin yet → check if ANY admin exists in the system.
    // We use a Firestore collection-group query with a where clause.
    // ⚠️ This requires the Firestore rule to allow listing users for admins.
    // Since the current user isn't admin yet, the query will return 0 docs
    // even if admins exist (permission denied → caught below).
    // We use a try/catch: permission error = admins already exist = lock the page.
    let adminExists = false;
    try {
      const adminQuery = query(
        collection(db, "users"),
        where("role", "==", "admin"),
        limit(1)
      );
      const adminSnap = await getDocs(adminQuery);
      adminExists = !adminSnap.empty;
    } catch {
      // Permission denied → can't read others' docs → an admin must already
      // exist (the rule only grants read access to isOwner OR isAdmin).
      adminExists = true;
    }

    if (adminExists) {
      showState("stateLocked");
      return;
    }

    // No admin yet → show the claim UI
    document.getElementById("claimEmail").textContent = user.email;
    document.getElementById("claimRole").textContent  = profile.role || "customer";
    showState("stateClaim");

    document.getElementById("claimBtn").addEventListener("click", async () => {
      const btn = document.getElementById("claimBtn");
      btn.disabled = true;
      btn.textContent = "PROMOTING…";
      try {
        await updateDoc(doc(db, "users", user.uid), { role: "admin" });
        showState("stateSuccess");
        setTimeout(() => { window.location.href = "../admin/admin.html"; }, 1800);
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = "PROMOTE TO ADMIN";
      }
    });

  } catch (err) {
    showError(err.message);
    showState("stateClaim"); // still show the UI so the error is visible
  }
});
