import { create } from "zustand";

export const useGameManager = create((set, get) => ({
  // Game state
  isPlaying: false,
  isTimeTrial: false,
  gameStarted: false,
  gameOver: false,
  showHomepage: true,
  countdown: 3,
  
  // Audio
  backgroundMusic: null,
  gameStartSound: null,
  gameOverSound: null,
  
  // Time trial data
  lapTimes: [],
  bestLapTime: null,
  currentLapTime: 0,
  currentLap: 0,
  totalTime: 0,
  
  // Direct setters for emergency use
  setGameStarted: () => set({ gameStarted: true, countdown: -1 }),
  
  // Game control functions
  startGame: (isTimeTrial = false) => {
    // Preload audio files
    const backgroundMusic = new Audio('./music/Mario Kart Wii OST.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3;
    // Preload audio to prevent delayed playback
    backgroundMusic.preload = 'auto';
    backgroundMusic.load();
    
    const gameStartSound = new Audio('./music/level-completed.wav');
    gameStartSound.volume = 0.5;
    gameStartSound.preload = 'auto';
    gameStartSound.load();
    
    const gameOverSound = new Audio('./music/game-over.wav');
    gameOverSound.volume = 0.5;
    gameOverSound.preload = 'auto';
    gameOverSound.load();
    
    // Add event listeners to handle audio playback issues
    backgroundMusic.addEventListener('canplaythrough', () => {
      console.log('Background music ready to play');
    });
    
    gameStartSound.addEventListener('canplaythrough', () => {
      console.log('Start sound ready to play');
    });
    
    // Setup audio context to ensure audio can play (fixes iOS/Safari issues)
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Resume audio context on user interaction (required by some browsers)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
    } catch (e) {
      console.warn('Web Audio API not supported in this browser');
    }
    
    // Apply performance optimizations for time trial mode
    console.log(`Starting game in ${isTimeTrial ? 'Time Trial' : 'Regular'} mode`);
    
    set({
      isPlaying: true,
      isTimeTrial, 
      gameStarted: false,
      gameOver: false,
      showHomepage: false,
      countdown: 3,
      backgroundMusic,
      gameStartSound,
      gameOverSound,
      totalTime: 0,
      currentLapTime: 0,
      currentLap: 0,
      lapTimes: [],
      // Add specific time trial performance settings
      timeTrialPerformanceMode: isTimeTrial
    });
  },
  
  startCountdown: () => {
    // Reset the countdown to ensure we start from 3
    set({ countdown: 3 });
    console.log("Countdown started: 3");
    
    // Start a timer that updates every second
    let currentCount = 3;
    const countdownInterval = setInterval(() => {
      currentCount -= 1;
      console.log("Countdown tick:", currentCount);
      
      if (currentCount >= 0) {
        // Update the countdown state
        set({ countdown: currentCount });
        
        // When we reach 0, play sounds and start the game
        if (currentCount === 0) {
          const state = get();
          const { gameStartSound, backgroundMusic } = state;
          
          // Play sound effects
          try {
            if (gameStartSound) {
              gameStartSound.play().catch(err => console.log("Error playing start sound:", err));
            }
            
            if (backgroundMusic) {
              backgroundMusic.play().catch(err => console.log("Error playing background music:", err));
            }
          } catch (error) {
            console.error("Error playing audio:", error);
          }
          
          // Show "GO!" for a short time, then start the game
          const goTimeout = setTimeout(() => {
            console.log("GO countdown complete, starting game now");
            set({ 
              gameStarted: true,
              countdown: -1 // Set to -1 to completely remove the countdown display
            });
            console.log("Game started!");
            
            // Double check to ensure game is actually started after a short delay
            setTimeout(() => {
              if (!get().gameStarted) {
                console.log("Recovery: Game didn't start properly, forcing start");
                set({ gameStarted: true, countdown: -1 });
              }
            }, 300);
          }, 800); // Reduced from 1000ms to 800ms for faster transition
          
          // Clear the interval
          clearInterval(countdownInterval);
        }
      }
    }, 1000);
    
    return () => clearInterval(countdownInterval);
  },
  
  endGame: () => {
    const { gameOverSound, backgroundMusic } = get();
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    
    if (gameOverSound) {
      gameOverSound.play();
    }
    
    set({
      gameOver: true,
      isPlaying: false
    });
  },
  
  returnToHomepage: () => {
    const { backgroundMusic, gameStartSound, gameOverSound } = get();
    
    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    
    if (gameStartSound) {
      gameStartSound.pause();
      gameStartSound.currentTime = 0;
    }
    
    if (gameOverSound) {
      gameOverSound.pause();
      gameOverSound.currentTime = 0;
    }
    
    set({
      showHomepage: true,
      isPlaying: false,
      gameStarted: false,
      gameOver: false,
      countdown: 3,
      backgroundMusic: null,
      gameStartSound: null,
      gameOverSound: null
    });
  },
  
  // Time trial functions
  startLap: () => {
    console.log("Starting new lap");
    set({
      currentLapTime: 0,
      currentLap: get().currentLap + 1
    });
  },
  
  endLap: (lapTime) => {
    console.log("Ending lap with time:", lapTime);
    const { lapTimes, bestLapTime } = get();
    
    // Ensure lapTime is valid
    if (isNaN(lapTime) || lapTime <= 0) {
      console.warn("Invalid lap time:", lapTime);
      return;
    }
    
    const newLapTimes = [...lapTimes, lapTime];
    
    set({
      lapTimes: newLapTimes,
      bestLapTime: bestLapTime === null || lapTime < bestLapTime ? lapTime : bestLapTime
    });
  },
  
  updateLapTime: (delta) => {
    if (get().gameStarted && !get().gameOver) {
      // Ensure delta is a valid number
      const validDelta = isNaN(delta) ? 0 : delta;
      
      if (validDelta < 0) {
        console.warn("Negative delta time:", delta);
        return; // Don't update with negative values
      }
      
      // If it's the first update, log it
      if (get().totalTime === 0) {
        console.log("First lap time update with delta:", validDelta);
      }
      
      // Update lap times with validated delta
      set(state => ({
        currentLapTime: state.currentLapTime + validDelta,
        totalTime: state.totalTime + validDelta
      }));
    }
  },
  
  formatTime: (milliseconds) => {
    // Ensure milliseconds is a valid number
    const validMs = isNaN(milliseconds) ? 0 : milliseconds;
    
    const totalSeconds = Math.floor(validMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = Math.floor((validMs % 1000) / 10);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
}));
