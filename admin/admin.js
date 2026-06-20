// admin/admin.js - Admin dashboard: inventory CRUD, orders, users, live chat, password
import { db } from "../firebase/firebase-config.js";
import { requireAdmin, logout, changePassword } from "../firebase/auth-guard.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

/* ── Gate the page: redirects non-admins before anything renders ────── */
const { user } = await requireAdmin();
document.getElementById("adminEmail").textContent = user.email;

document.querySelector("[data-logout]")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.href = "../index.html";
});

/* ── Tab switching ────────────────────────────────────────────────── */
const tabs = document.querySelectorAll(".admin-tab");
const panels = document.querySelectorAll(".admin-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.panel;
    panels.forEach((p) => p.classList.toggle("active", p.id === `panel-${target}`));
  });
});

/* ── Toast helper ─────────────────────────────────────────────────── */
const toast = document.getElementById("adminToast");
let toastTimer;
function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ════════════════════════════════════════════════════════════════════
   INVENTORY  (paginated: loads in chunks of PAGE_SIZE, "Load More" grows it)
   ════════════════════════════════════════════════════════════════════ */
const INVENTORY_PAGE_SIZE = 10;
const inventoryBody = document.getElementById("inventoryBody");
const inventoryCount = document.getElementById("inventoryCount");
const inventoryLoadMore = document.getElementById("inventoryLoadMore");
const seedBtn = document.getElementById("seedBtn");
const addMedicineBtn = document.getElementById("addMedicineBtn");

// Matches the original pharmacy/inventory.js — used once, only if the
// medicines collection is still empty, to give the catalogue a head start.
const STARTER_MEDICINES = [
  {
    name: "NEURO-STIM ALPHA",
    category: "SUPPLEMENT",
    description: "COGNITIVE ENHANCEMENT MATRIX. IMPROVES FOCUS AND MEMORY RETENTION.",
    price: 45.99,
    requiresPrescription: false,
    stock: "IN STOCK",
    image: "assets/medicines/neuro_stim.png",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/><path d="M12 6v6l4 2"/></svg>`,
  },
  {
    name: "CARDIO-BETA BLOCKER",
    category: "CHRONIC CARE",
    description: "ADVANCED HYPERTENSION MANAGEMENT. REGULATES HEART RHYTHM.",
    price: 120.50,
    requiresPrescription: true,
    stock: "LOW STOCK",
    image: "assets/medicines/cardio_block.png",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>`,
  },
  {
    name: "IMMUNO-SHIELD PRO",
    category: "VITAMINS",
    description: "HIGH-DOSE VITAMIN C & ZINC COMPLEX FOR IMMUNE SYSTEM FORTIFICATION.",
    price: 29.99,
    requiresPrescription: false,
    stock: "IN STOCK",
    image: "assets/medicines/immuno_shield.png",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  },
  {
    name: "SYNTHETIC INSULIN XR",
    category: "CHRONIC CARE",
    description: "EXTENDED-RELEASE GLUCOSE REGULATION PROTOCOL.",
    price: 85.00,
    requiresPrescription: true,
    stock: "IN STOCK",
    image: "assets/medicines/insulin_xr.png",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>`,
  },
];

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="18" height="6" rx="3"/><path d="M9 9v6M15 9v6"/></svg>`;

function stockPillClass(stock) {
  if (stock === "IN STOCK") return "stock-in";
  if (stock === "LOW STOCK") return "stock-low";
  return "stock-out";
}

let inventoryCache = [];
let inventoryLimit = INVENTORY_PAGE_SIZE;
let unsubInventory = null;

function listenInventory() {
  if (unsubInventory) unsubInventory();
  const q = query(collection(db, "medicines"), orderBy("name"), limit(inventoryLimit));
  unsubInventory = onSnapshot(q, (snapshot) => {
    inventoryCache = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    inventoryLoadMore.hidden = snapshot.docs.length < inventoryLimit;
    renderInventory();
  }, (err) => showToast(err.message, true));
}

inventoryLoadMore.addEventListener("click", () => {
  inventoryLimit += INVENTORY_PAGE_SIZE;
  listenInventory();
});

function renderInventory() {
  inventoryCount.textContent = `${inventoryCache.length} ITEM${inventoryCache.length === 1 ? "" : "S"}`;
  seedBtn.hidden = inventoryCache.length > 0;

  if (inventoryCache.length === 0) {
    inventoryBody.innerHTML = `<tr><td colspan="6" class="empty-state">NO MEDICINES YET — ADD ONE OR SEED THE STARTER CATALOGUE.</td></tr>`;
    return;
  }

  inventoryBody.innerHTML = inventoryCache.map((med) => `
    <tr>
      <td class="row-name">${escapeHtml(med.name)}</td>
      <td>${escapeHtml(med.category)}</td>
      <td>$${Number(med.price).toFixed(2)}</td>
      <td><span class="pill ${stockPillClass(med.stock)}">${escapeHtml(med.stock)}</span></td>
      <td>${med.requiresPrescription ? "RX" : "OTC"}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="row-btn" data-edit="${med.id}">EDIT</button>
          <button type="button" class="row-btn danger" data-delete="${med.id}">DELETE</button>
        </div>
      </td>
    </tr>
  `).join("");

  inventoryBody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openMedicineModal(inventoryCache.find((m) => m.id === btn.dataset.edit)));
  });
  inventoryBody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMedicine(btn.dataset.delete));
  });

  window.wireCursorHoverTargets?.();
}

async function deleteMedicine(id) {
  const med = inventoryCache.find((m) => m.id === id);
  if (!confirm(`Delete "${med?.name}"? This can't be undone.`)) return;
  try {
    await deleteDoc(doc(db, "medicines", id));
    showToast("Medicine deleted.");
  } catch (err) {
    showToast(err.message, true);
  }
}

seedBtn.addEventListener("click", async () => {
  seedBtn.disabled = true;
  try {
    const batch = writeBatch(db);
    STARTER_MEDICINES.forEach((med) => {
      const ref = doc(collection(db, "medicines"));
      batch.set(ref, { ...med, createdAt: serverTimestamp() });
    });
    await batch.commit();
    showToast("Starter catalogue seeded.");
  } catch (err) {
    showToast(err.message, true);
    seedBtn.disabled = false;
  }
});

/* ── Add / Edit medicine modal ───────────────────────────────────────── */
const overlay = document.getElementById("medicineModalOverlay");
const modalTitle = document.getElementById("medicineModalTitle");
const form = document.getElementById("medicineForm");
const fields = {
  id: document.getElementById("medicineId"),
  name: document.getElementById("medName"),
  category: document.getElementById("medCategory"),
  description: document.getElementById("medDescription"),
  price: document.getElementById("medPrice"),
  rx: document.getElementById("medRx"),
  stock: document.getElementById("medStock"),
  image: document.getElementById("medImage"),
};

function openMedicineModal(med = null) {
  form.reset();
  if (med) {
    modalTitle.textContent = "EDIT MEDICINE";
    fields.id.value = med.id;
    fields.name.value = med.name;
    fields.category.value = med.category;
    fields.description.value = med.description;
    fields.price.value = med.price;
    fields.rx.checked = !!med.requiresPrescription;
    fields.stock.value = med.stock;
    fields.image.value = med.image || "";
  } else {
    modalTitle.textContent = "ADD MEDICINE";
    fields.id.value = "";
  }
  overlay.classList.add("open");
}

function closeMedicineModal() {
  overlay.classList.remove("open");
}

addMedicineBtn.addEventListener("click", () => openMedicineModal());
document.getElementById("closeMedicineModal").addEventListener("click", closeMedicineModal);
overlay.addEventListener("click", (e) => {
  if (e.target === overlay) closeMedicineModal();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("medicineSubmitBtn");
  submitBtn.disabled = true;

  const payload = {
    name: fields.name.value.trim(),
    category: fields.category.value,
    description: fields.description.value.trim(),
    price: parseFloat(fields.price.value),
    requiresPrescription: fields.rx.checked,
    stock: fields.stock.value,
    image: fields.image.value.trim(),
  };

  try {
    if (fields.id.value) {
      await updateDoc(doc(db, "medicines", fields.id.value), payload);
      showToast("Medicine updated.");
    } else {
      await addDoc(collection(db, "medicines"), {
        ...payload,
        icon: DEFAULT_ICON,
        createdAt: serverTimestamp(),
      });
      showToast("Medicine added.");
    }
    closeMedicineModal();
  } catch (err) {
    showToast(err.message, true);
  } finally {
    submitBtn.disabled = false;
  }
});

listenInventory();

/* ════════════════════════════════════════════════════════════════════
   ORDERS  (paginated)
   ════════════════════════════════════════════════════════════════════ */
const ORDERS_PAGE_SIZE = 10;
const ordersBody = document.getElementById("ordersBody");
const ordersCount = document.getElementById("ordersCount");
const ordersLoadMore = document.getElementById("ordersLoadMore");

let ordersLimit = ORDERS_PAGE_SIZE;
let unsubOrders = null;

function listenOrders() {
  if (unsubOrders) unsubOrders();
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"), limit(ordersLimit));
  unsubOrders = onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    ordersCount.textContent = `${orders.length} ORDER${orders.length === 1 ? "" : "S"}`;
    ordersLoadMore.hidden = snapshot.docs.length < ordersLimit;

    if (orders.length === 0) {
      ordersBody.innerHTML = `<tr><td colspan="5" class="empty-state">NO ORDERS YET — THE CHECKOUT MODULE IS NEXT UP.</td></tr>`;
      return;
    }

    ordersBody.innerHTML = orders.map((order) => `
      <tr>
        <td>${escapeHtml(order.customerEmail || order.userId)}</td>
        <td>${(order.items || []).length} ITEM${(order.items || []).length === 1 ? "" : "S"}</td>
        <td>$${Number(order.total || 0).toFixed(2)}</td>
        <td>
          <select class="status-select" data-order="${order.id}">
            ${["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"].map((s) =>
              `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`
            ).join("")}
          </select>
        </td>
        <td>${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : "—"}</td>
      </tr>
    `).join("");

    ordersBody.querySelectorAll("[data-order]").forEach((select) => {
      select.addEventListener("change", async () => {
        try {
          await updateDoc(doc(db, "orders", select.dataset.order), { status: select.value });
          showToast("Order status updated.");
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    window.wireCursorHoverTargets?.();
  }, (err) => showToast(err.message, true));
}

ordersLoadMore.addEventListener("click", () => {
  ordersLimit += ORDERS_PAGE_SIZE;
  listenOrders();
});

listenOrders();

/* ════════════════════════════════════════════════════════════════════
   USERS  (paginated)
   ════════════════════════════════════════════════════════════════════ */
const USERS_PAGE_SIZE = 10;
const usersBody = document.getElementById("usersBody");
const usersCount = document.getElementById("usersCount");
const usersLoadMore = document.getElementById("usersLoadMore");

let usersLimit = USERS_PAGE_SIZE;
let unsubUsers = null;

function listenUsers() {
  if (unsubUsers) unsubUsers();
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(usersLimit));
  unsubUsers = onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    usersCount.textContent = `${users.length} ACCOUNT${users.length === 1 ? "" : "S"}`;
    usersLoadMore.hidden = snapshot.docs.length < usersLimit;

    if (users.length === 0) {
      usersBody.innerHTML = `<tr><td colspan="5" class="empty-state">NO ACCOUNTS YET.</td></tr>`;
      return;
    }

    usersBody.innerHTML = users.map((u) => `
      <tr>
        <td class="row-name">${escapeHtml(u.fullName) || "—"}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="pill ${u.role === "admin" ? "role-admin" : "role-customer"}">${escapeHtml(u.role || "customer")}</span></td>
        <td>${u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "—"}</td>
        <td>
          <div class="row-actions">
            <button type="button" class="row-btn" data-toggle-role="${u.id}" data-current-role="${u.role || "customer"}"
              ${u.id === user.uid ? 'disabled title="You cannot change your own role here"' : ""}>
              ${u.role === "admin" ? "MAKE CUSTOMER" : "MAKE ADMIN"}
            </button>
          </div>
        </td>
      </tr>
    `).join("");

    usersBody.querySelectorAll("[data-toggle-role]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nextRole = btn.dataset.currentRole === "admin" ? "customer" : "admin";
        try {
          await updateDoc(doc(db, "users", btn.dataset.toggleRole), { role: nextRole });
          showToast(`Role updated to ${nextRole}.`);
        } catch (err) {
          showToast(err.message, true);
        }
      });
    });

    window.wireCursorHoverTargets?.();
  }, (err) => showToast(err.message, true));
}

usersLoadMore.addEventListener("click", () => {
  usersLimit += USERS_PAGE_SIZE;
  listenUsers();
});

listenUsers();

/* ════════════════════════════════════════════════════════════════════
   LIVE CHAT  (conversation list + messages, both paginated)
   ════════════════════════════════════════════════════════════════════ */
const CHAT_LIST_PAGE_SIZE = 12;
const CHAT_MSG_PAGE_SIZE = 25;

const chatListEl = document.getElementById("chatList");
const chatListLoadMore = document.getElementById("chatListLoadMore");
const chatEmptyState = document.getElementById("chatEmptyState");
const chatActiveView = document.getElementById("chatActiveView");
const chatActiveName = document.getElementById("chatActiveName");
const chatMessagesAdmin = document.getElementById("chatMessagesAdmin");
const chatMsgLoadMore = document.getElementById("chatMsgLoadMore");
const chatReplyForm = document.getElementById("chatReplyForm");
const chatReplyInput = document.getElementById("chatReplyInput");

let chatListLimit = CHAT_LIST_PAGE_SIZE;
let unsubChatList = null;
let activeCustomerId = null;
let chatMsgLimit = CHAT_MSG_PAGE_SIZE;
let unsubActiveChat = null;

function listenChatList() {
  if (unsubChatList) unsubChatList();
  const q = query(collection(db, "chats"), orderBy("lastMessageAt", "desc"), limit(chatListLimit));
  unsubChatList = onSnapshot(q, (snapshot) => {
    const threads = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    chatListLoadMore.hidden = snapshot.docs.length < chatListLimit;
    renderChatList(threads);
  }, (err) => showToast(err.message, true));
}

function renderChatList(threads) {
  if (threads.length === 0) {
    chatListEl.innerHTML = `<p class="empty-state">NO CONVERSATIONS YET.</p>`;
    return;
  }

  chatListEl.innerHTML = threads.map((t) => `
    <button type="button" class="chat-thread-btn ${t.id === activeCustomerId ? "active" : ""}" data-thread="${t.id}" data-name="${escapeHtml(t.customerName || t.customerEmail || t.id)}">
      <span class="chat-thread-name">${escapeHtml(t.customerName || t.customerEmail || t.id)}</span>
      <span class="chat-thread-preview">${escapeHtml(t.lastMessage || "")}</span>
      ${t.unreadByAdmin ? '<span class="chat-thread-dot"></span>' : ""}
    </button>
  `).join("");

  chatListEl.querySelectorAll("[data-thread]").forEach((btn) => {
    btn.addEventListener("click", () => openThread(btn.dataset.thread, btn.dataset.name));
  });

  window.wireCursorHoverTargets?.();
}

chatListLoadMore.addEventListener("click", () => {
  chatListLimit += CHAT_LIST_PAGE_SIZE;
  listenChatList();
});

function openThread(customerId, name) {
  activeCustomerId = customerId;
  chatMsgLimit = CHAT_MSG_PAGE_SIZE;
  chatActiveView.hidden = false;
  chatEmptyState.hidden = true;
  chatActiveName.textContent = name;

  updateDoc(doc(db, "chats", customerId), { unreadByAdmin: false }).catch(() => {});

  listenActiveThread();
}

function listenActiveThread() {
  if (unsubActiveChat) unsubActiveChat();
  const q = query(
    collection(db, "chats", activeCustomerId, "messages"),
    orderBy("timestamp", "desc"),
    limit(chatMsgLimit)
  );
  unsubActiveChat = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    chatMsgLoadMore.hidden = snapshot.docs.length < chatMsgLimit;
    chatMessagesAdmin.innerHTML = msgs.map((m) => `
      <div class="chat-bubble-msg ${m.sender === "pharmacist" ? "from-pharmacist" : "from-user"}">${escapeHtml(m.text)}</div>
    `).join("");
    chatMessagesAdmin.scrollTop = chatMessagesAdmin.scrollHeight;
  }, (err) => showToast(err.message, true));
}

chatMsgLoadMore.addEventListener("click", () => {
  chatMsgLimit += CHAT_MSG_PAGE_SIZE;
  listenActiveThread();
});

chatReplyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatReplyInput.value.trim();
  if (!text || !activeCustomerId) return;
  chatReplyInput.value = "";

  try {
    await addDoc(collection(db, "chats", activeCustomerId, "messages"), {
      sender: "pharmacist",
      text,
      timestamp: serverTimestamp(),
    });
    await updateDoc(doc(db, "chats", activeCustomerId), {
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastSender: "pharmacist",
      unreadByUser: true,
      unreadByAdmin: false,
    });
  } catch (err) {
    showToast(err.message, true);
  }
});

listenChatList();

/* ════════════════════════════════════════════════════════════════════
   CHANGE PASSWORD
   ════════════════════════════════════════════════════════════════════
   Firebase Auth salts + hashes passwords (scrypt) on its own servers —
   plaintext is never stored anywhere, including here. This just rotates
   the credential through Firebase, after confirming the current one. */
const pwOverlay = document.getElementById("passwordModalOverlay");
const pwForm = document.getElementById("passwordForm");

document.getElementById("changePasswordBtn").addEventListener("click", () => {
  pwForm.reset();
  pwOverlay.classList.add("open");
});
document.getElementById("closePasswordModal").addEventListener("click", () => {
  pwOverlay.classList.remove("open");
});
pwOverlay.addEventListener("click", (e) => {
  if (e.target === pwOverlay) pwOverlay.classList.remove("open");
});

pwForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const current = document.getElementById("pwCurrent").value;
  const next = document.getElementById("pwNew").value;
  const confirmVal = document.getElementById("pwConfirm").value;

  if (next !== confirmVal) {
    showToast("New passwords don't match.", true);
    return;
  }

  const submitBtn = document.getElementById("passwordSubmitBtn");
  submitBtn.disabled = true;

  try {
    await changePassword(current, next);
    showToast("Password updated.");
    pwOverlay.classList.remove("open");
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
