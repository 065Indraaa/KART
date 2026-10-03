import { create } from "zustand";
import { raceConfig, scoring, funEffects } from "./theme";

// Live race state machine for "Dodge the FUD".
// Owns the 5-racer registry, live ranking, player score/coins and the active
// FUN effect timers. A <RaceManager> component drives updates each frame; the
// HUD and Results screens read from here.

export const PHASE = {
  MENU: "MENU",
  GARAGE: "GARAGE",
  LOADING: "LOADING",
  COUNTDOWN: "COUNTDOWN",
  RACING: "RACING",
  FINISHED: "FINISHED", // player crossed line; results pending
  RESULTS: "RESULTS",
};

const freshRaceState = () => ({
  racers: [], // {id,name,isPlayer,kart,character,lap,cpIndex,progress,finished,finishTime,place}
  playerId: null,
  score: 0,
  coins: 0,
  overtakes: 0,
  fudHits: 0,
  cleanLap: true, // reset each lap; true -> clean-lap bonus
  lap: 0,
  totalLaps: raceConfig.totalLaps,
  raceTime: 0,
  activeEffects: [], // {type,label,color,until}  (until in raceTime seconds; 0 = instant)
  heldItem: null,    // FUN effect id the player is carrying (use with E)
  countdown: null,   // 3,2,1,0(GO) during COUNTDOWN; null otherwise
  lastPlayerPlace: raceConfig.racers,
  results: null,
});

export const useRace = create((set, get) => ({
  phase: PHASE.MENU,
  ...freshRaceState(),

  setPhase: (phase) => set({ phase }),

  setCountdown: (countdown) => set({ countdown }),

  // FUN held-item: picking a box grants one; pressing E consumes it. The world
  // side-effects (timed effect, repair, disrupt) are run by the RaceManager;
  // this just carries the id and clears it.
  grantItem: (type) => set({ heldItem: type }),
  consumeItem: () => {
    const t = get().heldItem;
    if (t) set({ heldItem: null });
    return t;
  },

  resetRace: () => set({ ...freshRaceState() }),

  registerRacer: (racer) =>
    set((s) => {
      if (s.racers.find((r) => r.id === racer.id)) return s;
      const base = {
        lap: 0,
        cpIndex: 0,
        progress: 0,
        finished: false,
        finishTime: null,
        place: s.racers.length + 1,
        isPlayer: false,
        ...racer,
      };
      return {
        racers: [...s.racers, base],
        playerId: base.isPlayer ? base.id : s.playerId,
      };
    }),

  // progress is a monotonic scalar: lap*large + cpIndex + fractionToNextCp.
  updateRacerProgress: (id, patch) =>
    set((s) => ({
      racers: s.racers.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  // Recompute places from progress; detect player overtakes for scoring.
  computePositions: () =>
    set((s) => {
      const ranked = [...s.racers].sort((a, b) => {
        if (a.finished && b.finished) return a.finishTime - b.finishTime;
        if (a.finished) return -1;
        if (b.finished) return 1;
        return b.progress - a.progress;
      });
      const racers = s.racers.map((r) => ({
        ...r,
        place: ranked.findIndex((x) => x.id === r.id) + 1,
      }));
      const player = racers.find((r) => r.isPlayer);
      let { score, overtakes, lastPlayerPlace } = s;
      if (player && !player.finished && player.place < lastPlayerPlace) {
        const gained = lastPlayerPlace - player.place;
        overtakes += gained;
        score += gained * scoring.overtake;
      }
      if (player) lastPlayerPlace = player.place;
      return { racers, score, overtakes, lastPlayerPlace };
    }),

  addScore: (n) => set((s) => ({ score: Math.max(0, s.score + Math.round(n)) })),

  collectCoin: (mult = 1) =>
    set((s) => ({ coins: s.coins + 1, score: s.score + scoring.tapcoin * mult })),

  registerFudHit: () =>
    set((s) => ({
      fudHits: s.fudHits + 1,
      score: Math.max(0, s.score + scoring.fudHit),
      cleanLap: false,
    })),

  // durationScale extends timed FUN effects (character passive funDuration).
  applyFunEffect: (type, durationScale = 1) =>
    set((s) => {
      const def = funEffects[type];
      if (!def) return s;
      const duration = def.duration * Math.max(0, durationScale);
      const until = duration > 0 ? s.raceTime + duration : 0;
      const activeEffects = [
        ...s.activeEffects.filter((e) => e.type !== type),
        { type, label: def.label, color: def.color, until, magnitude: def.magnitude },
      ];
      return { activeEffects, score: s.score + scoring.funUseBonus };
    }),

  hasEffect: (type) => get().activeEffects.some((e) => e.type === type),

  // Called by RaceManager each frame.
  tick: (dt) =>
    set((s) => {
      if (s.phase !== PHASE.RACING) return s;
      const raceTime = s.raceTime + dt;
      const activeEffects = s.activeEffects.filter((e) => e.until === 0 || e.until > raceTime);
      return { raceTime, activeEffects };
    }),

  completeLap: () =>
    set((s) => {
      let score = s.score;
      if (s.cleanLap) score += scoring.cleanLap;
      return { lap: Math.min(s.lap + 1, s.totalLaps), score, cleanLap: true };
    }),

  finishRacer: (id) =>
    set((s) => {
      const racers = s.racers.map((r) =>
        r.id === id && !r.finished ? { ...r, finished: true, finishTime: s.raceTime } : r
      );
      return { racers };
    }),

  // opts.scoreMult applies the selected character's score passive to the final
  // score (passed by RaceManager from the player kart's tuning).
  finishRace: (opts = {}) =>
    set((s) => {
      const player = s.racers.find((r) => r.isPlayer);
      const place = player?.place ?? s.racers.length;
      const timeMs = Math.round(s.raceTime * 1000);
      // Time bonus scaled by finishing position (1st keeps most of it).
      const timeBonus = Math.round(scoring.timeBonus * (1 - (place - 1) / s.racers.length));
      const scoreMult = Math.max(0, opts.scoreMult ?? 1);
      const finalScore = Math.round((s.score + Math.max(0, timeBonus)) * scoreMult);
      const results = {
        place,
        score: finalScore,
        baseScore: s.score,
        timeBonus,
        scoreMult,
        coins: s.coins,
        overtakes: s.overtakes,
        fudHits: s.fudHits,
        timeMs,
      };
      return { phase: PHASE.FINISHED, score: finalScore, results };
    }),
}));
