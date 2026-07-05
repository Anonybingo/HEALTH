// chat/voice-recorder.js
// Shared utility for recording, encoding, and formatting voice messages.
// Imported by chat/chat.js and admin/admin.js.

export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream        = null;
    this.chunks        = [];
    this.timer         = null;
    this.elapsed       = 0;
    this.isRecording   = false;
    this.MAX_SECONDS   = 120; // 2 minutes hard cap
  }

  // Starts recording. onTick(seconds) fires every second.
  // Returns true if mic was granted, false if denied.
  async start(onTick) {
    this.chunks  = [];
    this.elapsed = 0;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime  = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus" : "audio/webm";
      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: mime });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.mediaRecorder.start(200);
      this.isRecording = true;
      this.timer = setInterval(() => {
        this.elapsed++;
        onTick?.(this.elapsed);
        if (this.elapsed >= this.MAX_SECONDS) this.stop();
      }, 1000);
      return true;
    } catch (err) {
      console.error("[voice] mic denied:", err.message);
      return false;
    }
  }

  // Stops recording and resolves with { blob, duration }.
  stop() {
    return new Promise((resolve) => {
      if (!this.isRecording) { resolve(null); return; }
      clearInterval(this.timer);
      this.isRecording = false;
      const duration   = this.elapsed;
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve({ blob, duration });
      };
      this.mediaRecorder.stop();
    });
  }
}

// Converts a Blob to a base64 data-URL string for Firestore storage.
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// "0:05", "1:23" etc.
export function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// SVG snippets reused across pages
export const ICONS = {
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>`,
  stop: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>`,
  pause:`<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
};
