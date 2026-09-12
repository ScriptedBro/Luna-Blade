import Phaser from 'phaser';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';

export default class Crate extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'crate');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Bounding box for 16x16 crate
    this.body.setSize(16, 16);
    this.body.setOffset(0, 0);
    this.body.setImmovable(true);
    this.body.setAllowGravity(false);
    this.setDepth(18);

    this.isBroken = false;
  }

  breakCrate(player) {
    if (this.isBroken) return;
    this.isBroken = true;
    this.body.setEnable(false);
    sound.playHit();

    // Spawn material drop
    this.spawnDrop(player);

    // Destruction debris effect
    for (let i = 0; i < 5; i++) {
      const splinter = this.scene.add.rectangle(this.x, this.y, 4, 3, 0x8b5a2b);
      this.scene.physics.add.existing(splinter);
      splinter.body.setVelocity((Math.random() - 0.5) * 140, -100 - Math.random() * 80);
      this.scene.tweens.add({
        targets: splinter,
        alpha: 0,
        duration: 300,
        onComplete: () => splinter.destroy()
      });
    }

    this.destroy();
  }

  spawnDrop(player) {
    const r = Math.random();
    let dropType = 'bark';
    let color = '#8b5a2b';
    let label = '+1 Forest Bark';

    if (player && player.health < player.maxHealth && Math.random() < 0.35) {
      dropType = 'heart';
      color = '#ff3333';
      label = '+1 Heart ❤️';
      player.heal(1);
    } else if (r < 0.45) {
      dropType = 'bark';
      storage.addMaterials({ bark: 1 });
    } else if (r < 0.75) {
      dropType = 'amber';
      color = '#ffaa00';
      label = '+1 Amber 🍯';
      storage.addMaterials({ amber: 1 });
    } else {
      dropType = 'iron';
      color = '#a0a0b0';
      label = '+1 Iron Ore ⚙️';
      storage.addMaterials({ iron: 1 });
    }

    sound.playCoin();

    // Floating text label
    const dropText = this.scene.add.text(this.x, this.y - 12, label, {
      fontFamily: 'Press Start 2P',
      fontSize: '7px',
      color: color,
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.scene.tweens.add({
      targets: dropText,
      y: this.y - 28,
      alpha: 0,
      duration: 700,
      onComplete: () => dropText.destroy()
    });
  }
}
