import "./screens.css";
import { useRace } from "../raceStore";
import { useGameStore } from "../store";
import { funEffects, raceConfig } from "../theme";
import { formatSeconds } from "./formatTime";

// In-race HUD overlay. Root is pointer-events:none so it never blocks driving.
// Reads live race + game state via zustand selectors.
export default function HUD() {
  const score = useRace((s) => s.score);
  const coins = useRace((s) => s.coins);
  const lap = useRace((s) => s.lap);
  const totalLaps = useRace((s) => s.totalLaps);
  const raceTime = useRace((s) => s.raceTime);
  const racers = useRace((s) => s.racers);
  const playerId = useRace((s) => s.playerId);
  const activeEffects = useRace((s) => s.activeEffects);
  const rawSpeed = useGameStore((s) => s.speed);

  const player = racers.find((r) => r.id === playerId) || null;
  const place = player?.place ?? racers.length ?? raceConfig.racers;
  const fieldSize = racers.length || raceConfig.racers;
  const lapShown = Math.min((lap ?? 0) + 1, totalLaps || raceConfig.totalLaps);
  const speed = Math.round(Math.abs(rawSpeed ?? 0));

  return (
    <div className="dtf-overlay dtf-overlay--pass">
      <div className="dtf-hud">
        {/* Top-left: score + coins */}
        <div className="dtf-hud__pane dtf-hud__tl">
          <span className="dtf-hud__label">Score</span>
          <div className="dtf-hud__score">{score.toLocaleString()}</div>
          <div className="dtf-hud__coins dtf-coin">
            <span className="dtf-coin__icon" aria-hidden="true"><img src="/assets/tap-coin.png" alt="" /></span>
            {coins}
          </div>
        </div>

        {/* Center-top: race clock */}
        <div className="dtf-hud__pane dtf-hud__time">
          <span className="dtf-hud__label">Time</span>
          <div className="dtf-hud__timeval">{formatSeconds(raceTime)}</div>
        </div>

        {/* Center-top: active FUN effects */}
        <div className="dtf-hud__effects" aria-live="polite">
          {activeEffects.map((fx) => {
            const def = funEffects[fx.type];
            const duration = def?.duration ?? 0;
            const hasTimer = fx.until > 0 && duration > 0;
            const remaining = hasTimer
              ? Math.max(0, Math.min(1, (fx.until - raceTime) / duration))
              : 0;
            return (
              <div
                key={fx.type}
                className="dtf-effect"
                style={{ "--fx": fx.color }}
              >
                <span className="dtf-effect__label">{fx.label}</span>
                {hasTimer && (
                  <div className="dtf-effect__bar">
                    <div
                      className="dtf-effect__barfill"
                      style={{ width: `${remaining * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Top-right: position + lap */}
        <div className="dtf-hud__pane dtf-hud__tr">
          <span className="dtf-hud__label">Position</span>
          <div className="dtf-hud__pos">
            P{place}/{fieldSize}
          </div>
          <div className="dtf-hud__lap">
            Lap {lapShown}/{totalLaps || raceConfig.totalLaps}
          </div>
        </div>

        {/* Bottom-left: speed readout */}
        <div className="dtf-hud__pane dtf-hud__bl">
          <span className="dtf-hud__label">Speed</span>
          <div className="dtf-hud__speed">
            <span className="dtf-hud__speedval">{speed}</span>
            <span className="dtf-hud__speedunit">km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
