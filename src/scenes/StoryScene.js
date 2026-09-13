import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Boar from '../entities/Boar.js';
import Snail from '../entities/Snail.js';
import Bee from '../entities/Bee.js';
import Mushroom from '../entities/Mushroom.js';
import FlyingEye from '../entities/FlyingEye.js';
import Goblin from '../entities/Goblin.js';
import BossGorgok from '../entities/BossGorgok.js';
import BossWizard from '../entities/BossWizard.js';
import Projectile from '../entities/Projectile.js';
import Crate from '../entities/Crate.js';
import Obelisk from '../entities/Obelisk.js';
import BossHealthBar from '../ui/BossHealthBar.js';
import HeroHealthBar from '../ui/HeroHealthBar.js';
import StoryDialogueBox from '../ui/StoryDialogueBox.js';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import confetti from 'canvas-confetti';

export default class StoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryScene' });
  }

  init(data) {
    this.chapterId = data.chapter || 1;
    this.chapterConfig = GAME_CONFIG.CHAPTERS.find(c => c.id === this.chapterId) || GAME_CONFIG.CHAPTERS[0];
    this.killsCount = 0;
    this.isVictory = false;
    this.inDialogue = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.levelWidth = this.chapterId === 1 ? 2800 : 2600;
    this.levelHeight = 420;
    this.victoryAdvanceCallback = null;
    this.gameOverRetryCallback = null;

    // Boss & Arena state
    this.boss = null;
    this.bossHealthBar = null;
    this.bossTriggered = false;
    this.arenaGateWall = null;
    this.arenaGateVisual = null;
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    // Physics bounds
    this.physics.world.setBounds(0, 0, this.levelWidth, this.levelHeight);

    // Lush Parallax High Forest Background & Atmosphere
    this.createForestBackground();

    // Platform, Hazard, Crate, Enemy, and Projectile groups
    this.platforms = this.physics.add.staticGroup();
    this.hazards = this.physics.add.staticGroup();
    this.crates = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group({ runChildUpdate: true });

    // Build the Level Geometry & Spawns
    this.buildChapterLevel();

    // Spawn Player
    this.player = new Player(this, 60, 240);
    this.physics.add.collider(this.player, this.platforms);

    // Camera follow
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setZoom(1);

    // Collisions
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.crates, this.platforms);
    this.physics.add.collider(this.crates, this.crates);

    // Projectile collisions with environment
    this.physics.add.collider(this.projectiles, this.platforms, (proj) => {
      if (proj.projType === 'goblin_bomb') {
        // Bombs bounce with friction
      } else {
        proj.explode();
      }
    });

    // Hazards (Water in ch1, honeycomb traps in ch2, spikes in ch3)
    this.physics.add.overlap(this.player, this.hazards, (player, hazard) => {
      this.handleHazardHit(player, hazard);
    });

    // Player attack vs enemies
    this.physics.add.overlap(this.player.attackHitbox, this.enemies, (hitbox, enemy) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(enemy)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(enemy);
      this.handlePlayerAttackEnemy(enemy);
    });

    // Player attack vs projectiles (Deflect or cut!)
    this.physics.add.overlap(this.player.attackHitbox, this.projectiles, (hitbox, proj) => {
      if (!this.player.isAttacking || proj.isDead) return;
      if (proj.isDeflectable && !proj.isDeflected) {
        proj.deflect(this.player);
      } else if (!proj.isDeflected) {
        proj.explode();
        this.registerComboHit();
      }
    });

    // Player body vs projectile
    this.physics.add.overlap(this.player, this.projectiles, (player, proj) => {
      if (proj.isDead || proj.isDeflected || player.isDead) return;
      proj.explode();
      const knockDir = proj.x < player.x ? 1 : -1;
      const damaged = player.takeDamage(proj.damage || 15, knockDir);
      if (damaged) {
        this.comboCount = 0;
        this.updateHearts();
        if (player.isDead) {
          this.handlePlayerGameOver();
        }
      }
    });

    // Deflected projectile vs enemies & bosses!
    this.physics.add.overlap(this.enemies, this.projectiles, (enemy, proj) => {
      if (!proj.isDeflected || proj.isDead || enemy.state === 'DEAD') return;
      proj.explode();
      enemy.takeDamage(35, proj.x);
    });

    // Player attack vs crates
    this.physics.add.overlap(this.player.attackHitbox, this.crates, (hitbox, crate) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(crate)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(crate);
      crate.breakCrate(this.player);
      this.updateHudMaterials();
    });

    // Player attack vs Obelisk
    if (this.obelisk) {
      this.physics.add.overlap(this.player.attackHitbox, this.obelisk, () => {
        if (this.player.currentSwingHits && this.player.currentSwingHits.has(this.obelisk)) return;
        if (this.player.currentSwingHits) this.player.currentSwingHits.add(this.obelisk);
        const cleansed = this.obelisk.strike();
        if (cleansed) {
          this.triggerChapterVictory();
        }
      });
    }

    // Player body vs enemy body
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      this.handlePlayerEnemyCollision(enemy);
    });

    // Keyboard inputs
    this.cursors = this.input.keyboard.createCursorKeys();
    this.cursors.keys = this.input.keyboard.addKeys('W,A,S,D,J,K,Z,X,E,R,ENTER,ESC');

    // On-screen HUD
    this.createStoryHUD();

    // Chapter Title Intro Card
    this.showChapterIntroCard();
  }

  buildChapterLevel() {
    const isCh1 = this.chapterId === 1;
    const isCh2 = this.chapterId === 2;
    const isCh3 = this.chapterId === 3;

    if (isCh1) {
      // =========================================================================
      // Chapter 1: Whispering Woods (2800px) - Forest & Lake, Water Hazards
      // =========================================================================

      // --- ZONE 1: The Forest Outskirts (0 - 640px) ---
      this.createGround(0, 380, 520);
      this.createHazard(520, 400, 120, 'WATER HAZARD 🌊');

      this.createPlatform(180, 310, 90);
      this.createPlatform(320, 250, 110);

      this.spawnMob('boar', 240, 340);
      this.spawnMob('boar', 440, 340);
      this.spawnMob('snail', 340, 230);
      this.spawnCrate(330, 220);

      // --- ZONE 2: Lake Cascades & Watchtower Lookout (640 - 1120px) ---
      this.createGround(640, 380, 340);
      this.createHazard(980, 400, 140, 'WATER HAZARD 🌊');

      // Wooden platforms leading into cascade
      this.createPlatform(720, 300, 90);
      this.createPlatform(840, 240, 100);

      // Stepping logs across the deep rapids
      this.createPlatform(990, 320, 55);
      this.createPlatform(1055, 270, 55);

      // High secret canopy lookout with hidden cache
      this.createPlatform(1010, 185, 90);
      this.spawnCrate(1030, 155);

      this.spawnMob('boar', 780, 340);
      this.spawnMob('snail', 680, 340);
      this.spawnMob('snail', 860, 220);
      this.spawnMob('bee', 820, 150);
      this.spawnMob('flying_eye', 1040, 130);
      this.spawnCrate(740, 270);

      // --- ZONE 3: Ancient Pine Canopy & Ravine (1120 - 2060px) ---
      this.createGround(1120, 380, 400);
      this.createHazard(1520, 400, 120, 'WATER HAZARD 🌊');
      this.createGround(1640, 380, 420);

      // Canopy network
      this.createPlatform(1220, 300, 90);
      this.createPlatform(1370, 240, 100);
      this.createPlatform(1540, 290, 80);
      this.createPlatform(1700, 230, 100);
      this.createPlatform(1860, 180, 120);

      this.spawnMob('mushroom', 1240, 340);
      this.spawnMob('snail', 1390, 220);
      this.spawnMob('flying_eye', 1460, 150);
      this.spawnMob('goblin', 1680, 340);
      this.spawnMob('boar', 1760, 340);
      this.spawnMob('mushroom', 1860, 340);
      this.spawnMob('goblin', 1980, 340);

      this.spawnCrate(1240, 270);
      this.spawnCrate(1400, 350);
      this.spawnCrate(1720, 200);
      this.spawnCrate(1880, 150);

      // --- ZONE 4: Obelisk Sanctuary & Boss Arena (2060 - 2800px) ---
      this.createHazard(2060, 400, 100, 'WATER HAZARD 🌊');
      this.createGround(2160, 380, 640);

      this.createPlatform(2260, 300, 100);
      this.createPlatform(2440, 240, 110);

      this.spawnMob('boar', 2220, 340);
      this.spawnMob('snail', 2280, 340);

      this.spawnCrate(2280, 270);
      this.spawnCrate(2520, 350);

      // Ancient Obelisk at the sacred clearing (Locked by Chieftain Gorgok!)
      this.obelisk = new Obelisk(this, 2720, 380, 'Shrine of Whispering Waters');
      this.obelisk.lock();

    } else if (isCh2) {
      // =========================================================================
      // Chapter 2: The Hive Canopy (2600px) - Autumn Trees, Honeycomb Traps, Bees
      // =========================================================================
      this.createGround(0, 380, 480);
      this.createHazard(480, 395, 80, 'HONEYCOMB TRAP 🍯');
      this.createGround(560, 380, 480);
      this.createHazard(1040, 395, 80, 'HONEYCOMB TRAP 🍯');
      this.createGround(1120, 380, 520);
      this.createHazard(1640, 395, 80, 'HONEYCOMB TRAP 🍯');
      this.createGround(1720, 380, 880);

      // High tree canopy platforms
      this.createPlatform(160, 300, 90);
      this.createPlatform(260, 230, 90);
      this.createPlatform(420, 180, 120);
      this.createPlatform(600, 230, 90);
      this.createPlatform(780, 170, 130);
      this.createPlatform(960, 250, 110);
      this.createPlatform(1200, 290, 100);
      this.createPlatform(1360, 220, 110);
      this.createPlatform(1520, 170, 120);
      this.createPlatform(1760, 280, 100);
      this.createPlatform(1940, 210, 120);
      this.createPlatform(2180, 270, 100);
      this.createPlatform(2340, 210, 120);
      this.createPlatform(2480, 270, 100);

      // Bees, Flying Eyes, Mushrooms, Goblins & Boars
      this.spawnMob('bee', 220, 160);
      this.spawnMob('flying_eye', 440, 120);
      this.spawnMob('snail', 460, 155);
      this.spawnMob('boar', 340, 340);
      this.spawnMob('mushroom', 600, 200);
      this.spawnMob('goblin', 780, 140);
      this.spawnMob('bee', 900, 120);
      this.spawnMob('boar', 820, 340);
      this.spawnMob('flying_eye', 1200, 140);
      this.spawnMob('mushroom', 1360, 190);
      this.spawnMob('goblin', 1520, 140);
      this.spawnMob('bee', 1540, 120);
      this.spawnMob('boar', 1740, 340);
      this.spawnMob('flying_eye', 1880, 140);
      this.spawnMob('snail', 1960, 180);

      // Crates with high amber chance
      this.spawnCrate(280, 205);
      this.spawnCrate(800, 145);
      this.spawnCrate(1140, 350);
      this.spawnCrate(1380, 195);
      this.spawnCrate(1780, 255);
      this.spawnCrate(2200, 245);
      this.spawnCrate(2420, 350);

      // Obelisk (Locked by Boss Malakor!)
      this.obelisk = new Obelisk(this, 2520, 380, 'Golden Hive Shrine');
      this.obelisk.lock();

    } else {
      // =========================================================================
      // Chapter 3: Sunken Ruins (2600px) - Mossy Stone, Spike Traps, Elite Swarms
      // =========================================================================
      this.createGround(0, 380, 400);
      this.createHazard(400, 400, 90, 'ANCIENT SPIKES ⚡');
      this.createGround(490, 380, 440);
      this.createHazard(930, 400, 100, 'ANCIENT SPIKES ⚡');
      this.createGround(1030, 380, 460);
      this.createHazard(1490, 400, 100, 'ANCIENT SPIKES ⚡');
      this.createGround(1590, 380, 460);
      this.createHazard(2050, 400, 100, 'ANCIENT SPIKES ⚡');
      this.createGround(2150, 380, 450);

      // Stepping stone platforms
      this.createPlatform(140, 280, 80);
      this.createPlatform(290, 220, 90);
      this.createPlatform(460, 260, 90);
      this.createPlatform(620, 190, 90);
      this.createPlatform(780, 240, 100);
      this.createPlatform(980, 210, 90);
      this.createPlatform(1180, 280, 90);
      this.createPlatform(1340, 210, 100);
      this.createPlatform(1520, 250, 90);
      this.createPlatform(1700, 190, 100);
      this.createPlatform(1920, 230, 90);
      this.createPlatform(2100, 270, 90);

      // Elite waves
      this.spawnMob('boar', 180, 340);
      this.spawnMob('snail', 310, 200);
      this.spawnMob('mushroom', 400, 340);
      this.spawnMob('flying_eye', 480, 160);
      this.spawnMob('goblin', 700, 340);
      this.spawnMob('boar', 820, 340);
      this.spawnMob('bee', 850, 140);
      this.spawnMob('mushroom', 1140, 340);
      this.spawnMob('goblin', 1280, 340);
      this.spawnMob('flying_eye', 1360, 160);
      this.spawnMob('snail', 1540, 230);
      this.spawnMob('boar', 1740, 340);
      this.spawnMob('mushroom', 1820, 140);
      this.spawnMob('goblin', 1940, 200);
      this.spawnMob('flying_eye', 2220, 140);
      this.spawnMob('boar', 2340, 340);

      // Crates
      this.spawnCrate(310, 195);
      this.spawnCrate(800, 215);
      this.spawnCrate(1100, 350);
      this.spawnCrate(1360, 185);
      this.spawnCrate(1720, 165);
      this.spawnCrate(2120, 245);
      this.spawnCrate(2380, 350);

      // Final Corrupted Shrine Obelisk
      this.obelisk = new Obelisk(this, 2480, 380, 'Corrupted Obelisk of the High Forest');
    }
  }

  createForestBackground() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    // 1. Sky Gradient (fixed to camera)
    this.bgSky = this.add.tileSprite(0, 0, w, h, 'sky_backdrop').setOrigin(0, 0).setScrollFactor(0).setDepth(0);

    // 2. Distant Mountains (very slow parallax)
    this.bgMountains = this.add.tileSprite(0, 20, w, 200, 'sky_mountains').setOrigin(0, 0).setScrollFactor(0).setDepth(1);

    // 3. Foggy Distant Mountain Pines (slow parallax)
    this.bgFogPines = this.add.tileSprite(0, 50, w, 220, 'forest_bg_p0').setOrigin(0, 0).setScrollFactor(0).setDepth(2);

    // 4. Midground Forest Silhouettes
    this.bgMidPines = this.add.tileSprite(0, 80, w, 220, 'forest_bg_p1').setOrigin(0, 0).setScrollFactor(0).setDepth(3);

    // 5. Standalone Tall Pine Trees placed along the level in world coordinates
    const treeSpacing = 140;
    const numTrees = Math.floor(this.levelWidth / treeSpacing);
    for (let i = 0; i < numTrees; i++) {
      const tx = 60 + i * treeSpacing + ((i * 37) % 50 - 25);
      let treeKey = (i % 3 === 0) ? 'pine_green' : (i % 3 === 1 ? 'pine_dark' : 'pine_golden');
      if (this.chapterId === 2 && treeKey === 'pine_green') treeKey = 'pine_golden';
      if (this.chapterId === 3) treeKey = 'pine_dark';

      const scale = 0.9 + ((i * 19) % 30) * 0.01;
      const tree = this.add.image(tx, 388, treeKey)
        .setOrigin(0.5, 1.0)
        .setScale(scale)
        .setDepth(4);

      // Subtle wind sway tween
      this.tweens.add({
        targets: tree,
        angle: { from: -0.8, to: 0.8 },
        duration: 2400 + (i % 5) * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // 6. Forest Bushes behind platforms
    const bushSpacing = 150;
    const numBushes = Math.floor(this.levelWidth / bushSpacing);
    for (let i = 0; i < numBushes; i++) {
      const bx = 90 + i * bushSpacing + ((i * 43) % 60 - 30);
      const bushKey = this.chapterId === 2 ? 'bush_golden' : (this.chapterId === 3 ? 'bush_dark' : 'bush_green');
      this.add.image(bx, 382, bushKey).setOrigin(0.5, 1.0).setDepth(5).setScale(0.85);
    }

    // 7. Ambient floating forest spores / pollen particles
    this.createForestParticles();
  }

  createForestParticles() {
    this.particles = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: this.levelWidth },
      y: { min: 40, max: 360 },
      quantity: 1,
      frequency: 240,
      lifespan: 3800,
      gravityY: -8,
      speedX: { min: -12, max: 12 },
      speedY: { min: -8, max: 8 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: this.chapterId === 2 ? 0xffcc44 : (this.chapterId === 3 ? 0x88ffbb : 0x88ee88),
      blendMode: 'ADD'
    }).setDepth(15);
  }

  createGround(x, y, width) {
    const depth = 10;
    // Static collider body aligned with walking surface at y
    const body = this.add.rectangle(x + width / 2, y + 20, width, 40, 0x000000, 0);
    this.physics.add.existing(body, true);
    this.platforms.add(body);

    // Render lush grass cliff top (16px per tile)
    const numTiles = Math.ceil(width / 16);
    for (let i = 0; i < numTiles; i++) {
      const tileX = x + i * 16;
      let topKey = 'tile_cliff_top_mid1';
      if (i === 0 && x > 0) {
        topKey = 'tile_cliff_top_left';
      } else if (i === numTiles - 1 && (x + width < this.levelWidth)) {
        topKey = 'tile_cliff_top_right';
      } else if (i % 3 === 0) {
        topKey = 'tile_cliff_top_mid2';
      }

      // Top grass tile: place top at y - 10 so grass tufts stick up slightly above walking line y
      this.add.image(tileX, y - 10, topKey).setOrigin(0, 0).setDepth(depth);

      // Underneath: cliff rock body down below
      for (let cy = y + 6; cy <= y + 38; cy += 16) {
        let bodyKey = 'tile_cliff_body_mid';
        if (i === 0 && x > 0) bodyKey = 'tile_cliff_body_left';
        else if (i === numTiles - 1 && (x + width < this.levelWidth)) bodyKey = 'tile_cliff_body_right';
        this.add.image(tileX, cy, bodyKey).setOrigin(0, 0).setDepth(depth - 1);
      }
    }

    // Add decorative flora (mushrooms, flowers, ferns) along the grass
    for (let px = x + 24; px < x + width - 24; px += 56) {
      const hash = Math.floor((px * 9301 + 49297) % 233280);
      const roll = hash % 5;
      if (roll === 0) {
        this.add.image(px, y, 'prop_shroom_big').setOrigin(0.5, 1.0).setDepth(depth + 1);
      } else if (roll === 1) {
        this.add.image(px, y, 'prop_flower_blue').setOrigin(0.5, 1.0).setDepth(depth + 1);
      } else if (roll === 2) {
        this.add.image(px, y, 'prop_flower_purple').setOrigin(0.5, 1.0).setDepth(depth + 1);
      } else if (roll === 3) {
        this.add.image(px, y, 'prop_shroom_small').setOrigin(0.5, 1.0).setDepth(depth + 1);
      } else if (roll === 4) {
        this.add.image(px, y, 'prop_fern').setOrigin(0.5, 1.0).setDepth(depth + 1);
      }
    }
  }

  createPlatform(x, y, width) {
    const depth = 10;
    // Static collider body
    const body = this.add.rectangle(x + width / 2, y + 6, width, 12, 0x000000, 0);
    this.physics.add.existing(body, true);
    this.platforms.add(body);

    if (this.chapterId === 3) {
      // Ancient stone ruins platform
      const count = Math.ceil(width / 48);
      for (let i = 0; i < count; i++) {
        this.add.image(x + i * 48, y, 'plat_stone').setOrigin(0, 0).setDepth(depth);
      }
    } else if (this.chapterId === 2) {
      // High tree branches
      const count = Math.ceil(width / 75);
      for (let i = 0; i < count; i++) {
        this.add.image(x + i * 75, y - 2, 'plat_branch').setOrigin(0, 0).setDepth(depth);
      }
    } else {
      // Whispering Woods: wooden timber platform
      const count = Math.ceil(width / 48);
      for (let i = 0; i < count; i++) {
        this.add.image(x + i * 48, y, 'plat_wood').setOrigin(0, 0).setDepth(depth);
      }
    }
  }

  createHazard(x, y, width, label) {
    const haz = this.add.rectangle(x + width / 2, y + 16, width, 24, 0x000000, 0);
    this.physics.add.existing(haz, true);
    this.hazards.add(haz);

    if (this.chapterId === 1) {
      // Lake Water: rippling animated water surface & deep water underneath
      const waterCount = Math.ceil(width / 64);
      for (let i = 0; i < waterCount; i++) {
        const waterImg = this.add.image(x + i * 64, y - 8, 'water_surface').setOrigin(0, 0).setDepth(11);
        this.tweens.add({
          targets: waterImg,
          y: y - 5,
          duration: 1000 + i * 160,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        this.add.image(x + i * 64, y + 24, 'water_deep').setOrigin(0, 0).setDepth(10);
      }
      // Reeds along shores
      this.add.image(x + 4, y - 8, 'prop_reeds').setOrigin(0.5, 1.0).setDepth(12);
      this.add.image(x + width - 4, y - 8, 'prop_reeds').setOrigin(0.5, 1.0).setDepth(12).setFlipX(true);
    } else if (this.chapterId === 2) {
      // Honeycomb traps
      const hCount = Math.ceil(width / 32);
      for (let i = 0; i < hCount; i++) {
        const hive = this.add.image(x + i * 32 + 16, y + 8, 'env_hive').setOrigin(0.5, 0.5).setScale(0.7).setDepth(11);
        hive.setTint(0xffaa22);
      }
    } else {
      // Ancient Spikes
      const sCount = Math.ceil(width / 16);
      for (let i = 0; i < sCount; i++) {
        this.add.triangle(x + i * 16 + 8, y + 12, 0, 16, 8, 0, 16, 16, 0x888899).setDepth(11);
      }
    }
  }

  spawnMob(type, x, y) {
    let mob;
    if (type === 'boar') {
      mob = new Boar(this, x, y);
    } else if (type === 'snail') {
      mob = new Snail(this, x, y);
    } else if (type === 'bee') {
      mob = new Bee(this, x, y);
    } else if (type === 'mushroom') {
      mob = new Mushroom(this, x, y);
    } else if (type === 'flying_eye') {
      mob = new FlyingEye(this, x, y);
    } else if (type === 'goblin') {
      mob = new Goblin(this, x, y);
    }
    if (mob) {
      mob.mobType = type;
      this.enemies.add(mob);
    }
    return mob;
  }

  spawnProjectile(type, x, y, vx, vy, isDeflectable = false) {
    const proj = new Projectile(this, x, y, type, vx, vy, isDeflectable);
    this.projectiles.add(proj);
    proj.setVelocity(vx, vy);
    return proj;
  }

  triggerBossEncounter(chapter) {
    if (this.bossTriggered) return;
    this.bossTriggered = true;

    sound.playVictory();
    this.cameras.main.shake(400, 0.02);

    if (chapter === 1) {
      // Restrict camera to Chapter 1 Boss Arena
      this.cameras.main.setBounds(2300, 0, 500, this.levelHeight);

      // Arena barricade gate at x = 2310
      this.arenaGateWall = this.add.rectangle(2310, 340, 20, 100, 0x000000, 0);
      this.physics.add.existing(this.arenaGateWall, true);
      this.platforms.add(this.arenaGateWall);

      // Visual gate: wooden spike barricade
      this.arenaGateVisual = this.add.container(2310, 340);
      for (let gy = -40; gy <= 40; gy += 24) {
        const cratePart = this.add.image(0, gy, 'crate').setScale(1.1).setTint(0x4a2a1a);
        this.arenaGateVisual.add(cratePart);
      }
      this.arenaGateVisual.setDepth(15);

      // Boss Health Bar
      this.bossHealthBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_GORGOK.NAME, GAME_CONFIG.MOBS.BOSS_GORGOK.HP);

      // Spawn Boss Gorgok (halt AI until dialogue concludes)
      this.boss = new BossGorgok(this, 2600, 340, this.bossHealthBar);
      this.enemies.add(this.boss);
      this.boss.actionCooldown = this.time.now + 999999;

      this.startDialogue([
        { speaker: 'GORGOK', text: 'GRAAAAGH! WHO ENTERS MY GLADE?! THE CRYSTAL... IT SINGS IN MY BLOOD!' },
        { speaker: 'LUNA', text: 'Gorgok! Fight the corruption! You were the revered guardian of these woods!' },
        { speaker: 'GORGOK', text: 'GUARDIAN NO MORE! I AM THE TUSK OF THE BLIGHT! CRUSH THE MOONWARDEN!' },
        { speaker: 'LUNA', text: 'Forgive me, ancient friend. The Luna Blade will shatter your chains!' }
      ], () => {
        if (this.boss && this.boss.active) {
          this.boss.actionCooldown = this.time.now + 600;
        }
        this.showBossWarningBanner(GAME_CONFIG.MOBS.BOSS_GORGOK.NAME, 'ARMORED WAR BOAR COLOSSUS');
      });
    } else if (chapter === 2) {
      // Restrict camera to Chapter 2 Boss Arena
      this.cameras.main.setBounds(2080, 0, 520, this.levelHeight);

      // Arena barricade gate at x = 2090
      this.arenaGateWall = this.add.rectangle(2090, 340, 20, 100, 0x000000, 0);
      this.physics.add.existing(this.arenaGateWall, true);
      this.platforms.add(this.arenaGateWall);

      // Visual gate: hive blocks
      this.arenaGateVisual = this.add.container(2090, 340);
      for (let gy = -40; gy <= 40; gy += 24) {
        const block = this.add.image(0, gy, 'crate').setScale(1.1).setTint(0x664411);
        this.arenaGateVisual.add(block);
      }
      this.arenaGateVisual.setDepth(15);

      // Boss Health Bar
      this.bossHealthBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_WIZARD.NAME, GAME_CONFIG.MOBS.BOSS_WIZARD.HP);

      // Spawn Boss Malakor (halt AI until dialogue concludes)
      this.boss = new BossWizard(this, 2380, 240, this.bossHealthBar);
      this.enemies.add(this.boss);
      this.boss.nextActionTime = this.time.now + 999999;

      this.startDialogue([
        { speaker: 'MALAKOR', text: 'Ah, the little Moonwarden finally arrives. How tragic that you climbed so high only to fall.' },
        { speaker: 'LUNA', text: 'Surrender the lunar shard, Malakor! Your experiments are rotting the forest from within!' },
        { speaker: 'MALAKOR', text: 'Rot? This is TRANSCENDENCE! With the celestial core, I shall bend reality itself! DIE!' }
      ], () => {
        if (this.boss && this.boss.active) {
          this.boss.nextActionTime = this.time.now + 700;
        }
        this.showBossWarningBanner(GAME_CONFIG.MOBS.BOSS_WIZARD.NAME, 'WIELDER OF TWILIGHT ARCANA');
      });
    } else if (chapter === 3) {
      // Restrict camera to Chapter 3 Climax Arena
      this.cameras.main.setBounds(2080, 0, 520, this.levelHeight);

      // Arena barricade gate at x = 2090
      this.arenaGateWall = this.add.rectangle(2090, 340, 20, 100, 0x000000, 0);
      this.physics.add.existing(this.arenaGateWall, true);
      this.platforms.add(this.arenaGateWall);

      // Visual gate: dark ruin stone pillars
      this.arenaGateVisual = this.add.container(2090, 340);
      for (let gy = -40; gy <= 40; gy += 24) {
        const block = this.add.image(0, gy, 'crate').setScale(1.1).setTint(0x221133);
        this.arenaGateVisual.add(block);
      }
      this.arenaGateVisual.setDepth(15);

      // Lock the final obelisk until guardians are purged
      if (this.obelisk) {
        this.obelisk.lock();
      }

      this.startDialogue([
        { speaker: 'SHRINE', text: 'A dark resonance echoes from the abyss: "YOU CANNOT CLEANSE THE CORE, LITTLE MOTH..."' },
        { speaker: 'LUNA', text: 'The Blight has formed a consciousness... Stand behind me, Sparky! Luna Blade, ignite!' }
      ], () => {
        this.showBossWarningBanner('SHADOW OF THE BLIGHT', 'PRIMORDIAL CRYSTALLINE GUARDIANS');

        // Spawn Elite Shadow Guardians
        const m1 = this.spawnMob('flying_eye', 2280, 150);
        const m2 = this.spawnMob('goblin', 2360, 340);
        const m3 = this.spawnMob('boar', 2420, 340);
        const m4 = this.spawnMob('mushroom', 2520, 340);
        this.climaxFoes = [m1, m2, m3, m4].filter(Boolean);
      });
    }
  }

  showBossWarningBanner(name, subtitle) {
    const w = GAME_CONFIG.WIDTH;
    const banner = this.add.container(w / 2, 70).setScrollFactor(0).setDepth(480);

    const bg = this.add.rectangle(0, 0, 360, 36, 0x1f0606, 0.9);
    bg.setStrokeStyle(1.5, 0xff2222);
    banner.add(bg);

    const warn = this.add.text(0, -9, `⚠️ BOSS BATTLE: ${name} ⚠️`, {
      fontFamily: 'Press Start 2P',
      fontSize: '6.5px',
      color: '#ffdd44'
    }).setOrigin(0.5);
    banner.add(warn);

    const sub = this.add.text(0, 7, subtitle, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#ff9999'
    }).setOrigin(0.5);
    banner.add(sub);

    this.tweens.add({
      targets: banner,
      alpha: 0,
      y: 50,
      delay: 2400,
      duration: 600,
      onComplete: () => banner.destroy()
    });
  }

  openArenaGate() {
    if (this.arenaGateWall) {
      this.platforms.remove(this.arenaGateWall);
      this.arenaGateWall.destroy();
      this.arenaGateWall = null;
    }

    if (this.arenaGateVisual) {
      this.tweens.add({
        targets: this.arenaGateVisual,
        alpha: 0,
        y: this.arenaGateVisual.y + 40,
        duration: 800,
        onComplete: () => {
          if (this.arenaGateVisual) {
            this.arenaGateVisual.destroy();
            this.arenaGateVisual = null;
          }
        }
      });
    }

    // Unlock camera bounds back to entire level
    this.cameras.main.setBounds(0, 0, this.levelWidth, this.levelHeight);
  }

  spawnCrate(x, y) {
    const crate = new Crate(this, x, y);
    this.crates.add(crate);
  }

  createStoryHUD() {
    const w = GAME_CONFIG.WIDTH;

    // HUD Top Bar Container (Fixed to Camera)
    this.hudContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    // Top background panel
    const bar = this.add.rectangle(w / 2, 14, w, 28, 0x0a140a, 0.85);
    bar.setStrokeStyle(1, 0x224422);
    this.hudContainer.add(bar);

    // Chapter name & Objective
    this.txtChapter = this.add.text(12, 6, `CH.${this.chapterId}: ${this.chapterConfig.title}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#f6c026'
    });
    this.hudContainer.add(this.txtChapter);

    this.txtObjective = this.add.text(12, 17, `OBJECTIVE: Cleanse Guardian Obelisk`, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#d0f0c0'
    });
    this.hudContainer.add(this.txtObjective);

    // Hero Health Bar
    this.heroHealthBar = new HeroHealthBar(this, 240, 14, this.player ? this.player.maxHealth : GAME_CONFIG.PLAYER.MAX_HEALTH);
    this.hudContainer.add(this.heroHealthBar);

    // Materials Counter
    this.txtMaterials = this.add.text(w - 12, 10, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#98ff20'
    }).setOrigin(1, 0);
    this.hudContainer.add(this.txtMaterials);
    this.updateHudMaterials();

    // Combo Counter (Center Screen)
    this.txtCombo = this.add.text(w / 2, 40, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '9px',
      color: '#ffd700',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
  }

  updateHudMaterials() {
    const mats = storage.getMaterials();
    this.txtMaterials.setText(`🌲${mats.bark} 🍯${mats.amber} ⚙️${mats.iron}`);
  }

  updateHearts() {
    if (!this.player) return;
    if (this.heroHealthBar) {
      this.heroHealthBar.updateHealth(this.player.health, this.player.maxHealth);
    }
  }

  showChapterIntroCard() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    const card = this.add.container(w / 2, h / 2).setScrollFactor(0).setDepth(300);
    this.chapterIntroCard = card;
    const box = this.add.rectangle(0, 0, 320, 80, 0x112211, 0.95);
    box.setStrokeStyle(2, 0x3c6e3c);
    card.add(box);

    const title = this.add.text(0, -20, `CHAPTER ${this.chapterId}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '11px',
      color: '#f6c026'
    }).setOrigin(0.5);
    card.add(title);

    const name = this.add.text(0, -2, this.chapterConfig.title, {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#ffffff'
    }).setOrigin(0.5);
    card.add(name);

    const desc = this.add.text(0, 16, this.chapterConfig.description, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#7da57d',
      align: 'center',
      wordWrap: { width: 280 }
    }).setOrigin(0.5);
    card.add(desc);

    this.time.delayedCall(2400, () => {
      this.tweens.add({
        targets: card,
        alpha: 0,
        y: h / 2 - 20,
        duration: 400,
        onComplete: () => {
          if (this.chapterIntroCard === card) this.chapterIntroCard = null;
          card.destroy();
          this.triggerChapterOpeningDialogue();
        }
      });
    });
  }

  triggerChapterOpeningDialogue() {
    if (this.chapterId === 1) {
      this.startDialogue([
        { speaker: 'COMPANION', text: 'Luna! Look at the lake shoreline... the water is thick with jagged purple crystals!' },
        { speaker: 'LUNA', text: 'The Pale Blight has spread this far... The Shrine of Whispering Waters is in grave danger.' },
        { speaker: 'COMPANION', text: 'Chieftain Gorgok is guarding the glade ahead, but the crystal madness has taken him. Be careful!' },
        { speaker: 'LUNA', text: 'We must free Gorgok from his pain and cleanse the sacred Obelisk. To the glade!' }
      ]);
    } else if (this.chapterId === 2) {
      this.startDialogue([
        { speaker: 'LUNA', text: 'The air up here smells of scorched honey and sulfur... We have reached the Golden Canopy.' },
        { speaker: 'COMPANION', text: 'Archmage Malakor has built alchemical extraction rigs into the elder boughs!' },
        { speaker: 'LUNA', text: 'He is siphoning the fallen moon shards to forge forbidden arcana. His arrogance ends now.' }
      ]);
    } else if (this.chapterId === 3) {
      this.startDialogue([
        { speaker: 'LUNA', text: 'The Sunken Ruins... we have descended to the subterranean roots of the World-Tree.' },
        { speaker: 'COMPANION', text: 'I can feel it, Luna... the Primordial Heart Shard is beating right ahead in the dark.' },
        { speaker: 'LUNA', text: 'This is where the blight began, and where it will end. Hold fast to the Luna Blade!' }
      ]);
    }
  }

  startDialogue(lines, onComplete) {
    if (this.chapterIntroCard) {
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
    }
    this.inDialogue = true;
    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);
      this.player.play('player_idle', true);
    }
    const box = new StoryDialogueBox(this);
    box.startDialogue(lines, () => {
      this.inDialogue = false;
      if (onComplete) onComplete();
    });
    return box;
  }

  handlePlayerAttackEnemy(enemy) {
    if (!this.player.isAttacking || enemy.state === 'DEAD') return;

    // Direction check: ensure player is facing the enemy for horizontal attacks
    if (this.player.attackType !== 'upward') {
      const enemyCenterX = enemy.body ? enemy.body.center.x : enemy.x;
      if (!this.player.flipX && enemyCenterX < this.player.x) return;
      if (this.player.flipX && enemyCenterX > this.player.x) return;
    }

    const dmg = this.player.getAttackDamage();
    const isUpward = this.player.attackType === 'upward';
    const res = enemy.takeDamage(dmg, this.player.x, isUpward);

    if (res && res.killed) {
      this.killsCount++;
      this.registerComboHit();

      // Drop materials directly to storage
      if (enemy.mobType === 'boar') {
        storage.addMaterials({ bark: 1, iron: 1 });
      } else if (enemy.mobType === 'bee') {
        storage.addMaterials({ amber: 1 });
      } else if (enemy.mobType === 'snail') {
        storage.addMaterials({ bark: 1 });
      } else if (enemy.mobType === 'mushroom') {
        storage.addMaterials({ bark: 1, amber: 1 });
      } else if (enemy.mobType === 'flying_eye') {
        storage.addMaterials({ amber: 1, iron: 1 });
      } else if (enemy.mobType === 'goblin') {
        storage.addMaterials({ iron: 2, bark: 1 });
      }
      this.updateHudMaterials();
    }
  }

  onEnemyShattered(enemy) {
    if (!enemy) return;
    this.killsCount++;
    this.registerComboHit();
    storage.addMaterials({ bark: 1 });
    this.updateHudMaterials();
  }

  handlePlayerEnemyCollision(enemy) {
    if (this.player.isDead || enemy.state === 'DEAD' || enemy.state === 'STUNNED') return;

    // Snail in SHELLED or SLIDING state behaves differently
    if (enemy.mobType === 'snail' && enemy.state === 'SHELLED') {
      // Player running into shelled snail nudges/kicks it
      const kickDir = this.player.x < enemy.x ? 1 : -1;
      enemy.kickShell(kickDir);
      return;
    }

    if (enemy.mobType === 'snail' && enemy.state === 'SLIDING') {
      // 1. If player is jumping downward onto the shell, bounce off it Mario-style!
      if (this.player.body && this.player.body.velocity.y > 0 && this.player.y < enemy.y - 2) {
        this.player.setVelocityY(-250);
        sound.playRicochet();
        const res = enemy.takeDamage(99, this.player.x);
        if (res && res.killed) {
          this.onEnemyShattered(enemy);
        }
        return;
      }

      // 2. Only damages player if moving fast towards player
      const dirTowardsPlayer = (enemy.body.velocity.x > 0 && this.player.x > enemy.x) ||
                               (enemy.body.velocity.x < 0 && this.player.x < enemy.x);
      if (!dirTowardsPlayer) return;
    }

    // Boar collision mechanics
    if (enemy.mobType === 'boar') {
      // If player is jumping downward onto the boar, bounce off it Mario-style!
      if (this.player.body && this.player.body.velocity.y > 0 && this.player.y < enemy.y - 2) {
        this.player.setVelocityY(-250);
        sound.playRicochet();
        const res = enemy.takeDamage(40, this.player.x);
        if (res && res.killed) {
          this.killsCount++;
          this.registerComboHit();
          storage.addMaterials({ bark: 1, iron: 1 });
          this.updateHudMaterials();
        }
        return;
      }
    }

    // Normal damage
    const knockDir = enemy.x < this.player.x ? 1 : -1;
    const enemyDmg = enemy.damage || (enemy.mobType && GAME_CONFIG.MOBS[enemy.mobType.toUpperCase()]?.DAMAGE) || 20;
    const damaged = this.player.takeDamage(enemyDmg, knockDir);
    if (damaged) {
      this.comboCount = 0;
      this.updateHearts();
      if (this.player.isDead) {
        this.handlePlayerGameOver();
      }
    }
  }

  handleHazardHit(player, hazard) {
    if (player.isDead) return;
    player.takeDamage(20, player.flipX ? 1 : -1);
    this.updateHearts();

    // Respawn slightly back on platform
    player.setVelocityY(-200);
    player.x -= 40;
    if (player.isDead) {
      this.handlePlayerGameOver();
    }
  }

  registerComboHit(isRicochet = false) {
    this.comboCount += isRicochet ? 2 : 1;
    this.comboTimer = this.time.now + 2500;

    const mul = (1.0 + (this.comboCount * 0.1)).toFixed(1);
    this.txtCombo.setText(`COMBO x${mul}!`);
    this.txtCombo.setAlpha(1);

    this.tweens.add({
      targets: this.txtCombo,
      scale: { from: 1.3, to: 1.0 },
      duration: 150
    });
  }

  triggerChapterVictory() {
    if (this.isVictory) return;
    this.isVictory = true;
    sound.playVictory();

    // Mark progression in Storage
    storage.markChapterComplete(this.chapterId, this.killsCount);

    if (this.chapterIntroCard) {
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
    }

    if (this.chapterId === 1) {
      this.startDialogue([
        { speaker: 'SHRINE', text: '✨ "The first root inhales pure moonlight. The waters run crystal-clear once more."' },
        { speaker: 'COMPANION', text: 'Gorgok is at peace, Luna! But the golden canopy above is still shrouded in dark arcana. Onward!' }
      ], () => {
        this.showVictoryBanner();
      });
    } else if (this.chapterId === 2) {
      this.startDialogue([
        { speaker: 'SHRINE', text: '✨ "The Golden Hive hums in harmony. The false sorcerer is broken, and the boughs are cleansed."' },
        { speaker: 'LUNA', text: 'Only the Sunken Ruins remain below. The primordial Heart Shard awaits in the abyss.' }
      ], () => {
        this.showVictoryBanner();
      });
    } else if (this.chapterId === 3) {
      this.startDialogue([
        { speaker: 'SHRINE', text: '✨ "THE PRIMORDIAL CORE SHATTERS! Pure celestial light cascades through every root of the World-Tree!"' },
        { speaker: 'LUNA', text: 'We did it, Sparky... The High Forest is saved. The Silver Moon is restored!' }
      ], () => {
        this.cameras.main.fade(800, 255, 255, 255);
        this.time.delayedCall(850, () => {
          this.scene.start('StoryEndingScene');
        });
      });
    }
  }

  showVictoryBanner() {
    // Celebration Confetti
    try {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.55 }
      });
    } catch (e) {}

    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.victoryInputReadyTime = this.time.now + 350; // brief delay so final attack swing doesn't accidentally skip

    // Victory Banner Container
    const banner = this.add.container(w / 2, h / 2).setScrollFactor(0).setDepth(500);

    // Dim background overlay (tapping background also advances)
    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setInteractive();
    banner.add(overlay);

    const box = this.add.rectangle(0, 0, 360, 140, 0x0b2110, 0.95);
    box.setStrokeStyle(2, 0xf6c026);
    banner.add(box);

    const title = this.add.text(0, -45, '✨ SHRINE CLEANSED! ✨', {
      fontFamily: 'Press Start 2P',
      fontSize: '11px',
      color: '#f6c026'
    }).setOrigin(0.5);
    banner.add(title);

    const nextCh = this.chapterId < 3 ? this.chapterId + 1 : null;
    const subTitleText = nextCh ? `Chapter ${this.chapterId} Cleared! | Foes Cleansed: ${this.killsCount}` : `Forest Restored! All 3 Shrines Cleansed!`;
    const msg = this.add.text(0, -22, subTitleText, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#b0f0b0'
    }).setOrigin(0.5);
    banner.add(msg);

    const btnText = nextCh ? `ADVANCE TO CHAPTER ${nextCh} ➔` : 'RETURN TO MAIN MENU ➔';
    const btn = this.add.rectangle(0, 8, 270, 26, 0x1d5828).setStrokeStyle(2, 0x76ee76).setInteractive({ useHandCursor: true });
    banner.add(btn);

    const btnLabel = this.add.text(0, 8, btnText, {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#ffffff'
    }).setOrigin(0.5);
    banner.add(btnLabel);

    // Animated flashing keyboard & touch hint
    const hintText = this.add.text(0, 38, '▶ PRESS [SPACE] OR [ENTER] TO ADVANCE ◀', {
      fontFamily: 'Press Start 2P',
      fontSize: '6.5px',
      color: '#f6c026'
    }).setOrigin(0.5);
    banner.add(hintText);

    this.tweens.add({
      targets: hintText,
      alpha: { from: 1, to: 0.25 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Advance logic
    let advanced = false;
    const advanceNext = () => {
      if (advanced) return;
      if (this.time.now < this.victoryInputReadyTime) return;
      advanced = true;
      sound.playCoin();
      if (nextCh) {
        this.scene.restart({ chapter: nextCh });
      } else {
        this.scene.start('MenuScene');
      }
    };

    this.victoryAdvanceCallback = advanceNext;

    btn.on('pointerdown', advanceNext);
    overlay.on('pointerdown', advanceNext);

    // Direct key listener
    this.input.keyboard.on('keydown', (event) => {
      if (!this.isVictory) return;
      if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyJ' || event.code === 'KeyZ' || event.code === 'KeyE') {
        advanceNext();
      }
    });
  }

  handlePlayerGameOver() {
    sound.playGameOver();
    this.gameOverInputReadyTime = this.time.now + 700;

    if (this.chapterIntroCard) {
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
    }

    this.time.delayedCall(700, () => {
      const w = GAME_CONFIG.WIDTH;
      const h = GAME_CONFIG.HEIGHT;
      const card = this.add.container(w / 2, h / 2).setScrollFactor(0).setDepth(500);

      const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setInteractive();
      card.add(overlay);

      const box = this.add.rectangle(0, 0, 320, 120, 0x240e0e, 0.95);
      box.setStrokeStyle(2, 0xff4444);
      card.add(box);

      const title = this.add.text(0, -35, 'YOU FELL IN BATTLE', {
        fontFamily: 'Press Start 2P',
        fontSize: '11px',
        color: '#ff4444'
      }).setOrigin(0.5);
      card.add(title);

      const retryBtn = this.add.rectangle(0, 5, 220, 24, 0x5a1818).setStrokeStyle(2, 0xff7777).setInteractive({ useHandCursor: true });
      card.add(retryBtn);

      const retryLabel = this.add.text(0, 5, 'RETRY CHAPTER ↺', {
        fontFamily: 'Press Start 2P',
        fontSize: '8px',
        color: '#ffffff'
      }).setOrigin(0.5);
      card.add(retryLabel);

      const hintText = this.add.text(0, 34, '▶ PRESS [SPACE] OR [ENTER] TO RETRY ◀', {
        fontFamily: 'Press Start 2P',
        fontSize: '6.5px',
        color: '#ffaaaa'
      }).setOrigin(0.5);
      card.add(hintText);

      this.tweens.add({
        targets: hintText,
        alpha: { from: 1, to: 0.25 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      let retried = false;
      const doRetry = () => {
        if (retried) return;
        if (this.time.now < this.gameOverInputReadyTime) return;
        retried = true;
        this.scene.restart({ chapter: this.chapterId });
      };

      this.gameOverRetryCallback = doRetry;

      retryBtn.on('pointerdown', doRetry);
      overlay.on('pointerdown', doRetry);

      this.input.keyboard.on('keydown', (event) => {
        if (!this.player?.isDead) return;
        if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyR' || event.code === 'KeyJ') {
          doRetry();
        }
      });
    });
  }

  update() {
    if (this.inDialogue) {
      if (this.player && this.player.body) {
        this.player.setVelocityX(0);
      }
      return;
    }

    const touchInputs = window.touchController ? {
      ...window.touchController.state,
      ...window.touchController.consumeTriggers()
    } : {};

    // Victory screen keyboard/touch advance check
    if (this.isVictory && this.victoryAdvanceCallback && this.time.now > this.victoryInputReadyTime) {
      const advancePressed = (
        touchInputs.justAttack ||
        touchInputs.justJump ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        (this.cursors.keys?.ENTER && Phaser.Input.Keyboard.JustDown(this.cursors.keys.ENTER)) ||
        (this.cursors.keys?.J && Phaser.Input.Keyboard.JustDown(this.cursors.keys.J)) ||
        (this.cursors.keys?.Z && Phaser.Input.Keyboard.JustDown(this.cursors.keys.Z)) ||
        (this.cursors.keys?.E && Phaser.Input.Keyboard.JustDown(this.cursors.keys.E))
      );
      if (advancePressed) {
        this.victoryAdvanceCallback();
        return;
      }
    }

    // Game over screen keyboard/touch retry check
    if (this.player?.isDead && this.gameOverRetryCallback && this.time.now > this.gameOverInputReadyTime) {
      const retryPressed = (
        touchInputs.justAttack ||
        touchInputs.justJump ||
        Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
        (this.cursors.keys?.ENTER && Phaser.Input.Keyboard.JustDown(this.cursors.keys.ENTER)) ||
        (this.cursors.keys?.R && Phaser.Input.Keyboard.JustDown(this.cursors.keys.R)) ||
        (this.cursors.keys?.J && Phaser.Input.Keyboard.JustDown(this.cursors.keys.J))
      );
      if (retryPressed) {
        this.gameOverRetryCallback();
        return;
      }
    }

    if (this.player) {
      this.player.update(this.cursors, touchInputs);

      // Check arena boss encounter triggers
      if (!this.bossTriggered && !this.player.isDead && !this.inDialogue) {
        if (this.chapterId === 1 && this.player.x >= 2320) {
          this.triggerBossEncounter(1);
        } else if (this.chapterId === 2 && this.player.x >= 2100) {
          this.triggerBossEncounter(2);
        } else if (this.chapterId === 3 && this.player.x >= 2080) {
          this.triggerBossEncounter(3);
        }
      }
    }

    // Check Chapter 3 Climax Arena Foes Defeat
    if (this.chapterId === 3 && this.bossTriggered && this.climaxFoes && this.climaxFoes.length > 0) {
      this.climaxFoes = this.climaxFoes.filter(f => f && f.active && f.state !== 'DEAD');
      if (this.climaxFoes.length === 0) {
        this.climaxFoes = null;
        this.openArenaGate();
        if (this.obelisk) {
          this.obelisk.unlock();
        }
      }
    }

    const camScrollX = this.cameras.main.scrollX;
    if (this.bgMountains) this.bgMountains.tilePositionX = camScrollX * 0.05;
    if (this.bgFogPines) this.bgFogPines.tilePositionX = camScrollX * 0.12;
    if (this.bgMidPines) this.bgMidPines.tilePositionX = camScrollX * 0.22;

    // Update enemies
    this.enemies.getChildren().forEach(enemy => {
      enemy.update(this.player);
    });

    // Combo decay
    if (this.comboCount > 0 && this.time.now > this.comboTimer) {
      this.comboCount = 0;
      this.tweens.add({
        targets: this.txtCombo,
        alpha: 0,
        duration: 200
      });
    }

    // Fall out of world check
    if (this.player && this.player.y > this.levelHeight + 30 && !this.player.isDead) {
      this.player.die();
      this.updateHearts();
      this.handlePlayerGameOver();
    }
  }
}
