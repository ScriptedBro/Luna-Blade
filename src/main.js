import Phaser from 'phaser';
import { GAME_CONFIG } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import StoryIntroScene from './scenes/StoryIntroScene.js';
import StoryScene from './scenes/StoryScene.js';
import StoryEndingScene from './scenes/StoryEndingScene.js';
import SurvivalScene from './scenes/SurvivalScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import ForgeScene from './scenes/ForgeScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import { TouchController } from './ui/TouchControls.js';
import { nimiqModal } from './ui/NimiqModal.js';
import { nimiqService } from './engine/NimiqService.js';
import { pauseService } from './engine/PauseService.js';
import { sound } from './engine/Audio.js';

// Phaser 3 Game Configuration
const phaserConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  autoFocus: true,
  pauseOnBlur: false,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: GAME_CONFIG.GRAVITY },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [
    BootScene,
    MenuScene,
    TutorialScene,
    StoryIntroScene,
    StoryScene,
    StoryEndingScene,
    SurvivalScene,
    ForgeScene,
    LeaderboardScene
  ]
};

// Start Game
const game = new Phaser.Game(phaserConfig);
window.game = game;
window.__GAME__ = game;

// Initialize Virtual Touch Controls & Header Actions
window.touchController = new TouchController(game);
window.nimiqModal = nimiqModal;
window.nimiqService = nimiqService;
window.pauseService = pauseService;
window.sound = sound;

// Ensure game canvas dynamically updates whenever container dimensions adapt
if (typeof ResizeObserver !== 'undefined') {
  const container = document.getElementById('game-container');
  if (container) {
    let rafId = null;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (game && game.scale) {
          game.scale.refresh();
        }
      });
    });
    ro.observe(container);
  }
}

console.log('🌲 Luna Blade: The High Forest initialized successfully!');
