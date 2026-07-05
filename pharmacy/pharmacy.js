// pharmacy/pharmacy.js
import { auth, db } from "../firebase/firebase-config.js";
import {
  collection, doc, getDoc, setDoc, addDoc,
  query, orderBy, limit, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const PAGE_SIZE     = 12;
const medicineGrid  = document.getElementById("medicineGrid");
const filterBtns    = document.querySelectorAll(".filter-btn");
const DEFAULT_ICON  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="18" height="6" rx="3"/><path d="M9 9v6M15 9v6"/></svg>`;

let currentMedicines = [];
let activeFilter     = "ALL";
let catalogueLimit   = PAGE_SIZE;
let hasMore          = false;
let unsubMeds        = null;

// ── Load-More button — declared FIRST so renderCatalogue can reference it ──
let loadMoreBtn = document.getElementById("catalogueLoadMore");
if (!loadMoreBtn && medicineGrid) {
  loadMoreBtn = document.createElement("button");
  loadMoreBtn.type      = "button";
  loadMoreBtn.id        = "catalogueLoadMore";
  loadMoreBtn.className = "load-more-btn";
  loadMoreBtn.textContent = "LOAD MORE";
  loadMoreBtn.hidden    = true;
  medicineGrid.insertAdjacentElement("afterend", loadMoreBtn);
}
loadMoreBtn?.addEventListener("click", () => {
  catalogueLimit += PAGE_SIZE;
  listenCatalogue();
});

// ── Static fallback — runs immediately while Firestore loads ──────────
const staticData = (typeof pharmacyInventory !== "undefined" && pharmacyInventory.length)
  ? pharmacyInventory
  : [];
if (staticData.length) {
  currentMedicines = staticData;
  renderCatalogue();
}

// ── Firestore live subscription ───────────────────────────────────────
function listenCatalogue() {
  if (unsubMeds) unsubMeds();
  const q = query(collection(db, "medicines"), orderBy("name"), limit(catalogueLimit));
  unsubMeds = onSnapshot(q, (snap) => {
    if (!snap.empty) {
      currentMedicines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      hasMore = snap.docs.length >= catalogueLimit;
    } else {
      currentMedicines = staticData;
      hasMore = false;
    }
    renderCatalogue();
  }, (err) => {
    console.error("[pharmacy] Firestore error:", err.message);
    // Firestore blocked (e.g. Brave shields) — static data still shows
    if (!currentMedicines.length && staticData.length) {
      currentMedicines = staticData;
      renderCatalogue();
    }
  });
}
listenCatalogue();

// ── Filter buttons ────────────────────────────────────────────────────
filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderCatalogue();
  });
});

// ── Render ────────────────────────────────────────────────────────────
function renderCatalogue() {
  if (!medicineGrid) return;

  const filtered = activeFilter === "ALL"
    ? currentMedicines
    : currentMedicines.filter((m) => m.category === activeFilter);

  if (loadMoreBtn) loadMoreBtn.hidden = !hasMore;

  if (!filtered.length) {
    medicineGrid.innerHTML = `<p class="empty-state">NO ITEMS IN THIS CATEGORY YET.</p>`;
    medicineGrid.classList.add("active");
    return;
  }

  medicineGrid.innerHTML = filtered.map((med) => {
    const id = med.id || "";
    return `
    <div class="med-card" data-id="${id}">
      <div class="shine"></div>
      <div class="med-header">
        <div class="med-icon">${med.icon || DEFAULT_ICON}</div>
        <div class="med-price">$${Number(med.price).toFixed(2)}</div>
      </div>
      <div class="med-image-container">
        <img src="${med.image || ""}" alt="${med.name}" class="med-product-image" onerror="this.style.display='none';">
      </div>
      <div class="med-info">
        <h3>${med.name}</h3>
        <span class="med-category">${med.category}</span>
        <p class="med-desc">${med.description}</p>
      </div>
      <div class="med-badges">
        ${med.requiresPrescription
          ? `<span class="badge prescription">RX REQUIRED</span>`
          : `<span class="badge otc">OTC APPROVED</span>`}
      </div>
      <div class="med-actions">
        <button class="med-btn-buy"  data-buy="${id}">BUY</button>
        <button class="med-btn-cart" data-add-to-cart="${id}">ADD TO CART</button>
      </div>
      <div class="med-buy-feedback" id="fb-${id}" hidden></div>
    </div>`;
  }).join("");

  // Force the grid visible immediately (don't wait for scroll-reveal)
  medicineGrid.classList.add("active");

  // Wire buttons
  medicineGrid.querySelectorAll("[data-buy]").forEach((b) =>
    b.addEventListener("click", () => handleBuy(b)));
  medicineGrid.querySelectorAll("[data-add-to-cart]").forEach((b) =>
    b.addEventListener("click", () => handleCart(b)));

  // Shine effect
  medicineGrid.querySelectorAll(".med-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
    });
  });

  window.wireCursorHoverTargets?.();
}

// ── BUY ───────────────────────────────────────────────────────────────
async function handleBuy(btn) {
  const med = currentMedicines.find((m) => (m.id || "") === btn.dataset.buy);
  if (!med) return;
  if (!auth.currentUser) { window.location.href = "../auth/auth.html"; return; }

  btn.disabled = true;
  try {
    await addDoc(collection(db, "orders"), {
      userId:        auth.currentUser.uid,
      customerEmail: auth.currentUser.email,
      items: [{ medId: med.id || "", name: med.name, price: med.price, image: med.image || "", qty: 1 }],
      total:         med.price,
      status:        "PENDING",
      createdAt:     serverTimestamp(),
    });
    const fb = document.getElementById(`fb-${med.id || ""}`);
    if (fb) {
      fb.textContent = "✓ ORDER PLACED — CHECK YOUR ORDER HISTORY";
      fb.hidden = false;
      setTimeout(() => { fb.hidden = true; btn.disabled = false; }, 4000);
    }
  } catch (err) {
    console.error("[pharmacy] buy failed:", err.message);
    btn.disabled = false;
  }
}

// ── ADD TO CART ───────────────────────────────────────────────────────
async function handleCart(btn) {
  const med = currentMedicines.find((m) => (m.id || "") === btn.dataset.addToCart);
  if (!med) return;
  if (!auth.currentUser) { window.location.href = "../auth/auth.html"; return; }

  btn.disabled = true;
  const orig = btn.textContent;
  try {
    const cartRef  = doc(db, "carts", auth.currentUser.uid);
    const snap     = await getDoc(cartRef);
    const items    = snap.exists() ? (snap.data().items || []) : [];
    const existing = items.find((i) => i.medId === (med.id || ""));
    if (existing) { existing.qty += 1; }
    else { items.push({ medId: med.id || "", name: med.name, price: med.price, image: med.image || "", qty: 1 }); }
    await setDoc(cartRef, { items, updatedAt: serverTimestamp() }, { merge: true });
    btn.textContent = "ADDED ✓";
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
  } catch (err) {
    console.error("[pharmacy] cart failed:", err.message);
    btn.textContent = "TRY AGAIN";
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
  }
}

// ── Scroll reveal ─────────────────────────────────────────────────────
function reveal() {
  document.querySelectorAll(".reveal").forEach((el) => {
    el.classList.toggle("active", el.getBoundingClientRect().top < window.innerHeight - 150);
  });
}
window.addEventListener("scroll", reveal, { passive: true });
reveal();

// ── Navbar hide-on-scroll ─────────────────────────────────────────────
let lastScrollY = window.scrollY;
const navbar = document.querySelector(".navbar");
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (navbar) navbar.classList.toggle("navbar--hidden", y > lastScrollY && y > 50);
  lastScrollY = y;
});

// ── Footer leaf particles ─────────────────────────────────────────────
class Leaf {
  constructor(c) { this.c = c; this.reset(); this.y = Math.random() * c.height; }
  reset() {
    this.x = Math.random() * this.c.width; this.y = this.c.height + 20;
    this.size = Math.random() * 8 + 5; this.speedY = -(Math.random() * 0.7 + 0.3);
    this.speedX = Math.random() * 0.2 - 0.1; this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.015 - 0.0075;
    this.swaySpeed = Math.random() * 0.015 + 0.005;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.opacity = Math.random() * 0.3 + 0.15;
  }
  update() {
    this.y += this.speedY; this.swayOffset += this.swaySpeed;
    this.x += this.speedX + Math.sin(this.swayOffset) * 0.4; this.angle += this.spin;
    if (this.y < -20 || this.x < -20 || this.x > this.c.width + 20) this.reset();
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.bezierCurveTo(this.size*.6,-this.size*.4,this.size*.6,this.size*.4,0,this.size);
    ctx.bezierCurveTo(-this.size*.6,this.size*.4,-this.size*.6,-this.size*.4,0,-this.size);
    ctx.fillStyle = "rgba(0,255,0)"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,-this.size); ctx.lineTo(0,this.size);
    ctx.strokeStyle = `rgba(0,0,0,${this.opacity*.3})`; ctx.lineWidth=1; ctx.stroke();
    ctx.restore();
  }
}
const fc = document.getElementById("leafCanvas");
if (fc) {
  const ctx = fc.getContext("2d"); const leaves = [];
  const resize = () => { const r=fc.parentElement.getBoundingClientRect(); fc.width=r.width; fc.height=r.height; };
  window.addEventListener("resize", resize); resize();
  for (let i=0;i<25;i++) leaves.push(new Leaf(fc));
  (function anim(){ ctx.clearRect(0,0,fc.width,fc.height); leaves.forEach(l=>{l.update();l.draw(ctx);}); requestAnimationFrame(anim); })();
}
