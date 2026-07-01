// Sound effects and haptic feedback utilities

// Audio context for generating sounds
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

// Resume audio context (needed after user interaction on mobile)
export function initAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

// Haptic feedback
export function vibrate(pattern: number | number[]) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration not supported or blocked
    }
  }
}

// Sound generation helpers
function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Envelope
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not supported
  }
}

function playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume = 0.15) {
  frequencies.forEach(freq => playTone(freq, duration, type, volume));
}

// Sound effects
export const sounds = {
  // Selection tap - short click
  tap: () => {
    playTone(800, 0.05, 'sine', 0.2);
    vibrate(10);
  },
  
  // Answer selected - satisfying click
  select: () => {
    playTone(600, 0.08, 'sine', 0.25);
    playTone(900, 0.08, 'sine', 0.15);
    vibrate(15);
  },
  
  // Correct answer - happy ascending arpeggio
  correct: () => {
    getAudioContext();
    
    playTone(523, 0.15, 'sine', 0.3); // C5
    setTimeout(() => playTone(659, 0.15, 'sine', 0.3), 80); // E5
    setTimeout(() => playTone(784, 0.2, 'sine', 0.35), 160); // G5
    setTimeout(() => playTone(1047, 0.3, 'sine', 0.4), 240); // C6
    
    vibrate([30, 50, 30, 50, 50]);
  },
  
  // Wrong answer - descending minor tone
  wrong: () => {
    playTone(400, 0.15, 'square', 0.2);
    setTimeout(() => playTone(300, 0.2, 'square', 0.15), 100);
    
    vibrate([50, 30, 100]);
  },
  
  // Timer tick - for last 5 seconds
  tick: () => {
    playTone(1000, 0.05, 'sine', 0.15);
    vibrate(5);
  },
  
  // Timer warning - last 3 seconds, more urgent
  tickUrgent: () => {
    playTone(1200, 0.08, 'square', 0.2);
    vibrate(15);
  },
  
  // Time's up - buzzer
  timeUp: () => {
    playTone(200, 0.3, 'sawtooth', 0.25);
    playTone(150, 0.3, 'sawtooth', 0.2);
    vibrate([100, 50, 100]);
  },
  
  // Points awarded - coin sound
  points: () => {
    playTone(1319, 0.1, 'sine', 0.25); // E6
    setTimeout(() => playTone(1568, 0.15, 'sine', 0.3), 80); // G6
    vibrate(20);
  },
  
  // Game start - fanfare
  gameStart: () => {
    playChord([523, 659, 784], 0.2, 'sine', 0.2); // C major
    setTimeout(() => playChord([587, 740, 880], 0.2, 'sine', 0.2), 200); // D major
    setTimeout(() => playChord([659, 831, 988], 0.3, 'sine', 0.25), 400); // E major
    
    vibrate([50, 50, 50, 50, 100]);
  },
  
  // Question appear - whoosh
  questionAppear: () => {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);
    
    vibrate(25);
  },
  
  // Countdown beep - 3, 2, 1
  countdownBeep: (final = false) => {
    if (final) {
      playTone(880, 0.2, 'sine', 0.35); // A5 - higher for "GO"
      vibrate(50);
    } else {
      playTone(660, 0.15, 'sine', 0.25); // E5
      vibrate(20);
    }
  },
  
  // Game over - triumphant
  gameOver: () => {
    const notes = [
      { freq: 523, delay: 0 },    // C5
      { freq: 659, delay: 150 },  // E5
      { freq: 784, delay: 300 },  // G5
      { freq: 1047, delay: 450 }, // C6
      { freq: 784, delay: 600 },  // G5
      { freq: 1047, delay: 750 }, // C6
    ];
    
    notes.forEach(({ freq, delay }) => {
      setTimeout(() => playTone(freq, 0.2, 'sine', 0.25), delay);
    });
    
    vibrate([50, 100, 50, 100, 50, 200]);
  },
  
  // Leaderboard position reveal
  rankReveal: () => {
    playTone(880, 0.1, 'sine', 0.2);
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.25), 100);
    vibrate(30);
  },
  
  // Game starting alert - loud attention-grabbing alert for players
  gameStartAlert: () => {
    // Initialize audio context
    getAudioContext();
    
    // First burst - wake up!
    playChord([523, 659, 784], 0.25, 'sine', 0.4); // C major loud
    
    // Second burst - slightly higher
    setTimeout(() => {
      playChord([587, 740, 880], 0.25, 'sine', 0.45); // D major
    }, 300);
    
    // Third burst - highest, triumphant
    setTimeout(() => {
      playChord([659, 831, 988], 0.35, 'sine', 0.5); // E major
      playTone(1319, 0.4, 'sine', 0.35); // High E for extra brightness
    }, 600);
    
    // Final flourish
    setTimeout(() => {
      playTone(1047, 0.15, 'sine', 0.3); // C6
      playTone(1319, 0.15, 'sine', 0.3); // E6
      playTone(1568, 0.3, 'sine', 0.35); // G6
    }, 950);
    
    // Strong haptic pattern: short-short-short-LONG to really grab attention
    vibrate([100, 80, 100, 80, 100, 80, 300]);
  },
};

// Mute state
let isMuted = false;

export function setMuted(muted: boolean) {
  isMuted = muted;
  if (muted && audioContext) {
    audioContext.suspend();
  } else if (!muted && audioContext) {
    audioContext.resume();
  }
}

export function getMuted(): boolean {
  return isMuted;
}

// Wrapper that respects mute state
export function playSound(soundFn: () => void) {
  if (!isMuted) {
    soundFn();
  }
}
