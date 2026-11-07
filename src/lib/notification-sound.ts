/** Two short soft tones (E5 then A5), made in the browser: no audio file to load. */
const TONES = [
  { frequency: 659.25, start: 0 },
  { frequency: 880, start: 0.12 },
] as const;
const TONE_SECONDS = 0.28;
const PEAK_GAIN = 0.12;

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
  context ??= new window.AudioContext();
  return context;
}

/**
 * Plays the notification chime. Browsers only allow sound after the person interacted with the
 * page; before that it stays silent instead of failing.
 */
export async function playNotificationSound(): Promise<void> {
  const audio = audioContext();
  if (!audio) return;
  try {
    if (audio.state === "suspended") await audio.resume();
  } catch {
    return;
  }
  const now = audio.currentTime;
  for (const tone of TONES) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0, now + tone.start);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + tone.start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.start + TONE_SECONDS);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + tone.start);
    oscillator.stop(now + tone.start + TONE_SECONDS);
  }
}

export type SystemPermission = "granted" | "denied" | "default" | "unsupported";

/** Whether this browser can show system notifications and what the person allowed. */
export function systemPermission(): SystemPermission {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return "unsupported";
  }
  return window.Notification.permission;
}

/** Asks the browser once; resolves to what the person chose. */
export async function requestSystemPermission(): Promise<SystemPermission> {
  if (systemPermission() === "unsupported") return "unsupported";
  try {
    return await window.Notification.requestPermission();
  } catch {
    return "denied";
  }
}
