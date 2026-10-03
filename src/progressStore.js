import { create } from "zustand";
import { persist } from "zustand/middleware";
import { karts, characters } from "./theme";

// Persistent player progression for "Dodge the FUD".
// Survives reloads via localStorage. Holds currency, ownership, selection,
// upgrades, personal best and a local leaderboard.

const defaultOwnedKarts = Object.values(karts)
  .filter((k) => k.unlocked)
  .map((k) => k.id);
const defaultOwnedChars = Object.values(characters)
  .filter((c) => c.unlocked)
  .map((c) => c.id);

export const useProgress = create(
  persist(
    (set, get) => ({
      tapcoins: 0,
      ownedKarts: defaultOwnedKarts,
      ownedCharacters: defaultOwnedChars,
      selectedKart: "starter",
      selectedCharacter: "satoshi",
      // Per-kart upgrade levels (0..3) with tradeoff dimensions.
      upgrades: {}, // { [kartId]: { speed, handling, fudResistance } }
      personalBest: null, // best final score
      bestTime: null, // best finish time (ms)
      leaderboard: [], // [{ name, score, time, date }]

      addTapcoins: (n) => set({ tapcoins: Math.max(0, get().tapcoins + n) }),

      canAfford: (price) => get().tapcoins >= price,

      buyKart: (id) => {
        const k = karts[id];
        const s = get();
        if (!k || s.ownedKarts.includes(id) || s.tapcoins < k.price) return false;
        set({ tapcoins: s.tapcoins - k.price, ownedKarts: [...s.ownedKarts, id] });
        return true;
      },

      buyCharacter: (id) => {
        const c = characters[id];
        const s = get();
        if (!c || s.ownedCharacters.includes(id) || s.tapcoins < c.price) return false;
        set({ tapcoins: s.tapcoins - c.price, ownedCharacters: [...s.ownedCharacters, id] });
        return true;
      },

      selectKart: (id) => get().ownedKarts.includes(id) && set({ selectedKart: id }),
      selectCharacter: (id) =>
        get().ownedCharacters.includes(id) && set({ selectedCharacter: id }),

      // Upgrades cost scales with level; each level trades one stat up slightly.
      upgradeKart: (id, dimension) => {
        const s = get();
        const cur = s.upgrades[id]?.[dimension] ?? 0;
        if (cur >= 3) return false;
        const cost = 500 * (cur + 1);
        if (s.tapcoins < cost) return false;
        set({
          tapcoins: s.tapcoins - cost,
          upgrades: {
            ...s.upgrades,
            [id]: { ...(s.upgrades[id] || {}), [dimension]: cur + 1 },
          },
        });
        return true;
      },

      recordResult: ({ name = "YOU", score, time }) => {
        const s = get();
        const isBestScore = s.personalBest == null || score > s.personalBest;
        const isBestTime = time != null && (s.bestTime == null || time < s.bestTime);
        const entry = { name, score, time, date: Date.now() };
        const leaderboard = [...s.leaderboard, entry]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        set({
          personalBest: isBestScore ? score : s.personalBest,
          bestTime: isBestTime ? time : s.bestTime,
          leaderboard,
        });
        return { isBestScore, isBestTime };
      },

      resetProgress: () =>
        set({
          tapcoins: 0,
          ownedKarts: defaultOwnedKarts,
          ownedCharacters: defaultOwnedChars,
          selectedKart: "starter",
          selectedCharacter: "satoshi",
          upgrades: {},
          personalBest: null,
          bestTime: null,
          leaderboard: [],
        }),
    }),
    { name: "dodge-the-fud-save" }
  )
);
