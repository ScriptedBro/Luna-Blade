import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { nimiqService } from '../engine/NimiqService.js';
import { nimiqModal } from './NimiqModal.js';

export class TouchController {
  constructor(game) {
    this.game = game;
    this.state = {
      left: false,
      right: false,
      up: false,
      down: false,
      justJump: false,
      justAttack: false,
      justUpSlash: false
    };

    this.touchContainer = document.getElementById('touch-controls');
    this.orientationHint = document.getElementById('orientation-hint');
    this.initTouchButtons();
    this.initHeaderButtons();
    this.initNimiqIntegration();
    this.autoDetectTouch();
    this.initOrientationListener();
  }

  autoDetectTouch() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch && this.touchContainer) {
      this.touchContainer.classList.remove('hidden');
    }
  }

  initOrientationListener() {
    const checkOrientation = () => {
      if (!this.orientationHint) return;
      const isPortrait = window.innerHeight > window.innerWidth && (window.innerWidth < 768);
      if (isPortrait) {
        this.orientationHint.classList.remove('hidden');
      } else {
        this.orientationHint.classList.add('hidden');
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }

  triggerHaptic() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(12); } catch {}
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
        this.triggerHaptic();

        if (isTrigger) {
          if (key === 'jump') this.state.justJump = true;
          if (key === 'attack') {
            // Combo: if UP button is also held, trigger upward slash!
            if (this.state.up) {
              this.state.justUpSlash = true;
            } else {
              this.state.justAttack = true;
            }
          }
          if (key === 'upslash') this.state.justUpSlash = true;
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
    bindBtn('touch-upslash', 'upslash', true);
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

  initNimiqIntegration() {
    const btnNimiq = document.getElementById('btn-nimiq');
    const txtNimiq = document.getElementById('nimiq-btn-text');
    const dotNimiq = document.getElementById('nimiq-dot');

    if (btnNimiq) {
      btnNimiq.addEventListener('click', () => {
        nimiqModal.open();
      });
    }

    // Subscribe to Nimiq status changes to update header indicator
    nimiqService.subscribe((status) => {
      if (!txtNimiq || !dotNimiq) return;

      if (status.connected) {
        dotNimiq.classList.remove('offline');
        dotNimiq.classList.add('online');
        txtNimiq.textContent = status.shortAddress || 'CONNECTED';
      } else {
        dotNimiq.classList.remove('online');
        dotNimiq.classList.add('offline');
        txtNimiq.textContent = 'NIMIQ';
      }
    });
  }

  consumeTriggers() {
    const triggers = {
      justJump: this.state.justJump,
      justAttack: this.state.justAttack,
      justUpSlash: this.state.justUpSlash
    };
    this.state.justJump = false;
    this.state.justAttack = false;
    this.state.justUpSlash = false;
    return triggers;
  }
}
