// src/audio/audioManager.js
// Singleton audio manager for "Dodge the FUD".
// - One shared, reuse-safe AudioContext.
// - Looping background music via an HTMLAudioElement.
// - Fire-and-forget SFX by logical name, with pooled/cached decoded buffers
//   and a procedural synthesizer fallback (see ./sfx.js) when a name has no
//   shipped file asset.
//
// Framework-agnostic (no React). Import the named functions or the default
// object; both refer to the same single instance.

import { synth, SYNTH_NAMES } from "./sfx.js";

// --- asset registries ------------------------------------------------------

// Looping background music tracks (streamed via HTMLAudioElement).
const MUSIC_ASSETS = {
  main: "./music/Mario Kart Wii OST.mp3",
};

// Optional named SFX that have real files. Every other logical name is
// synthesized procedurally.
const FILE_ASSETS = {
  gameOver: "./music/game-over.wav",
  levelComplete: "./music/level-completed.wav",
};

// --- internal state --------------------------------------------------------

let ctx = null;            // shared AudioContext
let sfxGain = null;        // master gain node for all SFX
let musicEl = null;        // HTMLAudioElement for background music
let currentMusic = null;   // key of the currently loaded music track
let musicVolume = 0.3;     // 0..1
let preloaded = false;

const sfxBuffers = new Map();   // name -> decoded AudioBuffer (pool/cache)
const pendingLoads = new Map(); // name -> in-flight Promise<AudioBuffer>

// --- context lifecycle -----------------------------------------------------

// Create the shared AudioContext once. Returns false when WebAudio is
// unavailable. Reuse-safe: subsequent calls return the existing context.
function ensureContext() {
  if (ctx) return true;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.8;
    sfxGain.connect(ctx.destination);
  } catch {
    ctx = null;
    sfxGain = null;
    return false;
  }
  return true;
}

function resumeContext() {
  if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
    ctx.resume().catch(() => {});
  }
}

// Resume the AudioContext. Safe to call on the first user gesture and safe to
// call repeatedly.
export function unlock() {
  if (!ensureContext()) return;
  resumeContext();
  // Nudge stricter browsers with a one-sample silent buffer.
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    // ignore
  }
}

// --- buffer loading / pooling ----------------------------------------------

function decodeAudio(data) {
  return new Promise((resolve, reject) => {
    // Support both the promise and the legacy callback decodeAudioData forms.
    const ret = ctx.decodeAudioData(data, resolve, reject);
    if (ret && typeof ret.then === "function") ret.then(resolve, reject);
  });
}

function loadBuffer(name, path) {
  if (sfxBuffers.has(name)) return Promise.resolve(sfxBuffers.get(name));
  if (pendingLoads.has(name)) return pendingLoads.get(name);
  if (!ensureContext()) return Promise.reject(new Error("no AudioContext"));

  const p = fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`audio asset missing: ${path}`);
      return res.arrayBuffer();
    })
    .then((data) => decodeAudio(data))
    .then((buffer) => {
      sfxBuffers.set(name, buffer);
      pendingLoads.delete(name);
      return buffer;
    })
    .catch((err) => {
      pendingLoads.delete(name);
      throw err;
    });

  pendingLoads.set(name, p);
  return p;
}

function playBuffer(buffer, volume, rate) {
  if (!buffer || !ensureContext()) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate > 0 ? rate : 1;
  if (volume !== 1) {
    const g = ctx.createGain();
    g.gain.value = Math.max(0, volume);
    src.connect(g).connect(sfxGain);
  } else {
    src.connect(sfxGain);
  }
  try {
    src.start();
  } catch {
    // ignore
  }
}

// --- public API ------------------------------------------------------------

// Called once at startup. Sets up the AudioContext and loads music. Reuse-safe:
// repeated calls are no-ops after the first.
export function preload() {
  if (preloaded) return;
  ensureContext();

  if (!musicEl) {
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.preload = "auto";
    musicEl.volume = musicVolume;
  }
  if (!currentMusic) {
    musicEl.src = MUSIC_ASSETS.main;
    currentMusic = "main";
    try {
      musicEl.load();
    } catch {
      // ignore
    }
  }

  // Best-effort decode of file-backed SFX so their first play is instant.
  if (ctx) {
    Object.keys(FILE_ASSETS).forEach((name) => {
      loadBuffer(name, FILE_ASSETS[name]).catch(() => {});
    });
  }

  preloaded = true;
}

// Fire-and-forget SFX by logical name. Uses a cached/pooled decoded buffer when
// a real file exists for the name; otherwise (or on load failure) synthesizes
// the sound procedurally so rapid repeats never stutter and never throw.
export function play(name, { volume = 1, rate = 1 } = {}) {
  if (!ensureContext()) return;
  resumeContext();

  const path = FILE_ASSETS[name];
  if (path) {
    const cached = sfxBuffers.get(name);
    if (cached) {
      playBuffer(cached, volume, rate);
      return;
    }
    loadBuffer(name, path)
      .then((buffer) => playBuffer(buffer, volume, rate))
      .catch(() => synth(ctx, name, sfxGain, { volume, rate }));
    return;
  }

  // No file asset for this name -> synthesize.
  synth(ctx, name, sfxGain, { volume, rate });
}

// Start (or restart) looping background music.
export function playMusic(name = "main") {
  const src = MUSIC_ASSETS[name];
  if (!src) return;
  if (!musicEl) {
    musicEl = new Audio();
    musicEl.loop = true;
    musicEl.preload = "auto";
  }
  if (currentMusic !== name) {
    musicEl.src = src;
    currentMusic = name;
  }
  musicEl.loop = true;
  musicEl.volume = musicVolume;
  const promise = musicEl.play();
  if (promise && typeof promise.catch === "function") promise.catch(() => {});
}

// Stop background music and rewind to the start.
export function stopMusic() {
  if (!musicEl) return;
  try {
    musicEl.pause();
    musicEl.currentTime = 0;
  } catch {
    // ignore
  }
}

// Set background music volume (0..1).
export function setMusicVolume(v) {
  const vol = Math.max(0, Math.min(1, Number(v)));
  if (!Number.isNaN(vol)) musicVolume = vol;
  if (musicEl) musicEl.volume = musicVolume;
}

// Logical names handled by the procedural synthesizer.
export const SFX_NAMES = SYNTH_NAMES;

// Names backed by shipped audio files (also valid for play()).
export const FILE_SFX_NAMES = Object.keys(FILE_ASSETS);

const audioManager = {
  preload,
  unlock,
  play,
  playMusic,
  stopMusic,
  setMusicVolume,
  SFX_NAMES,
  FILE_SFX_NAMES,
};

export default audioManager;
