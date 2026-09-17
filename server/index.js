import express from "express";
import cors from "cors";
import { config, DAILY_PRIZES_NIM, FIRST_BOSS_BOUNTY_NIM, LUNA_CRYSTAL_REWARD_NIM, LUNA_CRYSTAL_DAILY_CAP_NIM } from "./config.js";
import { createNonce, consumeNonce, signSession, requireAuth } from "./src/auth.js";
import { verifySignedMessageDeriveAddress } from "./src/verifyNimiq.js";
import { submitScore, getDailyBoard, getDailyRank, getDailyWinners, getAllTimeBoard, getAllTimeRank } from "./src/leaderboard.js";
import { runPayoutCycle, getPayoutSummary, isPayoutSignerConfigured, startPayoutCron, queueFirstBossPayout, queueCrystalHarvestPayout } from "./src/payout.js";
import { hasClaimedFirstBoss, recordFirstBossClaim, getDailyCrystalStatus, recordCrystalHarvestClaim } from "./src/claims.js";
import { initCloudStorage } from "./src/db.js";

const app = express();
app.use(cors({ origin: config.corsOrigins === "*" ? true : config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "64kb" }));

const appName = "Luna Blade";

// Health check endpoint for Render & uptime monitoring
app.get("/health", (_req, res) => {
  res.json({ ok: true, app: appName, network: config.network, uptime: Math.floor(process.uptime()) });
});

// --- Nimiq challenge-response auth ---

app.get("/api/auth/nonce", (_req, res) => {
  res.json(createNonce());
});

app.post("/api/auth/verify", async (req, res) => {
  const { nonce, message, signer, signerPublicKey, signature, nimiqPayClient } = req.body || {};

  if (!consumeNonce(String(nonce || ""))) {
    return res.status(401).json({ error: "invalid_nonce" });
  }
  if (message !== `Login:v1:${nonce}`) {
    return res.status(401).json({ error: "message_mismatch" });
  }

  const address = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
  if (!address) {
    return res.status(401).json({ error: "invalid_signature" });
  }

  // Nimiq Pay sends signer: "" (present-but-empty). Hub omits it or sends a value.
  // A bare flag must not label a Hub login as Nimiq Pay.
  const isNimiqPay =
    Boolean(nimiqPayClient) && (signer === undefined || signer === null || String(signer).trim() === "");

  const token = signSession(address, config.jwtSecret, { nimiqPay: isNimiqPay });
  res.json({ token, address, nimiqPay: isNimiqPay });
});

app.get("/api/config", (_req, res) => {
  res.json({
    appName,
    network: config.network,
    dailyPrizeNim: DAILY_PRIZES_NIM,
    firstBossPrizeNim: FIRST_BOSS_BOUNTY_NIM,
    lunaCrystalRewardNim: LUNA_CRYSTAL_REWARD_NIM,
    lunaCrystalDailyCapNim: LUNA_CRYSTAL_DAILY_CAP_NIM,
  });
});

// --- Rewards & Bounties (First Boss & Daily Luna Crystals) ---

app.get("/api/rewards/status", requireAuth, (req, res) => {
  const wallet = req.session.sub;
  const dateSeed = todaySeedString();
  const firstBossClaimed = hasClaimedFirstBoss(wallet);
  const crystalStatus = getDailyCrystalStatus(wallet, dateSeed);
  res.json({
    wallet,
    dateSeed,
    firstBossClaimed,
    firstBossPrizeNim: FIRST_BOSS_BOUNTY_NIM,
    crystalStatus,
  });
});

app.post("/api/rewards/claim-boss", requireAuth, async (req, res) => {
  const { message, signerPublicKey, signature, chapterId, bossName, durationMs, kills } = req.body || {};
  const wallet = req.session.sub;

  if (!message || !signerPublicKey || !signature) {
    return res.status(400).json({ error: "missing_proof" });
  }

  const ch = Number(chapterId) || 1;
  const boss = String(bossName || "Unknown Boss");
  const expected = `Luna Blade Boss Proof: Chapter ${ch} | Boss: ${boss} | Player: ${wallet}`;

  let derived = null;
  try {
    derived = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
  } catch {
    derived = null;
  }

  if (!derived || derived !== wallet || message !== expected) {
    return res.status(401).json({ error: "invalid_boss_proof" });
  }

  // Must be Story Mode boss (Chapters 1 to 5)
  if (ch < 1 || ch > 5) {
    return res.status(400).json({ error: "boss_reward_story_only" });
  }

  // Anti-cheat / bot baseline threshold: at least 15s play and 1 kill
  if (Number(durationMs || 0) < 15_000 || Number(kills || 0) < 1) {
    return res.status(400).json({ error: "insufficient_run_telemetry" });
  }

  // Check if wallet has already claimed First Boss bounty anywhere across the game
  if (hasClaimedFirstBoss(wallet)) {
    return res.status(409).json({ error: "already_claimed", firstBossClaimed: true });
  }

  // Record claim
  const record = recordFirstBossClaim(wallet, { chapterId: ch, bossName: boss });
  if (!record.ok) {
    return res.status(409).json({ error: "already_claimed" });
  }

  // Queue payout
  const payoutResult = await queueFirstBossPayout(wallet, boss);

  res.json({
    ok: true,
    bountyNim: FIRST_BOSS_BOUNTY_NIM,
    txId: payoutResult.id,
    claimedAt: record.claim.claimedAt,
  });
});

app.post("/api/rewards/bank-crystals", requireAuth, async (req, res) => {
  const { message, signerPublicKey, signature, dateSeed, crystalsCollected, durationMs, kills } = req.body || {};
  const wallet = req.session.sub;

  if (!message || !signerPublicKey || !signature) {
    return res.status(400).json({ error: "missing_proof" });
  }

  const dSeed = String(dateSeed || todaySeedString());
  const count = Math.max(0, Math.floor(Number(crystalsCollected) || 0));
  const expected = `Luna Blade Crystal Proof: ${count} | Date: ${dSeed} | Player: ${wallet}`;

  let derived = null;
  try {
    derived = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
  } catch {
    derived = null;
  }

  if (!derived || derived !== wallet || message !== expected) {
    return res.status(401).json({ error: "invalid_crystal_proof" });
  }

  if (count <= 0) {
    const status = getDailyCrystalStatus(wallet, dSeed);
    return res.json({ ok: true, creditedNim: 0, creditedCrystals: 0, status });
  }

  // Anti-teleport / anti-spoof checks
  const runMs = Number(durationMs || 0);
  const killCount = Number(kills || 0);
  if (runMs < 8_000) {
    return res.status(400).json({ error: "run_too_short" });
  }
  // Plausible crystals cap per run based on mobs and crates (generous upper bound)
  if (count > (killCount * 2) + 20) {
    return res.status(400).json({ error: "crystal_count_anomaly" });
  }

  const claimResult = recordCrystalHarvestClaim(wallet, dSeed, count);
  if (claimResult.creditedNim > 0) {
    await queueCrystalHarvestPayout(wallet, dSeed, claimResult.creditedNim);
  }

  res.json({
    ok: true,
    creditedNim: claimResult.creditedNim,
    creditedCrystals: claimResult.creditedCrystals,
    status: claimResult.status,
  });
});


// --- Verified leaderboard ---

app.post("/api/scores/submit", requireAuth, async (req, res) => {
  const { message, signerPublicKey, signature, score, dateSeed, mode, durationMs, kills, deviceId } = req.body || {};
  const wallet = req.session.sub;
  if (!message || !signerPublicKey || !signature) {
    return res.status(400).json({ error: "missing_proof" });
  }

  // The signed message must bind score + date + mode + wallet, and the derived
  // address must equal the session wallet (tamper-proof attribution).
  const expected =
    `Luna Blade Score Proof: ${score} | Mode: ${mode || "SURVIVAL"} | ` +
    `Player: ${wallet} | Date: ${dateSeed}`;
  let derived = null;
  try {
    derived = await verifySignedMessageDeriveAddress(message, signerPublicKey, signature);
  } catch {
    derived = null;
  }
  if (!derived || derived !== wallet || message !== expected) {
    return res.status(401).json({ error: "invalid_score_proof" });
  }

  const n = Number(score);
  if (!Number.isFinite(n) || n <= 0 || n > 100_000_000 || message !== expected) {
    return res.status(400).json({ error: "invalid_score" });
  }

  // Anti-cheat heuristic validations (game physics & balance sanity checks)
  const durMs = Number(durationMs) || 0;
  const killCount = Number(kills) || 0;

  // 1. Minimum run duration: a survival run must be at least 5 seconds
  if (durMs < 5000) {
    return res.status(400).json({ error: "invalid_duration", message: "Run duration too short" });
  }

  // 2. Score rate check: maximum possible points per second is bounded by mob spawn rates & combo
  // In Luna Blade, maximum mob spawn is ~5 mobs/sec (up to 50 pts each) * 4x combo + 10 pts/sec survival = ~1,010 pts/sec.
  // 1,500 pts/sec provides a generous ceiling that no human or bot can physically exceed without cheating.
  const seconds = durMs / 1000;
  const ptsPerSec = n / seconds;
  if (ptsPerSec > 1500) {
    return res.status(400).json({ error: "invalid_score_rate", message: "Score rate physically impossible" });
  }

  // 3. Kill rate check: continuous mob spawn caps at 12 kills per second
  const killsPerSec = killCount / seconds;
  if (killsPerSec > 12) {
    return res.status(400).json({ error: "invalid_kill_rate", message: "Kill rate physically impossible" });
  }

  const { isNewBest } = submitScore({
    wallet,
    dateSeed: String(dateSeed || ""),
    score: n,
    durationMs: durMs,
    kills: killCount,
    deviceId: typeof deviceId === "string" ? deviceId.slice(0, 128) : null,
    signedAt: Date.now(),
  });

  res.json({
    ok: true,
    isNewBest,
    rank: getDailyRank(dateSeed, wallet),
    allTimeRank: getAllTimeRank(wallet),
  });
});

app.get("/api/leaderboard/daily", (req, res) => {
  const dateSeed = todaySeedString();
  const board = getDailyBoard(dateSeed).map((row) => ({
    rank: row.rank,
    score: row.score,
    durationMs: row.durationMs,
    kills: row.kills,
    wallet: row.wallet,
  }));
  res.json({ entries: board, prizeNim: DAILY_PRIZES_NIM });
});

app.get("/api/leaderboard/alltime", (_req, res) => {
  const board = getAllTimeBoard().map((row) => ({
    rank: row.rank,
    score: row.score,
    durationMs: row.durationMs,
    kills: row.kills,
    wallet: row.wallet,
  }));
  res.json({ entries: board });
});

// --- Payouts (Tier 2, guarded) ---

app.post("/api/payouts/trigger-run", requireAuth, async (req, res) => {
  const isAdmin = req.session?.sub === config.payoutAdminAddress;
  if (isPayoutSignerConfigured() && !isAdmin && process.env.ALLOW_PUBLIC_PAYOUT_TRIGGER !== "1") {
    return res.status(403).json({ error: "forbidden" });
  }
  try {
    const dateSeed = req.body?.dateSeed || todaySeedString();
    const result = await runPayoutCycle(dateSeed);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/api/payouts/status", (_req, res) => {
  res.json({ ...getPayoutSummary(), signerConfigured: isPayoutSignerConfigured() });
});

// --- Boot ---

async function startServer() {
  await initCloudStorage();
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[luna-blade] API listening on 0.0.0.0:${config.port} (network=${config.network})`);
    if (!config.jwtSecret) console.warn("[luna-blade] JWT_SECRET is not set — sessions insecure");
    if (!isPayoutSignerConfigured()) console.warn("[luna-blade] NIM_PAYOUT_PRIVATE_KEY not set — payout worker disabled");
    startPayoutCron();
  });
}

startServer();

function todaySeedString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}