import "./screens.css";
import { useProgress } from "../progressStore";

// Main menu overlay for "Dodge the FUD".
// Big title, tagline, RACE + GARAGE actions, live Tapcoin balance and best score.
export default function MainMenu({ onPlay, onGarage }) {
  const tapcoins = useProgress((s) => s.tapcoins);
  const personalBest = useProgress((s) => s.personalBest);

  return (
    <div className="dtf-overlay dtf-overlay--menu">
      <div className="dtf-menu">
        <p className="dtf-menu__tag">Tropical Crypto Kart Racing</p>
        <h1 className="dtf-title dtf-menu__title">
          Dodge
          <br />
          the FUD
        </h1>

        <div className="dtf-menu__stats">
          <div className="dtf-chip">
            <span className="dtf-chip__k">Tapcoins</span>
            <span className="dtf-chip__v dtf-coin">
              <span className="dtf-coin__icon" aria-hidden="true"><img src="/assets/tap-coin.png" alt="" /></span>
              {tapcoins.toLocaleString()}
            </span>
          </div>
          {personalBest != null && (
            <div className="dtf-chip">
              <span className="dtf-chip__k">Personal Best</span>
              <span className="dtf-chip__v dtf-gold-text">
                {personalBest.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="dtf-menu__actions">
          <button
            type="button"
            className="dtf-btn dtf-btn--primary"
            onClick={onPlay}
            aria-label="Start a race"
          >
            Race
          </button>
          <button
            type="button"
            className="dtf-btn dtf-btn--secondary"
            onClick={onGarage}
            aria-label="Open the garage"
          >
            Garage
          </button>
        </div>

        <p className="dtf-menu__hint">
          WASD / Arrows to drive · Space to drift · E to use FUN · R to reset
        </p>
      </div>
    </div>
  );
}
