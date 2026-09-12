import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Loading Bar
    const progressBox = this.add.rectangle(width / 2, height / 2, 200, 16, 0x142214);
    progressBox.setStrokeStyle(2, 0x284428);
    const progressBar = this.add.rectangle(width / 2 - 96, height / 2, 0, 10, 0x98ff20);
    progressBar.setOrigin(0, 0.5);

    const loadingText = this.add.text(width / 2, height / 2 - 20, 'GATHERING FORESTS...', {
      fontFamily: 'Press Start 2P',
      fontSize: '8px',
      color: '#d0f0c0'
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      progressBar.width = 192 * value;
    });

    this.load.on('complete', () => {
      progressBox.destroy();
      progressBar.destroy();
      loadingText.destroy();
    });

    // Character Spritesheets (Normalized to 96x80 with feet resting on uniform baseline y=74)
    this.load.spritesheet('char_idle', 'assets/character/idle.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_run', 'assets/character/run.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_attack', 'assets/character/attack.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_jump_start', 'assets/character/jump_start.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_jump_end', 'assets/character/jump_end.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_jump_all', 'assets/character/jump_all.png', { frameWidth: 96, frameHeight: 80 });
    this.load.spritesheet('char_dead', 'assets/character/dead.png', { frameWidth: 96, frameHeight: 80 });

    // Boar Spritesheets
    this.load.spritesheet('boar_idle', 'assets/mobs/boar/idle.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('boar_walk', 'assets/mobs/boar/walk.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('boar_run', 'assets/mobs/boar/run.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('boar_hit', 'assets/mobs/boar/hit.png', { frameWidth: 48, frameHeight: 32 });

    // Snail Spritesheets
    this.load.spritesheet('snail_walk', 'assets/mobs/snail/walk.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('snail_hide', 'assets/mobs/snail/hide.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('snail_dead', 'assets/mobs/snail/dead.png', { frameWidth: 48, frameHeight: 32 });

    // Bee Spritesheets
    this.load.spritesheet('bee_fly', 'assets/mobs/bee/fly.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('bee_attack', 'assets/mobs/bee/attack.png', { frameWidth: 64, frameHeight: 64 });
    this.load.spritesheet('bee_hit', 'assets/mobs/bee/hit.png', { frameWidth: 64, frameHeight: 64 });

    // Environment & Parallax High Forest Layers
    this.load.image('env_bg', 'assets/env/forest_backdrop.png');
    this.load.image('sky_backdrop', 'assets/env/sky_backdrop.png');
    this.load.image('sky_mountains', 'assets/env/sky_mountains.png');
    this.load.image('forest_bg_p0', 'assets/env/forest_bg_p0.png');
    this.load.image('forest_bg_p1', 'assets/env/forest_bg_p1.png');
    this.load.image('forest_bg_p2', 'assets/env/forest_bg_p2.png');
    this.load.image('forest_bg_p3', 'assets/env/forest_bg_p3.png');
    this.load.image('pine_green', 'assets/env/pine_green.png');
    this.load.image('pine_golden', 'assets/env/pine_golden.png');
    this.load.image('pine_dark', 'assets/env/pine_dark.png');
    this.load.image('bush_green', 'assets/env/bush_green.png');
    this.load.image('bush_golden', 'assets/env/bush_golden.png');
    this.load.image('bush_dark', 'assets/env/bush_dark.png');
    this.load.image('boulders', 'assets/env/boulders.png');
    this.load.image('cliff_block', 'assets/env/cliff_block_80x48.png');
    this.load.image('tile_cliff_top_left', 'assets/env/tile_cliff_top_left.png');
    this.load.image('tile_cliff_top_mid1', 'assets/env/tile_cliff_top_mid1.png');
    this.load.image('tile_cliff_top_mid2', 'assets/env/tile_cliff_top_mid2.png');
    this.load.image('tile_cliff_top_right', 'assets/env/tile_cliff_top_right.png');
    this.load.image('tile_cliff_body_left', 'assets/env/tile_cliff_body_left.png');
    this.load.image('tile_cliff_body_mid', 'assets/env/tile_cliff_body_mid.png');
    this.load.image('tile_cliff_body_right', 'assets/env/tile_cliff_body_right.png');
    this.load.image('plat_wood', 'assets/env/plat_wood.png');
    this.load.image('plat_stone', 'assets/env/plat_stone.png');
    this.load.image('plat_branch', 'assets/env/plat_branch.png');
    this.load.image('bridge', 'assets/env/bridge.png');
    this.load.image('water_surface', 'assets/env/water_surface.png');
    this.load.image('water_deep', 'assets/env/water_deep.png');
    this.load.image('prop_shroom_big', 'assets/env/prop_shroom_big.png');
    this.load.image('prop_shroom_small', 'assets/env/prop_shroom_small.png');
    this.load.image('prop_flower_blue', 'assets/env/prop_flower_blue.png');
    this.load.image('prop_flower_purple', 'assets/env/prop_flower_purple.png');
    this.load.image('prop_reeds', 'assets/env/prop_reeds.png');
    this.load.image('prop_fern', 'assets/env/prop_fern.png');
    this.load.image('crate', 'assets/env/crate.png');
    this.load.image('spark', 'assets/env/spark.png');
    this.load.image('hud_base', 'assets/hud/hud_base.png');
    this.load.image('env_hive', 'assets/env/hive.png');
  }

  create() {
    this.createAnimations();

    const urlParams = new URLSearchParams(window.location.search);
    const targetScene = urlParams.get('scene');
    if (targetScene === 'story') {
      const ch = parseInt(urlParams.get('chapter') || '1', 10);
      this.scene.start('StoryScene', { chapter: ch });
    } else if (targetScene === 'survival') {
      this.scene.start('SurvivalScene');
    } else if (targetScene === 'forge') {
      this.scene.start('ForgeScene');
    } else if (targetScene === 'leaderboard') {
      this.scene.start('LeaderboardScene');
    } else {
      this.scene.start('MenuScene');
    }
  }

  createAnimations() {
    // Player Anims
    this.anims.create({
      key: 'player_idle',
      frames: this.anims.generateFrameNumbers('char_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'player_run',
      frames: this.anims.generateFrameNumbers('char_run', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1
    });

    // Combo 1 is first 4 frames (0..3)
    this.anims.create({
      key: 'player_attack_combo1',
      frames: this.anims.generateFrameNumbers('char_attack', { start: 0, end: 3 }),
      frameRate: 16,
      repeat: 0
    });

    // Combo 2 is next 4 frames (4..7)
    this.anims.create({
      key: 'player_attack_combo2',
      frames: this.anims.generateFrameNumbers('char_attack', { start: 4, end: 7 }),
      frameRate: 16,
      repeat: 0
    });

    this.anims.create({
      key: 'player_jump_start',
      frames: this.anims.generateFrameNumbers('char_jump_start', { start: 0, end: 3 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'player_jump_end',
      frames: this.anims.generateFrameNumbers('char_jump_end', { start: 0, end: 2 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'player_jump_all',
      frames: this.anims.generateFrameNumbers('char_jump_all', { start: 0, end: 14 }),
      frameRate: 15,
      repeat: 0
    });

    this.anims.create({
      key: 'player_dead',
      frames: this.anims.generateFrameNumbers('char_dead', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: 0
    });

    // Boar Anims
    this.anims.create({
      key: 'boar_idle_anim',
      frames: this.anims.generateFrameNumbers('boar_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'boar_walk_anim',
      frames: this.anims.generateFrameNumbers('boar_walk', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'boar_run_anim',
      frames: this.anims.generateFrameNumbers('boar_run', { start: 0, end: 5 }),
      frameRate: 14,
      repeat: -1
    });

    this.anims.create({
      key: 'boar_hit_anim',
      frames: this.anims.generateFrameNumbers('boar_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    // Snail Anims
    this.anims.create({
      key: 'snail_walk_anim',
      frames: this.anims.generateFrameNumbers('snail_walk', { start: 0, end: 7 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'snail_hide_anim',
      frames: this.anims.generateFrameNumbers('snail_hide', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'snail_dead_anim',
      frames: this.anims.generateFrameNumbers('snail_dead', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    // Bee Anims
    this.anims.create({
      key: 'bee_fly_anim',
      frames: this.anims.generateFrameNumbers('bee_fly', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'bee_attack_anim',
      frames: this.anims.generateFrameNumbers('bee_attack', { start: 0, end: 3 }),
      frameRate: 12,
      repeat: -1
    });

    this.anims.create({
      key: 'bee_hit_anim',
      frames: this.anims.generateFrameNumbers('bee_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });
  }
}
