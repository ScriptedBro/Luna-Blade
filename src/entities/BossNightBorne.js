import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import EnemyHealthBar from '../ui/EnemyHealthBar.js';

export default class BossNightBorne extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, healthBar = null) {
    super(scene, x, y, 'nightborne_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.healthBar = healthBar;
    this.overheadBar = new EnemyHealthBar(scene, this, 50, 5, 14);
    this.mobType = 'boss_nightborne';
    this.bossName = GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.NAME;

    this.setScale(1.35);
    this.body.setSize(36, 52);
    this.body.setOffset(22, 28);
    this.body.setAllowGravity(true);
    this.setDepth(25);

    this.hp = GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.HP;
    this.maxHp = GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.HP;
    this.isPhase2 = false;

    this.state = 'IDLE'; // IDLE, RUN, WARP, ATTACK, SINGULARITY, DEAD
    this.nextActionTime = scene.time.now + 1200;
    this.runSpeed = GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.RUN_SPEED;

    this.play('nightborne_idle_anim');

    if (this.healthBar) {
      this.healthBar.updateHealth(this.hp, this.maxHp);
    }
  }

  update(player) {
    if (this.overheadBar) this.overheadBar.update(this.hp, this.maxHp);
    if (this.state === 'DEAD') return;
    if (this.scene && this.scene.inDialogue) {
      this.setVelocityX(0);
      return;
    }

    // Phase 2 check (< 40% HP)
    if (!this.isPhase2 && this.hp <= this.maxHp * 0.4) {
      this.triggerPhase2(player);
      return;
    }

    if (this.state === 'WARP' || this.state === 'SINGULARITY' || this.state === 'ATTACK') {
      return;
    }

    if (!player || player.isDead) {
      this.setVelocityX(0);
      return;
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    if (this.scene.time.now > this.nextActionTime) {
      if (dist < 80) {
        this.startAttack(player);
      } else if (dist > 180 && Math.random() < 0.45) {
        this.startWarpSlash(player);
      } else {
        this.state = 'RUN';
        this.setVelocityX(dir * (this.isPhase2 ? this.runSpeed * 1.3 : this.runSpeed));
        this.play('nightborne_run_anim', true);
        this.nextActionTime = this.scene.time.now + Phaser.Math.Between(1000, 1800);
      }
    } else if (this.state === 'RUN') {
      this.setVelocityX(dir * (this.isPhase2 ? this.runSpeed * 1.3 : this.runSpeed));
      if (dist < 75) {
        this.startAttack(player);
      }
    }
  }

  startAttack(player) {
    this.state = 'ATTACK';
    this.setVelocityX(0);
    this.play('nightborne_attack_anim', true);
    sound.playEnemyAttack();

    // Hitbox timing (frames 8-10 with purple crescent arc)
    this.scene.time.delayedCall(450, () => {
      if (this.state === 'DEAD' || !this.scene) return;
      const p = this.scene.player;
      if (p && !p.isDead) {
        const pDist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
        const facing = (this.flipX && p.x < this.x) || (!this.flipX && p.x > this.x);
        if (pDist < 85 && facing) {
          const kDir = this.x < p.x ? 1 : -1;
          p.takeDamage(GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.DAMAGE, kDir);
          this.scene.cameras.main.shake(150, 0.018);
        }
      }

      // Launch crescent void shockwave projectile along ground
      this.fireCrescentWave();
    });

    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.state === 'DEAD') return;
      this.state = 'IDLE';
      this.play('nightborne_idle_anim', true);
      this.nextActionTime = this.scene.time.now + (this.isPhase2 ? 600 : 1100);
    });
  }

  fireCrescentWave() {
    if (!this.scene) return;
    const waveDir = this.flipX ? -1 : 1;
    const wave = this.scene.add.ellipse(this.x + waveDir * 35, this.y + 10, 16, 38, 0xbb66ff, 0.85);
    this.scene.physics.add.existing(wave);
    wave.body.setAllowGravity(false);
    wave.body.setVelocityX(waveDir * (this.isPhase2 ? 260 : 200));

    const waveHit = this.scene.physics.add.overlap(this.scene.player, wave, () => {
      if (this.scene.player && !this.scene.player.isDead) {
        const kDir = wave.x < this.scene.player.x ? 1 : -1;
        this.scene.player.takeDamage(20, kDir);
        waveHit.destroy();
        wave.destroy();
      }
    });

    this.scene.time.delayedCall(1600, () => {
      if (wave.active) {
        waveHit.destroy();
        wave.destroy();
      }
    });
  }

  startWarpSlash(player) {
    this.state = 'WARP';
    this.setVelocity(0, 0);

    // Warp out effect
    for (let i = 0; i < 10; i++) {
      const p = this.scene.add.circle(this.x, this.y, 4, 0xaa44ff, 0.9);
      this.scene.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-30, 30),
        y: p.y + Phaser.Math.Between(-30, 30),
        alpha: 0,
        duration: 300,
        onComplete: () => p.destroy()
      });
    }

    sound.playHit();
    this.setVisible(false);

    // Warp behind player after 300ms
    this.scene.time.delayedCall(300, () => {
      if (this.state === 'DEAD' || !this.scene || !player) return;
      const behindX = player.x + (player.flipX ? 60 : -60);
      this.setPosition(Phaser.Math.Clamp(behindX, 2100, 2550), player.y);
      this.setVisible(true);
      this.setFlipX(player.x < this.x);

      // Warp in burst
      for (let i = 0; i < 10; i++) {
        const p = this.scene.add.circle(this.x, this.y, 4, 0xdd88ff, 0.9);
        this.scene.tweens.add({
          targets: p,
          scale: 0.2,
          alpha: 0,
          duration: 300,
          onComplete: () => p.destroy()
        });
      }

      this.startAttack(player);
    });
  }

  triggerPhase2(player) {
    this.isPhase2 = true;
    this.state = 'SINGULARITY';
    this.setVelocity(0, 0);
    this.setTint(0xdd88ff);

    sound.playHit();
    this.scene.cameras.main.shake(400, 0.03);
    this.scene.showFloatingText(this.x, this.y - 45, 'UMBRA: VOID SINGULARITY!', '#cc44ff');

    // Pulsing black hole orb visual
    const orb = this.scene.add.circle(this.x, this.y, 16, 0x000000, 0.95);
    orb.setStrokeStyle(3, 0xaa44ff);
    orb.setDepth(30);

    this.scene.tweens.add({
      targets: orb,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 1000,
      yoyo: true,
      onComplete: () => {
        orb.destroy();
        if (this.state === 'DEAD') return;
        this.state = 'IDLE';
        this.play('nightborne_idle_anim', true);
        this.nextActionTime = this.scene.time.now + 500;
      }
    });
  }

  takeDamage(amount, fromX = null, isBackstab = false, isCounter = false) {
    if (this.state === 'DEAD') return;

    let finalDmg = amount;
    if (isBackstab) finalDmg *= 1.5;
    if (isCounter) finalDmg *= 1.5;
    finalDmg = Math.round(finalDmg);

    this.hp = Math.max(0, this.hp - finalDmg);
    if (this.healthBar) {
      this.healthBar.updateHealth(this.hp, this.maxHp);
    }

    sound.playHit();
    this.scene.showFloatingText(this.x, this.y - 25, `-${finalDmg}`, isBackstab ? '#ffdd44' : '#ff4444');

    if (this.hp <= 0) {
      this.die();
    } else if (this.state !== 'ATTACK' && this.state !== 'WARP') {
      this.play('nightborne_hit_anim', true);
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        if (this.state !== 'DEAD') {
          this.state = 'IDLE';
          this.play('nightborne_idle_anim', true);
        }
      });
    }
  }

  die() {
    this.state = 'DEAD';
    this.setVelocity(0, 0);
    this.body.setEnable(false);

    if (this.healthBar) {
      this.healthBar.defeat();
    }

    if (this.overheadBar) {
      this.overheadBar.destroy();
      this.overheadBar = null;
    }

    sound.playEnemyDeath();
    this.play('nightborne_dead_anim', true);
    this.scene.cameras.main.shake(800, 0.035);

    storage.addMaterials({ amber: 30, iron: 15, bark: 20 });
    storage.addScore(GAME_CONFIG.MOBS.BOSS_NIGHTBORNE.PTS);
    if (typeof this.scene.updateHudMaterials === 'function') {
      this.scene.updateHudMaterials();
    }
    this.scene.showFloatingText(this.x, this.y - 45, '+30 AMBER', '#ffcc00');

    // Unlock Chapter Obelisk & Arena Gate
    if (this.scene.obelisk) {
      this.scene.obelisk.unlock();
    }
    if (typeof this.scene.openArenaGate === 'function') {
      this.scene.openArenaGate();
    }

    // Cosmic void burst particles
    for (let i = 0; i < 30; i++) {
      const star = this.scene.add.circle(this.x, this.y, Phaser.Math.Between(3, 8), 0xaa55ff, 0.9);
      this.scene.physics.add.existing(star);
      star.body.setVelocity(Phaser.Math.Between(-220, 220), Phaser.Math.Between(-260, 60));
      star.body.setGravityY(150);
      this.scene.tweens.add({
        targets: star,
        alpha: 0,
        scale: 0.1,
        duration: 1200,
        onComplete: () => star.destroy()
      });
    }

    // Allow full 23-frame cosmic supernova animation to play out
    this.scene.time.delayedCall(2400, () => {
      if (this.scene && typeof this.scene.onBossDefeated === 'function') {
        this.scene.onBossDefeated(this);
      }
    });
  }
}
