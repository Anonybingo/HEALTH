# HEALTH CENTER — Online Pharmacy: Architecture & Setup

## Stack decision

**Firebase** (Auth + Firestore), no custom server.

Why: the site is static HTML/CSS/JS with no build step and nowhere it's currently
hosted with a backend. Firebase Authentication handles sign-up/login securely
without writing password hashing or session code, Firestore covers the
database (inventory, orders, chat) with built-in real-time listeners — perfect
for live chat without standing up WebSockets — and everything runs from the
browser via CDN imports, so the project stays a static site you can host
anywhere (Firebase Hosting, Netlify, GitHub Pages). A custom Node backend
would mean managing a server, a database, and your own auth/session logic —
more moving parts than this project needs right now.

## Folder convention

Every new page gets its own folder holding its own CSS/JS, matching the
existing `pharmacy/` pattern:

```
/
├── index.html
├── style/style.css            (shared global styles)
├── script/index.js            (shared homepage animation script)
├── firebase/                  (shared — not a page, used by every module)
│   ├── firebase-config.js
│   ├── auth-guard.js
│   ├── nav-auth.js
│   └── firestore.rules
├── auth/
│   ├── auth.html
│   ├── auth.css
│   └── auth.js
├── pharmacy/
│   ├── pharmacy.html
│   ├── pharmacy.css
│   ├── pharmacy.js
│   └── inventory.js
├── admin/                     (next up)
├── cart/                      (next up)
└── chat/                      (next up)
```

## Firestore schema

```
users/{uid}
  fullName, email, role: "customer" | "admin", createdAt

medicines/{medId}
  name, category, description, price, requiresPrescription,
  stock, image, icon
  (will replace the static array in inventory.js once the admin
  dashboard is built, so price/stock edits show up live)

orders/{orderId}
  userId, items: [{ medId, name, price, qty }], total,
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED",
  createdAt

chats/{userId}/messages/{messageId}
  sender: "user" | "pharmacist", text, timestamp
  (one thread per customer, keyed by their uid)
```

## Setup steps (do this before testing sign-up/login)

1. Go to **console.firebase.google.com** → **Add project** → name it
   (e.g. `health-center-pharmacy`) → finish creation (Analytics is optional).
2. Click the **`</>`** (web) icon to register a web app → copy the
   `firebaseConfig` object it shows you.
3. Paste those values into `firebase/firebase-config.js`, replacing the
   `YOUR_...` placeholders.
4. **Build → Authentication → Get started → Sign-in method** → enable
   **Email/Password**.
5. **Build → Firestore Database → Create database** → pick a region close
   to you.
6. Open the **Rules** tab → replace the default rules with the contents of
   `firebase/firestore.rules` → **Publish**.
7. Serve the site locally (see note below) and open `auth/auth.html` →
   create an account.
8. To make that account an **admin**: in the Firestore console, open the
   `users` collection → find your user document → change `role` from
   `"customer"` to `"admin"` → save.

### Important: run a local server, don't just double-click the HTML

The auth/admin/chat scripts use ES module imports, which browsers block
over `file://` for CORS reasons. Serve the folder locally instead, e.g.:

```
npx serve .
```
or the VS Code "Live Server" extension, then open `http://localhost:.../index.html`.

## Build roadmap

- [x] **User sign up / login** — Firebase Auth, profile doc with role, nav
      reflects signed-in state (`SIGN IN` → `MY ACCOUNT` / `ADMIN`)
- [x] **Admin dashboard** — manage medicines (price/stock/CRUD), view & update
      orders, manage user roles
- [ ] **Live chat** — customer ↔ pharmacist, Firestore real-time listeners
- [ ] **Shopping cart & checkout** — cart state, order placement

## What changed in this pass

### Auth phase
- Fixed a broken nav link in `index.html` (`pharmacy.html` → `pharmacy/pharmacy.html`)
- Added a `SIGN IN` nav item to `index.html` and `pharmacy/pharmacy.html` that
  becomes `MY ACCOUNT` / `ADMIN` once signed in
- Added the full `auth/` module and shared `firebase/` helpers

### Admin dashboard phase
- Added `admin/` — gated by `requireAdmin()`, three tabs:
  - **Inventory**: live Firestore-backed table, add/edit modal, delete with
    confirm, and a one-time **Seed Starter Catalogue** button that only shows
    while the `medicines` collection is empty
  - **Orders**: read-only list (will populate once checkout exists) with a
    status dropdown admins can already use
  - **Users**: lists everyone who's signed up, with a one-click role toggle
    (an admin can't demote themselves from this screen — that's intentional)
- `pharmacy/pharmacy.js` now reads the catalogue live from the `medicines`
  collection via `onSnapshot`, so admin price/stock edits show up on the
  storefront immediately. It falls back to the static array in `inventory.js`
  if Firestore has no data yet (e.g. before you've seeded it), so the page
  never looks broken during setup.
- Added `script/cursor.js` — the custom-cursor + magnetic-link effect, now
  shared instead of copy-pasted per page. `pharmacy.js` had accidentally
  picked up a full duplicate of the homepage's `index.js` (including dead
  code that referenced elements that don't exist on the pharmacy page and
  threw a console error on load) — that's been removed. The leaf-particle
  footer animation and scroll-reveal logic, which `pharmacy.html` actually
  uses, stayed in `pharmacy.js`.
- No `firestore.rules` changes needed — the original rules already grant
  admins full read/write on `medicines`, `orders`, and `users`.

No rules changes to re-publish this time — same `firestore.rules` as before.
