// history/history.js - Customer's own order history
import { db } from "../firebase/firebase-config.js";
import { requireAuth } from "../firebase/auth-guard.js";
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const { user } = await requireAuth({ redirectTo: "../auth/auth.html" });

const PAGE_SIZE = 10;
const ordersBody = document.getElementById("ordersBody");
const ordersCount = document.getElementById("ordersCount");
const loadMoreBtn = document.getElementById("ordersLoadMore");

let ordersLimit = PAGE_SIZE;
let unsubscribe = null;

function stockPillClass(status) {
  return `order-${(status || "pending").toLowerCase()}`;
}

function listenOrders() {
  if (unsubscribe) unsubscribe();
  // Filtered to this customer only, no orderBy in the query itself (avoids
  // needing a composite index) — sorted client-side after fetching instead.
  const q = query(collection(db, "orders"), where("userId", "==", user.uid), limit(ordersLimit));
  unsubscribe = onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    ordersCount.textContent = `${orders.length} ORDER${orders.length === 1 ? "" : "S"}`;
    loadMoreBtn.hidden = snapshot.docs.length < ordersLimit;

    if (orders.length === 0) {
      ordersBody.innerHTML = `<tr><td colspan="4" class="empty-state">NO ORDERS YET — <a href="../pharmacy/pharmacy.html">VISIT THE PHARMACY</a> TO GET STARTED.</td></tr>`;
      return;
    }

    ordersBody.innerHTML = orders.map((order) => `
      <tr>
        <td>${(order.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
        <td>$${Number(order.total || 0).toFixed(2)}</td>
        <td><span class="pill ${stockPillClass(order.status)}">${order.status || "PENDING"}</span></td>
        <td>${order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString() : "—"}</td>
      </tr>
    `).join("");
  });
}

loadMoreBtn.addEventListener("click", () => {
  ordersLimit += PAGE_SIZE;
  listenOrders();
});

listenOrders();
