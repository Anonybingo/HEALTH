// cart/cart.js - Cart management + checkout
import { db } from "../firebase/firebase-config.js";
import { requireAuth } from "../firebase/auth-guard.js";
import {
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const { user } = await requireAuth({ redirectTo: "../auth/auth.html" });

const cartItemsEl = document.getElementById("cartItems");
const subtotalEl = document.getElementById("cartSubtotal");
const checkoutBtn = document.getElementById("checkoutBtn");
const toast = document.getElementById("cartToast");

const cartRef = doc(db, "carts", user.uid);
let currentItems = [];
let saving = false;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

onSnapshot(cartRef, (snap) => {
  currentItems = snap.exists() ? (snap.data().items || []) : [];
  render();
}, (err) => showToast(err.message, true));

function render() {
  checkoutBtn.disabled = currentItems.length === 0 || saving;

  if (currentItems.length === 0) {
    cartItemsEl.innerHTML = `<p class="empty-state">YOUR CART IS EMPTY — <a href="../pharmacy/pharmacy.html">VISIT THE PHARMACY</a> TO ADD SOMETHING.</p>`;
    subtotalEl.textContent = "$0.00";
    return;
  }

  let subtotal = 0;
  cartItemsEl.innerHTML = currentItems.map((item) => {
    subtotal += item.price * item.qty;
    return `
      <div class="cart-item" data-id="${item.medId}">
        <div class="cart-item-image">
          <img src="${item.image || ""}" alt="${item.name}" onerror="this.style.display='none';">
        </div>
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <span>$${item.price.toFixed(2)} EACH</span>
        </div>
        <div class="cart-qty">
          <button type="button" data-action="dec" data-id="${item.medId}">−</button>
          <span>${item.qty}</span>
          <button type="button" data-action="inc" data-id="${item.medId}">+</button>
        </div>
        <button type="button" class="cart-item-remove" data-action="remove" data-id="${item.medId}">REMOVE</button>
      </div>
    `;
  }).join("");

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;

  cartItemsEl.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleAction(btn.dataset.action, btn.dataset.id));
  });

  window.wireCursorHoverTargets?.();
}

async function handleAction(action, medId) {
  const items = currentItems.map((i) => ({ ...i }));
  const idx = items.findIndex((i) => i.medId === medId);
  if (idx === -1) return;

  if (action === "inc") items[idx].qty += 1;
  if (action === "dec") items[idx].qty = Math.max(1, items[idx].qty - 1);
  if (action === "remove") items.splice(idx, 1);

  try {
    await setDoc(cartRef, { items, updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    showToast(err.message, true);
  }
}

checkoutBtn.addEventListener("click", async () => {
  if (currentItems.length === 0 || saving) return;
  saving = true;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "PLACING ORDER…";

  const total = currentItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  try {
    await addDoc(collection(db, "orders"), {
      userId: user.uid,
      customerEmail: user.email,
      items: currentItems,
      total,
      status: "PENDING",
      createdAt: serverTimestamp(),
    });

    await deleteDoc(cartRef);

    showToast("Order placed! Redirecting to your order history…");
    setTimeout(() => {
      window.location.href = "../history/history.html";
    }, 1200);
  } catch (err) {
    showToast(err.message, true);
    saving = false;
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "PROCEED TO CHECKOUT";
  }
});
