import { useState } from "react";
import "./screens.css";
import { karts, characters } from "../theme";
import { useProgress } from "../progressStore";

const STAT_LABELS = {
  topSpeed: "Top Speed",
  acceleration: "Accel",
  handling: "Handling",
  drift: "Drift",
  stability: "Stability",
  recovery: "Recovery",
  fudResistance: "FUD Resist",
};

const UPGRADE_DIMS = [
  ["speed", "Speed"],
  ["handling", "Handling"],
  ["fudResistance", "FUD Resist"],
];

const MAX_UPGRADE = 3;

// Build human-readable tags from a character's passive object (non-zero only).
function buildPassiveTags(passive) {
  const pct = (v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`;
  const tags = [];
  if (passive.tapcoinBonus) tags.push(`${pct(passive.tapcoinBonus)} Tapcoins`);
  if (passive.scoreMult && passive.scoreMult !== 1)
    tags.push(`${pct(passive.scoreMult - 1)} Score`);
  if (passive.accelBonus) tags.push(`${pct(passive.accelBonus)} Accel`);
  if (passive.fudResistance) tags.push(`${pct(passive.fudResistance)} FUD Resist`);
  if (passive.recovery) tags.push(`${pct(passive.recovery)} Recovery`);
  if (passive.funDuration) tags.push(`${pct(passive.funDuration)} FUN Time`);
  if (!tags.length) tags.push("No bonuses");
  return tags;
}

function StatBar({ label, value }) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="dtf-stat">
      <span className="dtf-stat__label">{label}</span>
      <span className="dtf-stat__val">{Math.round(v * 100)}</span>
      <div
        className="dtf-stat__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-label={label}
      >
        <div className="dtf-stat__fill" style={{ width: `${v * 100}%` }} />
      </div>
    </div>
  );
}

function LevelDots({ level }) {
  return (
    <span className="dtf-dots" aria-label={`Level ${level} of ${MAX_UPGRADE}`}>
      {Array.from({ length: MAX_UPGRADE }, (_, i) => (
        <span key={i} className={`dtf-dot ${i < level ? "dtf-dot--on" : ""}`} />
      ))}
    </span>
  );
}

function KartCard({ kart, owned, selected, upgradeLevels }) {
  const tapcoins = useProgress((s) => s.tapcoins);
  const canAfford = useProgress((s) => s.canAfford);
  const buyKart = useProgress((s) => s.buyKart);
  const selectKart = useProgress((s) => s.selectKart);
  const upgradeKart = useProgress((s) => s.upgradeKart);

  const affordable = canAfford(kart.price);

  return (
    <div
      className={`dtf-card ${selected ? "dtf-card--selected" : ""} ${
        owned ? "" : "dtf-card--locked"
      }`}
    >
      <div className="dtf-card__top">
        <span
          className="dtf-swatch"
          style={{ background: kart.bodyColor, color: kart.bodyColor }}
          aria-hidden="true"
        />
        <h3 className="dtf-card__name">{kart.name}</h3>
        {selected && <span className="dtf-badge">Selected</span>}
      </div>

      <p className="dtf-card__blurb">{kart.blurb}</p>

      <div className="dtf-stats">
        {Object.entries(STAT_LABELS).map(([key, label]) => (
          <StatBar key={key} label={label} value={kart.stats[key]} />
        ))}
      </div>

      <div className="dtf-upgrades">
        {UPGRADE_DIMS.map(([dim, label]) => {
          const level = upgradeLevels?.[dim] ?? 0;
          const maxed = level >= MAX_UPGRADE;
          const cost = 500 * (level + 1);
          const canBuy = owned && !maxed && tapcoins >= cost;
          return (
            <div className="dtf-upgrade" key={dim}>
              <span className="dtf-upgrade__label">{label}</span>
              <LevelDots level={level} />
              <button
                type="button"
                className="dtf-btn dtf-btn--ghost dtf-btn--sm"
                onClick={() => upgradeKart(kart.id, dim)}
                disabled={!canBuy}
                aria-label={
                  maxed
                    ? `${label} fully upgraded`
                    : `Upgrade ${label} for ${cost} Tapcoins`
                }
              >
                {maxed ? "Max" : `▲ ${cost}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="dtf-card__actions">
        {owned ? (
          <button
            type="button"
            className={`dtf-btn ${selected ? "dtf-btn--primary" : "dtf-btn--secondary"}`}
            onClick={() => selectKart(kart.id)}
            disabled={selected}
            aria-label={`Select ${kart.name}`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : (
          <button
            type="button"
            className="dtf-btn dtf-btn--primary"
            onClick={() => buyKart(kart.id)}
            disabled={!affordable}
            aria-label={`Buy ${kart.name} for ${kart.price} Tapcoins`}
          >
            Buy · {kart.price.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}

function CharacterCard({ character, owned, selected }) {
  const canAfford = useProgress((s) => s.canAfford);
  const buyCharacter = useProgress((s) => s.buyCharacter);
  const selectCharacter = useProgress((s) => s.selectCharacter);

  const affordable = canAfford(character.price);
  const tags = buildPassiveTags(character.passive);

  return (
    <div
      className={`dtf-card ${selected ? "dtf-card--selected" : ""} ${
        owned ? "" : "dtf-card--locked"
      }`}
    >
      <div className="dtf-card__top">
        <span
          className="dtf-swatch"
          style={{ background: character.accent, color: character.accent }}
          aria-hidden="true"
        />
        <h3 className="dtf-card__name">{character.name}</h3>
        {selected && <span className="dtf-badge">Selected</span>}
      </div>

      <p className="dtf-card__blurb">{character.blurb}</p>

      <div className="dtf-passive">
        {tags.map((t) => (
          <span className="dtf-tag" key={t}>
            {t}
          </span>
        ))}
      </div>

      <div className="dtf-card__actions">
        {owned ? (
          <button
            type="button"
            className={`dtf-btn ${selected ? "dtf-btn--primary" : "dtf-btn--secondary"}`}
            onClick={() => selectCharacter(character.id)}
            disabled={selected}
            aria-label={`Select ${character.name}`}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : (
          <button
            type="button"
            className="dtf-btn dtf-btn--primary"
            onClick={() => buyCharacter(character.id)}
            disabled={!affordable}
            aria-label={`Buy ${character.name} for ${character.price} Tapcoins`}
          >
            Buy · {character.price.toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}

// Garage screen: browse / buy / select karts and characters, upgrade karts.
// All store reads are live selectors so the UI reflects purchases instantly.
export default function Garage({ onBack, onRace }) {
  const [tab, setTab] = useState("karts");

  const tapcoins = useProgress((s) => s.tapcoins);
  const ownedKarts = useProgress((s) => s.ownedKarts);
  const ownedCharacters = useProgress((s) => s.ownedCharacters);
  const selectedKart = useProgress((s) => s.selectedKart);
  const selectedCharacter = useProgress((s) => s.selectedCharacter);
  const upgrades = useProgress((s) => s.upgrades);

  return (
    <div className="dtf-overlay dtf-overlay--scrim">
      <div className="dtf-panel dtf-garage">
        <header className="dtf-garage__head">
          <h2 className="dtf-heading">Garage</h2>
          <div className="dtf-tabs" role="tablist" aria-label="Garage sections">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "karts"}
              className={`dtf-tab ${tab === "karts" ? "dtf-tab--active" : ""}`}
              onClick={() => setTab("karts")}
            >
              Karts
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "characters"}
              className={`dtf-tab ${tab === "characters" ? "dtf-tab--active" : ""}`}
              onClick={() => setTab("characters")}
            >
              Characters
            </button>
          </div>
          <span className="dtf-coin" aria-label={`${tapcoins} Tapcoins`}>
            <span className="dtf-coin__icon" aria-hidden="true"><img src="/assets/tap-coin.png" alt="" /></span>
            {tapcoins.toLocaleString()}
          </span>
        </header>

        <div className="dtf-garage__grid">
          {tab === "karts"
            ? Object.values(karts).map((kart) => (
                <KartCard
                  key={kart.id}
                  kart={kart}
                  owned={ownedKarts.includes(kart.id)}
                  selected={selectedKart === kart.id}
                  upgradeLevels={upgrades[kart.id]}
                />
              ))
            : Object.values(characters).map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  owned={ownedCharacters.includes(character.id)}
                  selected={selectedCharacter === character.id}
                />
              ))}
        </div>

        <footer className="dtf-garage__foot">
          <button
            type="button"
            className="dtf-btn dtf-btn--ghost"
            onClick={onBack}
            aria-label="Back to main menu"
          >
            Back
          </button>
          <button
            type="button"
            className="dtf-btn dtf-btn--primary"
            onClick={onRace}
            aria-label="Start a race"
          >
            Race
          </button>
        </footer>
      </div>
    </div>
  );
}
