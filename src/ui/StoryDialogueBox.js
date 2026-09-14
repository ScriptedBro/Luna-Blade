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

    // Prompt to advance [▼]
    this.promptArrow = scene.add.text(boxW / 2 - 18, boxH / 2 - 12, '▼', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#ffd166'
    }).setOrigin(0.5);
    this.add(this.promptArrow);

    this.arrowTween = scene.tweens.add({
      targets: this.promptArrow,
      y: boxH / 2 - 8,
      duration: 400,
      yoyo: true,
      loop: -1
    });

    // Skip Button in upper right
    this.btnSkip = scene.add.text(boxW / 2 - 10, -boxH / 2 + 2, '[ESC] SKIP', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#7b929e'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    this.btnSkip.on('pointerover', () => this.btnSkip.setColor('#ffffff'));
    this.btnSkip.on('pointerout', () => this.btnSkip.setColor('#7b929e'));
    this.btnSkip.on('pointerdown', () => this.skipAll());
    this.add(this.btnSkip);

    // Click anywhere on dialogue box to advance
    this.bgBox.setInteractive({ useHandCursor: true });
    this.bgBox.on('pointerdown', () => this.handleAction());
    this.dimOverlay.on('pointerdown', () => this.handleAction());

    // Keyboard handlers (Space, Enter, E, Esc)
    this.onKeyDown = (event) => {
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') {
        this.handleAction();
      } else if (event.code === 'Escape') {
        this.skipAll();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  startDialogue(lines, onComplete) {
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

  close() {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.arrowTween) this.arrowTween.stop();

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
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.typingTimer) this.typingTimer.remove();
    super.destroy();
  }
}
