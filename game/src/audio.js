// Every sound is synthesised with WebAudio: no audio files, no network. Footsteps are
// soft ticks, a guard's steps pan left and right with where it walks, a pickup chimes,
// a fresh spot stings, and escaping plays a short arpeggio. The context is created on
// the first user gesture; until then the game is silent.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function unlock() {
    if (ensure() && context.state === 'suspended') void context.resume();
  }

  function blip(frequency, duration, type, volume, pan) {
    if (muted || !ensure() || context.state === 'suspended') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner ? context.createStereoPanner() : null;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  function note(frequency, startAt, duration, volume) {
    if (muted || !ensure() || context.state === 'suspended') return;
    const now = context.currentTime + startAt;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  return {
    unlock,
    toggleMuted() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Wren's own step: quiet, centred. */
    playerStep(sprinting) {
      blip(sprinting ? 210 : 170, 0.06, 'triangle', sprinting ? 0.16 : 0.09, 0);
    },
    /** A guard's step: the pan tells Wren which side it walks on. */
    guardStep(pan, closeness) {
      blip(120, 0.08, 'triangle', 0.05 + 0.14 * closeness, pan);
    },
    pickup() {
      note(880, 0, 0.18, 0.16);
      note(1318, 0.07, 0.22, 0.14);
    },
    coinPing() {
      note(1568, 0, 0.3, 0.14);
      note(2093, 0.12, 0.3, 0.1);
    },
    alertSting() {
      note(220, 0, 0.28, 0.2);
      note(233, 0.12, 0.3, 0.2);
    },
    exitLocked() {
      note(330, 0, 0.12, 0.12);
      note(262, 0.1, 0.16, 0.12);
    },
    win() {
      [523, 659, 784, 1047].forEach((frequency, index) => note(frequency, index * 0.11, 0.32, 0.16));
    },
    lose() {
      [392, 330, 262, 196].forEach((frequency, index) => note(frequency, index * 0.14, 0.34, 0.15));
    },
  };
}
