import VFXParticles from "../wawa-vfx/VFXParticles";
import VFXEmitter from "../wawa-vfx/VFXEmitter";
import { palette } from "../theme";

/**
 * ObjectVFX — declares the shared particle pools for pickups and impacts.
 * Mount once (alongside the other <VFXParticles> pools in the scene). Other
 * code triggers them via the VFX store's emit(name, ...) or the burst emitter
 * helpers exported below.
 *
 * Pools: "coinSparkle" (gold), "funBurst" (blue), "fudImpact" (dark + red).
 */
export function ObjectVFX() {
  return (
    <>
      <VFXParticles
        name="coinSparkle"
        settings={{
          nbParticles: 400,
          intensity: 3,
          renderMode: "billboard",
          appearance: "circular",
          fadeAlpha: [0, 1],
          fadeSize: [0, 0.8],
          gravity: [0, 2, 0], // slight upward drift
          frustumCulled: false,
        }}
      />

      <VFXParticles
        name="funBurst"
        settings={{
          nbParticles: 600,
          intensity: 3,
          renderMode: "billboard",
          appearance: "circular",
          fadeAlpha: [0, 1],
          fadeSize: [0, 0.9],
          gravity: [0, 0, 0],
          frustumCulled: false,
        }}
      />

      <VFXParticles
        name="fudImpact"
        settings={{
          nbParticles: 400,
          intensity: 2.5,
          renderMode: "stretchBillboard",
          fadeAlpha: [0, 1],
          fadeSize: [0, 0.9],
          gravity: [0, -1, 0],
          frustumCulled: false,
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Minimal burst-emitter helpers (wawa-vfx VFXEmitter pattern). Drop one at a
// world position to fire a one-shot burst into the matching pool.
// ---------------------------------------------------------------------------

export function CoinSparkleBurst(props) {
  return (
    <VFXEmitter
      emitter="coinSparkle"
      settings={{
        nbParticles: 40,
        spawnMode: "burst",
        colorStart: [palette.tapcoin, palette.tapcoinGlow],
        colorEnd: [palette.tapcoinGlow],
        particlesLifetime: [0.3, 0.8],
        speed: [3, 8],
        size: [0.1, 0.35],
        directionMin: [-1, 0.4, -1],
        directionMax: [1, 1.4, 1],
      }}
      {...props}
    />
  );
}

export function FunBurst(props) {
  return (
    <VFXEmitter
      emitter="funBurst"
      settings={{
        nbParticles: 60,
        spawnMode: "burst",
        colorStart: [palette.fun, palette.funGlow],
        colorEnd: [palette.funGlow],
        particlesLifetime: [0.3, 0.9],
        speed: [4, 12],
        size: [0.1, 0.4],
        directionMin: [-1, -1, -1],
        directionMax: [1, 1, 1],
      }}
      {...props}
    />
  );
}

export function FudImpactBurst(props) {
  return (
    <VFXEmitter
      emitter="fudImpact"
      settings={{
        nbParticles: 50,
        spawnMode: "burst",
        colorStart: [palette.fudEye, palette.fudGlow, palette.fudBody],
        colorEnd: [palette.fudBody],
        particlesLifetime: [0.2, 0.6],
        speed: [8, 18],
        size: [0.1, 0.3],
        directionMin: [-1, 0, -1],
        directionMax: [1, 0.6, 1],
      }}
      {...props}
    />
  );
}

export default ObjectVFX;
