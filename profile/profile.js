// profile/profile.js - View and edit profile info
import { db } from "../firebase/firebase-config.js";
import { requireAuth } from "../firebase/auth-guard.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const { user, profile } = await requireAuth({ redirectTo: "../auth/auth.html" });

document.getElementById("profileName").value = profile?.fullName || user.displayName || "";
document.getElementById("profileEmail").value = user.email || "";
document.getElementById("profileRole").value = profile?.role === "admin" ? "ADMIN" : "CUSTOMER";

const toast = document.getElementById("profileToast");
function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

document.getElementById("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("profileSubmitBtn");
  const name = document.getElementById("profileName").value.trim();

  if (!name) {
    showToast("Name can't be empty.", true);
    return;
  }

  submitBtn.disabled = true;
  try {
    await updateDoc(doc(db, "users", user.uid), { fullName: name });
    await updateProfile(user, { displayName: name });
    showToast("Profile updated.");
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});
