// chat/chat.js
import { db } from "../firebase/firebase-config.js";
import { requireAuth } from "../firebase/auth-guard.js";
import {
  doc, setDoc, getDoc, addDoc, collection,
  onSnapshot, query, orderBy, limit, serverTimestamp, updateDoc,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { VoiceRecorder, blobToBase64, formatDuration, ICONS } from "./voice-recorder.js";

const { user } = await requireAuth({ redirectTo: "../auth/auth.html" });

const PAGE_SIZE   = 25;
const messagesEl  = document.getElementById("chatMessages");
const loadMoreBtn = document.getElementById("chatLoadMore");
const form        = document.getElementById("chatForm");
const input       = document.getElementById("chatInput");
const recordBtn   = document.getElementById("voiceRecordBtn");
const recordingBar= document.getElementById("voiceRecordingBar");
const voiceTimer  = document.getElementById("voiceTimer");
const cancelBtn   = document.getElementById("voiceCancelBtn");

recordBtn.innerHTML = ICONS.mic;

let pageSize = PAGE_SIZE;
let unsubscribeMessages = null;
const recorder = new VoiceRecorder();
let recordingCancelled = false;

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

/* ── Render bars for a static waveform look (not real amplitude, just decorative) ── */
function waveformBars(seed = 12) {
  let html = "";
  for (let i = 0; i < seed; i++) {
    const h = 6 + Math.round(Math.sin(i * 1.7) * 6 + 6);
    html += `<span style="height:${h}px"></span>`;
  }
  return html;
}

/* ── Message rendering ─────────────────────────────────────────────── */
function renderMessages(msgs) {
  if (!msgs.length) {
    messagesEl.innerHTML = `<p class="empty-state">NO MESSAGES YET — SAY HELLO TO YOUR PHARMACIST.</p>`;
    return;
  }
  messagesEl.innerHTML = msgs.map((m) => {
    const fromClass = m.sender === "user" ? "from-user" : "from-pharmacist";
    if (m.type === "voice") {
      return `
        <div class="voice-bubble ${fromClass}" data-audio="${m.audioData}">
          <button type="button" class="voice-play-btn" data-play>${ICONS.play}</button>
          <div class="voice-waveform">${waveformBars()}</div>
          <span class="voice-duration">${formatDuration(m.duration || 0)}</span>
        </div>`;
    }
    return `<div class="chat-bubble-msg ${fromClass}">${escapeHtml(m.text)}</div>`;
  }).join("");

  // Wire playback for every voice bubble
  messagesEl.querySelectorAll(".voice-bubble").forEach((bubble) => {
    const playBtn = bubble.querySelector("[data-play]");
    let audio = null;
    playBtn.addEventListener("click", () => {
      if (!audio) {
        audio = new Audio(bubble.dataset.audio);
        audio.addEventListener("ended", () => { playBtn.innerHTML = ICONS.play; });
      }
      if (audio.paused) {
        // Pause any other currently-playing voice note first
        document.querySelectorAll(".voice-play-btn").forEach((b) => { if (b !== playBtn) b.innerHTML = ICONS.play; });
        audio.play();
        playBtn.innerHTML = ICONS.pause;
      } else {
        audio.pause();
        playBtn.innerHTML = ICONS.play;
      }
    });
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function listenToThread() {
  if (unsubscribeMessages) unsubscribeMessages();
  const q = query(collection(db, "chats", user.uid, "messages"), orderBy("timestamp", "desc"), limit(pageSize));
  unsubscribeMessages = onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
    loadMoreBtn.hidden = snap.docs.length < pageSize;
    renderMessages(msgs);
  }, (err) => console.warn("[chat] message listener:", err.message));
}
loadMoreBtn.addEventListener("click", () => { pageSize += PAGE_SIZE; listenToThread(); });
listenToThread();

// Mark read when the pharmacist has replied and this page is open
onSnapshot(doc(db, "chats", user.uid), (snap) => {
  if (snap.exists() && snap.data().unreadByUser) {
    updateDoc(doc(db, "chats", user.uid), { unreadByUser: false }).catch(() => {});
  }
}, () => {});

/* ── Updates the chat's parent doc so the admin's conversation list + unread dot work ── */
async function touchThreadMeta(previewText, sender) {
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  const profile = profileSnap.exists() ? profileSnap.data() : {};
  await setDoc(doc(db, "chats", user.uid), {
    customerName:  profile.fullName || user.email,
    customerEmail: user.email,
    lastMessage:   previewText,
    lastMessageAt: serverTimestamp(),
    lastSender:    sender,
    unreadByAdmin: true,
    unreadByUser:  false,
  }, { merge: true });
}

/* ── Text message send ──────────────────────────────────────────────── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  try {
    await addDoc(collection(db, "chats", user.uid, "messages"), {
      sender: "user", type: "text", text, timestamp: serverTimestamp(),
    });
    await touchThreadMeta(text, "user");
  } catch (err) {
    console.error("[chat] could not send message:", err.message);
  }
});

/* ── Voice recording ────────────────────────────────────────────────── */
recordBtn.addEventListener("click", async () => {
  if (recorder.isRecording) {
    await finishRecording();
    return;
  }
  recordingCancelled = false;
  const granted = await recorder.start((secs) => {
    voiceTimer.textContent = formatDuration(secs);
  });
  if (!granted) {
    alert("Microphone access was denied. Please allow microphone access to send a voice message.");
    return;
  }
  input.hidden = true;
  recordingBar.classList.add("active");
  recordBtn.classList.add("recording");
  recordBtn.innerHTML = ICONS.stop;
  voiceTimer.textContent = "0:00";
});

cancelBtn.addEventListener("click", async () => {
  recordingCancelled = true;
  await recorder.stop();
  resetRecordingUI();
});

async function finishRecording() {
  const result = await recorder.stop();
  resetRecordingUI();
  if (recordingCancelled || !result || result.duration < 1) return;

  recordBtn.disabled = true;
  try {
    const base64 = await blobToBase64(result.blob);
    await addDoc(collection(db, "chats", user.uid, "messages"), {
      sender: "user", type: "voice", audioData: base64,
      duration: result.duration, timestamp: serverTimestamp(),
    });
    await touchThreadMeta("🎤 Voice message", "user");
  } catch (err) {
    console.error("[chat] could not send voice message:", err.message);
    alert("Could not send voice message — it may be too long. Try keeping it under a minute.");
  } finally {
    recordBtn.disabled = false;
  }
}

function resetRecordingUI() {
  input.hidden = false;
  recordingBar.classList.remove("active");
  recordBtn.classList.remove("recording");
  recordBtn.innerHTML = ICONS.mic;
}
