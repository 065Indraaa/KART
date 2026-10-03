// Maps normalized kart/character stats (0..1) + persistent upgrades into the
// concrete physics constants kartPhysics.js consumes. One place to retune feel.
import { karts, characters } from "../theme";

// World-unit baselines. The drivable loop is ~926 units long; at ~46 u/s a lap
// is ~20s, so a 3-lap race lands around a minute. Tuned for the 0.08-scaled track.
const BASE = {
  speedMin: 34, speedSpan: 20,      // maxSpeed = min + topSpeed*span
  accelMin: 2.2, accelSpan: 3.0,    // speed low-pass rate
  brake: 7.0,                        // braking low-pass rate
  reverseMax: 14,
  turnMin: 1.5, turnSpan: 1.7,      // rad/s at full speed influence
  driftTurnMin: 0.55, driftTurnSpan: 0.7,
  boostAdd: 16,                      // boost adds this to maxSpeed
  boostDur: 1.1,                     // seconds of turbo per drift tier
  stunBase: 0.45,                    // base stun seconds on FUD hit
  knockBase: 2.4,                    // base knockback impulse (units)
};

// Drift charge thresholds (seconds held) -> boost tier (0..3).
export const DRIFT_TIERS = [0.0, 0.55, 1.3, 2.2];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// upgrades: { speed?, handling?, fudResistance? } each 0..3; +0.07 per level.
function withUpgrades(stats, up = {}) {
  const bump = (base, lvl) => clamp01(base + (lvl || 0) * 0.07);
  return {
    ...stats,
    topSpeed: bump(stats.topSpeed, up.speed),
    handling: bump(stats.handling, up.handling),
    fudResistance: bump(stats.fudResistance, up.fudResistance),
  };
}

export function buildKartTuning({ kartId = "starter", characterId = "satoshi", upgrades = {} } = {}) {
  const kart = karts[kartId] || karts.starter;
  const character = characters[characterId] || characters.satoshi;
  const s = withUpgrades(kart.stats, upgrades);
  const passive = character.passive;

  const fudResistance = clamp01(s.fudResistance + passive.fudResistance);
  const recovery = clamp01(s.recovery + passive.recovery);
  const accel = BASE.accelMin + s.acceleration * BASE.accelSpan + passive.accelBonus * 1.5;

  return {
    kartId,
    characterId,
    bodyColor: kart.bodyColor,
    maxSpeed: BASE.speedMin + s.topSpeed * BASE.speedSpan,
    accel,
    brake: BASE.brake,
    reverseMax: BASE.reverseMax,
    turnRate: BASE.turnMin + s.handling * BASE.turnSpan,
    driftTurnBonus: BASE.driftTurnMin + s.drift * BASE.driftTurnSpan,
    grip: 0.5 + s.handling * 0.5,
    stability: s.stability,
    boostSpeedAdd: BASE.boostAdd,
    boostDuration: BASE.boostDur,
    // FUD resistance shortens stun and softens knockback; recovery speeds spin-up.
    stunMult: 1 - fudResistance * 0.6,
    knockMult: 1 - fudResistance * 0.5,
    recovery,
    // Character/economy knobs the RaceManager reads (not used by pure physics).
    tapcoinBonus: passive.tapcoinBonus,
    scoreMult: passive.scoreMult,
    funDuration: passive.funDuration,
  };
}
