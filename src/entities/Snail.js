import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';

export default class Snail extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'snail_walk');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Snail frame is 48x32. Collider:
    this.body.setSize(24, 18);
    this.body.setOffset(12, 14);
    this.setDepth(19);

    this.mobType = 'snail';
    this.hp = GAME_CONFIG.MOBS.SNAIL.HP;
    this.state = 'WALK'; // WALK, SHELLED, SLIDING, DEAD
    this.patrolDir = -1;
    this.bounceCount = 0;
    this.maxBounces = 3;
    this.shellSlideSpeed = GAME_CONFIG.MOBS.SNAIL.SHELL_SPEED;

    this.play('snail_walk_anim');
  }

  update() {
    if (this.state === 'DEAD') return;

    const hitWall = this.body.blocked.left || this.body.blocked.right;

    if (this.state === 'WALK') {
      if (hitWall) {
        this.patrolDir *= -1;
      }
      this.setVelocityX(this.patrolDir * GAME_CONFIG.MOBS.SNAIL.WALK_SPEED);
      this.setFlipX(this.patrolDir > 0);
    } else if (this.state === 'SHELLED') {
      this.setVelocityX(0);
    } else if (this.state === 'SLIDING') {
      if (hitWall) {
        this.bounceCount++;
        sound.playRicochet();
        this.scene.cameras.main.shake(60, 0.006);

        if (this.bounceCount >= this.maxBounces) {
          this.shatter();
          return;
        }
      }

      // Maintain high slide speed in current direction
      const currentDir = this.body.velocity.x >= 0 ? 1 : -1;
      this.setVelocityX(currentDir * this.shellSlideSpeed);
      this.setAngle(this.angle + (currentDir * 18)); // Shell spinning
    }
  }

  takeDamage(amount, attackFromX, isUpwardSlash = false) {
    if (this.state === 'DEAD') return false;

    if (this.state === 'WALK') {
      // Normal attack damages and curls into shell
      this.hp -= amount;
      sound.playHit();

      if (this.hp <= 0) {
        this.enterShelled();
        return { killed: false, pts: 0, shelled: true };
      } else {
        this.enterShelled();
        return { killed: false, pts: 0, shelled: true };
      }
    } else if (this.state === 'SHELLED' || this.state === 'SLIDING') {
      // Kick / Launch the shell into high speed projectile!
      const kickDir = attackFromX < this.x ? 1 : -1;
      this.kickShell(kickDir);
      return { killed: false, pts: 0, kicked: true };
    }
  }

  enterShelled() {
    this.state = 'SHELLED';
    this.setVelocity(0, 0);
    sound.playHit();
    this.play('snail_hide_anim');

    // Pop up "SHELLED! KICK IT!" prompt
    const tipText = this.scene.add.text(this.x, this.y - 18, 'SHELL READY!', {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: '#98ff20',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: tipText,
      y: this.y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => tipText.destroy()
    });
  }

  kickShell(dir) {
    this.state = 'SLIDING';
    this.bounceCount = 0;
    this.body.setBounce(1, 0);
    this.setVelocityX(dir * this.shellSlideSpeed);
    sound.playShellKick();

    // Speed particles
    const kickText = this.scene.add.text(this.x, this.y - 18, 'SHELL KICK!', {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#f6c026',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: kickText,
      y: this.y - 32,
      alpha: 0,
      duration: 500,
      onComplete: () => kickText.destroy()
    });
  }

  shatter() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();

    // Spawn shell fragments
    for (let i = 0; i < 4; i++) {
      const frag = this.scene.add.rectangle(this.x, this.y, 4, 4, 0x8a6f4d);
      this.scene.physics.add.existing(frag);
      frag.body.setVelocity((Math.random() - 0.5) * 150, -100 - Math.random() * 80);
      this.scene.tweens.add({
        targets: frag,
        alpha: 0,
        duration: 350,
        onComplete: () => frag.destroy()
      });
    }

    this.destroy();
  }

  die() {
    this.state = 'DEAD';
    this.body.setEnable(false);
    sound.playEnemyDeath();
    this.play('snail_dead_anim');

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      y: this.y - 8,
      duration: 350,
      onComplete: () => this.destroy()
    });
  }
}
