import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Boar from '../entities/Boar.js';
import Snail from '../entities/Snail.js';
import Bee from '../entities/Bee.js';
import Mushroom from '../entities/Mushroom.js';
import FlyingEye from '../entities/FlyingEye.js';
import Goblin from '../entities/Goblin.js';
import BossGorgok from '../entities/BossGorgok.js';
import Projectile from '../entities/Projectile.js';
import BossHealthBar from '../ui/BossHealthBar.js';
import Crate from '../entities/Crate.js';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { getTodaySeedString, generateDailySurvivalSpec } from '../engine/PRNG.js';
import confetti from 'canvas-confetti';

export default class SurvivalScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SurvivalScene' });
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.arenaWidth = 840;
    this.arenaHeight = 380;

    this.physics.world.setBounds(0, 0, this.arenaWidth, this.arenaHeight);

    // Load today's deterministic seed & spec
    this.seedString = getTodaySeedString();
    this.spec = generateDailySurvivalSpec(this.seedString);

    // Arena Lush Forest Background & Atmosphere
    this.createArenaForestBackground();

    // Game stats
    this.startTime = this.time.now;
    this.secondsSurvived = 0;
    this.totalScore = 0;
    this.killCount = { boar: 0, snail: 0, bee: 0, mushroom: 0, flying_eye: 0, goblin: 0, boss_gorgok: 0, total: 0 };
    this.comboCount = 0;
    this.currentComboMultiplier = 1.0;
    this.isGameOver = false;

    // Groups
    this.platforms = this.physics.add.staticGroup();
    this.crates = this.physics.add.group();
    this.enemies = this.physics.add.group();
    this.projectiles = this.physics.add.group({ runChildUpdate: true });

    // Build seeded arena
    this.buildSeededArena();

    // Spawn player in center
    this.player = new Player(this, 400, 240);
    this.physics.add.collider(this.player, this.platforms);

    // Camera setup
    this.cameras.main.setBounds(0, 0, this.arenaWidth, this.arenaHeight);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Collisions
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.crates, this.platforms);

    // Projectile terrain collision
    this.physics.add.collider(this.projectiles, this.platforms, (proj) => {
      if (proj && proj.active) {
        if (proj.projType === 'goblin_bomb') {
          // bombs bounce on ground
        } else {
          proj.destroyProj ? proj.destroyProj() : proj.destroy();
        }
      }
    });

    // Player attack vs enemies
    this.physics.add.overlap(this.player.attackHitbox, this.enemies, (hitbox, enemy) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(enemy)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(enemy);
      this.handlePlayerAttack(enemy);
    });

    // Player attack vs projectiles (deflection)
    this.physics.add.overlap(this.player.attackHitbox, this.projectiles, (hitbox, proj) => {
      if (!this.player.isAttacking || !proj || proj.isDead || proj.isDeflected) return;
      if (proj.isDeflectable) {
        proj.deflect(this.player);
      }
    });

    // Player attack vs crates
    this.physics.add.overlap(this.player.attackHitbox, this.crates, (hitbox, crate) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(crate)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(crate);
      crate.breakCrate(this.player);
    });

    // Player vs enemy body
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      this.handlePlayerHurt(enemy);
    });

    // Player vs projectiles
    this.physics.add.overlap(this.player, this.projectiles, (player, proj) => {
      if (this.player.isDead || !proj || proj.isDead || proj.isDeflected) return;
      const knockDir = proj.x < this.player.x ? 1 : -1;
      const damaged = this.player.takeDamage(proj.damage || 1, knockDir);
      if (damaged) {
        this.comboCount = 0;
        this.currentComboMultiplier = 1.0;
        this.txtCombo.setText('COMBO: 1.0x');
        this.updateHearts();
        if (this.player.isDead) {
          this.handleGameOver();
        }
      }
      proj.destroyProj ? proj.destroyProj() : proj.destroy();
    });

    // Deflected projectiles vs enemies
    this.physics.add.overlap(this.projectiles, this.enemies, (proj, enemy) => {
      if (!proj || proj.isDead || !proj.isDeflected || !enemy || enemy.state === 'DEAD' || enemy._killHandled) return;
      const res = enemy.takeDamage(60, proj.x);
      proj.destroyProj ? proj.destroyProj() : proj.destroy();
      if (res && res.killed) {
        this.addKill(enemy.mobType, res.pts, 40, enemy.x, enemy.y - 12, 'DEFLECT KILL! ⚡', enemy);
      }
    });

    // Sliding shell ricochet
    this.physics.add.overlap(this.enemies, this.enemies, (e1, e2) => {
      this.handleRicochet(e1, e2);
    });

    // Controls
    this.cursors = this.input.keyboard.createCursorKeys();
    this.cursors.keys = this.input.keyboard.addKeys('W,A,S,D,J,K,Z,X,ENTER,ESC');

    // HUD
    this.createSurvivalHUD();

    // Start wave progression (kill-gated with concurrency cap)
    this.currentWaveIndex = 0;
    this.wavePendingCount = 0;
    this.waveRemainingFoes = 0;
    this.waveSpawnQueue = [];
    this.maxConcurrentEnemies = 2;
    this.inFlightSpawns = 0;
    this.waveHpMul = 1;
    this.endlessMode = false;
    this.endlessWave = 1;
    this.failsafeTimer = null;
    this.waveSpawnTimers = [];
    this.modalButtons = null;
    this.player.body.setCollideWorldBounds(true);
    this.startWave(this.currentWaveIndex);
  }

  createArenaForestBackground() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    // 1. Sky
    this.bgSky = this.add.tileSprite(0, 0, w, h, 'sky_backdrop').setOrigin(0, 0).setScrollFactor(0).setDepth(0);

    // 2. Mountains
    this.bgMountains = this.add.tileSprite(0, 20, w, 200, 'sky_mountains').setOrigin(0, 0).setScrollFactor(0).setDepth(1);

    // 3. Fog pines
    this.bgFogPines = this.add.tileSprite(0, 50, w, 220, 'forest_bg_p0').setOrigin(0, 0).setScrollFactor(0).setDepth(2);

    // 4. Midground pines
    this.bgMidPines = this.add.tileSprite(0, 80, w, 220, 'forest_bg_p1').setOrigin(0, 0).setScrollFactor(0).setDepth(3);

    // 5. Tall Forest Pines in Arena
    const treePositions = [
      { x: 70, scale: 1.1, type: 'pine_green' },
      { x: 200, scale: 0.95, type: 'pine_dark' },
      { x: 360, scale: 1.05, type: 'pine_golden' },
      { x: 500, scale: 0.9, type: 'pine_dark' },
      { x: 650, scale: 1.1, type: 'pine_green' },
      { x: 770, scale: 1.0, type: 'pine_golden' },
    ];

    treePositions.forEach(t => {
      const tree = this.add.image(t.x, 326, t.type)
        .setOrigin(0.5, 1.0)
        .setScale(t.scale)
        .setDepth(4);

      this.tweens.add({
        targets: tree,
        angle: { from: -0.8, to: 0.8 },
        duration: 2600 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // 6. Bushes
    [100, 260, 420, 580, 720].forEach(bx => {
      this.add.image(bx, 322, 'bush_green').setOrigin(0.5, 1.0).setDepth(5).setScale(0.8);
    });

    // 7. Ambient particles
    this.createArenaForestParticles();
  }

  createArenaForestParticles() {
    this.particles = this.add.particles(0, 0, 'spark', {
      x: { min: 0, max: this.arenaWidth },
      y: { min: 40, max: 320 },
      quantity: 1,
      frequency: 240,
      lifespan: 3800,
      gravityY: -8,
      speedX: { min: -12, max: 12 },
      speedY: { min: -8, max: 8 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.6, end: 0 },
      tint: 0x88ee88,
      blendMode: 'ADD'
    }).setDepth(15);
  }

  buildSeededArena() {
    const depth = 10;

    // Build platforms from deterministic spec
    this.spec.platforms.forEach(plat => {
      // Invisible static collider body
      const rect = this.add.rectangle(plat.x, plat.y, plat.width, plat.height, 0x000000, 0);
      this.physics.add.existing(rect, true);
      this.platforms.add(rect);

      const startX = plat.x - plat.width / 2;
      const topY = plat.y - plat.height / 2;

      if (plat.type === 'ground') {
        // Render lush grass cliff top
        const numTiles = Math.ceil(plat.width / 16);
        for (let i = 0; i < numTiles; i++) {
          const tileX = startX + i * 16;
          let topKey = (i % 3 === 0) ? 'tile_cliff_top_mid2' : 'tile_cliff_top_mid1';
          if (i === 0) topKey = 'tile_cliff_top_left';
          else if (i === numTiles - 1) topKey = 'tile_cliff_top_right';

          this.add.image(tileX, topY - 10, topKey).setOrigin(0, 0).setDepth(depth);

          for (let cy = topY + 6; cy <= topY + 50; cy += 16) {
            this.add.image(tileX, cy, 'tile_cliff_body_mid').setOrigin(0, 0).setDepth(depth - 1);
          }
        }

        // Flora along the grass
        for (let px = startX + 30; px < startX + plat.width - 30; px += 64) {
          const hash = Math.floor((px * 9301 + 49297) % 233280);
          const roll = hash % 5;
          if (roll === 0) {
            this.add.image(px, topY, 'prop_shroom_big').setOrigin(0.5, 1.0).setDepth(depth + 1);
          } else if (roll === 1) {
            this.add.image(px, topY, 'prop_flower_blue').setOrigin(0.5, 1.0).setDepth(depth + 1);
          } else if (roll === 2) {
            this.add.image(px, topY, 'prop_flower_purple').setOrigin(0.5, 1.0).setDepth(depth + 1);
          } else if (roll === 3) {
            this.add.image(px, topY, 'prop_shroom_small').setOrigin(0.5, 1.0).setDepth(depth + 1);
          } else if (roll === 4) {
            this.add.image(px, topY, 'prop_fern').setOrigin(0.5, 1.0).setDepth(depth + 1);
          }
        }
      } else {
        // Elevated wooden timber / ruins platforms
        const count = Math.ceil(plat.width / 48);
        for (let i = 0; i < count; i++) {
          this.add.image(startX + i * 48, topY, 'plat_wood').setOrigin(0, 0).setDepth(depth);
        }
      }
    });

    // Spawn deterministic crates
    this.spec.crates.forEach(spot => {
      const crate = new Crate(this, spot.x, spot.y);
      this.crates.add(crate);
    });

    // Solid boundary barriers at edges to prevent clipping out of arena
    const leftWall = this.add.rectangle(-10, this.arenaHeight / 2, 20, this.arenaHeight, 0x000000, 0);
    this.physics.add.existing(leftWall, true);
    this.platforms.add(leftWall);

    const rightWall = this.add.rectangle(this.arenaWidth + 10, this.arenaHeight / 2, 20, this.arenaHeight, 0x000000, 0);
    this.physics.add.existing(rightWall, true);
    this.platforms.add(rightWall);
  }

  spawnProjectile(type, x, y, vx, vy, isDeflectable = true) {
    if (this.isGameOver) return null;
    const proj = new Projectile(this, x, y, type, vx, vy, isDeflectable);
    this.projectiles.add(proj);
    return proj;
  }

  getMaxConcurrentForWave(waveIndex) {
    if (waveIndex === 0) return 2; // Wave 1: max 2 active enemies
    if (waveIndex === 1) return 3; // Wave 2: max 3 active enemies
    if (waveIndex === 2) return 3; // Wave 3: max 3 active enemies
    if (waveIndex === 3) return 4; // Wave 4: max 4 active enemies
    if (waveIndex === 4) return 4; // Wave 5: max 4 active enemies (Boss + 3 minions)
    return 4;
  }

  startWave(index) {
    if (this.isGameOver) return;

    const waves = this.spec.waves;
    if (index >= waves.length) {
      this.startEndless();
      return;
    }

    const wave = waves[index];
    this.currentWaveIndex = index;
    this.waveHpMul = this.getWaveHpMul(index);
    this.waveSpawnQueue = [...wave.spawns];
    this.waveRemainingFoes = wave.spawns.length;
    this.wavePendingCount = wave.spawns.length;
    this.maxConcurrentEnemies = this.getMaxConcurrentForWave(index);
    this.inFlightSpawns = 0;
    this.endlessMode = false;
    this.waveSpawnTimers = [];
    this.updateWaveHud();

    this.announceWave(wave.title);

    // Initial spawn check to populate arena up to maxConcurrentEnemies
    this.checkSpawnQueue();

    // Fail-safe: if a wave can't be cleared, force it forward
    this.startWaveFailsafe();
  }

  checkSpawnQueue() {
    if (this.isGameOver || this.endlessMode) return;

    // Count living active enemies currently in the arena
    const activeEnemies = this.enemies.getChildren().filter(e => e && e.active && e.state !== 'DEAD' && !e._killHandled);
    const activeCount = activeEnemies.length;

    // If no foes left in queue, no in-flight spawns, and all active enemies are dead, wave is cleared
    if (this.waveRemainingFoes <= 0 && activeCount === 0 && this.waveSpawnQueue.length === 0 && this.inFlightSpawns === 0) {
      this.waveCleared();
      return;
    }

    // Available concurrency slots
    const availableSlots = this.maxConcurrentEnemies - (activeCount + this.inFlightSpawns);
    if (availableSlots <= 0 || this.waveSpawnQueue.length === 0) {
      return;
    }

    // Spawn up to availableSlots from the queue, slightly staggered
    const toSpawn = Math.min(availableSlots, this.waveSpawnQueue.length);
    for (let i = 0; i < toSpawn; i++) {
      const spawn = this.waveSpawnQueue.shift();
      this.inFlightSpawns++;
      const staggerDelay = i * 250;

      const timer = this.time.delayedCall(staggerDelay, () => {
        if (this.isGameOver) return;
        this.showSpawnTelegraph(spawn.x, spawn.y);

        const spawnTimer = this.time.delayedCall(450, () => {
          if (this.isGameOver) return;
          this.inFlightSpawns = Math.max(0, this.inFlightSpawns - 1);
          this.spawnEnemy(spawn.type, spawn.x, spawn.y, this.waveHpMul);
          // Check if another slot opened
          this.checkSpawnQueue();
        });
        this.waveSpawnTimers.push(spawnTimer);
      });
      this.waveSpawnTimers.push(timer);
    }
  }

  showSpawnTelegraph(x, y) {
    const rune = this.add.circle(x, y, 12, 0xf6c026, 0.7).setDepth(18);
    this.tweens.add({
      targets: rune,
      scale: 1.6,
      alpha: 0,
      duration: 450,
      onComplete: () => rune.destroy()
    });
  }

  waveCleared() {
    if (this.isGameOver) return;

    this.stopWaveFailsafe();
    this.waveSpawnTimers.forEach(t => t.remove(false));
    this.waveSpawnTimers = [];
    this.waveSpawnQueue = [];
    this.inFlightSpawns = 0;
    this.waveRemainingFoes = 0;
    this.wavePendingCount = 0;
    this.updateWaveHud();

    const bonus = GAME_CONFIG.SURVIVAL.WAVE_CLEAR_BONUS + (this.currentWaveIndex * 50);
    this.totalScore += bonus;
    this.txtScore.setText(`SCORE: ${this.totalScore}`);
    this.showScorePopup(this.player ? this.player.x : 400, (this.player ? this.player.y : 200) - 24, bonus, 'WAVE CLEAR! ✨');

    sound.playCoin();
    confetti({ particleCount: 35, spread: 70, origin: { y: 0.6 } });
    this.announceWave(`✨ WAVE ${this.currentWaveIndex + 1} CLEARED! +${bonus} PTS ✨`);

    this.time.delayedCall(1400, () => {
      if (this.isGameOver) return;
      this.startWave(this.currentWaveIndex + 1);
    });
  }

  startWaveFailsafe() {
    this.stopWaveFailsafe();
    this.failsafeTimer = this.time.addEvent({
      delay: GAME_CONFIG.SURVIVAL.WAVE_FAILSAFE_SECONDS * 1000,
      callback: () => {
        if (this.isGameOver) return;
        this.waveSpawnTimers.forEach(t => t.remove(false));
        this.waveSpawnTimers = [];
        this.waveSpawnQueue = [];
        this.inFlightSpawns = 0;
        this.enemies.getChildren().forEach(enemy => {
          if (enemy && enemy.active && enemy.state !== 'DEAD') {
            enemy.die();
          }
        });
        this.waveCleared();
      }
    });
  }

  stopWaveFailsafe() {
    if (this.failsafeTimer) {
      this.failsafeTimer.remove(false);
      this.failsafeTimer = null;
    }
  }

  startEndless() {
    if (this.isGameOver) return;

    this.endlessMode = true;
    this.waveRemainingFoes = 0;
    this.wavePendingCount = 0;
    this.endlessWave = 1;
    this.maxConcurrentEnemies = 4;
    this.inFlightSpawns = 0;
    this.waveHpMul = GAME_CONFIG.SURVIVAL.ENDLESS_HP_MUL_BASE;
    this.stopWaveFailsafe();
    this.updateWaveHud();

    this.announceWave('SURVIVAL RUSH!');

    // Endless mode periodic spawner: checks every 2 seconds if arena has open slots up to maxConcurrentEnemies
    this.endlessTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => {
        if (this.isGameOver) return;
        const activeCount = this.enemies.getChildren().filter(e => e && e.active && e.state !== 'DEAD' && !e._killHandled).length;
        const openSlots = this.maxConcurrentEnemies - (activeCount + this.inFlightSpawns);
        if (openSlots <= 0) return;

        for (let i = 0; i < openSlots; i++) {
          const types = ['boar', 'snail', 'bee', 'mushroom', 'flying_eye', 'goblin'];
          const chosen = Phaser.Utils.Array.GetRandom(types);
          const spawnX = Math.random() < 0.5 ? 80 : 760;
          let spawnY = 280;
          if (chosen === 'bee' || chosen === 'flying_eye') spawnY = Phaser.Math.Between(80, 140);
          else if (chosen === 'mushroom' || chosen === 'goblin') spawnY = Math.random() < 0.5 ? 150 : 210;

          this.inFlightSpawns++;
          this.showSpawnTelegraph(spawnX, spawnY);
          const t = this.time.delayedCall(450, () => {
            if (this.isGameOver) return;
            this.inFlightSpawns = Math.max(0, this.inFlightSpawns - 1);
            this.spawnEnemy(chosen, spawnX, spawnY, this.waveHpMul);
          });
          this.waveSpawnTimers.push(t);
        }
      }
    });
  }

  getWaveHpMul(index) {
    return 1 + index * GAME_CONFIG.SURVIVAL.HP_SCALE_PER_WAVE;
  }

  showScorePopup(x, y, pts, label = '') {
    const text = label ? `+${pts} ${label}` : `+${pts}`;
    const popup = this.add.text(x, y, text, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: label ? '#ffd700' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(220);

    this.tweens.add({
      targets: popup,
      y: y - 26,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy()
    });

    // Score HUD punch animation
    if (this.txtScore) {
      this.tweens.killTweensOf(this.txtScore);
      this.txtScore.setScale(1.25);
      this.txtScore.setTint(0xffd700);
      this.tweens.add({
        targets: this.txtScore,
        scale: 1.0,
        duration: 180,
        onComplete: () => this.txtScore.clearTint()
      });
    }
  }

  addKill(mobType, basePts, bonusPts = 0, hitX = null, hitY = null, label = '', enemy = null) {
    if (this.isGameOver) return 0;

    if (enemy) {
      if (enemy._killHandled) return 0;
      enemy._killHandled = true;
    }

    this.killCount[mobType] = (this.killCount[mobType] || 0) + 1;
    this.killCount.total++;

    this.comboCount++;
    this.currentComboMultiplier = Math.min(
      GAME_CONFIG.SURVIVAL.MAX_COMBO,
      1.0 + this.comboCount * GAME_CONFIG.SURVIVAL.COMBO_INCREMENT
    );

    const ptsEarned = Math.round((basePts + bonusPts) * this.currentComboMultiplier);
    this.totalScore += ptsEarned;
    this.txtScore.setText(`SCORE: ${this.totalScore}`);
    this.txtCombo.setText(`COMBO: ${this.currentComboMultiplier.toFixed(1)}x`);

    const popupX = hitX !== null ? hitX : (this.player ? this.player.x : 400);
    const popupY = hitY !== null ? hitY : (this.player ? this.player.y - 10 : 200);
    const comboTag = this.currentComboMultiplier > 1.0 ? `${this.currentComboMultiplier.toFixed(1)}x` : '';
    const fullLabel = [label, comboTag].filter(Boolean).join(' ');
    this.showScorePopup(popupX, popupY, ptsEarned, fullLabel);

    if (!this.endlessMode) {
      this.waveRemainingFoes = Math.max(0, (this.waveRemainingFoes !== undefined ? this.waveRemainingFoes : this.wavePendingCount) - 1);
      this.wavePendingCount = this.waveRemainingFoes;
      this.updateWaveHud();

      const livingCount = this.enemies.getChildren().filter(e => e && e.active && e.state !== 'DEAD' && !e._killHandled).length;
      if (this.waveRemainingFoes === 0 && livingCount === 0 && this.waveSpawnQueue.length === 0 && this.inFlightSpawns === 0) {
        this.waveCleared();
      } else {
        // A slot has opened up in the arena! Check queue to dispatch next foe
        this.time.delayedCall(350, () => this.checkSpawnQueue());
      }
    }

    return ptsEarned;
  }

  onEnemyShattered(enemy) {
    if (!enemy || enemy._killHandled) return;
    this.addKill('snail', GAME_CONFIG.MOBS.SNAIL.PTS * 1.5, 0, enemy.x, enemy.y - 12, 'SHATTER! 💥', enemy);
  }

  updateWaveHud() {
    if (this.txtWave) {
      const label = this.endlessMode
        ? `RUSH ${this.endlessWave || 1}`
        : `WAVE ${this.currentWaveIndex + 1}/${this.spec.waves.length}`;
      this.txtWave.setText(label);
    }
    if (this.txtFoes) {
      const count = this.waveRemainingFoes !== undefined ? this.waveRemainingFoes : this.wavePendingCount;
      this.txtFoes.setText(this.endlessMode ? 'FOES: ∞' : `FOES: ${count}`);
    }
  }

  spawnEnemy(type, x, y, hpMul = 1) {
    let enemy;
    if (type === 'boar') {
      enemy = new Boar(this, x, y);
    } else if (type === 'snail') {
      enemy = new Snail(this, x, y);
    } else if (type === 'bee') {
      enemy = new Bee(this, x, y);
    } else if (type === 'mushroom') {
      enemy = new Mushroom(this, x, y);
    } else if (type === 'flying_eye') {
      enemy = new FlyingEye(this, x, y);
    } else if (type === 'goblin') {
      enemy = new Goblin(this, x, y);
    } else if (type === 'boss_gorgok') {
      if (!this.bossBar) {
        this.bossBar = new BossHealthBar(this, GAME_CONFIG.MOBS.BOSS_GORGOK.NAME, GAME_CONFIG.MOBS.BOSS_GORGOK.HP);
        this.bossBar.y = 44;
      }
      enemy = new BossGorgok(this, x, y, this.bossBar);
    }

    if (enemy) {
      enemy.mobType = type;
      if (hpMul !== 1) {
        enemy.hp = Math.max(1, Math.round(enemy.hp * hpMul));
        enemy.maxHp = enemy.hp;
      }
      // Progressive wave speed boost (each wave enemies move slightly faster)
      const speedBoost = 1 + (this.currentWaveIndex || 0) * 0.05;
      if (enemy.walkSpeed) enemy.walkSpeed *= speedBoost;

      enemy.body.setCollideWorldBounds(true);
      this.enemies.add(enemy);

      // Spawn puff
      const spawnPuff = this.add.circle(x, y, 14, 0x88ee88, 0.75).setDepth(20);
      this.tweens.add({
        targets: spawnPuff,
        scale: 1.6,
        alpha: 0,
        duration: 350,
        onComplete: () => spawnPuff.destroy()
      });
    }
  }

  announceWave(title) {
    const w = GAME_CONFIG.WIDTH;
    const waveText = this.add.text(w / 2, 48, title, {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#f6c026',
      stroke: '#000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(250);

    this.tweens.add({
      targets: waveText,
      scale: { from: 1.4, to: 1.0 },
      alpha: { from: 1, to: 0 },
      duration: 2200,
      onComplete: () => waveText.destroy()
    });
  }

  createSurvivalHUD() {
    const w = GAME_CONFIG.WIDTH;
    this.hudContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(200);

    const bar = this.add.rectangle(w / 2, 14, w, 28, 0x0a140a, 0.85);
    bar.setStrokeStyle(1, 0x3d5c3d);
    this.hudContainer.add(bar);

    // Mode title & Seed
    this.add.text(12, 6, `DAILY TRIAL: ${this.seedString}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#e9b213'
    }).setScrollFactor(0).setDepth(201);

    // Score & Timer
    this.txtScore = this.add.text(12, 17, 'SCORE: 0', {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(201);

    this.txtTimer = this.add.text(w - 12, 6, 'TIME: 0s', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#d0f0c0'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(201);

    this.txtCombo = this.add.text(w - 12, 17, 'COMBO: 1.0x', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#ffd700'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(201);

    // 3 Hearts display
    this.heartIcons = [];
    for (let i = 0; i < 3; i++) {
      const heart = this.add.text(w / 2 - 20 + i * 16, 8, '❤️', { fontSize: '11px' }).setScrollFactor(0).setDepth(201);
      this.heartIcons.push(heart);
    }

    // Wave progress (right of hearts)
    this.txtWave = this.add.text(w / 2 + 64, 6, 'WAVE 1/5', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#f6c026'
    }).setScrollFactor(0).setDepth(201);

    this.txtFoes = this.add.text(w / 2 + 64, 17, 'FOES: 0', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#d0f0c0'
    }).setScrollFactor(0).setDepth(201);
  }

  updateHearts() {
    if (!this.player) return;
    for (let i = 0; i < 3; i++) {
      this.heartIcons[i].setText(i < this.player.health ? '❤️' : '🖤');
    }
  }

  handlePlayerAttack(enemy) {
    if (!this.player.isAttacking || enemy.state === 'DEAD' || enemy._killHandled) return;

    const dmg = this.player.getAttackDamage();
    const isUpward = this.player.attackType === 'upward';
    const res = enemy.takeDamage(dmg, this.player.x, isUpward);

    if (res && res.killed) {
      const label = res.isBackstab ? 'CRIT!' : (res.shattered ? 'SHATTER! 💥' : (isUpward ? 'UP-SLASH!' : ''));
      const bonus = res.isBackstab ? 25 : 0;
      this.addKill(enemy.mobType, res.pts, bonus, enemy.x, enemy.y - 12, label, enemy);
    }
  }

  handlePlayerHurt(enemy) {
    if (this.player.isDead || enemy.state === 'DEAD') return;

    if (enemy.mobType === 'snail' && enemy.state === 'SHELLED') {
      const kickDir = this.player.x < enemy.x ? 1 : -1;
      enemy.kickShell(kickDir);
      return;
    }

    if (enemy.mobType === 'snail' && enemy.state === 'SLIDING') {
      // Only damages player if moving fast towards player
      const dirTowardsPlayer = (enemy.body.velocity.x > 0 && this.player.x > enemy.x) ||
                               (enemy.body.velocity.x < 0 && this.player.x < enemy.x);
      if (!dirTowardsPlayer) return;
    }

    const knockDir = enemy.x < this.player.x ? 1 : -1;
    const damaged = this.player.takeDamage(1, knockDir);
    if (damaged) {
      // Reset combo on hit
      this.comboCount = 0;
      this.currentComboMultiplier = 1.0;
      this.txtCombo.setText('COMBO: 1.0x');
      this.updateHearts();

      if (this.player.isDead) {
        this.handleGameOver();
      }
    }
  }

  handleRicochet(e1, e2) {
    let projectile = null;
    let victim = null;

    if (e1.mobType === 'snail' && e1.state === 'SLIDING') {
      projectile = e1;
      victim = e2;
    } else if (e2.mobType === 'snail' && e2.state === 'SLIDING') {
      projectile = e2;
      victim = e1;
    }

    if (projectile && victim && victim.state !== 'DEAD' && !victim._killHandled && victim !== projectile) {
      sound.playRicochet();
      this.cameras.main.shake(100, 0.012);

      const res = victim.takeDamage(99, projectile.x);
      if (res && res.killed) {
        const earned = this.addKill(victim.mobType, res.pts, GAME_CONFIG.MOBS.SNAIL.RICOCHET_BONUS_PTS, victim.x, victim.y, '', victim);

        const ricoText = this.add.text(victim.x, victim.y - 18, `+${earned} SHELL RICOCHET! 💥`, {
          fontFamily: 'Press Start 2P',
          fontSize: '7px',
          color: '#ffd700',
          stroke: '#000',
          strokeThickness: 2
        }).setOrigin(0.5);

        this.tweens.add({
          targets: ricoText,
          y: victim.y - 32,
          alpha: 0,
          duration: 600,
          onComplete: () => ricoText.destroy()
        });
      }
    }
  }

  handleGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playGameOver();

    // Final score formula: (Kills * Mob Value) + (Seconds Survived * 10) + Hit Combo Multiplier
    const timeBonus = this.secondsSurvived * GAME_CONFIG.SURVIVAL.PTS_PER_SECOND;
    this.totalScore += timeBonus;

    // Generate cryptographic anti-cheat proof
    const runData = {
      seed: this.seedString,
      duration: this.secondsSurvived,
      kills: this.killCount.total,
      score: this.totalScore,
      timestamp: Date.now()
    };
    const proofHash = `RUN-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*8999+1000)}`;

    // Save locally
    storage.recordDailyTrial(this.seedString, this.totalScore, {
      ...runData,
      proofHash
    });

    this.time.delayedCall(300, () => {
      this.showGameOverModal(proofHash);
    });
  }

  showGameOverModal(proofHash) {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    // Full screen backdrop overlay to capture clicks and dim the arena
    const backdrop = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.78)
      .setScrollFactor(0)
      .setDepth(490)
      .setInteractive();

    // Modal Card Frame
    const box = this.add.rectangle(w / 2, h / 2, 400, 206, 0x121c12, 0.98)
      .setStrokeStyle(2, 0xe9b213)
      .setScrollFactor(0)
      .setDepth(500);

    const title = this.add.text(w / 2, h / 2 - 76, 'DAILY TRIAL LOCKED IN', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#f6c026'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    const scoreDisplay = this.add.text(w / 2, h / 2 - 54, `FINAL SCORE: ${this.totalScore}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    const details = this.add.text(w / 2, h / 2 - 14, [
      `Date: ${this.seedString} (UTC)`,
      `Time Survived: ${this.secondsSurvived}s (+${this.secondsSurvived * 10} pts)`,
      `Kills: 🐗${this.killCount.boar || 0} 🐌${this.killCount.snail || 0} 🐝${this.killCount.bee || 0} 🍄${this.killCount.mushroom || 0} 👁️${this.killCount.flying_eye || 0} 👺${this.killCount.goblin || 0}`,
      `Anti-Cheat Proof: ${proofHash}`
    ].join('\n'), {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#a0c4a0',
      lineSpacing: 5,
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(501);

    // Navigation callbacks with listener cleanup
    let modalClosed = false;
    const cleanup = () => {
      if (modalClosed) return;
      modalClosed = true;
      this.input.keyboard.off('keydown', onKeyDown);
    };

    const goRetry = () => {
      cleanup();
      sound.playCoin();
      this.scene.restart();
    };

    const goLeaderboard = () => {
      cleanup();
      sound.playCoin();
      this.scene.start('LeaderboardScene', { lastScore: this.totalScore });
    };

    const goMenu = () => {
      cleanup();
      sound.playCoin();
      this.scene.start('MenuScene');
    };

    const onKeyDown = (event) => {
      if (modalClosed) return;
      const key = (event.key || '').toUpperCase();
      if (key === 'R' || key === ' ') {
        goRetry();
      } else if (key === 'L') {
        goLeaderboard();
      } else if (key === 'ESCAPE' || key === 'M' || key === 'ENTER') {
        goMenu();
      }
    };
    this.input.keyboard.on('keydown', onKeyDown);

    // Button builder helper
    const createBtn = (bx, by, bw, bh, bgCol, borderCol, textCol, label, action) => {
      const rect = this.add.rectangle(bx, by, bw, bh, bgCol)
        .setStrokeStyle(1, borderCol)
        .setScrollFactor(0)
        .setDepth(502)
        .setInteractive({ useHandCursor: true });

      const txt = this.add.text(bx, by, label, {
        fontFamily: 'Press Start 2P',
        fontSize: '6px',
        color: textCol
      }).setOrigin(0.5).setScrollFactor(0).setDepth(503).setInteractive({ useHandCursor: true });

      const setHover = (hover) => {
        const s = hover ? 1.05 : 1.0;
        rect.setScale(s);
        txt.setScale(s);
      };

      rect.on('pointerover', () => setHover(true));
      txt.on('pointerover', () => setHover(true));
      rect.on('pointerout', () => setHover(false));
      txt.on('pointerout', () => setHover(false));

      rect.on('pointerdown', action);
      txt.on('pointerdown', action);

      return { rect, txt };
    };

    const btnY = h / 2 + 65;
    // RETRY [R]
    const retryBtn = createBtn(w / 2 - 124, btnY, 108, 26, 0x163816, 0x4ade80, '#4ade80', 'RETRY [R]', goRetry);
    // LEADERBOARD [L]
    const lbBtn = createBtn(w / 2, btnY, 124, 26, 0x15283c, 0x38bdf8, '#38bdf8', 'LEADERBOARD [L]', goLeaderboard);
    // MAIN MENU [ESC]
    const menuBtn = createBtn(w / 2 + 124, btnY, 108, 26, 0x382414, 0xf59e0b, '#f59e0b', 'MAIN MENU [ESC]', goMenu);

    this.modalButtons = {
      retry: retryBtn,
      leaderboard: lbBtn,
      menu: menuBtn
    };
  }

  update() {
    if (this.isGameOver) return;

    // Update survival timer
    const elapsedSec = Math.floor((this.time.now - this.startTime) / 1000);
    if (elapsedSec !== this.secondsSurvived) {
      this.secondsSurvived = elapsedSec;
      this.txtTimer.setText(`TIME: ${this.secondsSurvived}s`);
    }

    const touchInputs = window.touchController ? {
      ...window.touchController.state,
      ...window.touchController.consumeTriggers()
    } : {};

    if (this.player) {
      this.player.update(this.cursors, touchInputs);
    }

    const camScrollX = this.cameras.main.scrollX;
    if (this.bgMountains) this.bgMountains.tilePositionX = camScrollX * 0.05;
    if (this.bgFogPines) this.bgFogPines.tilePositionX = camScrollX * 0.12;
    if (this.bgMidPines) this.bgMidPines.tilePositionX = camScrollX * 0.22;

    this.enemies.getChildren().forEach(e => {
      if (e && e.active && e.state !== 'DEAD') {
        if (e.y > 330 && e.mobType !== 'bee' && e.mobType !== 'flying_eye') {
          e.y = 308;
          e.setVelocityY(0);
        }
        e.update(this.player);
      }
    });

    // Fall out of bounds check
    if (this.player && this.player.y > this.arenaHeight + 20) {
      this.player.die();
      this.updateHearts();
      this.handleGameOver();
    }
  }
}
