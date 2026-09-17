import { loadJson, saveJson } from "./db.js";
import { LUNA_CRYSTAL_REWARD_NIM, LUNA_CRYSTAL_DAILY_CAP_NIM } from "../config.js";

const CLAIMS_FILE = "claims.json";

function loadClaimsStore() {
  return loadJson(CLAIMS_FILE, {
    firstBoss: {},
    dailyCrystals: {},
  });
}

function normalizeWallet(w) {
  return String(w || "").trim().replace(/\s+/g, "").toUpperCase();
}

/** Check if wallet has already claimed the one-time First Boss bounty. */
export function hasClaimedFirstBoss(wallet) {
  const norm = normalizeWallet(wallet);
  if (!norm) return false;
  const store = loadClaimsStore();
  return Boolean(store.firstBoss && store.firstBoss[norm]);
}

/** Record one-time First Boss claim for a wallet. */
export function recordFirstBossClaim(wallet, { chapterId, bossName, txId }) {
  const norm = normalizeWallet(wallet);
  if (!norm) throw new Error("invalid_wallet");
  const store = loadClaimsStore();
  if (!store.firstBoss) store.firstBoss = {};
  if (store.firstBoss[norm]) {
    return { ok: false, alreadyClaimed: true, claim: store.firstBoss[norm] };
  }
  const claim = {
    wallet: norm,
    chapterId: Number(chapterId) || 1,
    bossName: String(bossName || "Unknown Boss"),
    txId: txId || null,
    claimedAt: Date.now(),
  };
  store.firstBoss[norm] = claim;
  saveJson(CLAIMS_FILE, store);
  return { ok: true, alreadyClaimed: false, claim };
}

/** Get daily crystal harvest status for a wallet on a specific dateSeed. */
export function getDailyCrystalStatus(wallet, dateSeed) {
  const norm = normalizeWallet(wallet);
  const store = loadClaimsStore();
  const key = `${dateSeed}:${norm}`;
  const entry = store.dailyCrystals?.[key] || {
    nimEarned: 0,
    crystalsCollected: 0,
  };
  const nimEarned = Number(entry.nimEarned) || 0;
  const remainingNim = Math.max(0, Number((LUNA_CRYSTAL_DAILY_CAP_NIM - nimEarned).toFixed(2)));
  return {
    wallet: norm,
    dateSeed,
    nimEarned,
    crystalsCollected: Number(entry.crystalsCollected) || 0,
    dailyCapNim: LUNA_CRYSTAL_DAILY_CAP_NIM,
    remainingNim,
    isCapped: remainingNim <= 0,
  };
}

/** Record crystal harvest claim, applying daily cap (max 10 NIM/day). */
export function recordCrystalHarvestClaim(wallet, dateSeed, crystalsCount) {
  const norm = normalizeWallet(wallet);
  if (!norm) throw new Error("invalid_wallet");
  const count = Math.max(0, Math.floor(Number(crystalsCount) || 0));
  if (count <= 0) {
    return { ok: true, creditedNim: 0, creditedCrystals: 0, status: getDailyCrystalStatus(norm, dateSeed) };
  }

  const store = loadClaimsStore();
  if (!store.dailyCrystals) store.dailyCrystals = {};
  const key = `${dateSeed}:${norm}`;
  const current = store.dailyCrystals[key] || { nimEarned: 0, crystalsCollected: 0 };

  const currentNim = Number(current.nimEarned) || 0;
  const roomNim = Math.max(0, Number((LUNA_CRYSTAL_DAILY_CAP_NIM - currentNim).toFixed(2)));

  const potentialNim = Number((count * LUNA_CRYSTAL_REWARD_NIM).toFixed(2));
  const creditedNim = Math.min(roomNim, potentialNim);
  const creditedCrystals = Math.round(creditedNim / LUNA_CRYSTAL_REWARD_NIM);

  const updatedEntry = {
    wallet: norm,
    dateSeed,
    nimEarned: Number((currentNim + creditedNim).toFixed(2)),
    crystalsCollected: (current.crystalsCollected || 0) + creditedCrystals,
    updatedAt: Date.now(),
  };

  store.dailyCrystals[key] = updatedEntry;
  saveJson(CLAIMS_FILE, store);

  return {
    ok: true,
    creditedNim,
    creditedCrystals,
    status: getDailyCrystalStatus(norm, dateSeed),
  };
}
