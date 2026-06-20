// chat/chat-widget.js - Floating live-chat bubble for signed-in customers
// Include on any customer-facing page (adjust basePath to page depth):
//   <link rel="stylesheet" href="../chat/chat-widget.css" />
//   <script type="module">
//     import { initChatWidget } from "../chat/chat-widget.js";
//     initChatWidget("../");
//   </script>

import { db } from "../firebase/firebase-config.js";
import { watchAuth } from "../firebase/auth-guard.js";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const PAGE_SIZE = 20;

export function initChatWidget(basePath = "") {
  /* ── Build the bubble + panel DOM once ────────────────────────────── */
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "chat-bubble";
  bubble.setAttribute("aria-label", "Open live chat");
  bubble.innerHTML = `CHAT<span class="chat-unread-dot" hidden></span>`;
  document.body.appendChild(bubble);

  const panel = document.createElement("div");
  panel.className = "chat-panel";
  panel.innerHTML = `
    <div class="chat-panel-head">
      <span>LIVE PHARMACIST CHAT</span>
      <button type="button" class="chat-panel-close" aria-label="Close chat">&times;</button>
    </div>
    <div class="chat-signed-out" hidden>
      <p>SIGN IN TO CHAT WITH OUR PHARMACIST.</p>
      <a href="${basePath}auth/auth.html" class="magnetic-btn">SIGN IN</a>
    </div>
    <div class="chat-signed-in" hidden>
      <button type="button" class="chat-load-more" hidden>LOAD EARLIER MESSAGES</button>
      <div class="chat-messages"></div>
      <form class="chat-input-row">
        <input type="text" placeholder="TYPE A MESSAGE…" autocomplete="off" />
        <button type="submit" aria-label="Send">SEND</button>
      </form>
    </div>
  `;
  document.body.appendChild(panel);

  const unreadDot = bubble.querySelector(".chat-unread-dot");
  const signedOutView = panel.querySelector(".chat-signed-out");
  const signedInView = panel.querySelector(".chat-signed-in");
  const messagesEl = panel.querySelector(".chat-messages");
  const loadMoreBtn = panel.querySelector(".chat-load-more");
  const form = panel.querySelector(".chat-input-row");
  const input = form.querySelector("input");

  bubble.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      unreadDot.hidden = true;
      markRead();
    }
  });
  panel.querySelector(".chat-panel-close").addEventListener("click", () => {
    panel.classList.remove("open");
  });

  let currentUser = null;
  let pageSize = PAGE_SIZE;
  let unsubscribeMessages = null;
  let unsubscribeThreadMeta = null;

  watchAuth((user) => {
    currentUser = user;

    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribeThreadMeta) unsubscribeThreadMeta();

    if (!user) {
      signedOutView.hidden = false;
      signedInView.hidden = true;
      unreadDot.hidden = true;
      return;
    }

    signedOutView.hidden = true;
    signedInView.hidden = false;
    pageSize = PAGE_SIZE;
    listenToThread();
    listenForUnread();
  });

  function listenToThread() {
    if (unsubscribeMessages) unsubscribeMessages();
    const msgsQuery = query(
      collection(db, "chats", currentUser.uid, "messages"),
      orderBy("timestamp", "desc"),
      limit(pageSize)
    );
    unsubscribeMessages = onSnapshot(msgsQuery, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
      loadMoreBtn.hidden = snapshot.docs.length < pageSize;
      renderMessages(msgs);
    }, (err) => console.warn("[chat-widget] message listener:", err.message));
  }

  function renderMessages(msgs) {
    messagesEl.innerHTML = msgs.map((m) => `
      <div class="chat-bubble-msg ${m.sender === "user" ? "from-user" : "from-pharmacist"}">${escapeHtml(m.text)}</div>
    `).join("");
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  loadMoreBtn.addEventListener("click", () => {
    pageSize += PAGE_SIZE;
    listenToThread();
  });

  function listenForUnread() {
    if (unsubscribeThreadMeta) unsubscribeThreadMeta();
    unsubscribeThreadMeta = onSnapshot(doc(db, "chats", currentUser.uid), (snap) => {
      const unread = snap.exists() && snap.data().unreadByUser;
      unreadDot.hidden = !unread || panel.classList.contains("open");
    }, () => { /* thread doc doesn't exist yet for a brand-new account — fine */ });
  }

  async function markRead() {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "chats", currentUser.uid), { unreadByUser: false });
    } catch {
      /* no thread yet — nothing to mark */
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !currentUser) return;
    input.value = "";

    try {
      await addDoc(collection(db, "chats", currentUser.uid, "messages"), {
        sender: "user",
        text,
        timestamp: serverTimestamp(),
      });

      const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
      const profile = profileSnap.exists() ? profileSnap.data() : {};

      await setDoc(doc(db, "chats", currentUser.uid), {
        customerName: profile.fullName || currentUser.email,
        customerEmail: currentUser.email,
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastSender: "user",
        unreadByAdmin: true,
        unreadByUser: false,
      }, { merge: true });
    } catch (err) {
      console.error("[chat-widget] could not send message:", err.message);
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
