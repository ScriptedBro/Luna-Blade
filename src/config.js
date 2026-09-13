export const GAME_CONFIG = {
  WIDTH: 480,
  HEIGHT: 270,
  GRAVITY: 650,
  
  PLAYER: {
    MAX_HEALTH: 3,
    RUN_SPEED: 155,
    JUMP_FORCE: -310,
    DOUBLE_JUMP_FORCE: -270,
    WALL_SLIDE_SPEED: 48,
    WALL_JUMP_X: 180,
    WALL_JUMP_Y: -260,
    COMBO_WINDOW_MS: 380,
    INVULNERABILITY_MS: 1200,
    UPWARD_SLASH_BONUS: 1.5,
  },

  MOBS: {
    BOAR: {
      HP: 60,
      WALK_SPEED: 50,
      CHARGE_SPEED: 210,
      PTS: 50,
      DAMAGE: 1,
      BACKSTAB_MULTIPLIER: 3.0,
      AGGRO_RANGE: 260,
      CHARGE_RANGE: 150,
    },
    SNAIL: {
      HP: 30,
      WALK_SPEED: 25,
      SHELL_SPEED: 380,
      PTS: 25,
      RICOCHET_BONUS_PTS: 50,
      DAMAGE: 1,
    },
    BEE: {
      HP: 20,
      HOVER_SPEED: 55,
      SWOOP_SPEED: 165,
      PTS: 35,
      DAMAGE: 1,
      SWOOP_RANGE: 240,
    },
    MUSHROOM: {
      HP: 45,
      WALK_SPEED: 35,
      SPORE_SPEED: 120,
      PTS: 45,
      DAMAGE: 1,
    },
    FLYING_EYE: {
      HP: 35,
      HOVER_SPEED: 60,
      DIVE_SPEED: 140,
      PTS: 40,
      DAMAGE: 1,
    },
    GOBLIN: {
      HP: 40,
      WALK_SPEED: 70,
      BOMB_SPEED: 130,
      PTS: 45,
      DAMAGE: 1,
    },
    BOSS_GORGOK: {
      HP: 240,
      NAME: 'GORGOK, FOREST CHIEFTAIN',
      WALK_SPEED: 55,
      CHARGE_SPEED: 220,
      PTS: 500,
      DAMAGE: 1,
    },
    BOSS_WIZARD: {
      HP: 300,
      NAME: 'MALAKOR, CORRUPTED ARCHMAGE',
      PTS: 750,
      DAMAGE: 1,
    }
  },

  WEAPONS: {
    STARTER: {
      id: 'iron_starter',
      name: 'Rusted Shortsword',
      tier: 'Standard',
      damageMul: 1.0,
      rangeMul: 1.0,
      effect: 'none',
      crafted: true
    },
    IRON_BROADSWORD: {
      id: 'iron_broadsword',
      name: 'Iron Broadsword',
      tier: 'Tier 1 (Crafted)',
      damageMul: 1.25,
      rangeMul: 1.15,
      effect: 'iron_slash',
      cost: { bark: 10, iron: 5, amber: 0 }
    },
    FOREST_GLAIVE: {
      id: 'forest_glaive',
      name: 'Forest Glaive',
      tier: 'Tier 2 (Crafted)',
      damageMul: 1.5,
      rangeMul: 1.35,
      effect: 'leaf_glaive',
      cost: { bark: 15, iron: 8, amber: 10 }
    },
    GOLDEN_ALBATROSS: {
      id: 'golden_albatross',
      name: 'Golden Solar Blade',
      tier: 'Celestial Blade',
      damageMul: 1.5, // Fair Non-P2W: identical combat power
      rangeMul: 1.35,
      effect: 'golden_spark',
      cost: { amber: 8, iron: 6 },
      cosmeticDescription: 'Forged from radiant solar amber. Golden sword trails & sparkling embers.'
    },
    CORRUPTED_VOID: {
      id: 'corrupted_void',
      name: 'Corrupted Void Edge',
      tier: 'Celestial Blade',
      damageMul: 1.5, // Fair Non-P2W: identical combat power
      rangeMul: 1.35,
      effect: 'void_smoke',
      cost: { amber: 10, iron: 8 },
      cosmeticDescription: 'Infused with ancient twilight essence. Deep obsidian blade with purple shadow trails.'
    }
  },

  PERKS: [
    { id: 'magnet', name: 'Gem Magnet', desc: '+15% Material Magnet Radius' },
    { id: 'haste', name: 'Sylva Breeze', desc: '+5% Sprint Movement Speed' },
    { id: 'luck', name: 'Amber Glow', desc: '+10% Higher Chance for Crate Amber' },
    { id: 'fortitude', name: 'Bark Shield', desc: '+0.5s Longer Invulnerability After Hit' }
  ],

  CHAPTERS: [
    {
      id: 1,
      title: 'Whispering Woods',
      biome: 'Lake & Forest',
      description: 'Lush greenery and lake shores overrun by wild boars and snails. Cleanse the first guardian obelisk.',
      targetObelisks: 1,
      bgTint: 0xffffff
    },
    {
      id: 2,
      title: 'The Hive Canopy',
      biome: 'Autumn Trees & Hive',
      description: 'Vertical ascents up ancient golden boughs swarming with aerial bees. Destroy honeycomb traps.',
      targetObelisks: 1,
      bgTint: 0xffe8aa
    },
    {
      id: 3,
      title: 'The Sunken Ruins',
      biome: 'Mossy Ruins & Caverns',
      description: 'Ancient stone ruins buried in moss and spikes. Face elite enemy rushes and purge the Corrupted Shrine.',
      targetObelisks: 1,
      bgTint: 0x99aacc
    }
  ],

  SURVIVAL: {
    INITIAL_LIVES: 3,
    PTS_PER_SECOND: 10,
    COMBO_INCREMENT: 0.2,
    MAX_COMBO: 4.0,
    DAILY_PRIZE_POOL: 1000,
    WAVE_FAILSAFE_SECONDS: 45,
    WAVE_CLEAR_BONUS: 100,
    HP_SCALE_PER_WAVE: 0.3,
    ENDLESS_HP_MUL_BASE: 2.4,
    ENDLESS_HP_ADD: 0.4,
  }
};
