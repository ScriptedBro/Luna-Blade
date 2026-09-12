import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { getTodaySeedString } from '../engine/PRNG.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    sound.startBGM();

    // Parallax background
    this.bg = this.add.tileSprite(0, 0, w, h, 'env_bg').setOrigin(0, 0);

    // Ambient floating leaves/embers
    this.createAmbientLeaves(w, h);

    // Title banner container
    const titleBox = this.add.rectangle(w / 2, 54, 340, 56, 0x0a140a, 0.75);
    titleBox.setStrokeStyle(1, 0x2e4e2e);

    const titleText = this.add.text(w / 2, 38, 'LUNA BLADE', {
      fontFamily: 'Press Start 2P',
      fontSize: '18px',
      color: '#f6c026',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    const subText = this.add.text(w / 2, 58, 'THE HIGH FOREST', {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#98ff20',
      stroke: '#000000',
      strokeThickness: 3,
      letterSpacing: 2
    }).setOrigin(0.5);

    // Date & Seed Banner
    const todaySeed = getTodaySeedString();
    const seedText = this.add.text(w / 2, 72, `TODAY'S SEED: ${todaySeed}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#e9b213',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Subtle gentle bobbing title
    this.tweens.add({
      targets: [titleBox, titleText, subText, seedText],
      y: '-=3',
      duration: 1800,
      yoyo: true,
      loop: -1,
      ease: 'Sine.easeInOut'
    });

    // Menu Buttons Container
    const startY = 112;
    const spacing = 32;

    const options = [
      {
        text: '⚔️ 1. STORY MODE',
        desc: 'Restoration of the Shrines (3 Chapters)',
        action: () => this.scene.start('StoryScene', { chapter: 1 })
      },
      {
        text: '🏆 2. DAILY LUNA TRIAL',
        desc: 'Seeded Survival • 3 Lives • Daily Tournament',
        action: () => this.scene.start('SurvivalScene')
      },
      {
        text: '⚒️ 3. FORGE & SATCHEL',
        desc: 'Craft Blades & Companion Relics',
        action: () => this.scene.start('ForgeScene')
      },
      {
        text: '💰 4. DAILY LEADERBOARD',
        desc: 'Top Scores & Champion Rankings',
        action: () => this.scene.start('LeaderboardScene')
      }
    ];

    options.forEach((opt, idx) => {
      this.createMenuButton(w / 2, startY + idx * spacing, opt.text, opt.desc, opt.action);
    });

    // Footer Info
    const footBox = this.add.rectangle(w / 2, h - 12, 420, 16, 0x091409, 0.85);
    footBox.setStrokeStyle(1, 0x1d3d1d);
    this.add.text(w / 2, h - 12, 'Controls: WASD/Arrows = Move • Space = Jump • J = Slash • K = Upward', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#a0c4a0',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Animated warrior on menu
    const hero = this.add.sprite(46, h - 38, 'char_idle').setScale(1.1);
    hero.play('player_idle');

    // Tiny companion pet hovering if active
    if (storage.isCompanionActive()) {
      const pet = this.add.sprite(hero.x - 14, hero.y - 20, 'bee_fly').setScale(0.4);
      pet.play('bee_fly_anim');
    }

    // Peaceful boar grazing on right
    const boar = this.add.sprite(w - 52, h - 28, 'boar_idle');
    boar.play('boar_idle_anim');
    boar.setFlipX(true);
  }

  createMenuButton(x, y, label, subtitle, callback) {
    const btnBg = this.add.rectangle(x, y, 320, 24, 0x142814, 0.85);
    btnBg.setStrokeStyle(1, 0x3c6e3c);
    btnBg.setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y - 3, label, {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const sub = this.add.text(x, y + 7, subtitle, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#7da57d'
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x285028, 0.95);
      btnBg.setStrokeStyle(1, 0x98ff20);
      txt.setColor('#f6c026');
      sound.playSlash(1);
    });

    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x142814, 0.85);
      btnBg.setStrokeStyle(1, 0x3c6e3c);
      txt.setColor('#ffffff');
    });

    btnBg.on('pointerdown', () => {
      sound.playCoin();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(220, callback);
    });
  }

  createAmbientLeaves(w, h) {
    for (let i = 0; i < 15; i++) {
      const leaf = this.add.circle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.Between(1, 2),
        0x98ff20,
        Phaser.Math.FloatBetween(0.3, 0.7)
      );

      this.tweens.add({
        targets: leaf,
        x: `+=${Phaser.Math.Between(20, 60)}`,
        y: `+=${Phaser.Math.Between(30, 80)}`,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        yoyo: false,
        onRepeat: () => {
          leaf.x = Phaser.Math.Between(0, w);
          leaf.y = 0;
        }
      });
    }
  }

  update() {
    if (this.bg) {
      this.bg.tilePositionX += 0.2;
    }
  }
}
