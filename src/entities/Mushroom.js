import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';

export default class Mushroom extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'mushroom_idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Frame is 150x150. Sprite center is ~75, body is 24x38 at (63, 63)
    this.body.setSize(24, 38);
    this.body.setOffset(63, 63);
    this.setDepth(19);

    this.mobType = 'mushroom';
    this.hp = GAME_CONFIG.MOBS.MUSHROOM.HP;
    this.maxHp = GAME_CONFIG.MOBS.MUSHROOM.HP;
    this.state = 'PATROL'; // PATROL, ATTACK, STUNNED, DEAD
    this.patrolDir = -1; // -1 = left, 1 = right
    this.setFlipX(true); // LuizMelo sprites face right by default. flipX=true faces left

    this.attackCooldownUntil = 0;
    this.stunnedUntil = 0;

    this.play('mushroom_run_anim');
  }

  update(player) {
    if (this.state === 'DEAD') return;

    const hitWall = this.body.blocked.left || this.body.blocked.right;

    if (this.state === 'STUNNED') {
      if (this.scene.time.now > this.stunnedUntil) {
        this.state = 'PATROL';
        this.play('mushroom_run_anim', true);
      }
      return;
    }

    if (this.state === 'ATTACK') {
      this.setVelocityX(0);
      return;
    }

    // Default: PATROL with ledge check
    if (hitWall || this.isLedgeAhead(this.patrolDir)) {
      this.patrolDir *= -1;
    }

    this.setVelocityX(this.patrolDir * GAME_CONFIG.MOBS.MUSHROOM.WALK_SPEED);
    this.setFlipX(this.patrolDir < 0);

    // Check player for ranged toxic spore attack (360-degree proximity)
    if (player && !player.isDead && this.scene.time.now > this.attackCooldownUntil) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const dy = Math.abs(this.y - player.y);

      if (dist < 220 && dy < 80) {
        this.startAttack(player);
      }
    }
  }

  isLedgeAhead(dir) {
    if (!this.body.blocked.down || !this.scene.platforms) return false;
    const lookX = this.x + (dir * (this.body.width / 2 + 8));
    const footY = this.body.bottom + 6;

    const hasGround = this.scene.platforms.getChildren().some(plat => {
      const pb = plat.body;
      if (!pb) return false;
      return lookX >= pb.left && lookX <= pb.right && footY >= pb.top && footY <= pb.bottom + 14;
    });

    return !hasGround;
  }

  startAttack(player) {
    this.state = 'ATTACK';
    this.setVelocityX(0);
    this.attackCooldownUntil = this.scene.time.now + 2800;

    const dir = player.x < this.x ? -1 : 1;
    this.setFlipX(dir < 0);

    this.play('mushroom_attack_anim', true);

    // Fire spore on windup completion
    this.scene.time.delayedCall(400, () => {
      if (this.state === 'DEAD' || !this.scene) return;
      this.fireSpore(dir);
    });

    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (this.state !== 'DEAD') {
        this.state = 'PATROL';
        this.play('mushroom_run_anim', true);
      }
    });
  }

  fireSpore(dir) {
    sound.playSlash(1);
    const spawnX = this.x + (dir * 18);
    const spawnY = this.y - 4;

    if (this.scene && typeof this.scene.spawnProjectile === 'function') {
      this.scene.spawnProjectile('spore', spawnX, spawnY, dir * GAME_CONFIG.MOBS.MUSHROOM.SPORE_SPEED, 0);
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
    this.setVelocityX(knockDir * 110);
    this.setVelocityY(-90);

    if (this.hp <= 0) {
      this.die();
      return { killed: true, pts: GAME_CONFIG.MOBS.MUSHROOM.PTS };
    } else {
      this.state = 'STUNNED';
      this.stunnedUntil = this.scene.time.now + 280;
      this.play('mushroom_hit_anim', true);
      this.setTint(0xff5555);
      this.scene.time.delayedCall(120, () => this.clearTint());
      return { killed: false, pts: 0 };
    }
  }

  die() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();
    this.play('mushroom_dead_anim', true);

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 12,
      duration: 450,
      onComplete: () => this.destroy()
    });
  }
}
