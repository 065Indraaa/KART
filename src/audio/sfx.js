// src/audio/sfx.js
// Procedural WebAudio sound synthesizer for "Dodge the FUD".
// Generates short sounds entirely from oscillators + gain envelopes so the
// game has full audio feedback without shipping dedicated asset files.
//
// Public API:
//   synth(ctx, name, destination, options?) -> void
// Fire-and-forget: schedules nodes on the AudioContext timeline and returns.

const DEFAULTS = { volume: 1, rate: 1 };

// --- low level helpers -----------------------------------------------------

// Create (and cache per-context) a short mono white-noise AudioBuffer.
const noiseCache = new WeakMap();
function getNoiseBuffer(ctx, seconds = 1) {
  let buf = noiseCache.get(ctx);
  if (buf) return buf;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  buf = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buf);
  return buf;
}

// Schedule a single oscillator "note" with an attack/decay envelope.
function tone(ctx, out, opts) {
  const {
    type = "sine",
    freq = 440,
    freqEnd = null,
    start = 0,
    dur = 0.15,
    peak = 0.3,
    attack = 0.005,
    release = null,
  } = opts;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (freqEnd != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), start + dur);
  }
  const rel = release == null ? dur : release;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + rel);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + rel + 0.02);
}

// Schedule a filtered noise burst (for thuds / whooshes / drift screeches).
function noise(ctx, out, opts) {
  const {
    start = 0,
    dur = 0.2,
    peak = 0.3,
    filter = "lowpass",
    freq = 800,
    freqEnd = null,
    q = 1,
  } = opts;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  src.loop = true;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, start);
  if (freqEnd != null) {
    biquad.frequency.linearRampToValueAtTime(freqEnd, start + dur);
  }
  biquad.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + Math.min(0.02, dur / 2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(biquad).connect(gain).connect(out);
  src.start(start);
  src.stop(start + dur + 0.02);
}

// --- voices ----------------------------------------------------------------
// Each voice: (ctx, out, t, r) where t = start time, r = pitch rate multiplier.

const VOICES = {
  uiHover(ctx, out, t, r) {
    tone(ctx, out, { type: "sine", freq: 620 * r, start: t, dur: 0.06, peak: 0.12, attack: 0.004 });
  },
  uiClick(ctx, out, t, r) {
    tone(ctx, out, { type: "triangle", freq: 880 * r, start: t, dur: 0.05, peak: 0.2, attack: 0.002 });
  },
  countdownBeep(ctx, out, t, r) {
    tone(ctx, out, { type: "square", freq: 440 * r, start: t, dur: 0.18, peak: 0.25, attack: 0.004 });
  },
  countdownGo(ctx, out, t, r) {
    tone(ctx, out, { type: "square", freq: 880 * r, start: t, dur: 0.35, peak: 0.3, attack: 0.004 });
    tone(ctx, out, { type: "sine", freq: 1320 * r, start: t, dur: 0.35, peak: 0.15, attack: 0.004 });
  },
  coin(ctx, out, t, r) {
    // Quick two-note gold blip (B5 -> E6).
    tone(ctx, out, { type: "square", freq: 988 * r, start: t, dur: 0.08, peak: 0.22, attack: 0.002 });
    tone(ctx, out, { type: "square", freq: 1319 * r, start: t + 0.07, dur: 0.14, peak: 0.22, attack: 0.002 });
  },
  boost(ctx, out, t, r) {
    // Rising sweep + airy noise.
    tone(ctx, out, { type: "sawtooth", freq: 180 * r, freqEnd: 1200 * r, start: t, dur: 0.4, peak: 0.3, attack: 0.01 });
    noise(ctx, out, { start: t, dur: 0.4, peak: 0.12, filter: "bandpass", freq: 400, freqEnd: 2500, q: 1.2 });
  },
  drift(ctx, out, t, r) {
    noise(ctx, out, { start: t, dur: 0.25, peak: 0.14, filter: "bandpass", freq: 1600 * r, q: 6 });
  },
  accelerate(ctx, out, t, r) {
    // Short engine-ish rising low tone (loop-ish, optional).
    tone(ctx, out, { type: "sawtooth", freq: 90 * r, freqEnd: 220 * r, start: t, dur: 0.3, peak: 0.18, attack: 0.02 });
  },
  funActivate(ctx, out, t, r) {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) =>
      tone(ctx, out, { type: "triangle", freq: f * r, start: t + i * 0.05, dur: 0.18, peak: 0.2, attack: 0.004 })
    );
  },
  fudHit(ctx, out, t, r) {
    // Low sine drop + lowpass noise thud.
    tone(ctx, out, { type: "sine", freq: 160 * r, freqEnd: 55 * r, start: t, dur: 0.3, peak: 0.35, attack: 0.004 });
    noise(ctx, out, { start: t, dur: 0.2, peak: 0.3, filter: "lowpass", freq: 500, freqEnd: 120, q: 0.7 });
  },
  overtake(ctx, out, t, r) {
    // Quick upward whoosh.
    noise(ctx, out, { start: t, dur: 0.35, peak: 0.18, filter: "bandpass", freq: 500 * r, freqEnd: 3000 * r, q: 0.8 });
  },
  lapComplete(ctx, out, t, r) {
    const notes = [659.25, 783.99, 987.77];
    notes.forEach((f, i) =>
      tone(ctx, out, { type: "triangle", freq: f * r, start: t + i * 0.09, dur: 0.2, peak: 0.22, attack: 0.004 })
    );
  },
  finish(ctx, out, t, r) {
    // Short fanfare: melody + octave-below support.
    const notes = [523.25, 659.25, 783.99, 1046.5, 1046.5];
    notes.forEach((f, i) => {
      tone(ctx, out, { type: "square", freq: f * r, start: t + i * 0.12, dur: 0.26, peak: 0.2, attack: 0.006 });
      tone(ctx, out, { type: "triangle", freq: f * 0.5 * r, start: t + i * 0.12, dur: 0.26, peak: 0.12, attack: 0.006 });
    });
  },
  personalBest(ctx, out, t, r) {
    // Brighter fanfare with a sparkle tail.
    const notes = [659.25, 830.61, 987.77, 1318.51];
    notes.forEach((f, i) =>
      tone(ctx, out, { type: "triangle", freq: f * r, start: t + i * 0.1, dur: 0.3, peak: 0.22, attack: 0.004 })
    );
    [1760, 2093, 2637].forEach((f, i) =>
      tone(ctx, out, { type: "sine", freq: f * r, start: t + 0.4 + i * 0.06, dur: 0.14, peak: 0.1, attack: 0.002 })
    );
  },
};

// Resume/dispatch a procedural voice. Robust: never throws, guards against a
// missing or incapable AudioContext, and no-ops for unknown names.
export function synth(ctx, name, destination, options = {}) {
  if (!ctx || typeof ctx.createOscillator !== "function") return;
  const voice = VOICES[name];
  if (!voice) return;

  const { volume, rate } = { ...DEFAULTS, ...options };
  const out = destination || ctx.destination;

  // Route through a per-call gain node when a non-unity volume is requested,
  // so the individual voices can stay normalized.
  let target = out;
  if (volume !== 1) {
    const g = ctx.createGain();
    g.gain.value = Math.max(0, volume);
    g.connect(out);
    target = g;
  }

  const now = ctx.currentTime;
  const r = rate > 0 ? rate : 1;
  try {
    voice(ctx, target, now, r);
  } catch {
    // Fire-and-forget: swallow scheduling errors.
  }
}

// Logical names this synthesizer can produce.
export const SYNTH_NAMES = Object.keys(VOICES);

export default synth;
