import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';

export default class Goblin extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'goblin_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Frame 150x150. Body is 30x36 at (59, 65)
    this.body.setSize(30, 36);
    this.body.setOffset(59, 65);
    this.setDepth(19);

    this.mobType = 'goblin';
    this.hp = GAME_CONFIG.MOBS.GOBLIN.HP;
    this.maxHp = GAME_CONFIG.MOBS.GOBLIN.HP;
    this.state = 'PATROL'; // PATROL, ATTACK, STUNNED, DEAD
    this.patrolDir = -1;
    this.setFlipX(true); // LuizMelo faces right by default; flipX=true faces left

    this.attackCooldownUntil = 0;
    this.stunnedUntil = 0;

    this.play('goblin_run_anim');
  }

  update(player) {
    if (this.state === 'DEAD') return;

    const hitWall = this.body.blocked.left || this.body.blocked.right;

    if (this.state === 'STUNNED') {
      if (this.scene.time.now > this.stunnedUntil) {
        this.state = 'PATROL';
        this.play('goblin_run_anim', true);
      }
      return;
    }

    if (this.state === 'ATTACK') {
      this.setVelocityX(0);
      return;
    }

    if (hitWall) {
      this.patrolDir *= -1;
    }

    this.setVelocityX(this.patrolDir * GAME_CONFIG.MOBS.GOBLIN.WALK_SPEED);
    this.setFlipX(this.patrolDir < 0);

    // Check player for bomb toss
    if (player && !player.isDead && this.scene.time.now > this.attackCooldownUntil) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const dy = Math.abs(this.y - player.y);
      const dx = player.x - this.x;
      const isFacing = (this.patrolDir < 0 && dx < 0) || (this.patrolDir > 0 && dx > 0);

      if (dist < 240 && dy < 60 && isFacing) {
        this.startAttack(player);
      }
    }
  }

  startAttack(player) {
    this.state = 'ATTACK';
    this.setVelocityX(0);
    this.attackCooldownUntil = this.scene.time.now + 3200;

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    this.play('goblin_attack_anim', true);

    // Throw bomb at frame 4 (approx 350ms)
    this.scene.time.delayedCall(350, () => {
      if (this.state === 'DEAD' || !this.scene) return;
      this.tossBomb(dir, player);
    });

    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.state !== 'DEAD') {
        this.state = 'PATROL';
        this.play('goblin_run_anim', true);
      }
    });
  }

  tossBomb(dir, player) {
    sound.playSlash(1);
    const spawnX = this.x + (dir * 20);
    const spawnY = this.y - 6;

    const throwPower = Phaser.Math.Clamp(Math.abs(player.x - this.x) * 1.1, 90, 180);
    const vx = dir * throwPower;
    const vy = -180;

    if (typeof this.scene.spawnProjectile === 'function') {
      this.scene.spawnProjectile('goblin_bomb', spawnX, spawnY, vx, vy);
    }
  }

  takeDamage(amount, attackFromX, isUpwardSlash = false) {
    if (this.state === 'DEAD') return false;

    this.hp -= amount;
    sound.playHit();

    // Damage popup text
    const dmgText = this.scene.add.text(this.x, this.y - 18, `-${amount}`, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#ffffff',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: dmgText,
      y: this.y - 32,
      alpha: 0,
      duration: 500,
      onComplete: () => dmgText.destroy()
    });

    // Knockback
    const knockDir = attackFromX < this.x ? 1 : -1;
    this.setVelocityX(knockDir * 130);
    this.setVelocityY(-90);

    if (this.hp <= 0) {
      this.die();
      return { killed: true, pts: GAME_CONFIG.MOBS.GOBLIN.PTS };
    } else {
      this.state = 'STUNNED';
      this.stunnedUntil = this.scene.time.now + 260;
      this.play('goblin_hit_anim', true);
      this.setTint(0xff5555);
      this.scene.time.delayedCall(120, () => this.clearTint());
      return { killed: false, pts: 0 };
    }
  }

  die() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();
    this.play('goblin_dead_anim', true);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 10,
      duration: 450,
      onComplete: () => this.destroy()
    });
  }
}
