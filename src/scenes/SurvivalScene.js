import Phaser from 'phaser';
import Player from '../entities/Player.js';
import Boar from '../entities/Boar.js';
import Snail from '../entities/Snail.js';
import Bee from '../entities/Bee.js';
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
    this.killCount = { boar: 0, snail: 0, bee: 0, total: 0 };
    this.comboCount = 0;
    this.currentComboMultiplier = 1.0;
    this.isGameOver = false;

    // Groups
    this.platforms = this.physics.add.staticGroup();
    this.crates = this.physics.add.group();
    this.enemies = this.physics.add.group();

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

    // Player attack
    this.physics.add.overlap(this.player.attackHitbox, this.enemies, (hitbox, enemy) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(enemy)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(enemy);
      this.handlePlayerAttack(enemy);
    });

    this.physics.add.overlap(this.player.attackHitbox, this.crates, (hitbox, crate) => {
      if (this.player.currentSwingHits && this.player.currentSwingHits.has(crate)) return;
      if (this.player.currentSwingHits) this.player.currentSwingHits.add(crate);
      crate.breakCrate(this.player);
    });

    // Player vs enemy body
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => {
      this.handlePlayerHurt(enemy);
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

    // Start wave scheduler
    this.currentWaveIndex = 0;
    this.scheduleWaves();
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
  }

  scheduleWaves() {
    this.spec.waves.forEach((wave, idx) => {
      // Trigger wave with a delay
      const waveDelay = idx * 12000;
      this.time.delayedCall(waveDelay, () => {
        if (this.isGameOver) return;
        this.announceWave(wave.title);

        wave.spawns.forEach(spawn => {
          this.time.delayedCall(spawn.delay, () => {
            if (this.isGameOver) return;
            this.spawnEnemy(spawn.type, spawn.x, spawn.y);
          });
        });
      });
    });

    // Endless scaling waves beyond wave 5 (starts at 60s)
    this.time.delayedCall(60000, () => {
      this.time.addEvent({
        delay: 15000,
        loop: true,
        callback: () => {
          if (this.isGameOver) return;
          const count = Phaser.Math.Between(2, 4);
          this.announceWave('SURVIVAL RUSH!');
          for (let i = 0; i < count; i++) {
            const types = ['boar', 'snail', 'bee'];
            const chosen = Phaser.Utils.Array.GetRandom(types);
            const spawnX = Math.random() < 0.5 ? 80 : 760;
            this.spawnEnemy(chosen, spawnX, chosen === 'bee' ? 100 : 310);
          }
        }
      });
    });
  }

  spawnEnemy(type, x, y) {
    let enemy;
    if (type === 'boar') {
      enemy = new Boar(this, x, y);
    } else if (type === 'snail') {
      enemy = new Snail(this, x, y);
    } else if (type === 'bee') {
      enemy = new Bee(this, x, y);
    }
    if (enemy) {
      enemy.mobType = type;
      this.enemies.add(enemy);
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
  }

  updateHearts() {
    if (!this.player) return;
    for (let i = 0; i < 3; i++) {
      this.heartIcons[i].setText(i < this.player.health ? '❤️' : '🖤');
    }
  }

  handlePlayerAttack(enemy) {
    if (!this.player.isAttacking || enemy.state === 'DEAD') return;

    const dmg = this.player.getAttackDamage();
    const isUpward = this.player.attackType === 'upward';
    const res = enemy.takeDamage(dmg, this.player.x, isUpward);

    if (res && res.killed) {
      this.killCount[enemy.mobType]++;
      this.killCount.total++;

      // Scoring formula: Kills * Mob Value * Combo Multiplier
      this.comboCount++;
      this.currentComboMultiplier = Math.min(
        GAME_CONFIG.SURVIVAL.MAX_COMBO,
        1.0 + this.comboCount * GAME_CONFIG.SURVIVAL.COMBO_INCREMENT
      );

      const ptsEarned = Math.round(res.pts * this.currentComboMultiplier);
      this.totalScore += ptsEarned;
      this.txtScore.setText(`SCORE: ${this.totalScore}`);
      this.txtCombo.setText(`COMBO: ${this.currentComboMultiplier.toFixed(1)}x`);
    }
  }

  handlePlayerHurt(enemy) {
    if (this.player.isDead || enemy.state === 'DEAD') return;

    if (enemy.mobType === 'snail' && enemy.state === 'SHELLED') {
      const kickDir = this.player.x < enemy.x ? 1 : -1;
      enemy.kickShell(kickDir);
      return;
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

    if (projectile && victim && victim.state !== 'DEAD' && victim !== projectile) {
      sound.playRicochet();
      this.cameras.main.shake(100, 0.012);

      const res = victim.takeDamage(99, projectile.x);
      if (res && res.killed) {
        this.killCount[victim.mobType]++;
        this.killCount.total++;

        // Ricochet bonus: +50 pts bonus!
        const bonus = Math.round((res.pts + GAME_CONFIG.MOBS.SNAIL.RICOCHET_BONUS_PTS) * this.currentComboMultiplier);
        this.totalScore += bonus;
        this.txtScore.setText(`SCORE: ${this.totalScore}`);

        const ricoText = this.add.text(victim.x, victim.y - 18, `+${bonus} SHELL RICOCHET! 💥`, {
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

    this.time.delayedCall(800, () => {
      this.showGameOverModal(proofHash);
    });
  }

  showGameOverModal(proofHash) {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    const modal = this.add.container(w / 2, h / 2).setScrollFactor(0).setDepth(300);

    const box = this.add.rectangle(0, 0, 360, 190, 0x141e14, 0.96);
    box.setStrokeStyle(2, 0xe9b213);
    modal.add(box);

    const title = this.add.text(0, -74, 'DAILY TRIAL LOCKED IN', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#f6c026'
    }).setOrigin(0.5);
    modal.add(title);

    const scoreDisplay = this.add.text(0, -52, `FINAL SCORE: ${this.totalScore}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '12px',
      color: '#ffffff'
    }).setOrigin(0.5);
    modal.add(scoreDisplay);

    const details = this.add.text(0, -18, [
      `Date: ${this.seedString} (UTC)`,
      `Time Survived: ${this.secondsSurvived}s (+${this.secondsSurvived * 10} pts)`,
      `Kills: 🐗${this.killCount.boar} 🐌${this.killCount.snail} 🐝${this.killCount.bee}`,
      `Anti-Cheat: ${proofHash}`
    ].join('\n'), {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#a0c4a0',
      lineSpacing: 5,
      align: 'center'
    }).setOrigin(0.5);
    modal.add(details);

    // Buttons
    const btnLeaderboard = this.add.rectangle(-80, 58, 140, 24, 0x1c3a1c).setStrokeStyle(1, 0x98ff20).setInteractive({ useHandCursor: true });
    modal.add(btnLeaderboard);
    modal.add(this.add.text(-80, 58, 'LEADERBOARD', { fontFamily: 'Press Start 2P', fontSize: '6px', color: '#fff' }).setOrigin(0.5));

    const btnMenu = this.add.rectangle(80, 58, 140, 24, 0x2a2414).setStrokeStyle(1, 0xf6c026).setInteractive({ useHandCursor: true });
    modal.add(btnMenu);
    modal.add(this.add.text(80, 58, 'MAIN MENU', { fontFamily: 'Press Start 2P', fontSize: '6px', color: '#fff' }).setOrigin(0.5));

    btnLeaderboard.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('LeaderboardScene', { lastScore: this.totalScore });
    });

    btnMenu.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('MenuScene');
    });
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

    this.enemies.getChildren().forEach(e => e.update(this.player));

    // Fall out of bounds check
    if (this.player && this.player.y > this.arenaHeight + 20) {
      this.player.die();
      this.updateHearts();
      this.handleGameOver();
    }
  }
}
