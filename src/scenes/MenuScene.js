import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { getTodaySeedString } from '../engine/PRNG.js';
import { nimiqModal } from '../ui/NimiqModal.js';
import { nimiqService } from '../engine/NimiqService.js';
import { pauseService } from '../engine/PauseService.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    pauseService.detachScene();
    this.cameras.main.resetFX();
    sound.playBGM('title');

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    if (typeof window !== 'undefined' && typeof window.__dismissGameLoader === 'function') {
      window.__dismissGameLoader();
    }

    // Parallax background
    this.bg = this.add.tileSprite(0, 0, w, h, 'env_bg').setOrigin(0, 0);

    // Ambient floating leaves/embers
    this.createAmbientLeaves(w, h);

    // Title banner container
    const titleBox = this.add.rectangle(w / 2, 33, 310, 42, 0x0a140a, 0.85);
    titleBox.setStrokeStyle(1, 0x2e4e2e);

    const titleText = this.add.text(w / 2, 21, 'LUNA BLADE', {
      fontFamily: 'Press Start 2P',
      fontSize: '13px',
      color: '#f6c026',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const subText = this.add.text(w / 2, 34, 'THE HIGH FOREST', {
      fontFamily: 'Press Start 2P',
      fontSize: '6.5px',
      color: '#98ff20',
      stroke: '#000000',
      strokeThickness: 2,
      letterSpacing: 2
    }).setOrigin(0.5);

    // Date & Seed & Status Combined Banner Line
    const todaySeed = getTodaySeedString();
    const status = nimiqService.getStatus();
    const blessingActive = storage.hasMoonBlessing();
    const statusBadge = blessingActive ? '🌙 BLESSING ACTIVE' : (status.connected ? `⚡ ${status.shortAddress}` : '⚡ NIMIQ READY');
    this.add.text(w / 2, 45, `SEED: ${todaySeed} • ${statusBadge}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: blessingActive ? '#64dfdf' : '#a0c4a0',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Pulse animation on title
    this.tweens.add({
      targets: [titleText, subText],
      scale: 1.02,
      duration: 1200,
      yoyo: true,
      loop: -1,
      ease: 'Sine.easeInOut'
    });

    // Menu Buttons Container
    const startY = 66;
    const spacing = 22;

    const options = [
      {
        text: '⚔️ 1. STORY MODE',
        desc: 'The Shattered Moon & The Blighted Roots',
        action: () => this.openStoryModal(),
        shouldFade: false
      },
      {
        text: '🎓 2. COMBAT TUTORIAL',
        desc: 'Learn Touch Moves, Jumps, Slashes & Combos',
        action: () => this.scene.start('TutorialScene'),
        shouldFade: true
      },
      {
        text: '🏆 3. DAILY LUNA TRIAL',
        desc: 'Seeded Survival • 3 Lives • Daily Tournament',
        action: () => this.scene.start('SurvivalScene'),
        shouldFade: true
      },
      {
        text: '⚒️ 4. FORGE & SATCHEL',
        desc: 'Craft Blades & Companion Relics',
        action: () => this.scene.start('ForgeScene'),
        shouldFade: true
      },
      {
        text: '💰 5. DAILY LEADERBOARD',
        desc: 'Top Scores & Champion Rankings',
        action: () => this.scene.start('LeaderboardScene'),
        shouldFade: true
      },
      {
        text: '⚡ 6. NIMIQ MOON SHRINE',
        desc: 'NIM Offerings, Wallet & Run Blessings',
        action: () => nimiqModal.open(),
        shouldFade: false
      }
    ];

    options.forEach((opt, idx) => {
      this.createMenuButton(w / 2, startY + idx * spacing, opt.text, opt.desc, opt.action, opt.shouldFade);
    });

    // Footer Info
    const footBox = this.add.rectangle(w / 2, h - 12, 430, 16, 0x091409, 0.85);
    footBox.setStrokeStyle(1, 0x1d3d1d);
    const controlsHint = 'CONTROLS: ◀ ▶ MOVE • JUMP • SLASH • UP ATTK • ⏸ PAUSE';

    this.add.text(w / 2, h - 12, controlsHint, {
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
      const pet = this.add.sprite(hero.x - 14, hero.y - 20, 'fairy_fly').setScale(0.7);
      pet.play('fairy_fly_anim');
    }

    // Peaceful boar grazing on right
    const boar = this.add.sprite(w - 52, h - 28, 'boar_idle');
    boar.play('boar_idle_anim');
    boar.setFlipX(true);
  }

  createMenuButton(x, y, label, subtitle, callback, shouldFade = false) {
    const btnBg = this.add.rectangle(x, y, 310, 20, 0x142814, 0.85);
    btnBg.setStrokeStyle(1, 0x3c6e3c);
    btnBg.setInteractive({ useHandCursor: true });

    const txt = this.add.text(x, y - 3, label, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const sub = this.add.text(x, y + 5, subtitle, {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
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
      if (shouldFade) {
        this.cameras.main.fade(200, 0, 0, 0);
        this.time.delayedCall(220, callback);
      } else {
        callback();
      }
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

  openStoryModal() {
    if (this.storyModalContainer) return;
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    const modal = this.add.container(w / 2, h / 2).setDepth(600);
    this.storyModalContainer = modal;

    // Dim overlay
    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.65).setInteractive();
    modal.add(overlay);

    // Modal panel
    const panel = this.add.rectangle(0, 0, 370, 236, 0x071217, 0.95);
    panel.setStrokeStyle(2, 0x1d4754);
    modal.add(panel);

    // Header
    const title = this.add.text(0, -100, '⚔️ CHOOSE CHAPTER', {
      fontFamily: 'Press Start 2P',
      fontSize: '7.5px',
      color: '#ffd166'
    }).setOrigin(0.5);
    modal.add(title);

    const sub = this.add.text(0, -88, 'THE SHATTERED MOON & THE BLIGHTED ROOTS', {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: '#7ba0ab'
    }).setOrigin(0.5);
    modal.add(sub);

    const ch2Unlocked = storage.isChapterUnlocked(2);
    const ch3Unlocked = storage.isChapterUnlocked(3);
    const ch4Unlocked = storage.isChapterUnlocked(4);
    const ch5Unlocked = storage.isChapterUnlocked(5);
    const epilogueUnlocked = !!storage.data.storyProgress?.chapter5?.completed;

    const entries = [
      {
        title: '📜 PROLOGUE: THE SHATTERED MOON',
        desc: 'Illustrated Origin of the Pale Blight',
        unlocked: true,
        action: () => this.scene.start('StoryIntroScene')
      },
      {
        title: '🌲 CHAPTER 1: WHISPERING WOODS',
        desc: 'Boss Gorgok | Whispering Waters',
        unlocked: true,
        action: () => this.scene.start('StoryScene', { chapter: 1 })
      },
      {
        title: '🍯 CHAPTER 2: THE HIVE CANOPY',
        desc: ch2Unlocked ? 'Boss Malakor | The High Boughs' : '🔒 Complete Chapter 1 to Unlock',
        unlocked: ch2Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 2 })
      },
      {
        title: '🏛️ CHAPTER 3: THE SUNKEN RUINS',
        desc: ch3Unlocked ? 'Boss Vorgath | Crypt of the Ancients' : '🔒 Complete Chapter 2 to Unlock',
        unlocked: ch3Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 3 })
      },
      {
        title: '🌋 CHAPTER 4: OBSIDIAN CALDERA',
        desc: ch4Unlocked ? 'Boss Ignis | The Molten Deep' : '🔒 Complete Chapter 3 to Unlock',
        unlocked: ch4Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 4 })
      },
      {
        title: '🌙 CHAPTER 5: THE LUNAR SPIRE',
        desc: ch5Unlocked ? 'Boss Umbra | Shattered Moon Core' : '🔒 Complete Chapter 4 to Unlock',
        unlocked: ch5Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 5 })
      }
    ];

    if (epilogueUnlocked) {
      entries.push({
        title: '✨ EPILOGUE: THE SILVER DAWN',
        desc: 'Watch the Forest Restoration Cinematic',
        unlocked: true,
        action: () => this.scene.start('StoryEndingScene')
      });
    }

    const startY = -70;
    const spacing = 19;
    entries.forEach((item, idx) => {
      const ey = startY + idx * spacing;
      const btnBg = this.add.rectangle(0, ey, 340, 17, item.unlocked ? 0x0d222b : 0x0a1417, 0.9);
      btnBg.setStrokeStyle(1, item.unlocked ? 0x225566 : 0x1a2d33);
      modal.add(btnBg);

      const t = this.add.text(-160, ey - 2, item.title, {
        fontFamily: 'Press Start 2P',
        fontSize: '5px',
        color: item.unlocked ? '#ffffff' : '#556b73'
      }).setOrigin(0, 0.5);
      modal.add(t);

      const d = this.add.text(45, ey - 2, item.desc, {
        fontFamily: 'Press Start 2P',
        fontSize: '3.5px',
        color: item.unlocked ? '#6ab2c4' : '#3d5259'
      }).setOrigin(0, 0.5);
      modal.add(d);

      if (item.unlocked) {
        btnBg.setInteractive({ useHandCursor: true });
        btnBg.on('pointerover', () => {
          btnBg.setFillStyle(0x194254);
          t.setColor('#ffd166');
          sound.playBlip(true);
        });
        btnBg.on('pointerout', () => {
          btnBg.setFillStyle(0x0d222b);
          t.setColor('#ffffff');
        });
        btnBg.on('pointerdown', () => {
          sound.playConfirm();
          this.storyModalContainer = null;
          item.action();
        });
      }
    });

    // Close button
    const closeBtnY = startY + entries.length * spacing + 4;
    const closeBg = this.add.rectangle(0, closeBtnY, 120, 18, 0x162c33, 0.9)
      .setStrokeStyle(1, 0x3d6b73)
      .setInteractive({ useHandCursor: true });
    modal.add(closeBg);

    const closeText = this.add.text(0, closeBtnY, '✕ BACK', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#e0f0f5'
    }).setOrigin(0.5);
    modal.add(closeText);

    closeBg.on('pointerdown', () => {
      sound.playCancel();
      modal.destroy();
      this.storyModalContainer = null;
    });
  }

  update() {
    if (this.bg) {
      this.bg.tilePositionX += 0.2;
    }
  }
}
