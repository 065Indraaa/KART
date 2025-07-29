import { useEffect, useState, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { WebGPUCanvas } from './WebGPUCanvas.jsx'
import { MobileControls } from './mobile/MobileControls.jsx'
import { LoadingScreen } from './LoadingScreen.jsx'
import HomePage from './HomePage.jsx'
import GameUI from './GameUI.jsx'
import GameReadyCheck from './GameReadyCheck.jsx'
import { useGameManager } from './gameManager.js'

const Root = () => {
  const { 
    showHomepage, 
    isPlaying, 
    startGame, 
    startCountdown, 
    gameStarted 
  } = useGameManager();

  // Initialize audio context on user interaction
  useEffect(() => {
    // Create a function to initialize audio
    const initAudio = () => {
      try {
        // Create audio context to unlock audio on iOS/Safari
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const audioCtx = new AudioContext();
          // Create and play a silent buffer to unlock audio
          const buffer = audioCtx.createBuffer(1, 1, 22050);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start(0);
          
          // Resume audio context if suspended
          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }
          
          console.log('Audio initialized');
        }
      } catch (e) {
        console.warn('Web Audio API not supported');
      }
      
      // Remove event listeners once audio is initialized
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
    
    // Add event listeners for user interaction
    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('keydown', initAudio);
    
    return () => {
      // Clean up listeners
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      document.removeEventListener('keydown', initAudio);
    };
  }, []);

  const handleStartGame = () => {
    startGame(false); // Regular mode
    setTimeout(() => {
      startCountdown(); // Start the countdown after state update completes
    }, 100);
  };

  const handleTimeTrial = () => {
    startGame(true); // Time Trial mode
    setTimeout(() => {
      startCountdown(); // Start the countdown after state update completes
    }, 100);
  };

  return (
    <>
      {showHomepage ? (
        <HomePage onStartGame={handleStartGame} onTimeTrial={handleTimeTrial} />
      ) : (
        <div className='canvas-container'>
          <MobileControls />
          <Suspense fallback={false}>
            <WebGPUCanvas />
          </Suspense>
          {/* Always show LoadingScreen initially; it will handle its own visibility */}
          <LoadingScreen />
          {/* Only show GameUI when game has actually started */}
          {gameStarted && <GameUI />}
          {/* Safety mechanism to ensure game starts */}
          <GameReadyCheck />
          <div className="version">v0.4.0</div>
        </div>
      )}
    </>
  );
};

createRoot(document.getElementById('root')).render(<Root />)
