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
import BossSkeleton from '../entities/BossSkeleton.js';
import BossDemon from '../entities/BossDemon.js';
import BossNightBorne from '../entities/BossNightBorne.js';
import Projectile from '../entities/Projectile.js';
import Crate from '../entities/Crate.js';
import Obelisk from '../entities/Obelisk.js';
import BossHealthBar from '../ui/BossHealthBar.js';
import HeroHealthBar from '../ui/HeroHealthBar.js';
import StoryDialogueBox from '../ui/StoryDialogueBox.js';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { pauseService } from '../engine/PauseService.js';
import confetti from 'canvas-confetti';

export default class StoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StoryScene' });
  }

  init(data) {
    this.chapterId = data.chapter || 1;
    this.chapterConfig = GAME_CONFIG.CHAPTERS.find(c => c.id === this.chapterId) || GAME_CONFIG.CHAPTERS[0];
    this.killsCount = 0;
    this.isGameOver = false;
    this.isVictory = false;
    this.inDialogue = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.levelWidth = this.chapterId === 1 ? 2800 : 2600;
    this.levelHeight = 420;
    this.victoryAdvanceCallback = null;
    this.gameOverRetryCallback = null;
    this.activeGameOverCleanup = null;
    this.activeVictoryCleanup = null;

    // Boss & Arena state
    this.boss = null;
    this.bossHealthBar = null;
    this.bossTriggered = false;
    this.arenaGateWall = null;
    this.arenaGateVisual = null;
    this.skipIntroCard = Boolean(data && data.skipIntroCard);
    this.startTime = performance.now();
    this.secondsElapsed = 0;
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    this.isGameOver = false;
    this.isVictory = false;

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    pauseService.attachScene(this, `CHAPTER ${this.chapterId}: ${this.chapterConfig.title}`);
    pauseService.hideButtons();
    pauseService.updateTimer(0);
    sound.playBGM(this.chapterId >= 4 ? 'battle' : 'forest');
    this.events.once('shutdown', () => {
      if (this.activeGameOverCleanup) {
        this.activeGameOverCleanup();
        this.activeGameOverCleanup = null;
      }
      if (this.activeVictoryCleanup) {
        this.activeVictoryCleanup();
        this.activeVictoryCleanup = null;
      }
      pauseService.detachScene();
      sound.stopBGM();
    });

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
      if (this.inDialogue) return;
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
      if (this.inDialogue || proj.isDead || proj.isDeflected || player.isDead) return;
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
    if (this.skipIntroCard) {
      this.triggerChapterOpeningDialogue();
    } else {
      this.showChapterIntroCard();
    }
  }

  buildChapterLevel() {
    if (this.chapterId === 1) {
      this.buildChapter1Woods();
    } else if (this.chapterId === 2) {
      this.buildChapter2Canopy();
    } else if (this.chapterId === 3) {
      this.buildChapter3Ruins();
    } else if (this.chapterId === 4) {
      this.buildChapter4Caldera();
    } else if (this.chapterId === 5) {
      this.buildChapter5LunarSpire();
    }
  }

  buildChapter1Woods() {
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

    this.createPlatform(720, 300, 90);
    this.createPlatform(840, 240, 100);

    this.createPlatform(990, 320, 48);
    this.createPlatform(1055, 270, 48);

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

    this.obelisk = new Obelisk(this, 2720, 380, 'Shrine of Whispering Waters');
    this.obelisk.lock();
  }

  buildChapter2Canopy() {
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

    this.spawnCrate(280, 205);
    this.spawnCrate(800, 145);
    this.spawnCrate(1140, 350);
    this.spawnCrate(1380, 195);
    this.spawnCrate(1780, 255);
    this.spawnCrate(2200, 245);
    this.spawnCrate(2420, 350);

    this.obelisk = new Obelisk(this, 2520, 380, 'Golden Hive Shrine');
    this.obelisk.lock();
  }

  buildChapter3Ruins() {
    // =========================================================================
    // Chapter 3: Sunken Ruins (2600px) - Mossy Stone, Spike Traps, Boss Vorgath
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
    this.createPlatform(2200, 260, 90);
    this.createPlatform(2380, 200, 90);

    // Pre-arena Crypt Monsters
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

    this.spawnCrate(310, 195);
    this.spawnCrate(800, 215);
    this.spawnCrate(1100, 350);
    this.spawnCrate(1360, 185);
    this.spawnCrate(1720, 165);
    this.spawnCrate(2120, 245);
    this.spawnCrate(2380, 350);

    // Crypt Obelisk (Locked by Vorgath)
    this.obelisk = new Obelisk(this, 2520, 380, 'Crypt Shrine of the Ancients');
    this.obelisk.lock();
  }

  buildChapter4Caldera() {
    // =========================================================================
    // Chapter 4: Obsidian Caldera (2600px) - Volcanic Magma, Basalt Platforms, Ignis
    // =========================================================================
    this.createGround(0, 380, 440);
    this.createHazard(440, 400, 140, 'MOLTEN LAVA 🔥');
    this.createGround(580, 380, 440);
    this.createHazard(1020, 400, 160, 'MOLTEN LAVA 🔥');
    this.createGround(1180, 380, 420);
    this.createHazard(1600, 400, 160, 'MOLTEN LAVA 🔥');
    this.createGround(1760, 380, 300);
    this.createHazard(2060, 400, 100, 'MOLTEN LAVA 🔥');
    this.createGround(2160, 380, 440);

    // Obsidian platforms over lava chasms
    this.createPlatform(180, 290, 96);
    this.createPlatform(320, 230, 96);
    this.createPlatform(470, 260, 96);
    this.createPlatform(640, 210, 96);
    this.createPlatform(800, 260, 96);
    this.createPlatform(940, 200, 144);
    this.createPlatform(1060, 260, 96);
    this.createPlatform(1220, 220, 96);
    this.createPlatform(1380, 270, 96);
    this.createPlatform(1520, 200, 96);
    this.createPlatform(1640, 250, 96);
    this.createPlatform(1820, 280, 96);
    this.createPlatform(1960, 220, 96);
    this.createPlatform(2240, 270, 96);
    this.createPlatform(2420, 210, 96);

    // Volcanic Foes
    this.spawnMob('goblin', 240, 340);
    this.spawnMob('flying_eye', 340, 160);
    this.spawnMob('boar', 680, 340);
    this.spawnMob('mushroom', 820, 340);
    this.spawnMob('flying_eye', 960, 140);
    this.spawnMob('goblin', 1260, 340);
    this.spawnMob('flying_eye', 1400, 160);
    this.spawnMob('mushroom', 1480, 340);
    this.spawnMob('boar', 1840, 340);
    this.spawnMob('goblin', 1980, 180);

    // Crates
    this.spawnCrate(340, 195);
    this.spawnCrate(660, 175);
    this.spawnCrate(960, 165);
    this.spawnCrate(1400, 235);
    this.spawnCrate(1840, 245);
    this.spawnCrate(2260, 235);

    // Caldera Obelisk (Locked by Ignis)
    this.obelisk = new Obelisk(this, 2520, 380, 'Shrine of the Molten Core');
    this.obelisk.lock();
  }

  buildChapter5LunarSpire() {
    // =========================================================================
    // Chapter 5: The Lunar Spire (2600px) - Astral Chasm, Crystal Steps, Umbra
    // =========================================================================
    this.createGround(0, 380, 420);
    this.createHazard(420, 400, 140, 'ASTRAL CHASM 🌌');
    this.createGround(560, 380, 420);
    this.createHazard(980, 400, 160, 'ASTRAL CHASM 🌌');
    this.createGround(1140, 380, 420);
    this.createHazard(1560, 400, 160, 'ASTRAL CHASM 🌌');
    this.createGround(1720, 380, 320);
    this.createHazard(2040, 400, 100, 'ASTRAL CHASM 🌌');
    this.createGround(2140, 380, 460);

    // Celestial crystal steps
    this.createPlatform(160, 280, 96);
    this.createPlatform(280, 210, 96);
    this.createPlatform(450, 250, 96);
    this.createPlatform(620, 200, 96);
    this.createPlatform(780, 270, 96);
    this.createPlatform(920, 190, 144);
    this.createPlatform(1030, 250, 96);
    this.createPlatform(1200, 210, 96);
    this.createPlatform(1360, 260, 96);
    this.createPlatform(1500, 180, 96);
    this.createPlatform(1610, 240, 96);
    this.createPlatform(1800, 270, 96);
    this.createPlatform(1940, 200, 96);
    this.createPlatform(2220, 270, 96);
    this.createPlatform(2400, 200, 96);

    // Celestial Void Guardians
    this.spawnMob('flying_eye', 220, 140);
    this.spawnMob('goblin', 320, 340);
    this.spawnMob('bee', 480, 140);
    this.spawnMob('mushroom', 660, 340);
    this.spawnMob('boar', 840, 340);
    this.spawnMob('flying_eye', 940, 130);
    this.spawnMob('goblin', 1240, 340);
    this.spawnMob('bee', 1380, 140);
    this.spawnMob('mushroom', 1460, 340);
    this.spawnMob('flying_eye', 1620, 130);
    this.spawnMob('goblin', 1820, 340);
    this.spawnMob('boar', 1960, 340);

    // Crates
    this.spawnCrate(300, 175);
    this.spawnCrate(640, 165);
    this.spawnCrate(940, 155);
    this.spawnCrate(1380, 225);
    this.spawnCrate(1820, 235);
    this.spawnCrate(2240, 235);

    // Final Celestial Obelisk (Locked by Umbra)
    this.obelisk = new Obelisk(this, 2520, 380, 'The Lunar Heart Obelisk');
    this.obelisk.lock();
  }

  createForestBackground() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    let bgKey = 'bg_whispering';
    if (this.chapterId === 2) bgKey = 'bg_hive';
    else if (this.chapterId === 3) bgKey = 'bg_ruins';
    else if (this.chapterId === 4) bgKey = 'bg_caldera';
    else if (this.chapterId === 5) bgKey = 'bg_lunar_spire';

    // 1. Sky Gradient / Main Backdrop
    this.bgSky = this.add.tileSprite(0, 0, w, h, bgKey).setOrigin(0, 0).setScrollFactor(0).setDepth(0);

    if (this.chapterId <= 3) {
      // 2. Distant Mountains (very slow parallax)
      this.bgMountains = this.add.tileSprite(0, 20, w, 200, 'sky_mountains').setOrigin(0, 0).setScrollFactor(0).setDepth(1);

      // 3. Foggy Distant Mountain Pines (slow parallax)
      this.bgFogPines = this.add.tileSprite(0, 50, w, 220, 'forest_bg_p0').setOrigin(0, 0).setScrollFactor(0).setDepth(2);

      // 4. Midground Forest Silhouettes
      this.bgMidPines = this.add.tileSprite(0, 80, w, 220, 'forest_bg_p1').setOrigin(0, 0).setScrollFactor(0).setDepth(3);

      // 5. Standalone Tall Pine Trees placed along the level
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
    } else if (this.chapterId === 4) {
      // Caldera: Dark basalt boulders along the horizon
      const rockSpacing = 170;
      const numRocks = Math.floor(this.levelWidth / rockSpacing);
      for (let i = 0; i < numRocks; i++) {
        const rx = 80 + i * rockSpacing + ((i * 31) % 40 - 20);
        this.add.image(rx, 390, 'boulders')
          .setOrigin(0.5, 1.0)
          .setScale(1.2 + (i % 3) * 0.2)
          .setTint(0x331111)
          .setDepth(4);
      }
    } else if (this.chapterId === 5) {
      // Lunar Spire: Floating stellar nebulae & celestial starlight
      const starSpacing = 150;
      const numStars = Math.floor(this.levelWidth / starSpacing);
      for (let i = 0; i < numStars; i++) {
        const sx = 70 + i * starSpacing + ((i * 41) % 50 - 25);
        const st = this.add.circle(sx, Phaser.Math.Between(60, 240), Phaser.Math.Between(2, 4), 0xccaaff, 0.8)
          .setDepth(3);
        this.tweens.add({
          targets: st,
          scale: 1.5,
          alpha: 0.3,
          duration: 1200 + (i % 4) * 300,
          yoyo: true,
          repeat: -1
        });
      }
    }

    this.createForestParticles();
  }

  createForestParticles() {
    let tint = 0x88ee88;
    let gravY = -8;
    let speedY = { min: -8, max: 8 };

    if (this.chapterId === 2) {
      tint = 0xffcc44;
    } else if (this.chapterId === 3) {
      tint = 0x88ffbb;
    } else if (this.chapterId === 4) {
      tint = 0xff4411;
      gravY = -22;
      speedY = { min: -28, max: -6 };
    } else if (this.chapterId === 5) {
      tint = 0xaaccff;
      gravY = -4;
      speedY = { min: -10, max: 10 };
    }

    this.particles = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: this.levelWidth },
      y: { min: 40, max: 360 },
      quantity: 1,
      frequency: this.chapterId === 4 ? 140 : 240,
      lifespan: 3600,
      gravityY: gravY,
      speedX: { min: -12, max: 12 },
      speedY: speedY,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: tint,
      blendMode: 'ADD'
    }).setDepth(15);
  }

  createGround(x, y, width) {
    const depth = 10;
    const body = this.add.rectangle(x + width / 2, y + 20, width, 40, 0x000000, 0);
    this.physics.add.existing(body, true);
    this.platforms.add(body);

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

      const topImg = this.add.image(tileX, y - 10, topKey).setOrigin(0, 0).setDepth(depth);
      if (this.chapterId === 4) topImg.setTint(0x774433);
      else if (this.chapterId === 5) topImg.setTint(0x7788aa);

      for (let cy = y + 6; cy <= y + 38; cy += 16) {
        let bodyKey = 'tile_cliff_body_mid';
        if (i === 0 && x > 0) bodyKey = 'tile_cliff_body_left';
        else if (i === numTiles - 1 && (x + width < this.levelWidth)) bodyKey = 'tile_cliff_body_right';
        const bodyImg = this.add.image(tileX, cy, bodyKey).setOrigin(0, 0).setDepth(depth - 1);
        if (this.chapterId === 4) bodyImg.setTint(0x442211);
        else if (this.chapterId === 5) bodyImg.setTint(0x556688);
      }
    }

    // Add decorative flora / crystals along the surface
    for (let px = x + 24; px < x + width - 24; px += 56) {
      const hash = Math.floor((px * 9301 + 49297) % 233280);
      const roll = hash % 5;
      if (this.chapterId === 4) {
        // Volcanic embers
        if (roll < 2) {
          const spark = this.add.circle(px, y - 2, 2, 0xff5500, 0.8).setDepth(depth + 1);
          this.tweens.add({ targets: spark, alpha: 0.2, yoyo: true, repeat: -1, duration: 600 });
        }
      } else if (this.chapterId === 5) {
        // Moon crystal flowers
        if (roll === 1 || roll === 2) {
          const fl = this.add.image(px, y, roll === 1 ? 'prop_flower_blue' : 'prop_flower_purple').setOrigin(0.5, 1.0).setDepth(depth + 1);
          fl.setTint(0x88ffff);
        }
      } else {
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
  }

  createPlatform(x, y, width) {
    const depth = 10;
    let tileSize = 48;
    let tileKey = 'plat_wood';

    if (this.chapterId === 5) {
      tileSize = 48;
      tileKey = 'plat_crystal';
    } else if (this.chapterId === 4) {
      tileSize = 48;
      tileKey = 'plat_obsidian';
    } else if (this.chapterId === 3) {
      tileSize = 48;
      tileKey = 'plat_stone';
    } else if (this.chapterId === 2) {
      tileSize = 75;
      tileKey = 'plat_branch';
    }

    const count = Math.max(1, Math.round(width / tileSize));
    const actualWidth = count * tileSize;

    const body = this.add.rectangle(x + actualWidth / 2, y + 6, actualWidth, 12, 0x000000, 0);
    this.physics.add.existing(body, true);
    body.body.checkCollision.down = false;
    body.body.checkCollision.left = false;
    body.body.checkCollision.right = false;
    body.body.checkCollision.up = true;
    this.platforms.add(body);

    for (let i = 0; i < count; i++) {
      const yOffset = this.chapterId === 2 ? -2 : 0;
      this.add.image(x + i * tileSize, y + yOffset, tileKey).setOrigin(0, 0).setDepth(depth);
    }
  }

  createHazard(x, y, width, label) {
    const haz = this.add.rectangle(x + width / 2, y + 16, width, 24, 0x000000, 0);
    this.physics.add.existing(haz, true);
    this.hazards.add(haz);

    if (this.chapterId === 4) {
      // Lava Hazard
      const count = Math.ceil(width / 64);
      for (let i = 0; i < count; i++) {
        const lava = this.add.image(x + i * 64, y - 8, 'lava_surface').setOrigin(0, 0).setDepth(11);
        this.tweens.add({
          targets: lava,
          y: y - 5,
          duration: 900 + i * 140,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        this.add.image(x + i * 64, y + 24, 'lava_deep').setOrigin(0, 0).setDepth(10);
      }
    } else if (this.chapterId === 5) {
      // Astral Chasm
      const count = Math.ceil(width / 32);
      for (let i = 0; i < count; i++) {
        const star = this.add.circle(x + i * 32 + 16, y + 12, 5, 0xbb88ff, 0.75).setDepth(11);
        this.tweens.add({
          targets: star,
          scale: 1.6,
          alpha: 0.3,
          duration: 750 + i * 120,
          yoyo: true,
          repeat: -1
        });
      }
    } else if (this.chapterId === 1) {
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
      this.add.image(x + 4, y - 8, 'prop_reeds').setOrigin(0.5, 1.0).setDepth(12);
      this.add.image(x + width - 4, y - 8, 'prop_reeds').setOrigin(0.5, 1.0).setDepth(12).setFlipX(true);
    } else if (this.chapterId === 2) {
      const hCount = Math.ceil(width / 32);
      for (let i = 0; i < hCount; i++) {
        const hive = this.add.image(x + i * 32 + 16, y + 8, 'env_hive').setOrigin(0.5, 0.5).setScale(0.7).setDepth(11);
        hive.setTint(0xffaa22);
      }
    } else {
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
      if (this.player && this.player.x < 2330) this.player.x = 2330;
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
      if (this.player && this.player.x < 2120) this.player.x = 2120;
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
      if (this.player && this.player.x < 2120) this.player.x = 2120;
      // Restrict camera to Chapter 3 Vorgath Arena
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

      this.bossHealthBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_SKELETON.NAME, GAME_CONFIG.MOBS.BOSS_SKELETON.HP);
      this.boss = new BossSkeleton(this, 2400, 340, this.bossHealthBar);
      this.enemies.add(this.boss);
      this.boss.nextActionTime = this.time.now + 999999;

      this.startDialogue([
        { speaker: 'VORGATH', text: 'WHO AWAKENS THE SOVEREIGN OF ASH AND BONE?! FOOLISH WARRIOR OF LIGHT!' },
        { speaker: 'LUNA', text: 'Vorgath! The ancient crypts have fallen to darkness, but your blade still serves honor!' },
        { speaker: 'VORGATH', text: 'HONOR IS DUST! ONLY OBLIVION ENDURES! RAISE YOUR BLADE, MORTAL!' },
        { speaker: 'LUNA', text: 'Then sleep in peace, ancient king. The Luna Blade shall grant you rest!' }
      ], () => {
        if (this.boss && this.boss.active) {
          this.boss.nextActionTime = this.time.now + 600;
        }
        this.showBossWarningBanner(GAME_CONFIG.MOBS.BOSS_SKELETON.NAME, 'ANCIENT MONARCH OF THE CRYPT');
      });
    } else if (chapter === 4) {
      if (this.player && this.player.x < 2120) this.player.x = 2120;
      // Restrict camera to Chapter 4 Ignis Arena
      this.cameras.main.setBounds(2080, 0, 520, this.levelHeight);

      // Arena barricade gate at x = 2090
      this.arenaGateWall = this.add.rectangle(2090, 340, 20, 100, 0x000000, 0);
      this.physics.add.existing(this.arenaGateWall, true);
      this.platforms.add(this.arenaGateWall);

      // Visual gate: fiery volcanic blocks
      this.arenaGateVisual = this.add.container(2090, 340);
      for (let gy = -40; gy <= 40; gy += 24) {
        const block = this.add.image(0, gy, 'crate').setScale(1.1).setTint(0x551100);
        this.arenaGateVisual.add(block);
      }
      this.arenaGateVisual.setDepth(15);

      this.bossHealthBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_DEMON.NAME, GAME_CONFIG.MOBS.BOSS_DEMON.HP);
      this.boss = new BossDemon(this, 2380, 220, this.bossHealthBar);
      this.enemies.add(this.boss);
      this.boss.nextActionTime = this.time.now + 999999;

      this.startDialogue([
        { speaker: 'IGNIS', text: 'SUCH SWEET FRAGILE FLESH TO BURN IN MY CALDERA! YOU DARE TREAD UPON MY FLAMES?!' },
        { speaker: 'LUNA', text: 'Your hellfire ends here, Ignis! The heat of your fury cannot melt the silver blade!' },
        { speaker: 'IGNIS', text: 'THEN ASHES BECOME YOUR TOMB! WITNESS THE CINDER SKY!' },
        { speaker: 'LUNA', text: 'Sylva, hold on! We strike through the inferno!' }
      ], () => {
        if (this.boss && this.boss.active) {
          this.boss.nextActionTime = this.time.now + 600;
        }
        this.showBossWarningBanner(GAME_CONFIG.MOBS.BOSS_DEMON.NAME, 'PYROMANCER OF THE OBSIDIAN DEEP');
      });
    } else if (chapter === 5) {
      if (this.player && this.player.x < 2120) this.player.x = 2120;
      // Restrict camera to Chapter 5 Umbra Pinnacle Arena
      this.cameras.main.setBounds(2080, 0, 520, this.levelHeight);

      // Arena barricade gate at x = 2090
      this.arenaGateWall = this.add.rectangle(2090, 340, 20, 100, 0x000000, 0);
      this.physics.add.existing(this.arenaGateWall, true);
      this.platforms.add(this.arenaGateWall);

      // Visual gate: cosmic astral blocks
      this.arenaGateVisual = this.add.container(2090, 340);
      for (let gy = -40; gy <= 40; gy += 24) {
        const block = this.add.image(0, gy, 'crate').setScale(1.1).setTint(0x110022);
        this.arenaGateVisual.add(block);
      }
      this.arenaGateVisual.setDepth(15);

      this.bossHealthBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.NAME, GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.HP);
      this.boss = new BossNightBorne(this, 2400, 340, this.bossHealthBar);
      this.enemies.add(this.boss);
      this.boss.nextActionTime = this.time.now + 999999;

      this.startDialogue([
        { speaker: 'UMBRA', text: 'At last... The final thread of moonlight arrives. Do you truly believe you can mend the shattered cosmos?' },
        { speaker: 'LUNA', text: 'Umbra! The Moon was never meant to rule in shadow. We are Wardens, not conquerors!' },
        { speaker: 'UMBRA', text: 'The light was weak! In the void of the eclipse, we are eternal! BOW BEFORE THE VOID!' },
        { speaker: 'LUNA', text: 'Never! By the radiance of the silver crest—LET THERE BE LIGHT!' }
      ], () => {
        if (this.boss && this.boss.active) {
          this.boss.nextActionTime = this.time.now + 600;
        }
        this.showBossWarningBanner(GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.NAME, 'SOVEREIGN OF THE SHATTERED MOON');
      });
    }
  }

  showBossWarningBanner(name, subtitle) {
    sound.playBGM('boss');
    const w = GAME_CONFIG.WIDTH;
    const banner = this.add.container(w / 2, 84).setScrollFactor(0).setDepth(480);

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
      y: 64,
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

  showFloatingText(x, y, text, color = '#ffffff') {
    const txt = this.add.text(x, y, text, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(250);

    this.tweens.add({
      targets: txt,
      y: y - 24,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy()
    });
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

    // Combo Counter (Center Screen, below Boss Health Bar)
    this.txtCombo = this.add.text(w / 2, 70, '', {
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
    this.inDialogue = true;
    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }
    this.physics.pause();
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

    const advanceIntro = () => {
      if (!this.chapterIntroCard) return;
      this.input.off('pointerdown', pointerHandler);
      if (this.game && this.game.canvas) {
        this.game.canvas.removeEventListener('pointerdown', canvasHandler);
      }
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
      this.triggerChapterOpeningDialogue();
    };

    const pointerHandler = () => advanceIntro();
    this.input.once('pointerdown', pointerHandler);

    const canvasHandler = () => advanceIntro();
    if (this.game && this.game.canvas) {
      this.game.canvas.addEventListener('pointerdown', canvasHandler, { once: true });
    }
    box.setInteractive({ useHandCursor: true }).on('pointerdown', advanceIntro);

    this.time.delayedCall(2400, () => {
      if (!this.chapterIntroCard) return;
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
        { speaker: 'COMPANION', text: 'I sense a grim presence guarding the tomb... Vorgath, the fallen Bone Sovereign!' },
        { speaker: 'LUNA', text: 'His shield was once unbreakable, but the Luna Blade strikes true. We must shatter his guard!' }
      ]);
    } else if (this.chapterId === 4) {
      this.startDialogue([
        { speaker: 'LUNA', text: 'The temperature is rising rapidly... We have entered the Obsidian Caldera.' },
        { speaker: 'COMPANION', text: 'Watch your step, Luna! The ground below is collapsing into molten lava pools!' },
        { speaker: 'LUNA', text: 'And soaring above the magma is Ignis, the Cinder Drake. Prepare your leaps—we fight across the embers!' }
      ]);
    } else if (this.chapterId === 5) {
      this.startDialogue([
        { speaker: 'LUNA', text: 'The Lunar Spire... we have transcended the mortal realm into the cosmic firmament.' },
        { speaker: 'COMPANION', text: 'Luna! The Moon\'s core is fracturing! Umbra is siphoning the very starlight of the heavens!' },
        { speaker: 'LUNA', text: 'This is the final battle for the cosmos. For the Moon, for Sylva, and for all life—let\'s bring back the dawn!' }
      ]);
    }
  }

  startDialogue(lines, onComplete) {
    if (this.chapterIntroCard) {
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
    }
    this.inDialogue = true;
    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }
    pauseService.hideButtons();
    this.physics.pause();
    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0);
      this.player.play('player_idle', true);
    }
    if (this.enemies) {
      this.enemies.getChildren().forEach(e => {
        if (e.body) {
          e.body.velocity.x = 0;
          e.body.velocity.y = 0;
        }
      });
    }
    const box = new StoryDialogueBox(this);
    this.dialogueBox = box;
    box.startDialogue(lines, () => {
      this.dialogueBox = null;
      this.inDialogue = false;
      this.physics.resume();
      if (!this.isVictory && (!this.player || !this.player.isDead)) {
        if (typeof window !== 'undefined' && window.touchController) {
          window.touchController.show();
        }
        pauseService.showButtons();
      }
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
    if (this.inDialogue || this.player.isDead || enemy.state === 'DEAD' || enemy.state === 'STUNNED') return;

    // --- UNIVERSAL STOMP BOUNCE DETECTION ---
    // If player is airborne, falling downward, and physically above the enemy:
    const isFalling = this.player.body && this.player.body.velocity.y > 20;
    const playerBottom = this.player.body ? this.player.body.bottom : this.player.y + 16;
    const enemyTop = enemy.body ? enemy.body.top : enemy.y - 14;
    const isAbove = playerBottom <= enemyTop + 20 || this.player.y < enemy.y - 4;

    if (isFalling && isAbove) {
      this.player.setVelocityY(-260);
      sound.playBoarChargeHit();
      sound.playRicochet();

      const stompText = this.add.text(enemy.x, enemy.y - 18, '💥 STOMP! -35', {
        fontFamily: 'Press Start 2P',
        fontSize: '6.5px',
        color: '#ffd166',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(200);

      this.tweens.add({
        targets: stompText,
        y: stompText.y - 22,
        alpha: 0,
        duration: 650,
        onComplete: () => stompText.destroy()
      });

      if (enemy.mobType === 'snail') {
        if (enemy.state === 'WALK') {
          enemy.takeDamage(35, this.player.x);
          this.registerComboHit(true);
        } else if (enemy.state === 'SHELLED') {
          const kickDir = this.player.flipX ? -1 : 1;
          enemy.kickShell(kickDir);
          this.registerComboHit(true);
        } else if (enemy.state === 'SLIDING') {
          const res = enemy.takeDamage(99, this.player.x);
          if (res && res.killed) {
            this.onEnemyShattered(enemy);
          }
        }
      } else if (enemy.mobType === 'boss_gorgok') {
        enemy.takeDamage(25, this.player.x);
        this.registerComboHit(true);
      } else {
        const res = enemy.takeDamage(35, this.player.x);
        this.registerComboHit(true);
        if (res && res.killed) {
          this.killsCount++;
          if (typeof storage !== 'undefined') {
            storage.addMaterials({ bark: 1, iron: 1 });
            this.updateHudMaterials();
          }
        }
      }
      return; // Successfully stomped: evade all player damage!
    }

    // Snail in SHELLED or SLIDING state horizontal collision
    if (enemy.mobType === 'snail' && enemy.state === 'SHELLED') {
      const kickDir = this.player.x < enemy.x ? 1 : -1;
      enemy.kickShell(kickDir);
      return;
    }

    if (enemy.mobType === 'snail' && enemy.state === 'SLIDING') {
      const dirTowardsPlayer = (enemy.body.velocity.x > 0 && this.player.x > enemy.x) ||
                               (enemy.body.velocity.x < 0 && this.player.x < enemy.x);
      if (!dirTowardsPlayer) return;
    }

    // Boss Gorgok collision mechanics: ONLY damages player when actively CHARGING!
    if (enemy.mobType === 'boss_gorgok') {
      if (enemy.state !== 'CHARGE') {
        return;
      }

      // Direct charge impact: heavy damage, screen shake, and strong knockback in charge direction
      const knockDir = enemy.chargeDir || (enemy.x < this.player.x ? 1 : -1);
      const enemyDmg = enemy.damage || GAME_CONFIG.MOBS.BOSS_GORGOK?.DAMAGE || 30;
      const damaged = this.player.takeDamage(enemyDmg, knockDir);
      if (damaged) {
        this.comboCount = 0;
        this.updateHearts();
        sound.playSlash(2);
        this.cameras.main.shake(180, 0.02);

        // Visual charge impact cue
        const impactText = this.add.text(this.player.x, this.player.y - 20, `💥 CHARGE HIT! -${enemyDmg}`, {
          fontFamily: 'Press Start 2P',
          fontSize: '7px',
          color: '#ff2222',
          stroke: '#000',
          strokeThickness: 2
        }).setOrigin(0.5);
        this.tweens.add({
          targets: impactText,
          y: this.player.y - 42,
          alpha: 0,
          duration: 650,
          onComplete: () => impactText.destroy()
        });

        if (this.player.isDead) {
          this.handlePlayerGameOver();
        }
      }
      return;
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
    const damaged = player.takeDamage(20, player.flipX ? 1 : -1);
    if (damaged) {
      this.updateHearts();
      player.setVelocityY(-240);
      player.setVelocityX(player.flipX ? 160 : -160);
      if (player.isDead) {
        this.handlePlayerGameOver();
      }
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
    pauseService.hideButtons();

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

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
        { speaker: 'SHRINE', text: '✨ "The crypt falls quiet as Vorgath\'s soul finds eternal peace. The subterranean seal unlocks."' },
        { speaker: 'LUNA', text: 'Beyond this crypt lies the Obsidian Caldera... The heat of the molten deep awaits!' }
      ], () => {
        this.showVictoryBanner();
      });
    } else if (this.chapterId === 4) {
      this.startDialogue([
        { speaker: 'SHRINE', text: '✨ "The Cinder Drake collapses into embers. The magma calms, revealing a stairway of pure starlight."' },
        { speaker: 'LUNA', text: 'Sylva, look up! The Lunar Spire pierces into the cosmos... to Umbra!' }
      ], () => {
        this.showVictoryBanner();
      });
    } else if (this.chapterId === 5) {
      this.startDialogue([
        { speaker: 'SHRINE', text: '✨ "THE SHATTERED MOON IS RESTORED! Pure celestial light cascades across the entire cosmos!"' },
        { speaker: 'LUNA', text: 'We did it, Sylva... The darkness is banished, and the Silver Dawn has arrived!' }
      ], () => {
        this.showVictoryBanner();
      });
    }
  }

  showVictoryBanner() {
    sound.playBGM('victory');
    pauseService.hideButtons();
    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

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

    // Dim background overlay (interactive to block touches underneath)
    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.65).setInteractive();
    banner.add(overlay);

    const nextCh = this.chapterId < 5 ? this.chapterId + 1 : null;
    const boxHeight = nextCh ? 164 : 140;
    const box = this.add.rectangle(0, 0, 380, boxHeight, 0x0b2110, 0.96);
    box.setStrokeStyle(2, 0xf6c026);
    banner.add(box);

    const title = this.add.text(0, -boxHeight / 2 + 22, '✨ SHRINE CLEANSED! ✨', {
      fontFamily: 'Press Start 2P',
      fontSize: '11px',
      color: '#f6c026'
    }).setOrigin(0.5);
    banner.add(title);

    const subTitleText = nextCh ? `Chapter ${this.chapterId} Cleared! | Foes Cleansed: ${this.killsCount}` : `Cosmos Restored! All 5 Shrines Cleansed!`;
    const msg = this.add.text(0, -boxHeight / 2 + 42, subTitleText, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#b0f0b0'
    }).setOrigin(0.5);
    banner.add(msg);

    let actionTaken = false;
    const cleanup = () => {
      this.input.off('pointerdown', onScenePointerDown);
      this.input.keyboard.off('keydown', onKeyDown);
      if (this.game && this.game.canvas) {
        this.game.canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      }
      this.activeVictoryCleanup = null;
    };
    this.activeVictoryCleanup = cleanup;

    const doAdvance = () => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      actionTaken = true;
      cleanup();
      sound.playCoin();
      if (nextCh) {
        this.scene.restart({ chapter: nextCh });
      } else {
        this.scene.start('MenuScene');
      }
    };

    const doRetry = () => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      actionTaken = true;
      cleanup();
      sound.playCoin();
      this.scene.restart({ chapter: this.chapterId });
    };

    const doMenu = () => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      actionTaken = true;
      cleanup();
      sound.playCoin();
      this.scene.start('MenuScene');
    };

    this.victoryAdvanceCallback = nextCh ? doAdvance : doMenu;

    const buttons = [];
    const createBtn = (relX, relY, bw, bh, bgCol, borderCol, textCol, label, action) => {
      const btnRect = this.add.rectangle(relX, relY, bw, bh, bgCol)
        .setStrokeStyle(1.5, borderCol)
        .setInteractive({ useHandCursor: true });
      banner.add(btnRect);

      const btnLabel = this.add.text(relX, relY, label, {
        fontFamily: 'Press Start 2P',
        fontSize: '7px',
        color: textCol
      }).setOrigin(0.5);
      banner.add(btnLabel);

      const setHover = (hover) => {
        const s = hover ? 1.03 : 1.0;
        btnRect.setScale(s);
        btnLabel.setScale(s);
      };

      btnRect.on('pointerover', () => setHover(true));
      btnRect.on('pointerout', () => setHover(false));
      btnRect.on('pointerdown', action);

      buttons.push({
        minX: (w / 2 + relX) - bw / 2,
        maxX: (w / 2 + relX) + bw / 2,
        minY: (h / 2 + relY) - bh / 2,
        maxY: (h / 2 + relY) + bh / 2,
        action
      });

      return { btnRect, btnLabel };
    };

    if (nextCh) {
      // Advance to next chapter
      createBtn(0, -6, 280, 26, 0x1d5828, 0x76ee76, '#ffffff', `ADVANCE TO CHAPTER ${nextCh} ➔`, doAdvance);
      // Secondary options: Retry Chapter or Main Menu
      createBtn(-78, 30, 140, 24, 0x223322, 0x55aa55, '#88ee88', '↺ RETRY', doRetry);
      createBtn(78, 30, 140, 24, 0x332818, 0xee9933, '#ffcc77', '◄ MAIN MENU', doMenu);
    } else {
      // Replay Chapter or Main Menu
      createBtn(-80, 8, 150, 28, 0x223322, 0x55aa55, '#88ee88', '↺ REPLAY CHAPTER', doRetry);
      createBtn(80, 8, 150, 28, 0x332818, 0xee9933, '#ffcc77', '◄ MAIN MENU', doMenu);
    }

    const hintY = nextCh ? 56 : 42;
    const hintText = this.add.text(0, hintY, '▶ SELECT AN OPTION TO CONTINUE ◀', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
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

    const onScenePointerDown = (pointer) => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      const px = pointer.x;
      const py = pointer.y;
      for (const b of buttons) {
        if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
          b.action();
          return;
        }
      }
    };
    this.input.on('pointerdown', onScenePointerDown);

    const onCanvasPointerDown = (e) => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      if (!this.game || !this.game.canvas) return;
      const rect = this.game.canvas.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * w;
      const py = ((e.clientY - rect.top) / rect.height) * h;
      for (const b of buttons) {
        if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
          b.action();
          return;
        }
      }
    };
    if (this.game && this.game.canvas) {
      this.game.canvas.addEventListener('pointerdown', onCanvasPointerDown);
    }

    const onKeyDown = (event) => {
      if (actionTaken || this.time.now < this.victoryInputReadyTime) return;
      const key = (event.key || '').toUpperCase();
      if (nextCh && (key === 'ENTER' || key === ' ' || key === 'J')) {
        doAdvance();
      } else if (key === 'R') {
        doRetry();
      } else if (key === 'ESCAPE' || key === 'M') {
        doMenu();
      }
    };
    this.input.keyboard.on('keydown', onKeyDown);
  }

  handlePlayerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.stopBGM();
    sound.playGameOver();
    pauseService.hideButtons();
    this.gameOverInputReadyTime = this.time.now + 350;

    if (this.player && !this.player.isDead) {
      this.player.die();
    }

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    if (this.chapterIntroCard) {
      this.chapterIntroCard.destroy();
      this.chapterIntroCard = null;
    }

    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    const card = this.add.container(w / 2, h / 2).setScrollFactor(0).setDepth(500);

      const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.65).setInteractive();
      card.add(overlay);

      const box = this.add.rectangle(0, 0, 360, 130, 0x240e0e, 0.96);
      box.setStrokeStyle(2, 0xff4444);
      card.add(box);

      const title = this.add.text(0, -42, 'YOU FELL IN BATTLE', {
        fontFamily: 'Press Start 2P',
        fontSize: '11px',
        color: '#ff4444'
      }).setOrigin(0.5);
      card.add(title);

      const subtitle = this.add.text(0, -22, `Chapter ${this.chapterId}: ${this.chapterConfig.title}`, {
        fontFamily: 'Press Start 2P',
        fontSize: '6.5px',
        color: '#ffaaaa'
      }).setOrigin(0.5);
      card.add(subtitle);

      let actionTaken = false;
      const cleanup = () => {
        this.input.off('pointerdown', onScenePointerDown);
        this.input.keyboard.off('keydown', onKeyDown);
        if (this.game && this.game.canvas) {
          this.game.canvas.removeEventListener('pointerdown', onCanvasPointerDown);
        }
        this.activeGameOverCleanup = null;
      };
      this.activeGameOverCleanup = cleanup;

      const doRetry = () => {
        if (actionTaken || this.time.now < this.gameOverInputReadyTime) return;
        actionTaken = true;
        cleanup();
        sound.playCoin();
        this.scene.restart({ chapter: this.chapterId });
      };

      const doMenu = () => {
        if (actionTaken || this.time.now < this.gameOverInputReadyTime) return;
        actionTaken = true;
        cleanup();
        sound.playCoin();
        this.scene.start('MenuScene');
      };

      this.gameOverRetryCallback = doRetry;

      const buttons = [];
      const createBtn = (relX, relY, bw, bh, bgCol, borderCol, textCol, label, action) => {
        const btnRect = this.add.rectangle(relX, relY, bw, bh, bgCol)
          .setStrokeStyle(1.5, borderCol)
          .setInteractive({ useHandCursor: true });
        card.add(btnRect);

        const btnLabel = this.add.text(relX, relY, label, {
          fontFamily: 'Press Start 2P',
          fontSize: '7px',
          color: textCol
        }).setOrigin(0.5);
        card.add(btnLabel);

        const setHover = (hover) => {
          const s = hover ? 1.04 : 1.0;
          btnRect.setScale(s);
          btnLabel.setScale(s);
        };

        btnRect.on('pointerover', () => setHover(true));
        btnRect.on('pointerout', () => setHover(false));
        btnRect.on('pointerdown', action);

        buttons.push({
          minX: (w / 2 + relX) - bw / 2,
          maxX: (w / 2 + relX) + bw / 2,
          minY: (h / 2 + relY) - bh / 2,
          maxY: (h / 2 + relY) + bh / 2,
          action
        });

        return { btnRect, btnLabel };
      };

      // Two distinct buttons side-by-side: Retry and Main Menu
      createBtn(-78, 10, 140, 26, 0x5a1818, 0xff7777, '#ffffff', '↺ RETRY', doRetry);
      createBtn(78, 10, 140, 26, 0x382414, 0xf59e0b, '#f59e0b', '◄ MAIN MENU', doMenu);

      const hintText = this.add.text(0, 42, '▶ TAP RETRY OR MAIN MENU TO CONTINUE ◀', {
        fontFamily: 'Press Start 2P',
        fontSize: '5.5px',
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

      const onScenePointerDown = (pointer) => {
        if (actionTaken || this.time.now < this.gameOverInputReadyTime) return;
        const px = pointer.x;
        const py = pointer.y;
        for (const b of buttons) {
          if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
            b.action();
            return;
          }
        }
      };
      this.input.on('pointerdown', onScenePointerDown);

      const onCanvasPointerDown = (e) => {
        if (actionTaken || this.time.now < this.gameOverInputReadyTime) return;
        if (!this.game || !this.game.canvas) return;
        const rect = this.game.canvas.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const py = ((e.clientY - rect.top) / rect.height) * h;
        for (const b of buttons) {
          if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
            b.action();
            return;
          }
        }
      };
      if (this.game && this.game.canvas) {
        this.game.canvas.addEventListener('pointerdown', onCanvasPointerDown);
      }

      const onKeyDown = (event) => {
        if (actionTaken || this.time.now < this.gameOverInputReadyTime) return;
        const key = (event.key || '').toUpperCase();
        if (key === 'R' || key === 'ENTER' || key === ' ' || key === 'J') {
          doRetry();
        } else if (key === 'ESCAPE' || key === 'M') {
          doMenu();
        }
      };
      this.input.keyboard.on('keydown', onKeyDown);
  }

  update() {
    if (this.inDialogue) {
      if (this.player && this.player.body) {
        this.player.setVelocityX(0);
      }
      return;
    }

    if (!this.isVictory && !this.isGameOver && this.player && !this.player.isDead) {
      const sec = Math.floor((performance.now() - this.startTime) / 1000);
      if (sec !== this.secondsElapsed) {
        this.secondsElapsed = sec;
        pauseService.updateTimer(this.secondsElapsed);
      }
    }

    const touchInputs = window.touchController ? {
      ...window.touchController.state,
      ...window.touchController.consumeTriggers()
    } : {};

    // Victory screen keyboard/touch advance check
    if (this.isVictory && this.victoryAdvanceCallback && this.time.now > this.victoryInputReadyTime) {
      const advancePressed = (
        touchInputs.justAttack ||
        touchInputs.justUpSlash ||
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
        touchInputs.justUpSlash ||
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
        } else if (this.chapterId === 2 && this.player.x >= 2120) {
          this.triggerBossEncounter(2);
        } else if (this.chapterId === 3 && this.player.x >= 2120) {
          this.triggerBossEncounter(3);
        } else if (this.chapterId === 4 && this.player.x >= 2120) {
          this.triggerBossEncounter(4);
        } else if (this.chapterId === 5 && this.player.x >= 2120) {
          this.triggerBossEncounter(5);
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
