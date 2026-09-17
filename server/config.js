import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

function bool(v, def = false) {
  if (v == null || v === "") return def;
  return v === "1" || v === "true" || v === "yes";
}

export const config = {
  port: Number(process.env.PORT || 3001),
  network: String(process.env.NIMIQ_NETWORK || "testalbatross").toLowerCase(),
  rpcUrl: String(
    process.env.NIMIQ_RPC_URL ||
      (String(process.env.NIMIQ_NETWORK || "testalbatross").toLowerCase() === "mainnet"
        ? "https://rpc.nimiqwatch.com"
        : "https://test.nimiqwatch.com")
  ).trim(),
  jwtSecret: String(process.env.JWT_SECRET || ""),
  corsOrigins: String(
    process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  devAuthBypass: bool(process.env.DEV_AUTH_BYPASS, false),
  // Payout worker
  payoutPrivateKey: String(process.env.NIM_PAYOUT_PRIVATE_KEY || ""),
  payoutCronEnabled: bool(process.env.PAYOUT_CRON_ENABLED, false),
  payoutCronIntervalMs: Number(process.env.PAYOUT_CRON_INTERVAL_MS || 60_000),
  payoutAdminAddress: String(process.env.PAYOUT_ADMIN_ADDRESS || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase(),
  txConfirmTimeoutMs: Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS || 120_000),
  dataDir: path.join(path.dirname(fileURLToPath(import.meta.url)), "data"),
};

export const LUNA_PER_NIM = 100000;
export const JWT_TTL_SEC = 60 * 60 * 12;
export const NONCE_TTL_MS = 5 * 60 * 1000;

/** Daily spoils for the verified leaderboard top-3, in NIM: 1st=25, 2nd=15, 3rd=10 NIM */
export const DAILY_PRIZES_NIM = [25, 15, 10];
export const FIRST_BOSS_BOUNTY_NIM = 10;
export const LUNA_CRYSTAL_REWARD_NIM = 0.1;
export const LUNA_CRYSTAL_DAILY_CAP_NIM = 10.0;