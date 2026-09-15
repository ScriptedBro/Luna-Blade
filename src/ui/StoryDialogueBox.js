import Phaser from 'phaser';
import { sound } from '../engine/Audio.js';
import { GAME_CONFIG } from '../config.js';

const SPEAKER_CONFIGS = {
  LUNA: {
    name: 'LUNA',
    color: '#48cae4',
    bgColor: 0x032830,
    borderColor: 0x00b4d8,
    spriteKey: 'char_idle',
    scale: 0.65,
    frame: 0,
    soundPitch: true
  },
  COMPANION: {
    name: 'SYLVA (MOON SPRITE)',
    color: '#64dfdf',
    bgColor: 0x032226,
    borderColor: 0x48cae4,
    spriteKey: 'fairy_portrait',
    scale: 0.95,
    frame: 0,
    soundPitch: true
  },
  GORGOK: {
    name: 'CHIEFTAIN GORGOK',
    color: '#f77f00',
    bgColor: 0x2e1003,
    borderColor: 0xd62828,
    spriteKey: 'chieftain_idle',
    scale: 1.1,
    frame: 0,
    soundPitch: false
  },
  MALAKOR: {
    name: 'ARCHMAGE MALAKOR',
    color: '#c77dff',
    bgColor: 0x240046,
    borderColor: 0x9d4edd,
    spriteKey: 'wizard_idle',
    scale: 0.38,
    frame: 0,
    soundPitch: false
  },
  SHRINE: {
    name: 'LORE OF THE HIGH FOREST',
    color: '#06d6a0',
    bgColor: 0x022e23,
    borderColor: 0x118ab2,
    spriteKey: null,
    icon: '✨',
    soundPitch: true
  },
  VORGATH: {
    name: 'VORGATH, BONE SOVEREIGN',
    color: '#e0e1dd',
    bgColor: 0x1b263b,
    borderColor: 0x778da9,
    spriteKey: 'skeleton_idle',
    scale: 0.35,
    frame: 0,
    soundPitch: false
  },
  IGNIS: {
    name: 'IGNIS, CINDER DRAKE',
    color: '#ff7b00',
    bgColor: 0x3d0000,
    borderColor: 0xff5400,
    spriteKey: 'demon_idle',
    scale: 0.6,
    frame: 0,
    soundPitch: false
  },
  UMBRA: {
    name: 'UMBRA, SHATTERED SOVEREIGN',
    color: '#b5179e',
    bgColor: 0x10002b,
    borderColor: 0x7209b7,
    spriteKey: 'nightborne_idle',
    scale: 0.55,
    frame: 0,
    soundPitch: false
  }
};

export default class StoryDialogueBox extends Phaser.GameObjects.Container {
  constructor(scene) {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    super(scene, w / 2, h - 42);
    scene.add.existing(this);

    this.scene = scene;
    this.lines = [];
    this.currentLineIdx = 0;
    this.isTyping = false;
    this.typingTimer = null;
    this.currentDisplayedChars = 0;
    this.onCompleteCallback = null;

    this.setScrollFactor(0);
    this.setDepth(600);

    const boxW = 444;
    const boxH = 68;
    this.boxW = boxW;
    this.boxH = boxH;

    // Dark backdrop overlay behind dialogue to dim the world slightly
    this.dimOverlay = scene.add.rectangle(-w / 2, -h + 42, w, h, 0x000000, 0.35)
      .setOrigin(0, 0)
      .setInteractive();
    this.add(this.dimOverlay);

    // Main box background
    this.bgBox = scene.add.rectangle(0, 0, boxW, boxH, 0x060d11, 0.95);
    this.bgBox.setStrokeStyle(2, 0x1e3a47);
    this.add(this.bgBox);

    // Subtle inner trim line
    this.innerTrim = scene.add.rectangle(0, 0, boxW - 6, boxH - 6, 0x000000, 0);
    this.innerTrim.setStrokeStyle(1, 0x0e2530);
    this.add(this.innerTrim);

    // Portrait frame on left
    this.portraitBg = scene.add.rectangle(-boxW / 2 + 34, 0, 48, 48, 0x0a161c, 1);
    this.portraitBg.setStrokeStyle(1.5, 0x3a5a6b);
    this.add(this.portraitBg);

    // Portrait sprite container
    this.portraitSprite = scene.add.sprite(-boxW / 2 + 34, 0, 'char_idle').setVisible(false);
    this.add(this.portraitSprite);

    this.portraitIcon = scene.add.text(-boxW / 2 + 34, 0, '✨', {
      fontSize: '22px'
    }).setOrigin(0.5).setVisible(false);
    this.add(this.portraitIcon);

    // Speaker Nameplate Container (top-left above text)
    this.nameplateBg = scene.add.rectangle(-boxW / 2 + 68, -boxH / 2, 140, 16, 0x032830, 0.95)
      .setOrigin(0, 0.5);
    this.nameplateBg.setStrokeStyle(1, 0x00b4d8);
    this.add(this.nameplateBg);

    this.nameplateText = scene.add.text(-boxW / 2 + 76, -boxH / 2, 'LUNA', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#48cae4'
    }).setOrigin(0, 0.5);
    this.add(this.nameplateText);

    // Dialogue Body Text
    this.dialogueText = scene.add.text(-boxW / 2 + 72, -boxH / 2 + 18, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#e0f0f5',
      lineSpacing: 5,
      wordWrap: { width: boxW - 90 }
    });
    this.add(this.dialogueText);

    // Prompt to advance [TAP TO CONTINUE ▼]
    this.promptArrow = scene.add.text(boxW / 2 - 12, boxH / 2 - 10, 'TAP TO CONTINUE ▼', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(1, 0.5);
    this.add(this.promptArrow);

    this.arrowTween = scene.tweens.add({
      targets: this.promptArrow,
      y: boxH / 2 - 7,
      duration: 400,
      yoyo: true,
      loop: -1
    });

    // Skip Button in upper right (prominent pill button)
    this.skipBtnBg = scene.add.rectangle(boxW / 2 - 40, -boxH / 2 + 4, 68, 18, 0x162c1e, 0.95);
    this.skipBtnBg.setStrokeStyle(1.5, 0x48e4b6);
    this.skipBtnBg.setOrigin(0.5, 0.5);
    this.add(this.skipBtnBg);

    this.btnSkip = scene.add.text(boxW / 2 - 40, -boxH / 2 + 4, 'SKIP ⏭', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5, 0.5);
    this.add(this.btnSkip);

    // Set scrollFactor 0 on all children so Phaser hit testing does not suffer camera scroll offsets
    this.each((child) => {
      if (child.setScrollFactor) child.setScrollFactor(0);
    });

    this.lastActionTime = 0;

    const triggerAction = (isSkip = false) => {
      const now = performance.now();
      if (now - this.lastActionTime < 180) return;
      this.lastActionTime = now;
      if (isSkip) {
        this.skipAll();
      } else {
        this.handleAction();
      }
    };

    // 1. Phaser scene pointer listener: receives all canvas taps with raw viewport coords (0 to 480, 0 to 270)
    this.scenePointerListener = (pointer) => {
      if (!this.active || !this.visible) return;
      // Skip button bounding area (with generous touch padding for mobile thumbs)
      const isSkip = (pointer.x >= 360 && pointer.x <= 475 && pointer.y >= 170 && pointer.y <= 230);
      triggerAction(isSkip);
    };
    scene.input.on('pointerdown', this.scenePointerListener);

    // 2. Direct DOM canvas pointer listener for absolute mobile browser responsiveness
    const canvas = scene.game && scene.game.canvas ? scene.game.canvas : null;
    if (canvas) {
      this.canvasPointerListener = (e) => {
        if (!this.active || !this.visible) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const touchX = (clientX - rect.left) * (GAME_CONFIG.WIDTH / rect.width);
        const touchY = (clientY - rect.top) * (GAME_CONFIG.HEIGHT / rect.height);
        const isSkip = (touchX >= 360 && touchX <= 475 && touchY >= 170 && touchY <= 230);
        triggerAction(isSkip);
      };
      canvas.addEventListener('pointerdown', this.canvasPointerListener);
      canvas.addEventListener('touchstart', this.canvasPointerListener, { passive: true });
    }

    // 3. Direct game object interaction fallback
    this.skipBtnBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => triggerAction(true));
    this.btnSkip.setInteractive({ useHandCursor: true }).on('pointerdown', () => triggerAction(true));
    this.bgBox.setInteractive({ useHandCursor: true }).on('pointerdown', () => triggerAction(false));
    this.dimOverlay.setInteractive().on('pointerdown', () => triggerAction(false));

    // 4. Touch virtual triggers fallback
    this.touchListener = () => {
      if (typeof window !== 'undefined' && window.touchController) {
        const triggers = window.touchController.consumeTriggers();
        if (triggers.justAttack || triggers.justJump || triggers.justUpSlash) {
          triggerAction(false);
        }
      }
    };
    scene.events.on('update', this.touchListener);

    // 5. Keyboard handlers (Space, Enter, E, Esc)
    this.onKeyDown = (event) => {
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') {
        triggerAction(false);
      } else if (event.code === 'Escape') {
        triggerAction(true);
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  startDialogue(lines, onComplete) {
    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }
    this.lines = lines;
    this.currentLineIdx = 0;
    this.onCompleteCallback = onComplete;
    this.setVisible(true);
    this.showLine(this.currentLineIdx);
  }

  showLine(idx) {
    if (idx >= this.lines.length) {
      this.close();
      return;
    }

    const line = this.lines[idx];
    const speaker = SPEAKER_CONFIGS[line.speaker] || SPEAKER_CONFIGS.LUNA;

    // Update nameplate
    this.nameplateText.setText(speaker.name);
    this.nameplateText.setColor(speaker.color);
    this.nameplateBg.setFillStyle(speaker.bgColor, 0.95);
    this.nameplateBg.setStrokeStyle(1, speaker.borderColor);

    const textWidth = Math.max(120, speaker.name.length * 6.5 + 16);
    this.nameplateBg.setSize(textWidth, 16);

    // Update Portrait
    if (speaker.spriteKey) {
      this.portraitIcon.setVisible(false);
      this.portraitSprite.setVisible(true);
      this.portraitSprite.setTexture(speaker.spriteKey, speaker.frame || 0);
      this.portraitSprite.setScale(speaker.scale || 0.8);
      this.portraitBg.setStrokeStyle(1.5, speaker.borderColor);
    } else {
      this.portraitSprite.setVisible(false);
      this.portraitIcon.setVisible(true);
      this.portraitIcon.setText(speaker.icon || '✨');
      this.portraitBg.setStrokeStyle(1.5, speaker.borderColor);
    }

    // Typewriter effect
    this.targetText = line.text;
    this.dialogueText.setText('');
    this.currentDisplayedChars = 0;
    this.isTyping = true;
    this.promptArrow.setVisible(false);

    if (this.typingTimer) this.typingTimer.remove();

    this.typingTimer = this.scene.time.addEvent({
      delay: 20,
      repeat: this.targetText.length - 1,
      callback: () => {
        this.currentDisplayedChars++;
        this.dialogueText.setText(this.targetText.substring(0, this.currentDisplayedChars));

        if (this.currentDisplayedChars % 3 === 0) {
          sound.playBlip(speaker.soundPitch);
        }

        if (this.currentDisplayedChars >= this.targetText.length) {
          this.isTyping = false;
          this.promptArrow.setVisible(true);
        }
      }
    });
  }

  handleAction() {
    if (this.isTyping) {
      // Instantly finish line
      if (this.typingTimer) this.typingTimer.remove();
      this.dialogueText.setText(this.targetText);
      this.isTyping = false;
      this.promptArrow.setVisible(true);
      sound.playBlip(true);
    } else {
      // Proceed to next line
      sound.playBlip(false);
      this.currentLineIdx++;
      this.showLine(this.currentLineIdx);
    }
  }

  skipAll() {
    if (this.typingTimer) this.typingTimer.remove();
    this.close();
  }

  cleanUpListeners() {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.scene && this.scene.input && this.scenePointerListener) {
      this.scene.input.off('pointerdown', this.scenePointerListener);
      this.scenePointerListener = null;
    }
    const canvas = this.scene && this.scene.game ? this.scene.game.canvas : null;
    if (canvas && this.canvasPointerListener) {
      canvas.removeEventListener('pointerdown', this.canvasPointerListener);
      canvas.removeEventListener('touchstart', this.canvasPointerListener);
      this.canvasPointerListener = null;
    }
    if (this.scene && this.scene.events && this.touchListener) {
      this.scene.events.off('update', this.touchListener);
      this.touchListener = null;
    }
    if (this.arrowTween) {
      this.arrowTween.stop();
      this.arrowTween = null;
    }
    if (this.typingTimer) {
      this.typingTimer.remove();
      this.typingTimer = null;
    }
  }

  close() {
    this.cleanUpListeners();

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 15,
      duration: 250,
      onComplete: () => {
        const cb = this.onCompleteCallback;
        this.destroy();
        if (cb) cb();
      }
    });
  }

  destroy() {
    this.cleanUpListeners();
    super.destroy();
  }
}
