import { loadJson, saveJson } from "./db.js";

/**
 * Verified daily-leaderboard store (server-authoritative, JSON persistence).
 * Best score per (wallet, date) is upserted; every row carries its wallet
 * proof so the API can expose a public, honest board.
 */

const STORE_FILE = "leaderboard.json";

function store() {
  return loadJson(STORE_FILE, { entries: [] });
}

export function submitScore({ wallet, dateSeed, score, durationMs, kills, deviceId, signedAt }) {
  const s = store();
  const row = {
    wallet,
    dateSeed,
    score: Math.floor(Number(score) || 0),
    durationMs: Math.floor(Number(durationMs) || 0),
    kills: Math.floor(Number(kills) || 0),
    deviceId: deviceId || null,
    signedAt: Number(signedAt) || Date.now(),
  };

  const key = `${dateSeed}:${wallet}`;
  const existing = s.entries.find((e) => `${e.dateSeed}:${e.wallet}` === key);

  if (existing && existing.score >= row.score) {
    return { ok: true, row: existing, isNewBest: false };
  }

  if (existing) {
    Object.assign(existing, row);
  } else {
    s.entries.push(row);
  }

  saveJson(STORE_FILE, s);
  return { ok: true, row: existing || row, isNewBest: true };
}

export function getDailyBoard(dateSeed, limit = 50) {
  const s = store();
  return s.entries
    .filter((e) => e.dateSeed === dateSeed)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      score: row.score,
      durationMs: row.durationMs,
      kills: row.kills,
    }));
}

export function getDailyRank(dateSeed, wallet) {
  const board = getDailyBoard(dateSeed, 100000);
  const idx = board.findIndex((r) => r.wallet === wallet);
  if (idx === -1) return null;
  return idx + 1;
}

/**
 * All-time board: a wallet's best verified score across ALL days. Purely
 * functional — no daily seed/arena variance, so scores are comparable.
 */
export function getAllTimeBoard(limit = 50) {
  const s = store();
  const bestByWallet = new Map();
  for (const e of s.entries) {
    const prev = bestByWallet.get(e.wallet);
    if (!prev || e.score > prev.score) bestByWallet.set(e.wallet, e);
  }
  return [...bestByWallet.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, i) => ({
      rank: i + 1,
      wallet: row.wallet,
      score: row.score,
      durationMs: row.durationMs,
      kills: row.kills,
    }));
}

/** Rank of a wallet in the all-time board, or null. */
export function getAllTimeRank(wallet) {
  const board = getAllTimeBoard(100000);
  const idx = board.findIndex((r) => r.wallet === wallet);
  return idx === -1 ? null : idx + 1;
}

/** Top-N winners for a given day (used by the payout worker). */
export function getDailyWinners(dateSeed, prizeCount) {
  return getDailyBoard(dateSeed, prizeCount);
}

/** Best verified score for a wallet on a given day, if any. */
export function getPlayerScore(dateSeed, wallet) {
  const board = getDailyBoard(dateSeed, 100000);
  const row = board.find((r) => r.wallet === wallet);
  return row || null;
}