const BGM_TRACKS = {
  title: '/assets/audio/bgm_title.mp3',
  forest: '/assets/audio/bgm_forest.mp3',
  battle: '/assets/audio/bgm_battle.mp3',
  boss: '/assets/audio/bgm_boss.mp3',
  victory: '/assets/audio/bgm_victory.mp3'
};

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.bgmPlaying = false;
    this.currentTrack = null;
    this.currentAudio = null;
    this.audioCache = new Map();
    this.bgmVolume = 0.45;
    this.unlocked = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);
    } catch (e) {
      console.warn('WebAudio not supported:', e);
    }

    if (typeof window !== 'undefined' && !this.unlocked) {
      const unlock = () => {
        this.resume();
        if (this.currentAudio && this.currentAudio.paused && !this.muted && this.currentTrack) {
          this.currentAudio.play().catch(() => {});
        }
        this.unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  resume() {
    if (!this.ctx) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1.0, this.ctx.currentTime);
    }
    if (this.currentAudio) {
      this.currentAudio.volume = this.muted ? 0 : this.bgmVolume;
    }
    return this.muted;
  }

  playSlash(combo = 1) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Noise buffer for swoosh
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(combo === 1 ? 1200 : 800, t);
    filter.frequency.exponentialRampToValueAtTime(combo === 1 ? 300 : 150, t + 0.12);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(combo === 1 ? 0.6 : 0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);

    // Tonal sword chime for combo 2
    if (combo === 2) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.18);
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
      osc.connect(oscGain);
      oscGain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  }

  playUpwardSlash() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.15);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, t);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playJump(doubleJump = false) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    
    const startFreq = doubleJump ? 380 : 220;
    const endFreq = doubleJump ? 750 : 520;
    
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playWallSlide() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playHit() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.14);

    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  playEnemyDeath() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  playShellKick() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    
    // Impact thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playRicochet() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  playCoin() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, t); // B5
    osc.frequency.setValueAtTime(1318.51, t + 0.08); // E6
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  playObelisk() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);
      gain.gain.setValueAtTime(0.3, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 1.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + 1.2);
    });
  }

  playVictory() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t + idx * 0.12);
      gain.gain.setValueAtTime(0.3, t + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.12);
      osc.stop(t + idx * 0.12 + 0.35);
    });
  }

  playGameOver() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const notes = [440, 415.30, 392, 349.23];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.18);
      gain.gain.setValueAtTime(0.4, t + idx * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.18 + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t + idx * 0.18);
      osc.stop(t + idx * 0.18 + 0.3);
    });
  }

  playBlip(high = false) {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 580 : 380, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playSelect() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(780, t + 0.08);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  playBack() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.07);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playLevelUp() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      const noteTime = t + i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);
      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.15);
    });
  }

  playSparkle() {
    this.playLevelUp();
  }

  playImpact() {
    this.playHit();
  }

  playSwordSlash() {
    this.playSlash(1);
  }

  playBoarChargeHit() {
    this.playHit();
  }

  playEnemyAttack() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.18);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  playRumble() {
    if (this.muted || !this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.75);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.005, t + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, t);
    filter.frequency.exponentialRampToValueAtTime(40, t + 0.8);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.8);
  }

  playBGM(key = 'title') {
    this.init();
    const url = BGM_TRACKS[key] || BGM_TRACKS.title;

    // If this track is already playing, do nothing
    if (this.currentTrack === key && this.currentAudio && !this.currentAudio.paused) {
      return;
    }

    let audio = this.audioCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.loop = true;
      audio.preload = 'auto';
      this.audioCache.set(url, audio);
    }

    // Crossfade out previous audio if playing and different
    const oldAudio = this.currentAudio;
    if (oldAudio && oldAudio !== audio && !oldAudio.paused) {
      let v = oldAudio.volume;
      const fadeStep = v / 8;
      const fadeOutTimer = setInterval(() => {
        v = Math.max(0, v - fadeStep);
        oldAudio.volume = v;
        if (v <= 0.01) {
          clearInterval(fadeOutTimer);
          oldAudio.pause();
          oldAudio.currentTime = 0;
        }
      }, 25);
    }

    audio.currentTime = 0;
    audio.volume = this.muted ? 0 : this.bgmVolume;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Handled by user-interaction unlock
      });
    }

    this.currentAudio = audio;
    this.currentTrack = key;
    this.bgmPlaying = true;
  }

  startBGM(key = 'title') {
    this.playBGM(key);
  }

  stopBGM(fade = true) {
    this.bgmPlaying = false;
    this.currentTrack = null;
    const a = this.currentAudio;
    if (!a) return;

    if (fade && a.volume > 0.05 && !a.paused) {
      let v = a.volume;
      const fadeStep = v / 10;
      const timer = setInterval(() => {
        v = Math.max(0, v - fadeStep);
        a.volume = v;
        if (v <= 0.01) {
          clearInterval(timer);
          a.pause();
          a.currentTime = 0;
        }
      }, 30);
    } else {
      a.pause();
      a.currentTime = 0;
    }
  }
}

export const sound = new SoundEngine();
