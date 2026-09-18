import Phaser from 'phaser';
import LunaCrystalDrop from '../entities/LunaCrystalDrop.js';


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
      const barEl = document.getElementById('loader-bar-fill');
      const statusEl = document.getElementById('loader-status-text');
      if (barEl) barEl.style.width = Math.max(14, Math.floor(value * 100)) + '%';
      if (statusEl) {
        if (value < 0.3) statusEl.textContent = '🌲 GATHERING HIGH FORESTS...';
        else if (value < 0.6) statusEl.textContent = '⚔️ FORGING CELESTIAL BLADES...';
        else if (value < 0.85) statusEl.textContent = '✨ SUMMONING SYLVA SPRITE...';
        else statusEl.textContent = '🌙 ENTERING REALM...';
      }
    });

    this.load.on('complete', () => {
      progressBox.destroy();
      progressBar.destroy();
      loadingText.destroy();
      if (typeof window !== 'undefined' && typeof window.__dismissGameLoader === 'function') {
        window.__dismissGameLoader();
      }
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

    // Boar Chieftain (Boss Gorgok) Spritesheets
    this.load.spritesheet('chieftain_idle', 'assets/mobs/boar_chieftain/idle.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('chieftain_walk', 'assets/mobs/boar_chieftain/walk.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('chieftain_run', 'assets/mobs/boar_chieftain/run.png', { frameWidth: 48, frameHeight: 32 });
    this.load.spritesheet('chieftain_hit', 'assets/mobs/boar_chieftain/hit.png', { frameWidth: 48, frameHeight: 32 });

    // Mushroom Spritesheets
    this.load.spritesheet('mushroom_idle', 'assets/mobs/mushroom/idle.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('mushroom_run', 'assets/mobs/mushroom/run.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('mushroom_attack', 'assets/mobs/mushroom/attack.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('mushroom_hit', 'assets/mobs/mushroom/hit.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('mushroom_dead', 'assets/mobs/mushroom/death.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('mushroom_spore', 'assets/mobs/mushroom/spore.png', { frameWidth: 50, frameHeight: 50 });

    // Flying Eye Spritesheets
    this.load.spritesheet('eye_flight', 'assets/mobs/flying_eye/flight.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('eye_attack', 'assets/mobs/flying_eye/attack.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('eye_hit', 'assets/mobs/flying_eye/hit.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('eye_dead', 'assets/mobs/flying_eye/death.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('eye_projectile', 'assets/mobs/flying_eye/projectile.png', { frameWidth: 48, frameHeight: 48 });

    // Goblin Spritesheets
    this.load.spritesheet('goblin_idle', 'assets/mobs/goblin/idle.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('goblin_run', 'assets/mobs/goblin/run.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('goblin_attack', 'assets/mobs/goblin/attack.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('goblin_hit', 'assets/mobs/goblin/hit.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('goblin_dead', 'assets/mobs/goblin/death.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('goblin_bomb', 'assets/mobs/goblin/bomb.png', { frameWidth: 100, frameHeight: 100 });

    // Evil Wizard (Boss Malakor) Spritesheets
    this.load.spritesheet('wizard_idle', 'assets/mobs/wizard/idle.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('wizard_move', 'assets/mobs/wizard/move.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('wizard_attack', 'assets/mobs/wizard/attack.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('wizard_hit', 'assets/mobs/wizard/hit.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('wizard_dead', 'assets/mobs/wizard/death.png', { frameWidth: 150, frameHeight: 150 });

    // Armored Skeleton Knight (Chapter 3 Boss Vorgath) Spritesheets
    this.load.spritesheet('skeleton_idle', 'assets/mobs/skeleton/Idle.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('skeleton_walk', 'assets/mobs/skeleton/Walk.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('skeleton_attack', 'assets/mobs/skeleton/Attack.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('skeleton_shield', 'assets/mobs/skeleton/Shield.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('skeleton_hit', 'assets/mobs/skeleton/Take Hit.png', { frameWidth: 150, frameHeight: 150 });
    this.load.spritesheet('skeleton_dead', 'assets/mobs/skeleton/Death.png', { frameWidth: 150, frameHeight: 150 });

    // Fire Demon (Chapter 4 Boss Ignis) Spritesheets
    this.load.spritesheet('demon_idle', 'assets/mobs/demon/idle.png', { frameWidth: 79, frameHeight: 69 });
    this.load.spritesheet('demon_flying', 'assets/mobs/demon/flying.png', { frameWidth: 79, frameHeight: 69 });
    this.load.spritesheet('demon_attack', 'assets/mobs/demon/attack.png', { frameWidth: 79, frameHeight: 69 });
    this.load.spritesheet('demon_hit', 'assets/mobs/demon/hit.png', { frameWidth: 79, frameHeight: 69 });
    this.load.spritesheet('demon_dead', 'assets/mobs/demon/death.png', { frameWidth: 79, frameHeight: 69 });
    this.load.image('demon_projectile', 'assets/mobs/demon/projectile.png');

    // NightBorne (Chapter 5 Final Boss Umbra) Spritesheets
    this.load.spritesheet('nightborne_idle', 'assets/mobs/nightborne/idle.png', { frameWidth: 80, frameHeight: 80 });
    this.load.spritesheet('nightborne_run', 'assets/mobs/nightborne/run.png', { frameWidth: 80, frameHeight: 80 });
    this.load.spritesheet('nightborne_attack', 'assets/mobs/nightborne/attack.png', { frameWidth: 80, frameHeight: 80 });
    this.load.spritesheet('nightborne_hit', 'assets/mobs/nightborne/hit.png', { frameWidth: 80, frameHeight: 80 });
    this.load.spritesheet('nightborne_dead', 'assets/mobs/nightborne/death.png', { frameWidth: 80, frameHeight: 80 });

    // Environment & Parallax High Forest Layers
    this.load.image('env_bg', 'assets/env/forest_backdrop.png');
    this.load.image('sky_backdrop', 'assets/env/sky_backdrop.png');
    this.load.image('sky_mountains', 'assets/env/sky_mountains.png');
    this.load.image('forest_bg_p0', 'assets/env/forest_bg_p0.png');
    this.load.image('forest_bg_p1', 'assets/env/forest_bg_p1.png');
    this.load.image('forest_bg_p2', 'assets/env/forest_bg_p2.png');
    this.load.image('forest_bg_p3', 'assets/env/forest_bg_p3.png');
    this.load.image('bg_whispering', 'assets/env/bg_whispering.png');
    this.load.image('bg_hive', 'assets/env/bg_hive.png');
    this.load.image('bg_ruins', 'assets/env/bg_ruins.png');
    this.load.image('bg_caldera', 'assets/env/bg_caldera.png');
    this.load.image('bg_lunar_spire', 'assets/env/bg_lunar_spire.png');
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
    this.load.image('plat_obsidian', 'assets/env/plat_obsidian.png');
    this.load.image('plat_crystal', 'assets/env/plat_crystal.png');
    this.load.image('bridge', 'assets/env/bridge.png');
    this.load.image('water_surface', 'assets/env/water_surface.png');
    this.load.image('water_deep', 'assets/env/water_deep.png');
    this.load.image('lava_surface', 'assets/env/lava_surface.png');
    this.load.image('lava_deep', 'assets/env/lava_deep.png');
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

    // Companion Sprite & Portrait (Sylva, the Moon Sprite)
    this.load.image('fairy_portrait', 'assets/companion/fairy_portrait.png');
    this.load.spritesheet('fairy_fly', 'assets/companion/fairy_fly.png', { frameWidth: 36, frameHeight: 38 });

    // Weapon Skin Icons
    this.load.image('sword_flame', 'assets/weapons/sword_flame.png');
    this.load.image('sword_frost', 'assets/weapons/sword_frost.png');
    this.load.image('sword_verdant', 'assets/weapons/sword_verdant.png');
  }

  create() {
    LunaCrystalDrop.ensureTexture(this);
    this.createAnimations();

    // Ensure Phaser scale dimensions match target orientation before launching scenes
    if (window.viewportManager) {
      const isPortrait = window.viewportManager.detectPortrait();
      const targetH = isPortrait ? 440 : 270;
      if (this.scale.height !== targetH) {
        this.scale.resize(480, targetH);
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const targetScene = urlParams.get('scene');
    if (targetScene === 'story') {
      const ch = parseInt(urlParams.get('chapter') || '1', 10);
      const skipIntroCard = urlParams.get('skipIntro') === 'true';
      this.scene.start('StoryScene', { chapter: ch, skipIntroCard });
    } else if (targetScene === 'survival') {
      this.scene.start('SurvivalScene');
    } else if (targetScene === 'forge') {
      this.scene.start('ForgeScene');
    } else if (targetScene === 'leaderboard') {
      this.scene.start('LeaderboardScene');
    } else if (targetScene === 'prologue' || targetScene === 'intro') {
      this.scene.start('StoryIntroScene');
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

    // Boar Chieftain (Gorgok) Anims
    this.anims.create({
      key: 'chieftain_idle_anim',
      frames: this.anims.generateFrameNumbers('chieftain_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'chieftain_walk_anim',
      frames: this.anims.generateFrameNumbers('chieftain_walk', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'chieftain_run_anim',
      frames: this.anims.generateFrameNumbers('chieftain_run', { start: 0, end: 5 }),
      frameRate: 14,
      repeat: -1
    });

    this.anims.create({
      key: 'chieftain_hit_anim',
      frames: this.anims.generateFrameNumbers('chieftain_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    // Mushroom Monster Anims
    this.anims.create({
      key: 'mushroom_idle_anim',
      frames: this.anims.generateFrameNumbers('mushroom_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'mushroom_run_anim',
      frames: this.anims.generateFrameNumbers('mushroom_run', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'mushroom_attack_anim',
      frames: this.anims.generateFrameNumbers('mushroom_attack', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'mushroom_hit_anim',
      frames: this.anims.generateFrameNumbers('mushroom_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'mushroom_dead_anim',
      frames: this.anims.generateFrameNumbers('mushroom_dead', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: 0
    });

    this.anims.create({
      key: 'mushroom_spore_anim',
      frames: this.anims.generateFrameNumbers('mushroom_spore', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1
    });

    // Flying Eye Anims
    this.anims.create({
      key: 'eye_flight_anim',
      frames: this.anims.generateFrameNumbers('eye_flight', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'eye_attack_anim',
      frames: this.anims.generateFrameNumbers('eye_attack', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'eye_hit_anim',
      frames: this.anims.generateFrameNumbers('eye_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'eye_dead_anim',
      frames: this.anims.generateFrameNumbers('eye_dead', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: 0
    });

    this.anims.create({
      key: 'eye_projectile_anim',
      frames: this.anims.generateFrameNumbers('eye_projectile', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: -1
    });

    // Goblin Raider Anims
    this.anims.create({
      key: 'goblin_idle_anim',
      frames: this.anims.generateFrameNumbers('goblin_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'goblin_run_anim',
      frames: this.anims.generateFrameNumbers('goblin_run', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: -1
    });

    this.anims.create({
      key: 'goblin_attack_anim',
      frames: this.anims.generateFrameNumbers('goblin_attack', { start: 0, end: 7 }),
      frameRate: 12,
      repeat: 0
    });

    this.anims.create({
      key: 'goblin_hit_anim',
      frames: this.anims.generateFrameNumbers('goblin_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'goblin_dead_anim',
      frames: this.anims.generateFrameNumbers('goblin_dead', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: 0
    });

    this.anims.create({
      key: 'goblin_bomb_anim',
      frames: this.anims.generateFrameNumbers('goblin_bomb', { start: 0, end: 18 }),
      frameRate: 14,
      repeat: 0
    });

    // Evil Wizard (Boss Malakor) Anims
    this.anims.create({
      key: 'wizard_idle_anim',
      frames: this.anims.generateFrameNumbers('wizard_idle', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'wizard_move_anim',
      frames: this.anims.generateFrameNumbers('wizard_move', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'wizard_attack_anim',
      frames: this.anims.generateFrameNumbers('wizard_attack', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'wizard_hit_anim',
      frames: this.anims.generateFrameNumbers('wizard_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'wizard_dead_anim',
      frames: this.anims.generateFrameNumbers('wizard_dead', { start: 0, end: 4 }),
      frameRate: 7,
      repeat: 0
    });

    // Companion Fairy Animation
    this.anims.create({
      key: 'fairy_fly_anim',
      frames: this.anims.generateFrameNumbers('fairy_fly', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1
    });

    // Armored Skeleton Knight (Boss Vorgath) Anims
    this.anims.create({
      key: 'skeleton_idle_anim',
      frames: this.anims.generateFrameNumbers('skeleton_idle', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: -1
    });

    this.anims.create({
      key: 'skeleton_walk_anim',
      frames: this.anims.generateFrameNumbers('skeleton_walk', { start: 0, end: 3 }),
      frameRate: 7,
      repeat: -1
    });

    this.anims.create({
      key: 'skeleton_attack_anim',
      frames: this.anims.generateFrameNumbers('skeleton_attack', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'skeleton_shield_anim',
      frames: this.anims.generateFrameNumbers('skeleton_shield', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'skeleton_hit_anim',
      frames: this.anims.generateFrameNumbers('skeleton_hit', { start: 0, end: 3 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'skeleton_dead_anim',
      frames: this.anims.generateFrameNumbers('skeleton_dead', { start: 0, end: 3 }),
      frameRate: 6,
      repeat: 0
    });

    // Fire Demon (Boss Ignis) Anims
    this.anims.create({
      key: 'demon_idle_anim',
      frames: this.anims.generateFrameNumbers('demon_idle', { start: 0, end: 3 }),
      frameRate: 7,
      repeat: -1
    });

    this.anims.create({
      key: 'demon_flying_anim',
      frames: this.anims.generateFrameNumbers('demon_flying', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1
    });

    this.anims.create({
      key: 'demon_attack_anim',
      frames: this.anims.generateFrameNumbers('demon_attack', { start: 0, end: 7 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'demon_hit_anim',
      frames: this.anims.generateFrameNumbers('demon_hit', { start: 0, end: 3 }),
      frameRate: 9,
      repeat: 0
    });

    this.anims.create({
      key: 'demon_dead_anim',
      frames: this.anims.generateFrameNumbers('demon_dead', { start: 0, end: 6 }),
      frameRate: 8,
      repeat: 0
    });

    // NightBorne (Boss Umbra) Anims
    this.anims.create({
      key: 'nightborne_idle_anim',
      frames: this.anims.generateFrameNumbers('nightborne_idle', { start: 0, end: 8 }),
      frameRate: 9,
      repeat: -1
    });

    this.anims.create({
      key: 'nightborne_run_anim',
      frames: this.anims.generateFrameNumbers('nightborne_run', { start: 0, end: 5 }),
      frameRate: 11,
      repeat: -1
    });

    this.anims.create({
      key: 'nightborne_attack_anim',
      frames: this.anims.generateFrameNumbers('nightborne_attack', { start: 0, end: 11 }),
      frameRate: 13,
      repeat: 0
    });

    this.anims.create({
      key: 'nightborne_hit_anim',
      frames: this.anims.generateFrameNumbers('nightborne_hit', { start: 0, end: 4 }),
      frameRate: 10,
      repeat: 0
    });

    this.anims.create({
      key: 'nightborne_dead_anim',
      frames: this.anims.generateFrameNumbers('nightborne_dead', { start: 0, end: 22 }),
      frameRate: 12,
      repeat: 0
    });
  }
}
