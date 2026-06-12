export const OPEN_SOUND_ENABLED_STORAGE_KEY = "neteruneko_open_sound_enabled";

const SELECTED_OPEN_SOUND_URL = "";
let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let audioLoadPromise: Promise<AudioBuffer | null> | null = null;

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

export function preloadOpenSound() {
  if (!SELECTED_OPEN_SOUND_URL || typeof window === "undefined") {
    return Promise.resolve(null);
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

  const response = await fetch(SELECTED_OPEN_SOUND_URL);
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await context.decodeAudioData(arrayBuffer);
  return audioBuffer;
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
