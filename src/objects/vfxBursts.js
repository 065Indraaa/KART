// Imperative one-shot particle bursts fired at a world position, straight into
// the pools declared by <ObjectVFX>. Avoids mounting a VFXEmitter per event.
import { useVFX } from "../wawa-vfx/VFXStore";
import { palette } from "../theme";

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

function burst(pool, pos, n, { colors, colorEnd, life, speed, size, up = 0.6 }) {
  const emit = useVFX.getState().emit;
  if (!emit) return;
  emit(pool, n, () => {
    const s = rand(size[0], size[1]);
    return {
      position: [pos[0] + rand(-0.3, 0.3), pos[1] + rand(0, 0.4), pos[2] + rand(-0.3, 0.3)],
      direction: [rand(-1, 1), rand(up * 0.3, up + 0.6), rand(-1, 1)],
      scale: [s, s, s],
      rotation: [0, 0, rand(0, Math.PI)],
      rotationSpeed: [0, 0, rand(-4, 4)],
      lifetime: [rand(life[0], life[1]), rand(life[0], life[1])],
      colorStart: pick(colors),
      colorEnd: colorEnd || pick(colors),
      speed: [rand(speed[0], speed[1])],
    };
  });
}

export function coinBurst(pos) {
  burst("coinSparkle", pos, 24, {
    colors: [palette.tapcoin, palette.tapcoinGlow], colorEnd: palette.tapcoinGlow,
    life: [0.3, 0.7], speed: [3, 8], size: [0.1, 0.3], up: 1.2,
  });
}
export function funBurst(pos) {
  burst("funBurst", pos, 40, {
    colors: [palette.fun, palette.funGlow], colorEnd: palette.funGlow,
    life: [0.3, 0.9], speed: [4, 12], size: [0.1, 0.4], up: 0.4,
  });
}
export function fudBurst(pos) {
  burst("fudImpact", pos, 36, {
    colors: [palette.fudEye, palette.fudGlow, palette.fudBody], colorEnd: palette.fudBody,
    life: [0.2, 0.6], speed: [8, 18], size: [0.1, 0.3], up: 0.3,
  });
}
