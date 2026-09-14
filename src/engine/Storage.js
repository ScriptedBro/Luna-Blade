import { GAME_CONFIG } from '../config.js';

const STORAGE_KEY = 'LUNA_BLADE_SAVE_V1';

const DEFAULT_STATE = {
  inventory: {
    bark: 25,
    amber: 15,
    iron: 10,
  },
  equippedWeapon: 'iron_starter',
  unlockedWeapons: ['iron_starter'],
  satchelUnlocked: false,
  companionEquipped: false,
  activePerk: 'magnet',
  storyProgress: {
    chapter1: { completed: false, highKills: 0 },
    chapter2: { completed: false, highKills: 0 },
    chapter3: { completed: false, highKills: 0 },
  },
  dailyRecords: {}, // keyed by date string
  highScore: 0,
  nimiqAccount: null,
  moonBlessings: 0,
};

class StorageManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch (e) {
      console.warn('Failed to parse save data, resetting:', e);
      return { ...DEFAULT_STATE };
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  getMaterials() {
    return this.data.inventory;
  }

  addMaterials({ bark = 0, amber = 0, iron = 0 }) {
    this.data.inventory.bark += bark;
    this.data.inventory.amber += amber;
    this.data.inventory.iron += iron;
    this.save();
    return this.data.inventory;
  }

  spendMaterials({ bark = 0, amber = 0, iron = 0 }) {
    if (
      this.data.inventory.bark >= bark &&
      this.data.inventory.amber >= amber &&
      this.data.inventory.iron >= iron
    ) {
      this.data.inventory.bark -= bark;
      this.data.inventory.amber -= amber;
      this.data.inventory.iron -= iron;
      this.save();
      return true;
    }
    return false;
  }

  getEquippedWeapon() {
    return this.data.equippedWeapon;
  }

  equipWeapon(weaponId) {
    if (this.data.unlockedWeapons.includes(weaponId)) {
      this.data.equippedWeapon = weaponId;
      this.save();
      return true;
    }
    return false;
  }

  unlockWeapon(weaponId) {
    if (!this.data.unlockedWeapons.includes(weaponId)) {
      this.data.unlockedWeapons.push(weaponId);
      this.save();
    }
  }

  isWeaponUnlocked(weaponId) {
    return this.data.unlockedWeapons.includes(weaponId);
  }

  unlockSatchel() {
    this.data.satchelUnlocked = true;
    this.data.companionEquipped = true;
    this.save();
  }

  toggleCompanion() {
    if (this.data.satchelUnlocked) {
      this.data.companionEquipped = !this.data.companionEquipped;
      this.save();
    }
    return this.data.companionEquipped;
  }

  isCompanionActive() {
    return this.data.satchelUnlocked && this.data.companionEquipped;
  }

  setActivePerk(perkId) {
    this.data.activePerk = perkId;
    this.save();
  }

  getActivePerk() {
    return this.data.activePerk;
  }

  markChapterComplete(chapterNum, kills = 0) {
    const key = `chapter${chapterNum}`;
    if (this.data.storyProgress[key]) {
      this.data.storyProgress[key].completed = true;
      this.data.storyProgress[key].highKills = Math.max(this.data.storyProgress[key].highKills, kills);
      this.save();
    }
  }

  isChapterUnlocked(chapterNum) {
    if (chapterNum === 1) return true;
    const prevKey = `chapter${chapterNum - 1}`;
    return !!this.data.storyProgress[prevKey]?.completed;
  }

  recordDailyTrial(dateStr, score, details) {
    if (!this.data.dailyRecords) this.data.dailyRecords = {};
    const prev = this.data.dailyRecords[dateStr];
    if (!prev || score > prev.score) {
      this.data.dailyRecords[dateStr] = {
        score,
        details,
        timestamp: Date.now()
      };
      this.data.highScore = Math.max(this.data.highScore, score);
      this.save();
    }
  }

  getDailyRecord(dateStr) {
    if (!this.data.dailyRecords) this.data.dailyRecords = {};
    return this.data.dailyRecords[dateStr] || null;
  }

  getNimiqAccount() {
    return this.data.nimiqAccount || null;
  }

  setNimiqAccount(account) {
    this.data.nimiqAccount = account;
    this.save();
  }

  addMoonBlessing(nimAmount = 10) {
    this.data.moonBlessings = (this.data.moonBlessings || 0) + Math.max(1, Math.floor(nimAmount / 10));
    this.save();
    return this.data.moonBlessings;
  }

  hasMoonBlessing() {
    return (this.data.moonBlessings || 0) > 0;
  }

  consumeMoonBlessing() {
    if ((this.data.moonBlessings || 0) > 0) {
      this.data.moonBlessings -= 1;
      this.save();
      return true;
    }
    return false;
  }
}

export const storage = new StorageManager();
