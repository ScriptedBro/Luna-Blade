import express from "express";
import cors from "cors";
import { config, DAILY_PRIZES_NIM } from "./config.js";
import { createNonce, consumeNonce, signSession, requireAuth } from "./src/auth.js";
import { verifySignedMessageDeriveAddress } from "./src/verifyNimiq.js";
import { submitScore, getDailyBoard, getDailyRank, getDailyWinners, getAllTimeBoard, getAllTimeRank } from "./src/leaderboard.js";
import { runPayoutCycle, getPayoutSummary, isPayoutSignerConfigured, startPayoutCron } from "./src/payout.js";

const app = express();
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: "64kb" }));

const appName = "Luna Blade";

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

  const { isNewBest } = submitScore({
    wallet,
    dateSeed: String(dateSeed || ""),
    score: n,
    durationMs,
    kills,
    deviceId,
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

app.listen(config.port, () => {
  console.log(`[luna-blade] API listening on :${config.port} (network=${config.network})`);
  if (!config.jwtSecret) console.warn("[luna-blade] JWT_SECRET is not set — sessions insecure");
  if (!isPayoutSignerConfigured()) console.warn("[luna-blade] NIM_PAYOUT_PRIVATE_KEY not set — payout worker disabled");
  startPayoutCron();
});

function todaySeedString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}