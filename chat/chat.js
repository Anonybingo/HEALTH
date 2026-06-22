// chat/chat.js - Full-page live chat with the pharmacist
import { db } from "../firebase/firebase-config.js";
import { requireAuth } from "../firebase/auth-guard.js";
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

const { user } = await requireAuth({ redirectTo: "../auth/auth.html" });

const PAGE_SIZE = 25;
const messagesEl = document.getElementById("chatMessages");
const loadMoreBtn = document.getElementById("chatLoadMore");
const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");

let pageSize = PAGE_SIZE;
let unsubscribeMessages = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function listenToThread() {
  if (unsubscribeMessages) unsubscribeMessages();
  const q = query(
    collection(db, "chats", user.uid, "messages"),
    orderBy("timestamp", "desc"),
    limit(pageSize)
  );
  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    loadMoreBtn.hidden = snapshot.docs.length < pageSize;
    renderMessages(msgs);
  }, (err) => console.warn("[chat] message listener:", err.message));
}

function renderMessages(msgs) {
  if (msgs.length === 0) {
    messagesEl.innerHTML = `<p class="empty-state">NO MESSAGES YET — SAY HELLO TO YOUR PHARMACIST.</p>`;
    return;
  }
  messagesEl.innerHTML = msgs.map((m) => `
    <div class="chat-bubble-msg ${m.sender === "user" ? "from-user" : "from-pharmacist"}">${escapeHtml(m.text)}</div>
  `).join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

loadMoreBtn.addEventListener("click", () => {
  pageSize += PAGE_SIZE;
  listenToThread();
});

listenToThread();

// Mark as read whenever the page is open and the pharmacist has replied.
onSnapshot(doc(db, "chats", user.uid), (snap) => {
  if (snap.exists() && snap.data().unreadByUser) {
    updateDoc(doc(db, "chats", user.uid), { unreadByUser: false }).catch(() => {});
  }
}, () => { /* no thread yet — nothing to mark */ });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  try {
    await addDoc(collection(db, "chats", user.uid, "messages"), {
      sender: "user",
      text,
      timestamp: serverTimestamp(),
    });

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};

    await setDoc(doc(db, "chats", user.uid), {
      customerName: profile.fullName || user.email,
      customerEmail: user.email,
      lastMessage: text,
      lastMessageAt: serverTimestamp(),
      lastSender: "user",
      unreadByAdmin: true,
      unreadByUser: false,
    }, { merge: true });
  } catch (err) {
    console.error("[chat] could not send message:", err.message);
  }
});
