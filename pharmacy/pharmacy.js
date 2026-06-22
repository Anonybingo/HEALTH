// pharmacy/pharmacy.js - Local Module Logic
// Renders the static catalogue (pharmacyInventory, from inventory.js) and
// wires "Add to Cart" to a real per-customer cart doc in Firestore.

import { auth, db } from "../firebase/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const medicineGrid = document.getElementById('medicineGrid');
const filterBtns = document.querySelectorAll('.filter-btn');

function renderCatalogue(filterCategory = 'ALL') {
  if (!medicineGrid) return;

  medicineGrid.innerHTML = '';

  const filteredInventory = pharmacyInventory.filter(med => {
    if (filterCategory === 'ALL') return true;
    return med.category === filterCategory;
  });

  filteredInventory.forEach(med => {
    const rxBadge = med.requiresPrescription
      ? `<span class="badge prescription">RX REQUIRED</span>`
      : `<span class="badge otc">OTC APPROVED</span>`;

    const cardHTML = `
      <div class="med-card animate-card" data-id="${med.id}">
        <div class="shine"></div>
        <div class="med-header">
          <div class="med-icon">${med.icon}</div>
          <div class="med-price">$${med.price.toFixed(2)}</div>
        </div>
        
        <div class="med-image-container">
          <img src="${med.image}" alt="${med.name}" class="med-product-image" onerror="this.style.display='none';">
        </div>

        <div class="med-info">
          <h3>${med.name}</h3>
          <span class="med-category">${med.category}</span>
          <p class="med-desc">${med.description}</p>
        </div>
        <div class="med-badges">
          ${rxBadge}
        </div>
        <button class="add-to-cart-btn" data-add-to-cart="${med.id}">INITIALIZE ACQUISITION</button>
      </div>
    `;

    medicineGrid.insertAdjacentHTML('beforeend', cardHTML);
  });

  initializeMedicalCardTilt();
  wireAddToCartButtons();
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    filterBtns.forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const category = e.target.getAttribute('data-filter');
    renderCatalogue(category);
  });
});

function initializeMedicalCardTilt() {
  const medicalCards = document.querySelectorAll('.med-card');

  medicalCards.forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });

  // Cursor hover-expand on the new cards/buttons — script/cursor.js re-scans
  // for elements added after page load via window.wireCursorHoverTargets.
  window.wireCursorHoverTargets?.();
}

/* ── Add to Cart ──────────────────────────────────────────────────────
   Cart lives at carts/{uid} as a single doc: { items: [...], updatedAt }.
   No account yet → send them to sign in instead of silently failing. */
function wireAddToCartButtons() {
  document.querySelectorAll('[data-add-to-cart]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn));
  });
}

async function addToCart(btn) {
  const medId = btn.dataset.addToCart;
  const med = pharmacyInventory.find((m) => m.id === medId);
  if (!med) return;

  if (!auth.currentUser) {
    window.location.href = '../auth/auth.html';
    return;
  }

  btn.disabled = true;
  const originalLabel = btn.textContent;

  try {
    const cartRef = doc(db, 'carts', auth.currentUser.uid);
    const snap = await getDoc(cartRef);
    const items = snap.exists() ? (snap.data().items || []) : [];

    const existing = items.find((i) => i.medId === med.id);
    if (existing) {
      existing.qty += 1;
    } else {
      items.push({
        medId: med.id,
        name: med.name,
        price: med.price,
        image: med.image,
        qty: 1,
      });
    }

    await setDoc(cartRef, { items, updatedAt: serverTimestamp() }, { merge: true });

    btn.textContent = 'ADDED ✓';
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }, 1200);
  } catch (err) {
    console.error('[pharmacy] could not add to cart:', err.message);
    btn.textContent = 'TRY AGAIN';
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }, 1500);
  }
}

renderCatalogue('ALL');

/* ── Scroll reveal (pharmacy.html has .reveal elements) ───────────────── */
function reveal() {
  document.querySelectorAll('.reveal').forEach(el => {
    const visible = el.getBoundingClientRect().top < window.innerHeight - 150;
    el.classList.toggle('active', visible);
  });
}
window.addEventListener('scroll', reveal, { passive: true });
reveal();

/* ── Navbar hide-on-scroll ─────────────────────────────────────────── */
let lastScrollY = window.scrollY;
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  const currentScrollY = window.scrollY;
  if (navbar) {
    navbar.classList.toggle('navbar--hidden', currentScrollY > lastScrollY && currentScrollY > 50);
  }
  lastScrollY = currentScrollY;
});

/* ── Footer leaf particles ────────────────────────────────────────── */
class LeafParticle {
  constructor(canvas) {
    this.canvas = canvas;
    this.reset();
    this.y = Math.random() * canvas.height;
  }

  reset() {
    this.x = Math.random() * this.canvas.width;
    this.y = this.canvas.height + 20;
    this.size = Math.random() * 8 + 5;
    this.speedY = -(Math.random() * 0.7 + 0.3);
    this.speedX = Math.random() * 0.2 - 0.1;
    this.angle = Math.random() * Math.PI * 2;
    this.spin = Math.random() * 0.015 - 0.0075;
    this.swaySpeed = Math.random() * 0.015 + 0.005;
    this.swayOffset = Math.random() * Math.PI * 2;
    this.opacity = Math.random() * 0.3 + 0.15;
  }

  update() {
    this.y += this.speedY;
    this.swayOffset += this.swaySpeed;
    this.x += this.speedX + Math.sin(this.swayOffset) * 0.4;
    this.angle += this.spin;
    if (this.y < -20 || this.x < -20 || this.x > this.canvas.width + 20) this.reset();
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.bezierCurveTo(this.size * 0.6, -this.size * 0.4, this.size * 0.6, this.size * 0.4, 0, this.size);
    ctx.bezierCurveTo(-this.size * 0.6, this.size * 0.4, -this.size * 0.6, -this.size * 0.4, 0, -this.size);
    ctx.fillStyle = 'rgba(0, 255, 0)';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -this.size);
    ctx.lineTo(0, this.size);
    ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity * 0.3})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

const footerCanvas = document.getElementById('leafCanvas');
if (footerCanvas) {
  const footerCtx = footerCanvas.getContext('2d');
  const leaves = [];

  function resizeFooterCanvas() {
    const rect = footerCanvas.parentElement.getBoundingClientRect();
    footerCanvas.width = rect.width;
    footerCanvas.height = rect.height;
  }
  window.addEventListener('resize', resizeFooterCanvas);
  resizeFooterCanvas();

  for (let i = 0; i < 25; i++) leaves.push(new LeafParticle(footerCanvas));

  function animateLeaves() {
    footerCtx.clearRect(0, 0, footerCanvas.width, footerCanvas.height);
    leaves.forEach(leaf => { leaf.update(); leaf.draw(footerCtx); });
    requestAnimationFrame(animateLeaves);
  }
  animateLeaves();
}
