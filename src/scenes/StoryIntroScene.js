import Phaser from "phaser";
import { GAME_CONFIG } from "../config.js";
import { sound } from "../engine/Audio.js";
import { storage } from "../engine/Storage.js";
import { pauseService } from "../engine/PauseService.js";

const PROLOGUE_SLIDES = [
  {
    chapterTag: "PROLOGUE • I. THE SILVER ERA",
    title: "THE VIGIL OF THE MOON",
    text: "For centuries, the High Forest flourished under the cool vigil of the Silver Moon. Its radiant grace blessed the ancient World-Tree, keeping beast and warden alike in sacred equilibrium.",
    badge: "📜 CHRONICLES OF ELDERWOOD",
    bgColor: 0x05131d,
    tint: 0x38bdf8,
    elements: (scene, container) => {
      // Sky backdrop
      const sky = scene.add.image(240, 80, "sky_backdrop")
        .setScale(1.05)
        .setTint(0x183850)
        .setAlpha(0.7);
      container.add(sky);

      // Mountain silhouette horizon
      const mountains = scene.add.image(240, 118, "sky_mountains")
        .setScale(1.25, 0.8)
        .setTint(0x0c2232)
        .setAlpha(0.9);
      container.add(mountains);

      // Celestial silver moon in the night sky
      const moonAura = scene.add.circle(240, 62, 54, 0x38bdf8, 0.12);
      const moonGlow = scene.add.circle(240, 62, 38, 0x88ccff, 0.25);
      const moon = scene.add.circle(240, 62, 24, 0xe2f4ff);
      moon.setStrokeStyle(2, 0xffffff);
      container.add(moonAura);
      container.add(moonGlow);
      container.add(moon);

      scene.tweens.add({
        targets: [moonGlow, moonAura],
        scale: 1.2,
        alpha: 0.35,
        duration: 2000,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut"
      });

      // Distant lush pines silhouette
      for (let i = 0; i < 9; i++) {
        const pine = scene.add.image(28 + i * 52, 126, "pine_green")
          .setScale(0.66)
          .setTint(0x0f2d37)
          .setAlpha(0.95);
        container.add(pine);
      }
    }
  },
  {
    chapterTag: "PROLOGUE • II. THE CATACLYSM",
    title: "THE SHATTERED SKY",
    text: "Then came the Night of Sorrows. A cosmic tremor tore the moon asunder. Shards of burning lunar core rained down like jagged meteors, plunging deep into the heartwood and elder roots.",
    badge: "⚡ THE NIGHT OF SORROWS",
    bgColor: 0x140308,
    tint: 0xff4d6d,
    elements: (scene, container) => {
      const cx = 240;
      const cy = 60;

      // 1. Apocalyptic Sky & Mountain Horizon
      const sky = scene.add.image(240, 75, "sky_backdrop")
        .setScale(1.05)
        .setTint(0x601424)
        .setAlpha(0.75);
      container.add(sky);

      const mountains = scene.add.image(240, 118, "sky_mountains")
        .setScale(1.25, 0.8)
        .setTint(0x320714)
        .setAlpha(0.95);
      container.add(mountains);

      // Scorched Pine Tree Silhouettes along the horizon
      for (let i = 0; i < 9; i++) {
        const tree = scene.add.image(24 + i * 54, 126, "pine_dark")
          .setScale(0.65)
          .setTint(0x20050e)
          .setAlpha(0.95);
        container.add(tree);
      }

      // 2. Cosmic Lunar Energy Shockwaves
      const shockwaveOuter = scene.add.circle(cx, cy, 68, 0xff1e38, 0.14);
      const shockwaveMid = scene.add.circle(cx, cy, 48, 0xff5500, 0.26);
      container.add(shockwaveOuter);
      container.add(shockwaveMid);

      scene.tweens.add({
        targets: shockwaveOuter,
        scale: 1.35,
        alpha: 0.02,
        duration: 1600,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut"
      });

      scene.tweens.add({
        targets: shockwaveMid,
        scale: 1.22,
        alpha: 0.38,
        duration: 1100,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut"
      });

      // 3. Procedural Pixel-Art Shattered Moon Texture
      scene.ensureShatteredMoonTexture();
      const moonImg = scene.add.image(cx, cy, "tex_shattered_moon");
      container.add(moonImg);

      scene.tweens.add({
        targets: moonImg,
        scale: 1.04,
        duration: 1200,
        yoyo: true,
        loop: -1,
        ease: "Sine.easeInOut"
      });

      // 4. Molten Core Halo Pulse behind fracture
      const coreHalo = scene.add.circle(cx + 4, cy, 14, 0xffaa00, 0.45);
      container.add(coreHalo);
      scene.tweens.add({
        targets: coreHalo,
        scale: 1.35,
        alpha: 0.7,
        duration: 450,
        yoyo: true,
        loop: -1
      });

      // 5. Raining Burning Lunar Core Meteors
      const meteors = [
        { startX: 90, startY: 46, angle: -0.65, speed: 1000, delay: 0 },
        { startX: 175, startY: 42, angle: -0.7, speed: 900, delay: 350 },
        { startX: 290, startY: 44, angle: -0.6, speed: 1150, delay: 180 },
        { startX: 370, startY: 48, angle: -0.68, speed: 980, delay: 500 }
      ];

      meteors.forEach((m, idx) => {
        const mGroup = scene.add.container(m.startX, m.startY);

        const tail = scene.add.rectangle(0, 0, 32, 2.5, 0xff5500, 0.85);
        tail.setOrigin(1, 0.5);
        tail.setRotation(m.angle);

        const coreGlow = scene.add.circle(0, 0, 5, 0xffbb22, 0.7);
        const core = scene.add.circle(0, 0, 2.5, 0xffffff);

        mGroup.add(tail);
        mGroup.add(coreGlow);
        mGroup.add(core);
        container.add(mGroup);

        const targetX = m.startX + Math.cos(m.angle + Math.PI) * -110;
        const targetY = m.startY + Math.sin(m.angle + Math.PI) * -110;

        scene.tweens.add({
          targets: mGroup,
          x: targetX,
          y: targetY,
          alpha: { start: 1, to: 0 },
          scaleX: { start: 1, to: 0.6 },
          duration: m.speed,
          delay: m.delay,
          loop: -1,
          repeatDelay: 300 + idx * 180
        });
      });
    }
  },
  {
    chapterTag: "PROLOGUE • III. THE PALE BLIGHT",
    title: "CORRUPTED ROOTS",
    text: "Deep underground, celestial purity turned venomous. The Pale Blight took root. Forest beasts mutated into crystal-crazed thralls, and ancient Guardian Obelisks were bound in dark seal rings.",
    badge: "🔮 CORRUPTED SHRINES",
    bgColor: 0x12051e,
    tint: 0xc084fc,
    elements: (scene, container) => {
      const sky = scene.add.image(240, 75, "sky_backdrop")
        .setScale(1.05)
        .setTint(0x351448)
        .setAlpha(0.7);
      container.add(sky);

      const mountains = scene.add.image(240, 118, "sky_mountains")
        .setScale(1.25, 0.8)
        .setTint(0x200b32)
        .setAlpha(0.9);
      container.add(mountains);

      // Obelisk silhouette bound by dark crystal
      const obelisk = scene.add.rectangle(240, 86, 18, 52, 0x1a1226);
      obelisk.setStrokeStyle(2, 0x9933cc);
      const ring = scene.add.circle(240, 81, 24, 0x7700aa, 0.4);
      ring.setStrokeStyle(1.5, 0xff00ff);
      container.add(obelisk);
      container.add(ring);

      scene.tweens.add({
        targets: ring,
        scale: 1.15,
        alpha: 0.7,
        duration: 1200,
        yoyo: true,
        loop: -1
      });

      // Corrupted mob silhouettes on sides
      const boar = scene.add.sprite(180, 106, "boar_idle").setTint(0xaa2244).setScale(1.1);
      boar.play("boar_idle_anim");
      const snail = scene.add.sprite(300, 106, "snail_walk").setTint(0x9922aa).setScale(1.1);
      snail.play("snail_walk_anim");
      snail.setFlipX(true);
      container.add(boar);
      container.add(snail);
    }
  },
  {
    chapterTag: "PROLOGUE • IV. THE MOONWARDEN",
    title: "THE LUNA BLADE AWAKENS",
    text: "You are Luna, the last Moonwarden. Armed with the ancestral Luna Blade—forged from an uncorrupted lunar seed—you must cleanse the three Shrines, free the guardians, and restore the High Forest!",
    badge: "⚔️ WARDEN OF THE HIGH FOREST",
    bgColor: 0x051d18,
    tint: 0x4ade80,
    elements: (scene, container) => {
      const sky = scene.add.image(240, 75, "sky_backdrop")
        .setScale(1.05)
        .setTint(0x0f3428)
        .setAlpha(0.7);
      container.add(sky);

      const mountains = scene.add.image(240, 118, "sky_mountains")
        .setScale(1.25, 0.8)
        .setTint(0x0a241c)
        .setAlpha(0.9);
      container.add(mountains);

      // Hero ready for battle
      const hero = scene.add.sprite(230, 94, "char_idle").setScale(1.3);
      hero.play("player_idle");
      container.add(hero);

      // Glowing sword blade aura
      const bladeGlow = scene.add.circle(248, 94, 14, 0x00ffff, 0.45);
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
      const pet = scene.add.sprite(205, 74, "fairy_fly").setScale(0.8);
      pet.play("fairy_fly_anim");
      container.add(pet);
    }
  }
];

export default class StoryIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: "StoryIntroScene" });
  }

  ensureShatteredMoonTexture() {
    if (this.textures.exists("tex_shattered_moon")) return;

    const size = 80;
    const canvas = this.textures.createCanvas("tex_shattered_moon", size, size);
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const r = 26;

    ctx.save();

    // 1. Left Major Crescent Lunar Half
    ctx.beginPath();
    ctx.arc(cx - 3, cy, r, 0.5 * Math.PI, 1.5 * Math.PI, false);
    ctx.lineTo(cx - 1, cy - r + 3);
    // Jagged fissure inner edge
    ctx.lineTo(cx - 4, cy - 14);
    ctx.lineTo(cx + 2, cy - 2);
    ctx.lineTo(cx - 5, cy + 10);
    ctx.lineTo(cx - 1, cy + r - 3);
    ctx.closePath();
    ctx.fillStyle = "#a82436";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ff7588";
    ctx.stroke();

    // Lunar maria / craters on left piece
    ctx.fillStyle = "#6d1220";
    ctx.beginPath();
    ctx.arc(cx - 12, cy - 8, 5, 0, Math.PI * 2);
    ctx.arc(cx - 10, cy + 9, 6, 0, Math.PI * 2);
    ctx.arc(cx - 17, cy + 1, 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Upper Severed Shard (drifting top right)
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy - 18);
    ctx.lineTo(cx + 22, cy - 12);
    ctx.lineTo(cx + 17, cy - 2);
    ctx.lineTo(cx + 6, cy - 5);
    ctx.closePath();
    ctx.fillStyle = "#9c2032";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ff7588";
    ctx.stroke();

    // 3. Lower Severed Shard (drifting bottom right)
    ctx.beginPath();
    ctx.moveTo(cx + 6, cy + 4);
    ctx.lineTo(cx + 20, cy + 2);
    ctx.lineTo(cx + 22, cy + 16);
    ctx.lineTo(cx + 8, cy + 19);
    ctx.closePath();
    ctx.fillStyle = "#8a1828";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ff6b6b";
    ctx.stroke();

    // 4. Molten Veins & Fissure Energy
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff9900";
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 20);
    ctx.lineTo(cx + 4, cy - 5);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 5, cy + 20);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 20);
    ctx.lineTo(cx + 4, cy - 5);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 5, cy + 20);
    ctx.stroke();

    ctx.restore();
    canvas.refresh();
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.currentSlide = 0;
    this.isTransitioning = false;

    pauseService.detachScene();

    if (typeof window !== "undefined" && window.touchController) {
      window.touchController.hide();
    }

    // Outer Background
    this.bgRect = this.add.rectangle(w / 2, h / 2, w, h, 0x05131d);

    // Slide Illustration Container (middle of screen)
    this.illustrationContainer = this.add.container(0, 0);

    // Atmospheric Sky Gradient / Backdrop Container
    // Fullscreen borderless canvas for maximum cinematic immersion

    // Top Header tags
    this.txtChapterTag = this.add.text(w / 2, 18, "", {
      fontFamily: "Press Start 2P",
      fontSize: "6.5px",
      color: "#00f0ff",
      letterSpacing: 1
    }).setOrigin(0.5);

    this.txtTitle = this.add.text(w / 2, 32, "", {
      fontFamily: "Press Start 2P",
      fontSize: "9px",
      color: "#ffd166",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5);

    // Bottom Story Narration Interface Box
    const boxW = w - 40;
    const boxH = 50;
    const boxY = 166;

    // Dual-layer RPG Dialogue Frame
    this.textBoxOuter = this.add.rectangle(w / 2, boxY, boxW, boxH, 0x07111a, 0.92);
    this.textBoxOuter.setStrokeStyle(1.5, 0x1d3a47);

    // Inner accent border
    this.textBoxInner = this.add.rectangle(w / 2, boxY, boxW - 6, boxH - 6, 0x000000, 0);
    this.textBoxInner.setStrokeStyle(1, 0x0c2534, 0.8);

    // Dialogue Box Corner Rivets
    const boxCorners = [
      { x: w / 2 - boxW / 2 + 4, y: boxY - boxH / 2 + 4 },
      { x: w / 2 + boxW / 2 - 4, y: boxY - boxH / 2 + 4 },
      { x: w / 2 - boxW / 2 + 4, y: boxY + boxH / 2 - 4 },
      { x: w / 2 + boxW / 2 - 4, y: boxY + boxH / 2 - 4 }
    ];
    boxCorners.forEach(bc => {
      this.add.rectangle(bc.x, bc.y, 3, 3, 0xf6c026, 0.9);
    });

    // Dialogue Box Badge / Ribbon
    this.badgeBox = this.add.rectangle(w / 2, boxY - boxH / 2, 160, 12, 0x0a1c28);
    this.badgeBox.setStrokeStyle(1, 0x244b62);
    this.txtBadge = this.add.text(w / 2, boxY - boxH / 2, "", {
      fontFamily: "Press Start 2P",
      fontSize: "5px",
      color: "#ffd166"
    }).setOrigin(0.5);

    // Story narration text
    this.txtBody = this.add.text(28, boxY - 14, "", {
      fontFamily: "Press Start 2P",
      fontSize: "6px",
      color: "#e8f8fc",
      lineSpacing: 5.5,
      wordWrap: { width: boxW - 16 }
    });

    // Bottom Controls Bar
    // 1. Skip Button Pill (bottom left)
    const skipPillX = 72;
    const skipPillY = 203;
    this.skipPill = this.add.rectangle(skipPillX, skipPillY, 96, 17, 0x091722, 0.9)
      .setStrokeStyle(1, 0x244254)
      .setInteractive({ useHandCursor: true });

    this.txtSkip = this.add.text(skipPillX, skipPillY, "⏭ SKIP STORY", {
      fontFamily: "Press Start 2P",
      fontSize: "5.5px",
      color: "#8aa4b8"
    }).setOrigin(0.5);

    this.skipPill.on("pointerover", () => {
      this.skipPill.setStrokeStyle(1, 0x4ade80);
      this.txtSkip.setColor("#ffffff");
    });
    this.skipPill.on("pointerout", () => {
      this.skipPill.setStrokeStyle(1, 0x244254);
      this.txtSkip.setColor("#8aa4b8");
    });
    this.skipPill.on("pointerdown", () => this.startGame());

    // 2. Pagination Dots
    this.dots = [];
    for (let i = 0; i < PROLOGUE_SLIDES.length; i++) {
      const dot = this.add.circle(w / 2 - 24 + i * 16, 203, 3, i === 0 ? 0x00ffff : 0x224455);
      this.dots.push(dot);
    }

    // 3. Action Prompt (Next / Begin) Pill (bottom right)
    const nextPillX = w - 66;
    const nextPillY = 203;
    this.nextPill = this.add.rectangle(nextPillX, nextPillY, 84, 17, 0x1d1a08, 0.9)
      .setStrokeStyle(1, 0xf6c026)
      .setInteractive({ useHandCursor: true });

    this.txtPrompt = this.add.text(nextPillX, nextPillY, "NEXT ▶", {
      fontFamily: "Press Start 2P",
      fontSize: "5.5px",
      color: "#ffd166"
    }).setOrigin(0.5);

    this.nextPill.on("pointerdown", () => this.advanceSlide());

    this.tweens.add({
      targets: [this.nextPill, this.txtPrompt],
      scale: 1.04,
      duration: 650,
      yoyo: true,
      loop: -1
    });

    // Input handlers
    this.input.keyboard.on("keydown-SPACE", () => this.advanceSlide());
    this.input.keyboard.on("keydown-ENTER", () => this.advanceSlide());
    this.input.keyboard.on("keydown-ESCAPE", () => this.startGame());
    this.input.on("pointerdown", (pointer) => {
      // Avoid conflict if tapping skip pill
      if (pointer.x < 130 && pointer.y > 190) return;
      this.advanceSlide();
    });

    // Ambient floating sparks
    this.particles = this.add.particles(0, 0, "spark", {
      x: { min: 0, max: w },
      y: { min: 0, max: h },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.4, end: 0 },
      speedY: { min: -15, max: -5 },
      lifespan: 2500,
      frequency: 180
    });

    sound.startBGM();
    this.renderSlide(0);
  }

  update() {
    if (this.isTransitioning) return;
    if (typeof window !== "undefined" && window.touchController) {
      const triggers = window.touchController.consumeTriggers();
      if (triggers.justAttack || triggers.justJump || triggers.justUpSlash) {
        this.advanceSlide();
      }
    }
  }

  renderSlide(idx) {
    const data = PROLOGUE_SLIDES[idx];
    if (!data) return;

    this.illustrationContainer.removeAll(true);
    data.elements(this, this.illustrationContainer);

    this.txtChapterTag.setText(data.chapterTag);
    this.txtChapterTag.setColor("#" + data.tint.toString(16).padStart(6, "0"));
    this.txtTitle.setText(data.title);
    this.txtBody.setText(data.text);
    this.txtBadge.setText(data.badge || "📜 LUNA BLADE CHRONICLE");

    // Color transition on background & interface borders
    this.tweens.add({
      targets: this.bgRect,
      fillColor: data.bgColor,
      duration: 500
    });


    if (this.textBoxOuter) {
      this.textBoxOuter.setStrokeStyle(1.5, data.tint, 0.7);
    }
    if (this.badgeBox) {
      this.badgeBox.setStrokeStyle(1, data.tint, 0.8);
    }

    // Special cinematic effects for Cataclysm
    if (idx === 1) {
      this.cameras.main.shake(500, 0.007);
      sound.playRumble();
    } else {
      sound.playBlip(true);
    }

    this.dots.forEach((dot, i) => {
      dot.fillColor = i === idx ? data.tint : 0x224455;
      dot.radius = i === idx ? 3.5 : 2.5;
    });

    if (idx === PROLOGUE_SLIDES.length - 1) {
      this.txtPrompt.setText("BEGIN QUEST ⚔️");
      this.txtPrompt.setColor("#00ffcc");
      this.nextPill.setStrokeStyle(1, 0x00ffcc);
    } else {
      this.txtPrompt.setText("NEXT ▶");
      this.txtPrompt.setColor("#ffd166");
      this.nextPill.setStrokeStyle(1, 0xf6c026);
    }
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
      this.scene.start("StoryScene", { chapter: 1 });
    });
  }
}
