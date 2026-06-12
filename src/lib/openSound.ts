export const OPEN_SOUND_ENABLED_STORAGE_KEY = "neteruneko_open_sound_enabled";
export const OPEN_SOUND_SELECTED_STORAGE_KEY = "neteruneko_open_sound_candidate";

export type OpenSoundCandidateId = "1" | "2" | "3";

const DEFAULT_OPEN_SOUND_CANDIDATE: OpenSoundCandidateId = "1";
const OPEN_SOUND_CANDIDATE_URLS: Record<OpenSoundCandidateId, string> = {
  "1": "/sounds/open-paper-sound-1.mp3",
  "2": "",
  "3": "",
};
let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let audioLoadPromise: Promise<AudioBuffer | null> | null = null;
let loadedSoundUrl = "";

export function readOpenSoundEnabled() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(OPEN_SOUND_ENABLED_STORAGE_KEY) !== "0";
}

export function saveOpenSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OPEN_SOUND_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
}

export function readSelectedOpenSoundCandidate(): OpenSoundCandidateId {
  if (typeof window === "undefined") {
    return DEFAULT_OPEN_SOUND_CANDIDATE;
  }

  const candidate = window.localStorage.getItem(OPEN_SOUND_SELECTED_STORAGE_KEY);
  return isOpenSoundCandidateId(candidate) ? candidate : DEFAULT_OPEN_SOUND_CANDIDATE;
}

export function saveSelectedOpenSoundCandidate(candidate: OpenSoundCandidateId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OPEN_SOUND_SELECTED_STORAGE_KEY, candidate);
  audioBuffer = null;
  audioLoadPromise = null;
  loadedSoundUrl = "";
}

export function preloadOpenSound() {
  const soundUrl = getSelectedOpenSoundUrl();
  if (!soundUrl || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (loadedSoundUrl !== soundUrl) {
    audioBuffer = null;
    audioLoadPromise = null;
    loadedSoundUrl = soundUrl;
  }

  audioLoadPromise ??= loadOpenSoundBuffer();
  return audioLoadPromise;
}

export async function playOpenSound() {
  if (!readOpenSoundEnabled() || typeof window === "undefined") {
    return false;
  }

  window.dispatchEvent(new CustomEvent("neteruneko:open-sound-play-requested"));

  const buffer = await preloadOpenSound();
  if (!buffer) {
    return false;
  }

  const context = getAudioContext();
  if (!context) {
    return false;
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  gain.gain.value = 0.4;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
  return true;
}

async function loadOpenSoundBuffer() {
  const context = getAudioContext();
  if (!context) {
    return null;
  }

  const soundUrl = getSelectedOpenSoundUrl();
  if (!soundUrl) {
    return null;
  }

  const response = await fetch(soundUrl);
  if (!response.ok) {
    return null;
  }
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await context.decodeAudioData(arrayBuffer);
  return audioBuffer;
}

function getSelectedOpenSoundUrl() {
  return OPEN_SOUND_CANDIDATE_URLS[readSelectedOpenSoundCandidate()];
}

function isOpenSoundCandidateId(
  candidate: string | null,
): candidate is OpenSoundCandidateId {
  return candidate === "1" || candidate === "2" || candidate === "3";
}

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!AudioContextConstructor) {
    return null;
  }

  audioContext ??= new AudioContextConstructor();
  return audioContext;
}
