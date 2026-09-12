import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';

export default class Boar extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'boar_walk');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Boar frame is 48x32. Collider size:
    this.body.setSize(32, 22);
    this.body.setOffset(8, 10);
    this.setDepth(19);

    this.mobType = 'boar';
    this.hp = GAME_CONFIG.MOBS.BOAR.HP;
    this.maxHp = GAME_CONFIG.MOBS.BOAR.HP;
    this.state = 'PATROL'; // PATROL, ALERT, CHARGE, STUNNED, DEAD
    this.patrolDir = -1; // -1 = left, 1 = right
    this.setFlipX(false); // Default facing left

    this.chargeCooldownUntil = 0;
    this.alertTimer = 0;
    this.stunnedUntil = 0;

    this.play('boar_walk_anim');
  }

  update(player) {
    if (this.state === 'DEAD') return;

    const onGround = this.body.blocked.down;
    const hitWall = this.body.blocked.left || this.body.blocked.right;

    if (this.state === 'STUNNED') {
      if (this.scene.time.now > this.stunnedUntil) {
        this.state = 'PATROL';
        this.play('boar_walk_anim', true);
      }
      return;
    }

    if (this.state === 'ALERT') {
      this.setVelocityX(0);
      if (this.scene.time.now > this.alertTimer) {
        this.startCharge(player);
      }
      return;
    }

    if (this.state === 'CHARGE') {
      this.setVelocityX(this.chargeDir * GAME_CONFIG.MOBS.BOAR.CHARGE_SPEED);
      this.setFlipX(this.chargeDir > 0);

      if (hitWall) {
        // Wall crash stun
        this.state = 'STUNNED';
        this.stunnedUntil = this.scene.time.now + 900;
        this.setVelocityX(0);
        this.play('boar_idle_anim', true);
        sound.playHit();
        this.scene.cameras.main.shake(80, 0.008);
      }
      return;
    }

    // Default: PATROL
    if (hitWall) {
      this.patrolDir *= -1;
    }

    this.setVelocityX(this.patrolDir * GAME_CONFIG.MOBS.BOAR.WALK_SPEED);
    this.setFlipX(this.patrolDir > 0);

    // Player detection for charge
    if (player && !player.isDead && this.scene.time.now > this.chargeCooldownUntil) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
      const dy = Math.abs(this.y - player.y);
      const dx = player.x - this.x;
      const isFacingPlayer = (this.patrolDir < 0 && dx < 0) || (this.patrolDir > 0 && dx > 0);

      if (dist < 170 && dy < 40 && isFacingPlayer) {
        this.triggerAlert(player);
      }
    }
  }

  triggerAlert(player) {
    this.state = 'ALERT';
    this.alertTimer = this.scene.time.now + 450;
    this.play('boar_idle_anim', true);

    // Alert emote / dust puff
    const alertMark = this.scene.add.text(this.x, this.y - 18, '!', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#ff3333'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: alertMark,
      y: this.y - 28,
      alpha: 0,
      duration: 400,
      onComplete: () => alertMark.destroy()
    });
  }

  startCharge(player) {
    this.state = 'CHARGE';
    this.chargeDir = player.x < this.x ? -1 : 1;
    this.chargeCooldownUntil = this.scene.time.now + 3500;
    this.play('boar_run_anim', true);

    // Charge audio
    sound.playSlash(2);
  }

  takeDamage(amount, attackFromX, isUpwardSlash = false) {
    if (this.state === 'DEAD') return false;

    // Back-slash detection:
    // Boar is facing left (flipX false, dir < 0) -> back is to the RIGHT (attackFromX > this.x)
    // Boar is facing right (flipX true, dir > 0) -> back is to the LEFT (attackFromX < this.x)
    const boarFacingRight = this.flipX;
    const attackerBehind = boarFacingRight ? (attackFromX < this.x) : (attackFromX > this.x);

    let finalDamage = amount;
    let isBackstab = false;

    if (attackerBehind) {
      finalDamage = Math.round(amount * GAME_CONFIG.MOBS.BOAR.BACKSTAB_MULTIPLIER);
      isBackstab = true;
    }

    this.hp -= finalDamage;
    sound.playHit();

    // Damage popup text
    const color = isBackstab ? '#ffd700' : '#ffffff';
    const textMsg = isBackstab ? `CRIT -${finalDamage}!` : `-${finalDamage}`;
    const dmgText = this.scene.add.text(this.x, this.y - 14, textMsg, {
      fontFamily: 'Press Start 2P',
      fontSize: isBackstab ? '9px' : '7px',
      color: color,
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: dmgText,
      y: this.y - 28,
      alpha: 0,
      duration: 500,
      onComplete: () => dmgText.destroy()
    });

    // Knockback
    const knockDir = attackFromX < this.x ? 1 : -1;
    this.setVelocityX(knockDir * 120);
    this.setVelocityY(-100);

    if (this.hp <= 0) {
      this.die();
      return { killed: true, pts: GAME_CONFIG.MOBS.BOAR.PTS, isBackstab };
    } else {
      // Flash red
      this.setTint(0xff3333);
      this.scene.time.delayedCall(120, () => this.clearTint());
      return { killed: false, pts: 0, isBackstab };
    }
  }

  die() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();
    this.play('boar_hit_anim');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 10,
      duration: 350,
      onComplete: () => this.destroy()
    });
  }
}
