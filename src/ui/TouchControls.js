import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';

export class TouchController {
  constructor(game) {
    this.game = game;
    this.state = {
      left: false,
      right: false,
      up: false,
      down: false,
      justJump: false,
      justAttack: false
    };

    this.touchContainer = document.getElementById('touch-controls');
    this.initTouchButtons();
    this.initHeaderButtons();
    this.autoDetectTouch();
  }

  autoDetectTouch() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch && this.touchContainer) {
      this.touchContainer.classList.remove('hidden');
    }
  }

  initTouchButtons() {
    const bindBtn = (id, key, isTrigger = false) => {
      const el = document.getElementById(id);
      if (!el) return;

      const handlePress = (e) => {
        e.preventDefault();
        el.classList.add('pressed');
        this.state[key] = true;
        if (isTrigger) {
          if (key === 'jump') this.state.justJump = true;
          if (key === 'attack') this.state.justAttack = true;
        }
      };

      const handleRelease = (e) => {
        e.preventDefault();
        el.classList.remove('pressed');
        this.state[key] = false;
      };

      el.addEventListener('pointerdown', handlePress);
      el.addEventListener('pointerup', handleRelease);
      el.addEventListener('pointercancel', handleRelease);
      el.addEventListener('pointerleave', handleRelease);
    };

    bindBtn('touch-left', 'left');
    bindBtn('touch-right', 'right');
    bindBtn('touch-up', 'up');
    bindBtn('touch-down', 'down');
    bindBtn('touch-jump', 'jump', true);
    bindBtn('touch-attack', 'attack', true);
  }

  initHeaderButtons() {
    // Audio Toggle
    const btnAudio = document.getElementById('btn-audio');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const muted = sound.toggleMute();
        btnAudio.textContent = muted ? '🔇' : '🔊';
      });
    }

    // Touch Controls Toggle
    const btnTouch = document.getElementById('btn-touch');
    if (btnTouch && this.touchContainer) {
      btnTouch.addEventListener('click', () => {
        this.touchContainer.classList.toggle('hidden');
      });
    }

    // CRT Scanlines Toggle
    const btnCrt = document.getElementById('btn-crt');
    const crtOverlay = document.getElementById('crt-overlay');
    if (btnCrt && crtOverlay) {
      btnCrt.addEventListener('click', () => {
        crtOverlay.classList.toggle('active');
        btnCrt.style.opacity = crtOverlay.classList.contains('active') ? '1.0' : '0.5';
      });
    }

    // Fullscreen Toggle
    const btnFs = document.getElementById('btn-fullscreen');
    if (btnFs) {
      btnFs.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }


  consumeTriggers() {
    const triggers = {
      justJump: this.state.justJump,
      justAttack: this.state.justAttack
    };
    this.state.justJump = false;
    this.state.justAttack = false;
    return triggers;
  }
}
