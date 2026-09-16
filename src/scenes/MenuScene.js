import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
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

    // Connection status badge (tap to connect after skipping the gate)
    const status = nimiqService.getStatus();
    const statusBadge = status.connected ? `⚡ ${status.shortAddress}` : (status.offline ? '⚡ API OFFLINE' : '⚡ NOT CONNECTED');
    const badge = this.add.text(w / 2, 45, statusBadge, {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: '#a0c4a0',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    badge.setInteractive({ useHandCursor: true });
    badge.on('pointerdown', () => {
      if (!status.connected && window.__lunaGate) window.__lunaGate.show().then(() => {});
    });

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
        text: '🏆 3. SURVIVAL TRIAL',
        desc: 'Endless Arena • On-Chain Leaderboard',
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
        text: '💰 5. LEADERBOARD',
        desc: 'All-Time & Daily Rankings',
        action: () => this.scene.start('LeaderboardScene'),
        shouldFade: true
      },
      {
        text: '⚙️ 6. SETTINGS',
        desc: 'Sound Effects & Background Music',
        action: () => this.openSettingsModal(),
        shouldFade: false
      }
    ];

    options.forEach((opt, idx) => {
      this.createMenuButton(w / 2, startY + idx * spacing, opt.text, opt.desc, opt.action, opt.shouldFade);
    });

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
    if (this.storyModalObjects) return;
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.storyModalObjects = [];

    // 1. Dim full-screen overlay backdrop (captures any clicks outside panel)
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.72)
      .setDepth(590)
      .setInteractive();
    overlay.on('pointerdown', () => this.closeStoryModal());
    this.storyModalObjects.push(overlay);

    // 2. Modal panel frame
    const panelW = 426;
    const panelH = 250;
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x071317, 0.96)
      .setStrokeStyle(2, 0x1d4754)
      .setDepth(600)
      .setInteractive(); // Blocks clicks from hitting overlay underneath
    this.storyModalObjects.push(panel);

    // 3. Header
    const title = this.add.text(w / 2, h / 2 - 108, '⚔️ CHOOSE CHAPTER', {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#ffd166'
    }).setOrigin(0.5).setDepth(601);
    this.storyModalObjects.push(title);

    const sub = this.add.text(w / 2, h / 2 - 96, 'THE SHATTERED MOON & THE BLIGHTED ROOTS', {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: '#7ba0ab'
    }).setOrigin(0.5).setDepth(601);
    this.storyModalObjects.push(sub);

    const ch2Unlocked = storage.isChapterUnlocked(2);
    const ch3Unlocked = storage.isChapterUnlocked(3);
    const ch4Unlocked = storage.isChapterUnlocked(4);
    const ch5Unlocked = storage.isChapterUnlocked(5);

    const entries = [
      {
        title: '📜 PROLOGUE: THE SHATTERED MOON',
        desc: 'Origin of the Pale Blight',
        unlocked: true,
        action: () => this.scene.start('StoryIntroScene')
      },
      {
        title: '🌲 CHAPTER 1: WHISPERING WOODS',
        desc: 'Boss Gorgok • Whispering Waters',
        unlocked: true,
        action: () => this.scene.start('StoryScene', { chapter: 1 })
      },
      {
        title: '🍯 CHAPTER 2: THE HIVE CANOPY',
        desc: ch2Unlocked ? 'Boss Malakor • High Boughs' : '🔒 Complete Ch. 1 to Unlock',
        unlocked: ch2Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 2 })
      },
      {
        title: '🏛️ CHAPTER 3: THE SUNKEN RUINS',
        desc: ch3Unlocked ? 'Boss Vorgath • Ancient Crypt' : '🔒 Complete Ch. 2 to Unlock',
        unlocked: ch3Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 3 })
      },
      {
        title: '🌋 CHAPTER 4: OBSIDIAN CALDERA',
        desc: ch4Unlocked ? 'Boss Ignis • Molten Deep' : '🔒 Complete Ch. 3 to Unlock',
        unlocked: ch4Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 4 })
      },
      {
        title: '🌙 CHAPTER 5: THE LUNAR SPIRE',
        desc: ch5Unlocked ? 'Boss Umbra • Shattered Core' : '🔒 Complete Ch. 4 to Unlock',
        unlocked: ch5Unlocked,
        action: () => this.scene.start('StoryScene', { chapter: 5 })
      }
    ];

    const startY = 60;
    const spacing = 22;
    const btnW = 398;
    const btnH = 18;

    entries.forEach((item, idx) => {
      const ey = startY + idx * spacing;
      const btnBg = this.add.rectangle(w / 2, ey, btnW, btnH, item.unlocked ? 0x0d222b : 0x0a1417, 0.9)
        .setStrokeStyle(1, item.unlocked ? (item.isEpilogue ? 0x554422 : 0x225566) : 0x1a2d33)
        .setDepth(601);
      this.storyModalObjects.push(btnBg);

      // Title left-anchored
      const leftX = (w / 2) - (btnW / 2) + 10;
      const t = this.add.text(leftX, ey, item.title, {
        fontFamily: 'Press Start 2P',
        fontSize: '5px',
        color: item.unlocked ? '#ffffff' : '#556b73'
      }).setOrigin(0, 0.5).setDepth(602);
      this.storyModalObjects.push(t);

      // Description/Status right-anchored to prevent any overflow
      const rightX = (w / 2) + (btnW / 2) - 10;
      const d = this.add.text(rightX, ey, item.desc, {
        fontFamily: 'Press Start 2P',
        fontSize: '4.5px',
        color: item.unlocked ? '#64dfdf' : '#667b84'
      }).setOrigin(1, 0.5).setDepth(602);
      this.storyModalObjects.push(d);

      if (item.unlocked) {
        btnBg.setInteractive({ useHandCursor: true });
        t.setInteractive({ useHandCursor: true });
        d.setInteractive({ useHandCursor: true });

        const setItemHover = (isHover) => {
          btnBg.setFillStyle(isHover ? 0x194254 : 0x0d222b);
          btnBg.setStrokeStyle(1, isHover ? 0xffd166 : 0x225566);
          t.setColor(isHover ? '#ffd166' : '#ffffff');
          if (isHover) sound.playBlip(true);
        };

        const onAction = () => {
          sound.playConfirm();
          this.closeStoryModal();
          item.action();
        };

        btnBg.on('pointerover', () => setItemHover(true));
        btnBg.on('pointerout', () => setItemHover(false));
        btnBg.on('pointerdown', onAction);

        t.on('pointerover', () => setItemHover(true));
        t.on('pointerout', () => setItemHover(false));
        t.on('pointerdown', onAction);

        d.on('pointerover', () => setItemHover(true));
        d.on('pointerout', () => setItemHover(false));
        d.on('pointerdown', onAction);
      }
    });

    // Close button
    const closeBtnY = startY + entries.length * spacing + 10;
    const closeBg = this.add.rectangle(w / 2, closeBtnY, 140, 22, 0x162c33, 0.95)
      .setStrokeStyle(1.5, 0x3d6b73)
      .setDepth(602)
      .setInteractive({ useHandCursor: true });
    this.storyModalObjects.push(closeBg);

    const closeText = this.add.text(w / 2, closeBtnY, '✕ BACK TO MENU', {
      fontFamily: 'Press Start 2P',
      fontSize: '6.5px',
      color: '#e0f0f5'
    }).setOrigin(0.5).setDepth(603).setInteractive({ useHandCursor: true });
    this.storyModalObjects.push(closeText);

    const setCloseHover = (isHover) => {
      closeBg.setFillStyle(isHover ? 0x244c59 : 0x162c33);
      closeBg.setStrokeStyle(1.5, isHover ? 0x64dfdf : 0x3d6b73);
      closeText.setColor(isHover ? '#ffd166' : '#e0f0f5');
      if (isHover) sound.playBlip(true);
    };

    closeBg.on('pointerover', () => setCloseHover(true));
    closeBg.on('pointerout', () => setCloseHover(false));
    closeText.on('pointerover', () => setCloseHover(true));
    closeText.on('pointerout', () => setCloseHover(false));

    closeBg.on('pointerdown', () => this.closeStoryModal());
    closeText.on('pointerdown', () => this.closeStoryModal());

    // ESC key listener
    this.storyModalEscHandler = () => this.closeStoryModal();
    this.input.keyboard.once('keydown-ESC', this.storyModalEscHandler);
  }

  closeStoryModal() {
    if (!this.storyModalObjects) return;
    sound.playCancel();
    if (this.storyModalEscHandler) {
      this.input.keyboard.off('keydown-ESC', this.storyModalEscHandler);
      this.storyModalEscHandler = null;
    }
    this.storyModalObjects.forEach(obj => {
      if (obj && obj.destroy) obj.destroy();
    });
    this.storyModalObjects = null;
  }

  openSettingsModal() {
    if (this.settingsModalObjects) return;
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.settingsModalObjects = [];

    // 1. Full-screen backdrop
    const overlay = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.76)
      .setDepth(650)
      .setInteractive();
    overlay.on('pointerdown', () => this.closeSettingsModal());
    this.settingsModalObjects.push(overlay);

    // 2. Modal panel frame
    const panelW = 380;
    const panelH = 186;
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x07151e, 0.98)
      .setStrokeStyle(2, 0x1d4754)
      .setDepth(660)
      .setInteractive();
    this.settingsModalObjects.push(panel);

    // Corner rivets
    const rivets = [
      { x: w / 2 - panelW / 2 + 6, y: h / 2 - panelH / 2 + 6 },
      { x: w / 2 + panelW / 2 - 6, y: h / 2 - panelH / 2 + 6 },
      { x: w / 2 - panelW / 2 + 6, y: h / 2 + panelH / 2 - 6 },
      { x: w / 2 + panelW / 2 - 6, y: h / 2 + panelH / 2 - 6 }
    ];
    rivets.forEach(rv => {
      const r = this.add.rectangle(rv.x, rv.y, 3, 3, 0xf6c026, 0.9).setDepth(661);
      this.settingsModalObjects.push(r);
    });

    // 3. Header
    const title = this.add.text(w / 2, h / 2 - 66, '⚙️ AUDIO SETTINGS', {
      fontFamily: 'Press Start 2P',
      fontSize: '8.5px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(661);
    this.settingsModalObjects.push(title);

    const sub = this.add.text(w / 2, h / 2 - 50, 'SOUND EFFECTS & MUSIC PREFERENCES', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#7ba0ab'
    }).setOrigin(0.5).setDepth(661);
    this.settingsModalObjects.push(sub);

    // 4. Sound Effects Row (SFX)
    const sfxY = h / 2 - 18;
    const sfxRow = this.add.rectangle(w / 2, sfxY, 340, 36, 0x0b1f29, 0.9)
      .setStrokeStyle(1, 0x1d4754)
      .setDepth(661);
    this.settingsModalObjects.push(sfxRow);

    const sfxLabel = this.add.text(w / 2 - 155, sfxY - 6, '🔊 SOUND EFFECTS (SFX)', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setDepth(662);
    this.settingsModalObjects.push(sfxLabel);

    const sfxDesc = this.add.text(w / 2 - 155, sfxY + 7, 'Sword slashes, enemy hits, jumps & UI', {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: '#76a0b0'
    }).setOrigin(0, 0.5).setDepth(662);
    this.settingsModalObjects.push(sfxDesc);

    const sfxBtnBg = this.add.rectangle(w / 2 + 112, sfxY, 84, 22, 0x144a25, 0.95)
      .setStrokeStyle(1.5, 0x4ade80)
      .setDepth(662)
      .setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(sfxBtnBg);

    const sfxBtnTxt = this.add.text(w / 2 + 112, sfxY, '[ ON ]', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#4ade80'
    }).setOrigin(0.5).setDepth(663).setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(sfxBtnTxt);

    const updateSfxUI = () => {
      const isMuted = sound.isSoundMuted();
      sfxBtnBg.setFillStyle(isMuted ? 0x3b1515 : 0x144a25, 0.95);
      sfxBtnBg.setStrokeStyle(1.5, isMuted ? 0xf87171 : 0x4ade80);
      sfxBtnTxt.setText(isMuted ? '[ MUTED ]' : '[ ON ]');
      sfxBtnTxt.setColor(isMuted ? '#f87171' : '#4ade80');
    };
    updateSfxUI();

    const toggleSfxAction = () => {
      const isMuted = sound.toggleSound();
      updateSfxUI();
      if (!isMuted) sound.playBlip(true);
    };
    sfxBtnBg.on('pointerdown', toggleSfxAction);
    sfxBtnTxt.on('pointerdown', toggleSfxAction);

    // 5. Music Row (BGM)
    const bgmY = h / 2 + 24;
    const bgmRow = this.add.rectangle(w / 2, bgmY, 340, 36, 0x0b1f29, 0.9)
      .setStrokeStyle(1, 0x1d4754)
      .setDepth(661);
    this.settingsModalObjects.push(bgmRow);

    const bgmLabel = this.add.text(w / 2 - 155, bgmY - 6, '🎵 BACKGROUND MUSIC (BGM)', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#ffffff'
    }).setOrigin(0, 0.5).setDepth(662);
    this.settingsModalObjects.push(bgmLabel);

    const bgmDesc = this.add.text(w / 2 - 155, bgmY + 7, 'Melodic chapter soundtracks & ambient cues', {
      fontFamily: 'Press Start 2P',
      fontSize: '4.5px',
      color: '#76a0b0'
    }).setOrigin(0, 0.5).setDepth(662);
    this.settingsModalObjects.push(bgmDesc);

    const bgmBtnBg = this.add.rectangle(w / 2 + 112, bgmY, 84, 22, 0x144a25, 0.95)
      .setStrokeStyle(1.5, 0x4ade80)
      .setDepth(662)
      .setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(bgmBtnBg);

    const bgmBtnTxt = this.add.text(w / 2 + 112, bgmY, '[ ON ]', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#4ade80'
    }).setOrigin(0.5).setDepth(663).setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(bgmBtnTxt);

    const updateMusicUI = () => {
      const isMuted = sound.isMusicMuted();
      bgmBtnBg.setFillStyle(isMuted ? 0x3b1515 : 0x144a25, 0.95);
      bgmBtnBg.setStrokeStyle(1.5, isMuted ? 0xf87171 : 0x4ade80);
      bgmBtnTxt.setText(isMuted ? '[ MUTED ]' : '[ ON ]');
      bgmBtnTxt.setColor(isMuted ? '#f87171' : '#4ade80');
    };
    updateMusicUI();

    const toggleMusicAction = () => {
      sound.toggleMusic();
      updateMusicUI();
      sound.playBlip(true);
    };
    bgmBtnBg.on('pointerdown', toggleMusicAction);
    bgmBtnTxt.on('pointerdown', toggleMusicAction);

    // 6. Close Button
    const closeBtnY = h / 2 + 68;
    const closeBg = this.add.rectangle(w / 2, closeBtnY, 150, 22, 0x162c33, 0.95)
      .setStrokeStyle(1.5, 0x3d6b73)
      .setDepth(662)
      .setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(closeBg);

    const closeText = this.add.text(w / 2, closeBtnY, '✕ BACK TO MENU', {
      fontFamily: 'Press Start 2P',
      fontSize: '6.5px',
      color: '#e0f0f5'
    }).setOrigin(0.5).setDepth(663).setInteractive({ useHandCursor: true });
    this.settingsModalObjects.push(closeText);

    const setCloseHover = (isHover) => {
      closeBg.setFillStyle(isHover ? 0x244c59 : 0x162c33);
      closeBg.setStrokeStyle(1.5, isHover ? 0x64dfdf : 0x3d6b73);
      closeText.setColor(isHover ? '#ffd166' : '#e0f0f5');
      if (isHover) sound.playBlip(true);
    };

    closeBg.on('pointerover', () => setCloseHover(true));
    closeBg.on('pointerout', () => setCloseHover(false));
    closeText.on('pointerover', () => setCloseHover(true));
    closeText.on('pointerout', () => setCloseHover(false));

    closeBg.on('pointerdown', () => this.closeSettingsModal());
    closeText.on('pointerdown', () => this.closeSettingsModal());

    // ESC key listener
    this.settingsModalEscHandler = () => this.closeSettingsModal();
    this.input.keyboard.once('keydown-ESC', this.settingsModalEscHandler);
  }

  closeSettingsModal() {
    if (!this.settingsModalObjects) return;
    sound.playCancel();
    if (this.settingsModalEscHandler) {
      this.input.keyboard.off('keydown-ESC', this.settingsModalEscHandler);
      this.settingsModalEscHandler = null;
    }
    this.settingsModalObjects.forEach(obj => {
      if (obj && obj.destroy) obj.destroy();
    });
    this.settingsModalObjects = null;
  }

  update() {
    if (this.bg) {
      this.bg.tilePositionX += 0.2;
    }
  }
}
