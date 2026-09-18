import crypto from "node:crypto";
import { loadJson, saveJson } from "./db.js";
import {
  LUNA_CRYSTAL_REWARD_NIM,
  LUNA_CRYSTAL_DAILY_CAP_NIM,
  PER_DEVICE_DAILY_CAP_NIM,
  PER_DEVICE_FIRST_BOSS_LIMIT,
} from "../config.js";

const CLAIMS_FILE = "claims.json";

function loadClaimsStore() {
  return loadJson(CLAIMS_FILE, {
    firstBoss: {},
    dailyCrystals: {},
    firstBossDevices: {},
    dailyDevices: {},
  });
}

function normalizeWallet(w) {
  return String(w || "").trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Stable, hashed key for a Nimiq Pay device identifier.
 *
 * `requestDeviceIdentifier` returns a pseudonymous 64-char hex SHA-256 scoped to
 * the Mini App origin. We hash it again before persisting so the cloud ledger
 * never stores a raw device identifier.
 */
export function deviceKey(deviceId) {
  const raw = String(deviceId || "").trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(`luna-blade:device:${raw}`).digest("hex");
}

/** Check if wallet has already claimed the one-time First Boss bounty. */
export function hasClaimedFirstBoss(wallet) {
  const norm = normalizeWallet(wallet);
  if (!norm) return false;
  const store = loadClaimsStore();
  return Boolean(store.firstBoss && store.firstBoss[norm]);
}

/** Has this device already taken a First Boss bounty on any wallet? */
export function hasDeviceClaimedFirstBoss(deviceId) {
  const key = deviceKey(deviceId);
  if (!key) return false;
  const store = loadClaimsStore();
  return Boolean(store.firstBossDevices && store.firstBossDevices[key]);
}

/** Record one-time First Boss claim for a wallet (and its device). */
export function recordFirstBossClaim(wallet, { chapterId, bossName, txId, deviceId } = {}) {
  const norm = normalizeWallet(wallet);
  if (!norm) throw new Error("invalid_wallet");

  const store = loadClaimsStore();
  if (!store.firstBoss) store.firstBoss = {};
  if (!store.firstBossDevices) store.firstBossDevices = {};

  if (store.firstBoss[norm]) {
    return { ok: false, alreadyClaimed: true, claim: store.firstBoss[norm] };
  }

  // Anti-farm: one bounty per device, regardless of how many wallets it cycles.
  const devKey = deviceKey(deviceId);
  if (devKey && store.firstBossDevices[devKey]) {
    return {
      ok: false,
      alreadyClaimed: false,
      deviceCapped: true,
      allowed: PER_DEVICE_FIRST_BOSS_LIMIT,
    };
  }

  const claim = {
    wallet: norm,
    chapterId: Number(chapterId) || 1,
    bossName: String(bossName || "Unknown Boss"),
    txId: txId || null,
    deviceId: devKey || null,
    claimedAt: Date.now(),
  };
  store.firstBoss[norm] = claim;
  if (devKey) store.firstBossDevices[devKey] = { wallet: norm, claimedAt: Date.now() };
  saveJson(CLAIMS_FILE, store);
  return { ok: true, alreadyClaimed: false, claim };
}

/** Read the per-device daily crystal ledger entry (does not mutate). */
function readDailyDevice(store, devKey, dateSeed) {
  const key = `${dateSeed}:${devKey}`;
  return store.dailyDevices?.[key] || { nimEarned: 0, wallets: {} };
}

/** Get daily crystal harvest status for a wallet (and optionally its device). */
export function getDailyCrystalStatus(wallet, dateSeed, deviceId) {
  const norm = normalizeWallet(wallet);
  const store = loadClaimsStore();
  const key = `${dateSeed}:${norm}`;
  const entry = store.dailyCrystals?.[key] || {
    nimEarned: 0,
    crystalsCollected: 0,
  };
  const nimEarned = Number(entry.nimEarned) || 0;
  const remainingNim = Math.max(0, Number((LUNA_CRYSTAL_DAILY_CAP_NIM - nimEarned).toFixed(5)));
  const status = {
    wallet: norm,
    dateSeed,
    nimEarned,
    crystalsCollected: Number(entry.crystalsCollected) || 0,
    dailyCapNim: LUNA_CRYSTAL_DAILY_CAP_NIM,
    remainingNim,
    isCapped: remainingNim <= 0,
  };

  const devKey = deviceKey(deviceId);
  if (devKey) {
    const dev = readDailyDevice(store, devKey, dateSeed);
    status.deviceNimEarned = Number(dev.nimEarned) || 0;
    status.deviceDailyCapNim = PER_DEVICE_DAILY_CAP_NIM;
    status.deviceRemainingNim = Math.max(
      0,
      Number((PER_DEVICE_DAILY_CAP_NIM - status.deviceNimEarned).toFixed(5))
    );
    status.isCapped = status.isCapped || status.deviceRemainingNim <= 0;
  }
  return status;
}

/** Record crystal harvest claim, applying both wallet and device daily caps. */
export function recordCrystalHarvestClaim(wallet, dateSeed, crystalsCount, deviceId) {
  const norm = normalizeWallet(wallet);
  if (!norm) throw new Error("invalid_wallet");
  const count = Math.max(0, Math.floor(Number(crystalsCount) || 0));
  const devKey = deviceKey(deviceId);

  if (count <= 0) {
    return {
      ok: true,
      creditedNim: 0,
      creditedCrystals: 0,
      status: getDailyCrystalStatus(norm, dateSeed, deviceId),
    };
  }

  const store = loadClaimsStore();
  if (!store.dailyCrystals) store.dailyCrystals = {};
  if (!store.dailyDevices) store.dailyDevices = {};
  const key = `${dateSeed}:${norm}`;
  const current = store.dailyCrystals[key] || { nimEarned: 0, crystalsCollected: 0 };

  const currentNim = Number(current.nimEarned) || 0;
  const roomNim = Math.max(0, Number((LUNA_CRYSTAL_DAILY_CAP_NIM - currentNim).toFixed(5)));

  // Anti-farm: also bound what a single device can earn per day across wallets.
  let deviceRoomNim = roomNim;
  if (devKey) {
    const dev = readDailyDevice(store, devKey, dateSeed);
    deviceRoomNim = Math.max(
      0,
      Number((PER_DEVICE_DAILY_CAP_NIM - Number(dev.nimEarned || 0)).toFixed(5))
    );
  }

  const potentialNim = Number((count * LUNA_CRYSTAL_REWARD_NIM).toFixed(5));
  const creditedNim = Math.min(potentialNim, roomNim, deviceRoomNim);
  const creditedCrystals = Math.round(creditedNim / LUNA_CRYSTAL_REWARD_NIM);

  store.dailyCrystals[key] = {
    wallet: norm,
    dateSeed,
    nimEarned: Number((currentNim + creditedNim).toFixed(5)),
    crystalsCollected: (current.crystalsCollected || 0) + creditedCrystals,
    updatedAt: Date.now(),
  };

  if (devKey && creditedNim > 0) {
    const dk = `${dateSeed}:${devKey}`;
    const device = store.dailyDevices[dk] || { nimEarned: 0, wallets: {} };
    device.nimEarned = Number((Number(device.nimEarned || 0) + creditedNim).toFixed(5));
    if (!device.wallets) device.wallets = {};
    device.wallets[norm] = Number((Number(device.wallets[norm] || 0) + creditedNim).toFixed(5));
    device.updatedAt = Date.now();
    store.dailyDevices[dk] = device;
  }

  saveJson(CLAIMS_FILE, store);

  return {
    ok: true,
    creditedNim,
    creditedCrystals,
    status: getDailyCrystalStatus(norm, dateSeed, deviceId),
  };
}
