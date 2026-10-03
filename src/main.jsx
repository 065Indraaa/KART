import { useEffect, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./ui/screens.css";
import { WebGPUCanvas } from "./WebGPUCanvas.jsx";
import { MobileControls } from "./mobile/MobileControls.jsx";
import { LoadingScreen } from "./LoadingScreen.jsx";
import MainMenu from "./ui/MainMenu.jsx";
import Garage from "./ui/Garage.jsx";
import Results from "./ui/Results.jsx";
import HUD from "./ui/HUD.jsx";
import { useRace, PHASE } from "./raceStore.js";
import * as audio from "./audio/audioManager.js";

// GO fades to nothing; 3/2/1 pulse. Driven by raceStore.countdown.
const Countdown = () => {
  const countdown = useRace((s) => s.countdown);
  if (countdown == null) return null;
  return (
    <div className="dtf-countdown">
      <span className="dtf-countdown__num">{countdown === 0 ? "GO!" : countdown}</span>
    </div>
  );
};

const Root = () => {
  const phase = useRace((s) => s.phase);
  const setPhase = useRace((s) => s.setPhase);
  const resetRace = useRace((s) => s.resetRace);

  // Unlock + preload audio on the first user gesture (browser autoplay policy).
  useEffect(() => {
    const kick = () => {
      audio.unlock();
      audio.preload();
    };
    document.addEventListener("click", kick, { once: true });
    document.addEventListener("touchstart", kick, { once: true });
    document.addEventListener("keydown", kick, { once: true });
    return () => {
      document.removeEventListener("click", kick);
      document.removeEventListener("touchstart", kick);
      document.removeEventListener("keydown", kick);
    };
  }, []);

  const startRace = () => {
    resetRace();
    setPhase(PHASE.COUNTDOWN);
  };

  const inGame =
    phase === PHASE.COUNTDOWN ||
    phase === PHASE.RACING ||
    phase === PHASE.FINISHED ||
    phase === PHASE.RESULTS;

  const showHud =
    phase === PHASE.COUNTDOWN || phase === PHASE.RACING || phase === PHASE.FINISHED;

  return (
    <>
      {phase === PHASE.MENU && (
        <MainMenu onPlay={startRace} onGarage={() => setPhase(PHASE.GARAGE)} />
      )}

      {phase === PHASE.GARAGE && (
        <Garage onBack={() => setPhase(PHASE.MENU)} onRace={startRace} />
      )}

      {inGame && (
        <div className="canvas-container">
          <MobileControls />
          <Suspense fallback={false}>
            <WebGPUCanvas />
          </Suspense>
          <LoadingScreen />
          {showHud && <HUD />}
          <Countdown />
          {phase === PHASE.RESULTS && (
            <Results
              onMenu={() => setPhase(PHASE.MENU)}
              onRetry={startRace}
              onGarage={() => setPhase(PHASE.GARAGE)}
            />
          )}
          <div className="version">v0.5.0</div>
        </div>
      )}
    </>
  );
};

createRoot(document.getElementById("root")).render(<Root />);
