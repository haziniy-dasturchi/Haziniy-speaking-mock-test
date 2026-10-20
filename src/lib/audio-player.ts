// Web Audio API tone generator and SpeechSynthesis TTS helper

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays standard CEFR exam beep before answering (~0.4s, 1000 Hz)
 */
export async function playExamBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);

      // Smooth attack & decay to prevent audio clicks
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.4, ctx.currentTime + 0.35);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);

      osc.onended = () => {
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Plays end tone when answer time is up (double chime)
 */
export async function playEndTone(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

      osc.onended = () => {
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Chrome fills the voice list asynchronously; speaking before it is ready
 * falls back to a robotic default voice, so wait for it once.
 */
function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const available = window.speechSynthesis.getVoices();
    if (available.length > 0) {
      resolve(available);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };

    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    setTimeout(finish, 1200);
  });
}

/** Prefers the natural sounding English voices shipped with the browser / OS. */
function pickEnglishVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
  if (english.length === 0) return null;

  const preferred = [
    /google uk english female/i,
    /google us english/i,
    /microsoft (aria|jenny|libby|sonia|ryan|guy).*natural/i,
    /natural/i,
    /google/i,
    /samantha|daniel|karen/i,
  ];

  for (const pattern of preferred) {
    const match = english.find((voice) => pattern.test(voice.name));
    if (match) return match;
  }

  return (
    english.find((voice) => /en-GB/i.test(voice.lang)) ||
    english.find((voice) => /en-US/i.test(voice.lang)) ||
    english[0]
  );
}

/**
 * Reads a question or an instruction aloud with the browser AI voice.
 * Used whenever a task has text but no uploaded audio file.
 */
export async function speakText(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const content = (text || "").trim();
  if (!content) return;

  const voices = await getVoices();
  const voice = pickEnglishVoice(voices);

  return new Promise((resolve) => {
    window.speechSynthesis.cancel();

    // Long passages are split into sentences: some browsers cut off a single
    // very long utterance after ~15 seconds.
    const chunks = content
      .split(/(?<=[.!?])\s+|[\r\n]+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const queue = chunks.length > 0 ? chunks : [content];
    let index = 0;
    let settled = false;

    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const speakNext = () => {
      if (index >= queue.length) {
        done();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(queue[index]);
      index += 1;
      utterance.lang = voice?.lang || "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1;
      if (voice) utterance.voice = voice;

      utterance.onend = () => speakNext();
      utterance.onerror = () => done();

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  });
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  }
}

export function resumeSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  }
}

/**
 * Preload an audio URL
 */
export function preloadAudio(url: string): Promise<HTMLAudioElement> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = url;
    audio.oncanplaythrough = () => resolve(audio);
    audio.onerror = () => reject(new Error(`Failed to load audio: ${url}`));
    audio.load();
  });
}

/**
 * Preload an image URL
 */
export function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
  });
}
