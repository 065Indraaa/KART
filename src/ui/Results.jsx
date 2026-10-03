import "./screens.css";
import { useRace } from "../raceStore";
import { useProgress } from "../progressStore";
import { scoring, raceConfig } from "../theme";
import { formatTime } from "./formatTime";

const headingFor = (place) => {
  if (place === 1) return "VICTORY";
  if (place === 2 || place === 3) return "PODIUM";
  return "FINISHED";
};

// Post-race results overlay. Reads useRace.results (persistence handled
// elsewhere); only displays. Highlights new personal best / best time.
export default function Results({ onMenu, onRetry, onGarage }) {
  const results = useRace((s) => s.results);
  const personalBest = useProgress((s) => s.personalBest);
  const bestTime = useProgress((s) => s.bestTime);

  if (!results) return null;

  const {
    place,
    score,
    baseScore,
    timeBonus,
    coins,
    overtakes,
    fudHits,
    timeMs,
  } = results;

  const fieldSize = raceConfig.racers;
  // Use >= / <= so the badge still shows if persistence already recorded it.
  const isNewBest = personalBest == null || score >= personalBest;
  const isBestTime =
    timeMs != null && (bestTime == null || timeMs <= bestTime);

  const coinPts = coins * scoring.tapcoin;
  const overtakePts = overtakes * scoring.overtake;
  const fudPenalty = fudHits * scoring.fudHit; // negative

  return (
    <div className="dtf-overlay dtf-overlay--scrim">
      <div className="dtf-panel dtf-results">
        <h1 className="dtf-title dtf-results__place">{headingFor(place)}</h1>
        <p className="dtf-results__sub">
          Finished P{place}/{fieldSize}
        </p>

        <div className="dtf-results__badges">
          {isNewBest && <span className="dtf-newbest">New Best!</span>}
          {isBestTime && (
            <span className="dtf-newbest dtf-newbest--time">Best Time!</span>
          )}
        </div>

        <div className="dtf-breakdown">
          <div className="dtf-row">
            <span className="dtf-row__k">Base Score</span>
            <span className="dtf-row__v">{baseScore.toLocaleString()}</span>
          </div>
          <div className="dtf-row">
            <span className="dtf-row__k">Tapcoins ×{scoring.tapcoin}</span>
            <span className="dtf-row__v dtf-row__v--pos">
              {coins} · +{coinPts.toLocaleString()}
            </span>
          </div>
          <div className="dtf-row">
            <span className="dtf-row__k">Overtakes ×{scoring.overtake}</span>
            <span className="dtf-row__v dtf-row__v--pos">
              {overtakes} · +{overtakePts.toLocaleString()}
            </span>
          </div>
          <div className="dtf-row">
            <span className="dtf-row__k">FUD Hits</span>
            <span className="dtf-row__v dtf-row__v--neg">
              {fudHits} · {fudPenalty.toLocaleString()}
            </span>
          </div>
          <div className="dtf-row">
            <span className="dtf-row__k">Time Bonus</span>
            <span className="dtf-row__v dtf-row__v--pos">
              +{Math.max(0, timeBonus).toLocaleString()}
            </span>
          </div>
          <div className="dtf-row dtf-row--final">
            <span className="dtf-row__k">Final Score</span>
            <span className="dtf-row__v">{score.toLocaleString()}</span>
          </div>
        </div>

        <div className="dtf-results__time">
          Finish Time {formatTime(timeMs)}
        </div>

        <div className="dtf-results__earned dtf-coin">
          <span className="dtf-coin__icon" aria-hidden="true"><img src="/assets/tap-coin.png" alt="" /></span>
          +{coins} Tapcoins earned
        </div>

        <div className="dtf-results__actions">
          <button
            type="button"
            className="dtf-btn dtf-btn--primary"
            onClick={onRetry}
            aria-label="Retry the race"
          >
            Retry
          </button>
          <button
            type="button"
            className="dtf-btn dtf-btn--secondary"
            onClick={onGarage}
            aria-label="Open the garage"
          >
            Garage
          </button>
          <button
            type="button"
            className="dtf-btn dtf-btn--ghost"
            onClick={onMenu}
            aria-label="Return to main menu"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
