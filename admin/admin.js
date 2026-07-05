// admin/admin.js
// Images are uploaded to ImgBB (free, no Firebase Storage plan needed).
const IMGBB_API_KEY = "YOUR_IMGBB_API_KEY"; // ← paste your key here

import { db } from "../firebase/firebase-config.js";
import { requireAdmin, logout, changePassword } from "../firebase/auth-guard.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, limit, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { VoiceRecorder, blobToBase64, formatDuration, ICONS } from "../chat/voice-recorder.js";

/* ── Gate ──────────────────────────────────────────────────────────── */
const { user } = await requireAdmin();
document.getElementById("adminEmail").textContent = user.email;
document.querySelector("[data-logout]")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await logout();
  window.location.href = "../index.html";
});

/* ── Tabs ───────────────────────────────────────────────────────────── */
document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".admin-panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.panel}`).classList.add("active");
  });
});

/* ── Toast ──────────────────────────────────────────────────────────── */
const toast = document.getElementById("adminToast");
let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str ?? "";
  return d.innerHTML;
}

/* ── ImgBB image upload ──────────────────────────────────────────────── */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function uploadToImgBB(file) {
  if (!IMGBB_API_KEY || IMGBB_API_KEY === "YOUR_IMGBB_API_KEY") {
    throw new Error('ImgBB API key not set. Open admin/admin.js and paste your key into IMGBB_API_KEY (get a free one at https://api.imgbb.com/).');
  }
  const base64Full = await fileToBase64(file);
  const base64Data = base64Full.split(",")[1];
  const body = new FormData();
  body.append("key", IMGBB_API_KEY);
  body.append("image", base64Data);
  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body });
  if (!res.ok) throw new Error(`ImgBB responded with ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message || "ImgBB upload failed");
  return json.data.url;
}

/* ════════════════════════════════════════════════════════════════
   INVENTORY
   ════════════════════════════════════════════════════════════════ */
const INV_PAGE = 10;
const inventoryBody  = document.getElementById("inventoryBody");
const inventoryCount = document.getElementById("inventoryCount");
const invLoadMoreBtn = document.getElementById("inventoryLoadMore");
const seedBtn        = document.getElementById("seedBtn");
const addMedicineBtn = document.getElementById("addMedicineBtn");

const DEFAULT_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="9" width="18" height="6" rx="3"/><path d="M9 9v6M15 9v6"/></svg>`;

const STARTER_MEDICINES = [
  { name:"NEURO-STIM ALPHA",     category:"SUPPLEMENT",   description:"COGNITIVE ENHANCEMENT MATRIX. IMPROVES FOCUS AND MEMORY RETENTION.",  price:45.99,  requiresPrescription:false, stock:"IN STOCK",  image:"", icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/><path d="M12 6v6l4 2"/></svg>` },
  { name:"CARDIO-BETA BLOCKER",  category:"CHRONIC CARE", description:"ADVANCED HYPERTENSION MANAGEMENT. REGULATES HEART RHYTHM.",           price:120.50, requiresPrescription:true,  stock:"LOW STOCK", image:"", icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>` },
  { name:"IMMUNO-SHIELD PRO",    category:"VITAMINS",     description:"HIGH-DOSE VITAMIN C & ZINC COMPLEX FOR IMMUNE SYSTEM FORTIFICATION.", price:29.99,  requiresPrescription:false, stock:"IN STOCK",  image:"", icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>` },
  { name:"SYNTHETIC INSULIN XR", category:"CHRONIC CARE", description:"EXTENDED-RELEASE GLUCOSE REGULATION PROTOCOL.",                       price:85.00,  requiresPrescription:true,  stock:"IN STOCK",  image:"", icon:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/></svg>` },
];

function stockClass(s) { return s==="IN STOCK"?"stock-in":s==="LOW STOCK"?"stock-low":"stock-out"; }

let invCache = [], invLimit = INV_PAGE, unsubInv = null;

function listenInventory() {
  if (unsubInv) unsubInv();
  unsubInv = onSnapshot(
    query(collection(db,"medicines"), orderBy("name"), limit(invLimit)),
    (snap) => {
      invCache = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
      invLoadMoreBtn.hidden = snap.docs.length < invLimit;
      seedBtn.hidden = invCache.length > 0;
      renderInventory();
    },
    (err) => showToast(err.message, true)
  );
}
invLoadMoreBtn.addEventListener("click", () => { invLimit += INV_PAGE; listenInventory(); });

function renderInventory() {
  inventoryCount.textContent = `${invCache.length} ITEM${invCache.length===1?"":"S"}`;
  if (!invCache.length) {
    inventoryBody.innerHTML = `<tr><td colspan="7" class="empty-state">NO MEDICINES YET — ADD ONE OR SEED THE STARTER CATALOGUE.</td></tr>`;
    return;
  }
  inventoryBody.innerHTML = invCache.map((m) => `
    <tr>
      <td>${m.image?`<img src="${escHtml(m.image)}" class="med-thumb" onerror="this.style.display='none'">` : "—"}</td>
      <td class="row-name">${escHtml(m.name)}</td>
      <td>${escHtml(m.category)}</td>
      <td>$${Number(m.price).toFixed(2)}</td>
      <td><span class="pill ${stockClass(m.stock)}">${escHtml(m.stock)}</span></td>
      <td>${m.requiresPrescription?"RX":"OTC"}</td>
      <td><div class="row-actions">
        <button class="row-btn" data-edit="${m.id}">EDIT</button>
        <button class="row-btn danger" data-del="${m.id}">DELETE</button>
      </div></td>
    </tr>`).join("");
  inventoryBody.querySelectorAll("[data-edit]").forEach((b) =>
    b.addEventListener("click", () => openMedicineModal(invCache.find((m) => m.id===b.dataset.edit))));
  inventoryBody.querySelectorAll("[data-del]").forEach((b) =>
    b.addEventListener("click", () => deleteMedicine(b.dataset.del)));
  window.wireCursorHoverTargets?.();
}

async function deleteMedicine(id) {
  const m = invCache.find((x) => x.id===id);
  if (!confirm(`Delete "${m?.name}"? This can't be undone.`)) return;
  try { await deleteDoc(doc(db,"medicines",id)); showToast("Medicine deleted."); }
  catch (err) { showToast(err.message, true); }
}

seedBtn.addEventListener("click", async () => {
  seedBtn.disabled = true;
  try {
    const batch = writeBatch(db);
    STARTER_MEDICINES.forEach((m) => batch.set(doc(collection(db,"medicines")), { ...m, createdAt: serverTimestamp() }));
    await batch.commit();
    showToast("Starter catalogue seeded.");
  } catch (err) { showToast(err.message, true); seedBtn.disabled = false; }
});

/* ── Medicine modal ─────────────────────────────────────────────────── */
const medOverlay    = document.getElementById("medicineModalOverlay");
const medModalTitle = document.getElementById("medicineModalTitle");
const medForm       = document.getElementById("medicineForm");
const fEl = (id) => document.getElementById(id);

fEl("medImageFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    fEl("medImagePreview").src    = ev.target.result;
    fEl("medImagePreview").hidden = false;
    fEl("uploadPlaceholder").textContent = file.name;
  };
  reader.readAsDataURL(file);
});

function openMedicineModal(med = null) {
  medForm.reset();
  fEl("medImageFile").value    = "";
  fEl("medImageUrl").value     = "";
  fEl("medImagePreview").hidden = true;
  fEl("medImagePreview").src   = "";
  fEl("uploadPlaceholder").textContent = "↑ CLICK TO UPLOAD IMAGE";

  if (med) {
    medModalTitle.textContent  = "EDIT MEDICINE";
    fEl("medicineId").value    = med.id;
    fEl("medName").value       = med.name;
    fEl("medCategory").value   = med.category;
    fEl("medDescription").value= med.description;
    fEl("medPrice").value      = med.price;
    fEl("medRx").checked       = !!med.requiresPrescription;
    fEl("medStock").value      = med.stock;
    if (med.image) {
      fEl("medImageUrl").value       = med.image;
      fEl("medImagePreview").src    = med.image;
      fEl("medImagePreview").hidden = false;
      fEl("uploadPlaceholder").textContent = "↑ UPLOAD NEW IMAGE TO REPLACE";
    }
  } else {
    medModalTitle.textContent = "ADD MEDICINE";
    fEl("medicineId").value   = "";
  }
  medOverlay.classList.add("open");
}

function closeMedicineModal() { medOverlay.classList.remove("open"); }
addMedicineBtn.addEventListener("click", () => openMedicineModal());
fEl("closeMedicineModal").addEventListener("click", closeMedicineModal);
medOverlay.addEventListener("click", (e) => { if (e.target===medOverlay) closeMedicineModal(); });

medForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = fEl("medicineSubmitBtn");
  submitBtn.disabled = true;

  const payload = {
    name:                 fEl("medName").value.trim(),
    category:             fEl("medCategory").value,
    description:          fEl("medDescription").value.trim(),
    price:                parseFloat(fEl("medPrice").value),
    requiresPrescription: fEl("medRx").checked,
    stock:                fEl("medStock").value,
  };

  const file = fEl("medImageFile").files[0];
  if (file) {
    submitBtn.textContent = "UPLOADING IMAGE…";
    try { payload.image = await uploadToImgBB(file); }
    catch (err) {
      showToast(err.message, true);
      submitBtn.disabled = false;
      submitBtn.textContent = "SAVE MEDICINE";
      return;
    }
  } else {
    payload.image = fEl("medImageUrl").value || "";
  }

  submitBtn.textContent = "SAVING…";
  try {
    if (fEl("medicineId").value) {
      await updateDoc(doc(db,"medicines",fEl("medicineId").value), payload);
      showToast("Medicine updated.");
    } else {
      await addDoc(collection(db,"medicines"), { ...payload, icon: DEFAULT_ICON, createdAt: serverTimestamp() });
      showToast("Medicine added.");
    }
    closeMedicineModal();
  } catch (err) { showToast(err.message, true); }
  finally { submitBtn.disabled = false; submitBtn.textContent = "SAVE MEDICINE"; }
});

listenInventory();

/* ════════════════════════════════════════════════════════════════
   ORDERS
   ════════════════════════════════════════════════════════════════ */
const ORD_PAGE  = 10;
const ordersBody  = document.getElementById("ordersBody");
const ordersCount = document.getElementById("ordersCount");
const ordLoadMore = document.getElementById("ordersLoadMore");
let ordLimit = ORD_PAGE, unsubOrd = null;

function listenOrders() {
  if (unsubOrd) unsubOrd();
  unsubOrd = onSnapshot(
    query(collection(db,"orders"), orderBy("createdAt","desc"), limit(ordLimit)),
    (snap) => {
      const orders = snap.docs.map((d) => ({ id:d.id, ...d.data() }));
      ordersCount.textContent = `${orders.length} ORDER${orders.length===1?"":"S"}`;
      ordLoadMore.hidden = snap.docs.length < ordLimit;
      if (!orders.length) { ordersBody.innerHTML=`<tr><td colspan="5" class="empty-state">NO ORDERS YET.</td></tr>`; return; }
      ordersBody.innerHTML = orders.map((o) => `
        <tr>
          <td>${escHtml(o.customerEmail||o.userId)}</td>
          <td>${(o.items||[]).length} ITEM${(o.items||[]).length===1?"":"S"}</td>
          <td>$${Number(o.total||0).toFixed(2)}</td>
          <td><select class="status-select" data-order="${o.id}">
            ${["PENDING","CONFIRMED","SHIPPED","DELIVERED"].map((s)=>`<option ${o.status===s?"selected":""}>${s}</option>`).join("")}
          </select></td>
          <td>${o.createdAt?.toDate?o.createdAt.toDate().toLocaleDateString():"—"}</td>
        </tr>`).join("");
      ordersBody.querySelectorAll("[data-order]").forEach((sel) =>
        sel.addEventListener("change", async () => {
          try { await updateDoc(doc(db,"orders",sel.dataset.order),{status:sel.value}); showToast("Status updated."); }
          catch(err){ showToast(err.message,true); }
        }));
      window.wireCursorHoverTargets?.();
    }, (err)=>showToast(err.message,true));
}
ordLoadMore.addEventListener("click", () => { ordLimit+=ORD_PAGE; listenOrders(); });
listenOrders();

/* ════════════════════════════════════════════════════════════════
   USERS
   ════════════════════════════════════════════════════════════════ */
const USR_PAGE   = 10;
const usersBody   = document.getElementById("usersBody");
const usersCount  = document.getElementById("usersCount");
const usrLoadMore = document.getElementById("usersLoadMore");
let usrLimit = USR_PAGE, unsubUsr = null;

function listenUsers() {
  if (unsubUsr) unsubUsr();
  unsubUsr = onSnapshot(
    query(collection(db,"users"), orderBy("createdAt","desc"), limit(usrLimit)),
    (snap) => {
      const users = snap.docs.map((d)=>({id:d.id,...d.data()}));
      usersCount.textContent = `${users.length} ACCOUNT${users.length===1?"":"S"}`;
      usrLoadMore.hidden = snap.docs.length < usrLimit;
      if (!users.length){ usersBody.innerHTML=`<tr><td colspan="5" class="empty-state">NO ACCOUNTS YET.</td></tr>`; return; }
      usersBody.innerHTML = users.map((u)=>`
        <tr>
          <td class="row-name">${escHtml(u.fullName)||"—"}</td>
          <td>${escHtml(u.email)}</td>
          <td><span class="pill ${u.role==="admin"?"role-admin":"role-customer"}">${escHtml(u.role||"customer")}</span></td>
          <td>${u.createdAt?.toDate?u.createdAt.toDate().toLocaleDateString():"—"}</td>
          <td><div class="row-actions">
            <button class="row-btn" data-role="${u.id}" data-cur="${u.role||"customer"}" ${u.id===user.uid?"disabled":""}>
              ${u.role==="admin"?"MAKE CUSTOMER":"MAKE ADMIN"}
            </button>
          </div></td>
        </tr>`).join("");
      usersBody.querySelectorAll("[data-role]").forEach((b)=>
        b.addEventListener("click", async ()=>{
          const next = b.dataset.cur==="admin"?"customer":"admin";
          try{ await updateDoc(doc(db,"users",b.dataset.role),{role:next}); showToast(`Role → ${next}.`); }
          catch(err){ showToast(err.message,true); }
        }));
      window.wireCursorHoverTargets?.();
    }, (err)=>showToast(err.message,true));
}
usrLoadMore.addEventListener("click", () => { usrLimit+=USR_PAGE; listenUsers(); });
listenUsers();

/* ════════════════════════════════════════════════════════════════
   LIVE CHAT — text + voice
   ════════════════════════════════════════════════════════════════ */
const CHAT_LIST_PAGE=12, CHAT_MSG_PAGE=25;
const chatListEl    = document.getElementById("chatList");
const chatListMore  = document.getElementById("chatListLoadMore");
const chatEmpty     = document.getElementById("chatEmptyState");
const chatActiveView= document.getElementById("chatActiveView");
const chatActiveName= document.getElementById("chatActiveName");
const chatMsgsEl    = document.getElementById("chatMessagesAdmin");
const chatMsgMore   = document.getElementById("chatMsgLoadMore");
const chatReplyForm = document.getElementById("chatReplyForm");
const chatReplyInput= document.getElementById("chatReplyInput");

// Voice reply controls
const voiceRecordBtnAdmin    = document.getElementById("voiceRecordBtnAdmin");
const voiceRecordingBarAdmin = document.getElementById("voiceRecordingBarAdmin");
const voiceTimerAdmin        = document.getElementById("voiceTimerAdmin");
const voiceCancelBtnAdmin    = document.getElementById("voiceCancelBtnAdmin");
voiceRecordBtnAdmin.innerHTML = ICONS.mic;
const adminRecorder = new VoiceRecorder();
let adminRecordingCancelled = false;

let chatListLimit=CHAT_LIST_PAGE, activeCustomerId=null, chatMsgLimit=CHAT_MSG_PAGE;
let unsubChatList=null, unsubChat=null;

function listenChatList() {
  if (unsubChatList) unsubChatList();
  unsubChatList = onSnapshot(
    query(collection(db,"chats"), orderBy("lastMessageAt","desc"), limit(chatListLimit)),
    (snap)=>{
      const threads = snap.docs.map((d)=>({id:d.id,...d.data()}));
      chatListMore.hidden = snap.docs.length < chatListLimit;
      if (!threads.length){ chatListEl.innerHTML=`<p class="empty-state">NO CONVERSATIONS YET.</p>`; return; }
      chatListEl.innerHTML = threads.map((t)=>`
        <button type="button" class="chat-thread-btn ${t.id===activeCustomerId?"active":""}"
          data-thread="${t.id}" data-name="${escHtml(t.customerName||t.customerEmail||t.id)}">
          <span class="chat-thread-name">${escHtml(t.customerName||t.customerEmail||t.id)}</span>
          <span class="chat-thread-preview">${escHtml(t.lastMessage||"")}</span>
          ${t.unreadByAdmin?`<span class="chat-thread-dot"></span>`:""}
        </button>`).join("");
      chatListEl.querySelectorAll("[data-thread]").forEach((b)=>
        b.addEventListener("click",()=>openThread(b.dataset.thread,b.dataset.name)));
      window.wireCursorHoverTargets?.();
    }, (err)=>showToast(err.message,true));
}
chatListMore.addEventListener("click",()=>{ chatListLimit+=CHAT_LIST_PAGE; listenChatList(); });

function openThread(uid, name) {
  activeCustomerId=uid; chatMsgLimit=CHAT_MSG_PAGE;
  chatActiveView.hidden=false; chatEmpty.hidden=true;
  chatActiveName.textContent=name;
  updateDoc(doc(db,"chats",uid),{unreadByAdmin:false}).catch(()=>{});
  listenThread();
}

/* ── Decorative waveform bars (matches chat.js's customer-side helper) ── */
function waveformBars(seed = 12) {
  let html = "";
  for (let i = 0; i < seed; i++) {
    const h = 6 + Math.round(Math.sin(i * 1.7) * 6 + 6);
    html += `<span style="height:${h}px"></span>`;
  }
  return html;
}

function listenThread() {
  if (unsubChat) unsubChat();
  unsubChat = onSnapshot(
    query(collection(db,"chats",activeCustomerId,"messages"), orderBy("timestamp","desc"), limit(chatMsgLimit)),
    (snap)=>{
      const msgs = snap.docs.map((d)=>({id:d.id,...d.data()})).reverse();
      chatMsgMore.hidden = snap.docs.length < chatMsgLimit;

      chatMsgsEl.innerHTML = msgs.map((m) => {
        const fromClass = m.sender==="pharmacist" ? "from-pharmacist" : "from-user";
        if (m.type === "voice") {
          return `
            <div class="voice-bubble ${fromClass}" data-audio="${m.audioData}">
              <button type="button" class="voice-play-btn" data-play>${ICONS.play}</button>
              <div class="voice-waveform">${waveformBars()}</div>
              <span class="voice-duration">${formatDuration(m.duration||0)}</span>
            </div>`;
        }
        return `<div class="chat-bubble-msg ${fromClass}">${escHtml(m.text)}</div>`;
      }).join("");

      // Wire playback
      chatMsgsEl.querySelectorAll(".voice-bubble").forEach((bubble) => {
        const playBtn = bubble.querySelector("[data-play]");
        let audio = null;
        playBtn.addEventListener("click", () => {
          if (!audio) {
            audio = new Audio(bubble.dataset.audio);
            audio.addEventListener("ended", () => { playBtn.innerHTML = ICONS.play; });
          }
          if (audio.paused) {
            chatMsgsEl.querySelectorAll(".voice-play-btn").forEach((b) => { if (b!==playBtn) b.innerHTML = ICONS.play; });
            audio.play();
            playBtn.innerHTML = ICONS.pause;
          } else {
            audio.pause();
            playBtn.innerHTML = ICONS.play;
          }
        });
      });

      chatMsgsEl.scrollTop = chatMsgsEl.scrollHeight;
    }, (err)=>showToast(err.message,true));
}
chatMsgMore.addEventListener("click",()=>{ chatMsgLimit+=CHAT_MSG_PAGE; listenThread(); });

/* ── Text reply ── */
chatReplyForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const text=chatReplyInput.value.trim();
  if (!text||!activeCustomerId) return;
  chatReplyInput.value="";
  try {
    await addDoc(collection(db,"chats",activeCustomerId,"messages"),{sender:"pharmacist",type:"text",text,timestamp:serverTimestamp()});
    await updateDoc(doc(db,"chats",activeCustomerId),{lastMessage:text,lastMessageAt:serverTimestamp(),lastSender:"pharmacist",unreadByUser:true,unreadByAdmin:false});
  } catch(err){ showToast(err.message,true); }
});

/* ── Voice reply ── */
voiceRecordBtnAdmin.addEventListener("click", async () => {
  if (!activeCustomerId) { showToast("Select a conversation first.", true); return; }
  if (adminRecorder.isRecording) { await finishAdminRecording(); return; }

  adminRecordingCancelled = false;
  const granted = await adminRecorder.start((secs) => {
    voiceTimerAdmin.textContent = formatDuration(secs);
  });
  if (!granted) { showToast("Microphone access denied.", true); return; }

  chatReplyInput.hidden = true;
  voiceRecordingBarAdmin.classList.add("active");
  voiceRecordBtnAdmin.classList.add("recording");
  voiceRecordBtnAdmin.innerHTML = ICONS.stop;
  voiceTimerAdmin.textContent = "0:00";
});

voiceCancelBtnAdmin.addEventListener("click", async () => {
  adminRecordingCancelled = true;
  await adminRecorder.stop();
  resetAdminRecordingUI();
});

async function finishAdminRecording() {
  const result = await adminRecorder.stop();
  resetAdminRecordingUI();
  if (adminRecordingCancelled || !result || result.duration < 1) return;

  voiceRecordBtnAdmin.disabled = true;
  try {
    const base64 = await blobToBase64(result.blob);
    await addDoc(collection(db,"chats",activeCustomerId,"messages"), {
      sender:"pharmacist", type:"voice", audioData: base64,
      duration: result.duration, timestamp: serverTimestamp(),
    });
    await updateDoc(doc(db,"chats",activeCustomerId), {
      lastMessage:"🎤 Voice message", lastMessageAt: serverTimestamp(),
      lastSender:"pharmacist", unreadByUser:true, unreadByAdmin:false,
    });
  } catch (err) {
    showToast("Could not send voice message — try keeping it under a minute.", true);
  } finally {
    voiceRecordBtnAdmin.disabled = false;
  }
}

function resetAdminRecordingUI() {
  chatReplyInput.hidden = false;
  voiceRecordingBarAdmin.classList.remove("active");
  voiceRecordBtnAdmin.classList.remove("recording");
  voiceRecordBtnAdmin.innerHTML = ICONS.mic;
}

listenChatList();

/* ════════════════════════════════════════════════════════════════
   CHANGE PASSWORD
   ════════════════════════════════════════════════════════════════ */
const pwOverlay = document.getElementById("passwordModalOverlay");
const pwForm    = document.getElementById("passwordForm");

fEl("changePasswordBtn").addEventListener("click",()=>{ pwForm.reset(); pwOverlay.classList.add("open"); });
fEl("closePasswordModal").addEventListener("click",()=>pwOverlay.classList.remove("open"));
pwOverlay.addEventListener("click",(e)=>{ if(e.target===pwOverlay) pwOverlay.classList.remove("open"); });

pwForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const cur=fEl("pwCurrent").value, nxt=fEl("pwNew").value, con=fEl("pwConfirm").value;
  if (nxt!==con){ showToast("Passwords don't match.",true); return; }
  const btn=fEl("passwordSubmitBtn"); btn.disabled=true;
  try {
    await changePassword(cur,nxt);
    showToast("Password updated.");
    pwOverlay.classList.remove("open");
  } catch(err){
    const m={"auth/wrong-password":"Current password is incorrect.","auth/invalid-credential":"Current password is incorrect.","auth/weak-password":"Min 6 characters.","auth/too-many-requests":"Too many attempts — try again later."};
    showToast(m[err.code]||err.message,true);
  } finally { btn.disabled=false; }
});
