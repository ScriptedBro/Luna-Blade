import Phaser from 'phaser';
import { GAME_CONFIG } from './config.js';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import StoryScene from './scenes/StoryScene.js';
import SurvivalScene from './scenes/SurvivalScene.js';
import ForgeScene from './scenes/ForgeScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';
import { TouchController } from './ui/TouchControls.js';

// Phaser 3 Game Configuration
const phaserConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game-container',
  pixelArt: true,
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
    StoryScene,
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

console.log('🌲 Luna Blade: The High Forest initialized successfully!');
