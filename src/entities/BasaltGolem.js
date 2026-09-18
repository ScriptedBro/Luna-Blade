import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { juice } from '../engine/JuiceEffects.js';
import EnemyHealthBar from '../ui/EnemyHealthBar.js';

export default class BasaltGolem extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'basalt_golem_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(44, 48);
    this.body.setOffset(23, 16);
    this.setScale(1.15);
    this.setDepth(19);

    this.mobType = 'basalt_golem';
    this.hp = (GAME_CONFIG.MOBS.BASALT_GOLEM && GAME_CONFIG.MOBS.BASALT_GOLEM.HP) || 90;
    this.maxHp = this.hp;
    this.state = 'PATROL'; // PATROL, SLAM, RECOVER, STUNNED, DEAD
    this.patrolDir = -1;

    this.attackCooldownUntil = 0;
    this.stateTimer = 0;

    this.healthBar = new EnemyHealthBar(scene, this, 38, 4, -30);
    this.play('basalt_golem_idle_anim', true);
  }

  update(player) {
    if (this.state === 'DEAD' || !player || player.isDead) return;

    if (this.healthBar) {
      this.healthBar.update(this.hp, this.maxHp);
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
    const dy = Math.abs(player.y - this.y);
    const now = this.scene.time.now;

    if (this.state === 'STUNNED') {
      if (now > this.stateTimer) {
        this.state = 'PATROL';
        this.clearTint();
        this.play('basalt_golem_idle_anim', true);
      }
      return;
    }

    if (this.state === 'SLAM') {
      this.setVelocityX(0);
      if (now > this.stateTimer) {
        this.state = 'PATROL';
        this.play('basalt_golem_idle_anim', true);
      }
      return;
    }

    const dirToPlayer = player.x < this.x ? -1 : 1;
    this.setFlipX(dirToPlayer > 0);

    // Ground Seismic Slam Attack
    if (dist < 80 && dy < 40 && now > this.attackCooldownUntil && this.body.blocked.down) {
      this.performSlam(player);
      return;
    }

    // Heavy Stride Patrol
    const speed = (GAME_CONFIG.MOBS.BASALT_GOLEM && GAME_CONFIG.MOBS.BASALT_GOLEM.WALK_SPEED) || 32;
    if (dist < 200) {
      this.setVelocityX(dirToPlayer * speed);
    } else {
      this.setVelocityX(this.patrolDir * speed);
      if (this.body.blocked.left) this.patrolDir = 1;
      if (this.body.blocked.right) this.patrolDir = -1;
    }
  }

  performSlam(player) {
    this.state = 'SLAM';
    this.attackCooldownUntil = this.scene.time.now + 3200;
    this.stateTimer = this.scene.time.now + 1100;
    this.setVelocityX(0);
    this.play('basalt_golem_attack_anim', true);

    // Slam hits at frame 7 (~650ms)
    this.scene.time.delayedCall(650, () => {
      if (this.state === 'DEAD' || !this.scene) return;
      juice.screenShake(this.scene, 12, 200);
      sound.playBossStomp();
      juice.spawnFloatingText(this.scene, this.x, this.y - 35, 'SEISMIC SLAM! 🌋', '#f97316');

      // Shockwave impact against player
      if (player && !player.isDead) {
        const d = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        if (d < 95 && Math.abs(player.y - this.y) < 35) {
          const knockDir = this.x < player.x ? 1 : -1;
          player.takeDamage((GAME_CONFIG.MOBS.BASALT_GOLEM && GAME_CONFIG.MOBS.BASALT_GOLEM.DAMAGE) || 26, knockDir);
        }
      }
    });
  }

  takeDamage(amount, sourceX) {
    if (this.state === 'DEAD') return false;

    // Heavy Stone Skin front armor
    const facingLeft = !this.flipX;
    const attackerFromFront = (facingLeft && sourceX < this.x) || (!facingLeft && sourceX > this.x);

    let finalDamage = amount;
    if (attackerFromFront) {
      finalDamage = Math.max(5, Math.round(amount * 0.65));
      juice.spawnFloatingText(this.scene, this.x, this.y - 30, 'STONE ARMOR! 🪨', '#fdba74');
    } else {
      finalDamage = Math.round(amount * 1.5);
      juice.spawnFloatingText(this.scene, this.x, this.y - 30, 'CRYSTAL FRACTURE! 💥', '#f59e0b');
    }

    this.hp -= finalDamage;
    sound.playHit();
    juice.flashWhite(this, 90);
    juice.spawnDamageNumber(this.scene, this.x, this.y - 25, finalDamage, !attackerFromFront);
    juice.hitStop(this.scene, !attackerFromFront ? 45 : 25);

    if (this.hp <= 0) {
      this.die();
      return true;
    }

    // Heavy resist knockback
    this.state = 'STUNNED';
    this.stateTimer = this.scene.time.now + 300;
    const knockDir = sourceX < this.x ? 1 : -1;
    this.setVelocity(knockDir * 40, -40);

    return true;
  }

  die() {
    this.state = 'DEAD';
    this.body.enable = false;
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    juice.spawnDeathParticles(this.scene, this.x, this.y, 0xf97316);
    sound.playMonsterDeath();

    this.scene.tweens.add({
      targets: this,
      scaleY: 0.2,
      scaleX: 1.4,
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.destroy();
      }
    });
  }
}
