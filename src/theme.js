// DODGE THE FUD — central design/theme config.
// Single source of truth for colors, karts, characters, FUD, FUN, Tapcoins,
// scoring and AI personalities. Pure data: safe to import anywhere, no deps.

// ----------------------------------------------------------------------------
// Color language (tropical coastal + crypto-arcade accents)
// ----------------------------------------------------------------------------
export const palette = {
  skyZenith: "#1f78ff",
  skyHorizon: "#9be7ff",
  ocean: "#1b9ad6",
  oceanDeep: "#0a5c8a",
  sand: "#f2dca4",
  foliage: "#2fae6b",

  tapcoin: "#ffcf3a",      // gold
  tapcoinGlow: "#fff3b0",
  fun: "#27d3ff",          // glowing blue
  funGlow: "#b6f3ff",
  fudBody: "#0b0d12",      // near-black
  fudEye: "#ff2a2a",       // expressive red
  fudGlow: "#ff5a3c",

  uiAccent: "#27d3ff",
  uiWarn: "#ff2a2a",
  uiGold: "#ffcf3a",
};

// ----------------------------------------------------------------------------
// Kart variants. Stats are 0..1 normalized; the controller maps them to real
// physics values. Tradeoffs are intentional — no kart is best at everything.
// baseline sums are kept roughly equal so balance comes from playstyle fit.
// ----------------------------------------------------------------------------
export const karts = {
  starter: {
    id: "starter",
    name: "HODLER",
    bodyColor: "#3aa0ff",
    price: 0,
    unlocked: true,
    stats: { topSpeed: 0.55, acceleration: 0.6, handling: 0.6, drift: 0.55, stability: 0.7, recovery: 0.6, fudResistance: 0.6 },
    blurb: "Balanced all-rounder. Forgiving to drive.",
  },
  rocket: {
    id: "rocket",
    name: "MOONSHOT",
    bodyColor: "#ff6b3a",
    price: 1500,
    unlocked: false,
    stats: { topSpeed: 0.9, acceleration: 0.85, handling: 0.4, drift: 0.45, stability: 0.4, recovery: 0.45, fudResistance: 0.45 },
    blurb: "Blistering speed, twitchy handling. For confident racers.",
  },
  gripper: {
    id: "gripper",
    name: "DIAMOND HANDS",
    bodyColor: "#49e6b0",
    price: 1500,
    unlocked: false,
    stats: { topSpeed: 0.5, acceleration: 0.55, handling: 0.9, drift: 0.85, stability: 0.75, recovery: 0.55, fudResistance: 0.5 },
    blurb: "Cornering monster. Chains drifts, lower top speed.",
  },
  tank: {
    id: "tank",
    name: "COLD WALLET",
    bodyColor: "#8a7bff",
    price: 2500,
    unlocked: false,
    stats: { topSpeed: 0.6, acceleration: 0.45, handling: 0.5, drift: 0.5, stability: 0.9, recovery: 0.85, fudResistance: 0.95 },
    blurb: "Shrugs off FUD, recovers fast. Slow to spin up.",
  },
};

// ----------------------------------------------------------------------------
// Characters. Passive abilities create strategic differences; magnitudes are
// multipliers/offsets applied by the race manager.
// ----------------------------------------------------------------------------
export const characters = {
  satoshi: {
    id: "satoshi",
    name: "SATOSHI",
    accent: "#ffcf3a",
    price: 0,
    unlocked: true,
    passive: { tapcoinBonus: 0.0, fudResistance: 0.0, recovery: 0.0, scoreMult: 1.0, accelBonus: 0.0, funDuration: 0.0 },
    blurb: "No gimmicks. A clean baseline.",
  },
  degen: {
    id: "degen",
    name: "DEGEN",
    accent: "#ff6b3a",
    price: 1200,
    unlocked: false,
    passive: { tapcoinBonus: 0.25, fudResistance: -0.1, recovery: 0.0, scoreMult: 1.15, accelBonus: 0.0, funDuration: 0.0 },
    blurb: "+25% Tapcoins, +15% score — but more fragile to FUD.",
  },
  whaleRider: {
    id: "whaleRider",
    name: "WHALE RIDER",
    accent: "#27d3ff",
    price: 1800,
    unlocked: false,
    passive: { tapcoinBonus: 0.0, fudResistance: 0.3, recovery: 0.3, scoreMult: 1.0, accelBonus: 0.0, funDuration: 0.25 },
    blurb: "Tanky: strong FUD resistance, fast recovery, longer FUN.",
  },
  quant: {
    id: "quant",
    name: "QUANT",
    accent: "#49e6b0",
    price: 1800,
    unlocked: false,
    passive: { tapcoinBonus: 0.0, fudResistance: 0.0, recovery: 0.1, scoreMult: 1.0, accelBonus: 0.2, funDuration: 0.0 },
    blurb: "+20% acceleration out of corners and recoveries.",
  },
};

// ----------------------------------------------------------------------------
// FUD obstacle archetypes. Shared visual identity (dark body, red eyes);
// behavior differs. `penalty` describes the collision consequence.
// ----------------------------------------------------------------------------
export const fudTypes = {
  stationary: { id: "stationary", motion: "none", penalty: { speedMult: 0.5, knockback: 2, spin: 0.0, stunMs: 300, score: -300 } },
  moving:     { id: "moving",     motion: "patrol", speed: 6, penalty: { speedMult: 0.45, knockback: 3, spin: 0.4, stunMs: 450, score: -300 } },
  rotating:   { id: "rotating",   motion: "spin", rpm: 30, penalty: { speedMult: 0.5, knockback: 2, spin: 0.6, stunMs: 400, score: -300 } },
  falling:    { id: "falling",    motion: "drop", period: 3, penalty: { speedMult: 0.4, knockback: 2, spin: 0.3, stunMs: 500, score: -300 } },
  wall:       { id: "wall",       motion: "none", penalty: { speedMult: 0.3, knockback: 4, spin: 0.0, stunMs: 500, score: -300 } },
  cluster:    { id: "cluster",    motion: "none", penalty: { speedMult: 0.55, knockback: 1.5, spin: 0.5, stunMs: 350, score: -300 } },
  gate:       { id: "gate",       motion: "slide", speed: 4, penalty: { speedMult: 0.4, knockback: 3, spin: 0.2, stunMs: 450, score: -300 } },
  ambush:     { id: "ambush",     motion: "popup", triggerRadius: 12, penalty: { speedMult: 0.35, knockback: 3, spin: 0.5, stunMs: 500, score: -300 } },
};

// ----------------------------------------------------------------------------
// FUN power-ups (glowing blue boxes). duration in seconds; magnitude is the
// effect-specific knob the controller/race manager reads.
// ----------------------------------------------------------------------------
export const funEffects = {
  speedBoost:    { id: "speedBoost",    label: "SPEED",      duration: 3.0, magnitude: 1.0, color: palette.fun },
  shield:        { id: "shield",        label: "SHIELD",     duration: 6.0, magnitude: 1.0, color: "#8fe3ff" },
  fudImmunity:   { id: "fudImmunity",   label: "IMMUNE",     duration: 5.0, magnitude: 1.0, color: "#c9f3ff" },
  tapcoinMult:   { id: "tapcoinMult",   label: "2x COINS",   duration: 8.0, magnitude: 2.0, color: palette.tapcoin },
  scoreMult:     { id: "scoreMult",     label: "2x SCORE",   duration: 8.0, magnitude: 2.0, color: "#ffd86b" },
  accelBoost:    { id: "accelBoost",    label: "ACCEL",      duration: 4.0, magnitude: 1.5, color: "#5affd0" },
  handlingBoost: { id: "handlingBoost", label: "GRIP",       duration: 5.0, magnitude: 1.4, color: "#49e6b0" },
  opponentDisrupt:{id: "opponentDisrupt",label: "DISRUPT",   duration: 0.0, magnitude: 1.0, color: "#ff6b3a" },
  recoveryBoost: { id: "recoveryBoost", label: "REPAIR",     duration: 0.0, magnitude: 1.0, color: "#b6f3ff" },
};

// Weighted roll table for what a FUN box grants (opponentDisrupt/recovery rarer).
export const funRollTable = [
  "speedBoost", "speedBoost", "accelBoost", "handlingBoost",
  "shield", "fudImmunity", "tapcoinMult", "scoreMult",
  "opponentDisrupt", "recoveryBoost",
];

// ----------------------------------------------------------------------------
// Tapcoins + scoring
// ----------------------------------------------------------------------------
export const tapcoin = { value: 100, radius: 1.1, bob: 0.3, spinRpm: 40 };

export const scoring = {
  tapcoin: 100,
  overtake: 250,
  cleanLap: 500,
  timeBonus: 1000,     // scaled by remaining time at finish
  highSpeedPerSec: 10, // small drip while above speed threshold
  highSpeedThreshold: 0.8, // fraction of top speed
  shortcut: 400,
  funUseBonus: 150,
  fudHit: -300,
};

// ----------------------------------------------------------------------------
// Race format
// ----------------------------------------------------------------------------
export const raceConfig = {
  totalLaps: 3,
  racers: 5,          // 1 player + 4 AI
  aiCount: 4,
  countdownFrom: 3,
};

// ----------------------------------------------------------------------------
// AI personalities (names carried over from the prior tuning session).
// `difficulty` scales skill knobs globally; per-AI fields bias behavior.
// Default global difficulty 0.65 came from the prior ~25% win-rate sweep.
// ----------------------------------------------------------------------------
export const aiDefaultDifficulty = 0.65;

export const aiPersonalities = {
  velocita: {
    id: "velocita", name: "VELOCITA", archetype: "SPEED_DEMON", kart: "rocket",
    skill: { speed: 0.95, cornering: 0.6, aggression: 0.7, consistency: 0.6, foresight: 0.6 },
    behavior: { cornerEntryBrake: 0.75, lineRisk: 0.85, mistakeChance: 0.12, overtakeDrive: 0.8, defend: 0.3 },
    weakness: "Overcooks risky lines; punishable when pressured.",
  },
  oracle: {
    id: "oracle", name: "ORACLE", archetype: "TECHNICAL", kart: "gripper",
    skill: { speed: 0.7, cornering: 0.95, aggression: 0.35, consistency: 0.9, foresight: 0.85 },
    behavior: { cornerEntryBrake: 0.95, lineRisk: 0.4, mistakeChance: 0.04, overtakeDrive: 0.5, defend: 0.5 },
    weakness: "Passive in wheel-to-wheel contact.",
  },
  rugpull: {
    id: "rugpull", name: "RUGPULL", archetype: "AGGRESSOR", kart: "tank",
    skill: { speed: 0.75, cornering: 0.65, aggression: 0.95, consistency: 0.65, foresight: 0.6 },
    behavior: { cornerEntryBrake: 0.8, lineRisk: 0.7, mistakeChance: 0.1, overtakeDrive: 0.95, defend: 0.9, useShortcuts: true },
    weakness: "Takes unnecessary risks to block/overtake.",
  },
  whale: {
    id: "whale", name: "WHALE", archetype: "ELITE", kart: "gripper",
    skill: { speed: 0.85, cornering: 0.9, aggression: 0.7, consistency: 0.92, foresight: 0.95 },
    behavior: { cornerEntryBrake: 0.9, lineRisk: 0.55, mistakeChance: 0.03, overtakeDrive: 0.8, defend: 0.8, adaptive: true, useShortcuts: true },
    weakness: "None glaring — the race's benchmark opponent.",
  },
};

export const aiRoster = ["velocita", "oracle", "rugpull", "whale"];
