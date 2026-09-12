import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';

export default class Bee extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bee_fly');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Bee frame is 64x64. Collider:
    this.body.setSize(20, 20);
    this.body.setOffset(22, 22);
    this.body.setAllowGravity(false);
    this.setDepth(19);

    this.mobType = 'bee';
    this.hp = GAME_CONFIG.MOBS.BEE.HP;
    this.state = 'HOVER'; // HOVER, SWOOP, RECOVER, DEAD
    this.originY = y;
    this.patrolDir = -1;
    this.swoopCooldownUntil = 0;
    this.swoopTargetX = 0;
    this.swoopTargetY = 0;

    this.play('bee_fly_anim');
  }

  update(player) {
    if (this.state === 'DEAD') return;

    if (this.state === 'HOVER') {
      // Sinusoidal bobbing & gentle horizontal drift
      this.setVelocityX(this.patrolDir * GAME_CONFIG.MOBS.BEE.HOVER_SPEED);
      this.setFlipX(this.patrolDir > 0);

      const wave = Math.sin(this.scene.time.now * 0.005) * 25;
      this.y = this.originY + wave;

      // Reverse horizontal direction at boundaries or periodically
      if (this.body.blocked.left) this.patrolDir = 1;
      if (this.body.blocked.right) this.patrolDir = -1;

      // Check for swoop opportunity
      if (player && !player.isDead && this.scene.time.now > this.swoopCooldownUntil) {
        const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
        const playerBelow = player.y > this.y + 20;

        if (dist < 180 && playerBelow) {
          this.startSwoop(player);
        }
      }
    } else if (this.state === 'SWOOP') {
      // Steer downwards toward targeted player position
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.swoopTargetX, this.swoopTargetY);
      this.scene.physics.velocityFromRotation(angle, GAME_CONFIG.MOBS.BEE.SWOOP_SPEED, this.body.velocity);
      this.setFlipX(this.body.velocity.x > 0);

      // Check if reached swoop depth or ground
      if (this.y >= this.swoopTargetY - 10 || this.body.blocked.down) {
        this.recover();
      }
    } else if (this.state === 'RECOVER') {
      // Ascend back to origin height
      this.setVelocityY(-80);
      this.setVelocityX(this.patrolDir * 40);

      if (this.y <= this.originY) {
        this.state = 'HOVER';
        this.swoopCooldownUntil = this.scene.time.now + 2800;
        this.play('bee_fly_anim', true);
      }
    }
  }

  startSwoop(player) {
    this.state = 'SWOOP';
    this.swoopTargetX = player.x;
    this.swoopTargetY = player.y;
    this.play('bee_attack_anim', true);

    // Visual telegraph arrow / warning
    const warn = this.scene.add.text(this.x, this.y - 14, 'SWOOP!', {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#ffcc00'
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: warn,
      alpha: 0,
      duration: 350,
      onComplete: () => warn.destroy()
    });
  }

  recover() {
    this.state = 'RECOVER';
    this.play('bee_fly_anim', true);
  }

  takeDamage(amount, attackFromX, isUpwardSlash = false) {
    if (this.state === 'DEAD') return false;

    let finalDamage = amount;
    let isCounter = false;

    // Upward slash counter mechanic
    if (isUpwardSlash || this.state === 'SWOOP') {
      finalDamage = Math.round(amount * 2.5);
      isCounter = true;
    }

    this.hp -= finalDamage;
    sound.playHit();

    // Damage / Counter popup
    const popupText = isCounter ? `AERIAL COUNTER! -${finalDamage}` : `-${finalDamage}`;
    const dmgText = this.scene.add.text(this.x, this.y - 12, popupText, {
      fontFamily: 'Press Start 2P',
      fontSize: isCounter ? '8px' : '7px',
      color: isCounter ? '#ffea00' : '#ffffff',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: dmgText,
      y: this.y - 26,
      alpha: 0,
      duration: 500,
      onComplete: () => dmgText.destroy()
    });

    if (this.hp <= 0) {
      this.die();
      return { killed: true, pts: GAME_CONFIG.MOBS.BEE.PTS, isCounter };
    } else {
      this.recover();
      return { killed: false, pts: 0, isCounter };
    }
  }

  die() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();
    this.play('bee_hit_anim');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y + 16,
      duration: 350,
      onComplete: () => this.destroy()
    });
  }
}
