import { GAME_CONFIG } from '../config.js';

/**
 * Manages responsive viewport sizing and aspect-ratio adaptation
 * between mobile portrait and mobile/desktop landscape modes.
 * 
 * - Landscape: 480 x 270 (16:9 widescreen arcade)
 * - Portrait:  480 x 380 (5:4 expanded vertical viewport, +40% more viewable area)
 */
export class ViewportManager {
  constructor(game) {
    this.game = game;
    this.isPortrait = this.detectPortrait();
    this.currentWidth = GAME_CONFIG.WIDTH;
    this.currentHeight = this.isPortrait ? (GAME_CONFIG.PORTRAIT_HEIGHT || 440) : GAME_CONFIG.HEIGHT;
    this.boundOnResize = this.onResize.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.boundOnResize);
      window.addEventListener('orientationchange', this.boundOnResize);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.addEventListener('change', this.boundOnResize);
      }
      this.applyContainerStyles(this.currentWidth, this.currentHeight);
    }
  }

  detectPortrait() {
    if (typeof window === 'undefined') return false;
    const iw = window.innerWidth || 0;
    const ih = window.innerHeight || 0;
    return ih > iw;
  }

  applyContainerStyles(w, h) {
    if (typeof document === 'undefined') return;
    const gc = document.getElementById('game-container');
    const gw = document.getElementById('game-wrapper');
    const portrait = this.detectPortrait();

    if (gc) {
      if (portrait) {
        gc.style.aspectRatio = `${w} / ${h}`;
        gc.setAttribute('data-orientation', 'portrait');
      } else {
        gc.style.aspectRatio = '';
        gc.setAttribute('data-orientation', 'landscape');
      }
    }

    if (gw) {
      gw.setAttribute('data-orientation', portrait ? 'portrait' : 'landscape');
    }
  }

  onResize() {
    const newPortrait = this.detectPortrait();
    const targetW = GAME_CONFIG.WIDTH;
    const targetH = newPortrait ? (GAME_CONFIG.PORTRAIT_HEIGHT || 440) : GAME_CONFIG.HEIGHT;

    this.isPortrait = newPortrait;
    this.applyContainerStyles(targetW, targetH);

    if (this.currentWidth !== targetW || this.currentHeight !== targetH) {
      this.currentWidth = targetW;
      this.currentHeight = targetH;

      if (this.game && this.game.scale) {
        this.game.scale.resize(targetW, targetH);
        this.notifyScenes(targetW, targetH);
      }
    }
  }

  notifyScenes(w, h) {
    if (!this.game || !this.game.scene) return;
    this.game.scene.getScenes(true).forEach(scene => {
      if (scene && typeof scene.onViewportResize === 'function') {
        scene.onViewportResize(w, h);
      }
    });
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.boundOnResize);
      window.removeEventListener('orientationchange', this.boundOnResize);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', this.boundOnResize);
      }
    }
  }
}
