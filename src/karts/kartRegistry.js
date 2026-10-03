// Live, per-frame registry of every kart's world state. Plain module singleton
// (not React state) so the AI and RaceManager can read opponents cheaply without
// triggering re-renders. KartControllers write here every frame; readers treat
// it as read-only.

const karts = new Map();

export function registerKart(id, meta = {}) {
  karts.set(id, {
    id,
    position: [0, 0, 0],
    heading: 0,
    speed: 0,
    progress: 0,
    place: 1,
    isPlayer: false,
    finished: false,
    ...meta,
  });
}

export function writeKart(id, patch) {
  const k = karts.get(id);
  if (k) Object.assign(k, patch);
}

export function getKart(id) {
  return karts.get(id);
}

export function allKarts() {
  return [...karts.values()];
}

// Everyone except `id`, shaped for AIController.ctx.opponents.
export function opponentsOf(id) {
  const out = [];
  for (const k of karts.values()) {
    if (k.id === id) continue;
    out.push({ id: k.id, position: k.position, speed: k.speed, isPlayer: k.isPlayer });
  }
  return out;
}

export function clearRegistry() {
  karts.clear();
}
