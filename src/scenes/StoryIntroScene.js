import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';

const PROLOGUE_SLIDES = [
  {
    chapterTag: 'PROLOGUE • I. THE SILVER ERA',
    title: 'THE VIGIL OF THE MOON',
    text: 'For centuries, the High Forest flourished under the cool vigil of the Silver Moon. Its radiant grace blessed the ancient World-Tree, keeping beast and warden alike in sacred equilibrium.',
    bgColor: 0x05131d,
    tint: 0xaaddee,
    elements: (scene, container) => {
      // Celestial silver moon in the sky
      const moonGlow = scene.add.circle(240, 75, 42, 0x88ccff, 0.2);
      const moon = scene.add.circle(240, 75, 28, 0xe0f4ff);
      moon.setStrokeStyle(2, 0xffffff);
      container.add(moonGlow);
      container.add(moon);

      scene.tweens.add({
        targets: moonGlow,
        scale: 1.25,
        alpha: 0.35,
        duration: 2000,
        yoyo: true,
        loop: -1
      });

      // Distant pines silhouette
      for (let i = 0; i < 8; i++) {
        const pine = scene.add.image(40 + i * 60, 150, 'pine_green').setScale(0.7).setTint(0x1a3344);
        container.add(pine);
      }
    }
  },
  {
    chapterTag: 'PROLOGUE • II. THE CATACLYSM',
    title: 'THE SHATTERED SKY',
    text: 'Then came the Night of Sorrows. A cosmic tremor tore the moon asunder. Shards of burning lunar core rained down like jagged meteors, plunging deep into the heartwood and elder roots.',
    bgColor: 0x1d0811,
    tint: 0xff8899,
    elements: (scene, container) => {
      // Cracked moon
      const moon = scene.add.circle(240, 75, 28, 0xd4a5b0);
      moon.setStrokeStyle(2, 0xff5566);
      container.add(moon);

      // Cracks / meteor trails
      for (let i = 0; i < 5; i++) {
        const meteor = scene.add.rectangle(140 + i * 50, 40 + i * 15, 28, 3, 0xffdd66, 0.85);
        meteor.setRotation(-0.6);
        container.add(meteor);

        scene.tweens.add({
          targets: meteor,
          x: meteor.x + 80,
          y: meteor.y + 60,
          alpha: 0,
          duration: 900 + i * 200,
          loop: -1
        });
      }
    }
  },
  {
    chapterTag: 'PROLOGUE • III. THE PALE BLIGHT',
    title: 'CORRUPTED ROOTS',
    text: 'Deep underground, celestial purity turned venomous. The Pale Blight took root. Forest beasts mutated into crystal-crazed thralls, and ancient Guardian Obelisks were bound in dark seal rings.',
    bgColor: 0x160824,
    tint: 0xcc88ff,
    elements: (scene, container) => {
      // Obelisk silhouette bound by dark crystal
      const obelisk = scene.add.rectangle(240, 100, 18, 55, 0x1a1226);
      obelisk.setStrokeStyle(2, 0x9933cc);
      const ring = scene.add.circle(240, 95, 24, 0x7700aa, 0.4);
      ring.setStrokeStyle(1.5, 0xff00ff);
      container.add(obelisk);
      container.add(ring);

      // Corrupted mob silhouettes on sides
      const boar = scene.add.sprite(180, 115, 'boar_idle').setTint(0xaa2244).setScale(1.1);
      boar.play('boar_idle_anim');
      const snail = scene.add.sprite(300, 115, 'snail_walk').setTint(0x9922aa).setScale(1.1);
      snail.play('snail_walk_anim');
      snail.setFlipX(true);
      container.add(boar);
      container.add(snail);
    }
  },
  {
    chapterTag: 'PROLOGUE • IV. THE MOONWARDEN',
    title: 'THE LUNA BLADE AWAKENS',
    text: 'You are Luna, the last Moonwarden. Armed with the ancestral Luna Blade—forged from an uncorrupted lunar seed—you must cleanse the three Shrines, free the guardians, and restore the High Forest!',
    bgColor: 0x051d18,
    tint: 0x48e4b6,
    elements: (scene, container) => {
      // Hero ready for battle
      const hero = scene.add.sprite(230, 105, 'char_idle').setScale(1.3);
      hero.play('player_idle');
      container.add(hero);

      // Glowing sword blade aura
      const bladeGlow = scene.add.circle(248, 105, 14, 0x00ffff, 0.45);
      container.add(bladeGlow);

      scene.tweens.add({
        targets: bladeGlow,
        scale: 1.4,
        alpha: 0.7,
        duration: 600,
        yoyo: true,
        loop: -1
      });

      // Companion hovering
      const pet = scene.add.sprite(205, 85, 'fairy_fly').setScale(0.8);
      pet.play('fairy_fly_anim');
      container.add(pet);
    }
  }
];

export default class StoryIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryIntroScene' });
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.currentSlide = 0;
    this.isTransitioning = false;

    // Outer Background
    this.bgRect = this.add.rectangle(w / 2, h / 2, w, h, 0x05131d);

    // Decorative frame
    const frame = this.add.rectangle(w / 2, h / 2, w - 16, h - 16, 0x000000, 0);
    frame.setStrokeStyle(1.5, 0x224433);

    // Slide Content Container
    this.slideContainer = this.add.container(0, 0);

    // Top Header tags
    this.txtChapterTag = this.add.text(w / 2, 22, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#00f0ff'
    }).setOrigin(0.5);

    this.txtTitle = this.add.text(w / 2, 38, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '9px',
      color: '#ffd166',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Illustration Container (middle of screen)
    this.illustrationContainer = this.add.container(0, 0);

    // Bottom Story Narration Box
    const textBoxBg = this.add.rectangle(w / 2, h - 50, w - 36, 56, 0x071118, 0.95);
    textBoxBg.setStrokeStyle(1.5, 0x1d3a47);

    this.txtBody = this.add.text(26, h - 72, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#e0f2f7',
      lineSpacing: 5,
      wordWrap: { width: w - 52 }
    });

    // Pagination Dots
    this.dots = [];
    for (let i = 0; i < PROLOGUE_SLIDES.length; i++) {
      const dot = this.add.circle(w / 2 - 24 + i * 16, h - 12, 3, i === 0 ? 0x00ffff : 0x335566);
      this.dots.push(dot);
    }

    // Action Prompts
    this.txtPrompt = this.add.text(w - 24, h - 12, 'NEXT [SPACE] ▶', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#ffd166'
    }).setOrigin(1, 0.5);

    this.btnSkip = this.add.text(w - 20, 20, '[ESC] SKIP', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#7b929e'
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    this.btnSkip.on('pointerover', () => this.btnSkip.setColor('#ffffff'));
    this.btnSkip.on('pointerout', () => this.btnSkip.setColor('#7b929e'));
    this.btnSkip.on('pointerdown', () => this.startGame());

    // Input handlers
    this.input.keyboard.on('keydown-SPACE', () => this.advanceSlide());
    this.input.keyboard.on('keydown-ENTER', () => this.advanceSlide());
    this.input.keyboard.on('keydown-ESCAPE', () => this.startGame());
    this.input.on('pointerdown', (pointer) => {
      if (pointer.y > 40) this.advanceSlide();
    });

    // Ambient floating dust particles
    this.particles = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.4, end: 0 },
      speedY: { min: -15, max: -5 },
      lifespan: 2500,
      frequency: 200
    });

    sound.startBGM();
    this.renderSlide(0);
  }

  renderSlide(idx) {
    const data = PROLOGUE_SLIDES[idx];
    if (!data) return;

    this.illustrationContainer.removeAll(true);
    data.elements(this, this.illustrationContainer);

    this.txtChapterTag.setText(data.chapterTag);
    this.txtTitle.setText(data.title);
    this.txtBody.setText(data.text);

    this.tweens.add({
      targets: this.bgRect,
      fillColor: data.bgColor,
      duration: 500
    });

    this.dots.forEach((dot, i) => {
      dot.fillColor = i === idx ? 0x00ffff : 0x335566;
      dot.radius = i === idx ? 3.5 : 2.5;
    });

    if (idx === PROLOGUE_SLIDES.length - 1) {
      this.txtPrompt.setText('BEGIN QUEST [SPACE] ⚔️');
      this.txtPrompt.setColor('#00ffcc');
    } else {
      this.txtPrompt.setText('NEXT [SPACE] ▶');
      this.txtPrompt.setColor('#ffd166');
    }

    sound.playBlip(true);
  }

  advanceSlide() {
    if (this.isTransitioning) return;

    if (this.currentSlide < PROLOGUE_SLIDES.length - 1) {
      this.currentSlide++;
      this.renderSlide(this.currentSlide);
    } else {
      this.startGame();
    }
  }

  startGame() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    sound.playVictory();

    this.cameras.main.fade(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start('StoryScene', { chapter: 1 });
    });
  }
}
