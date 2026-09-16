import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config, DAILY_PRIZES_NIM, LUNA_PER_NIM } from "../config.js";
import { getDailyWinners } from "./leaderboard.js";
import { ensureDataDir } from "./db.js";

/**
 * Tier 2 automated payout worker for the verified daily leaderboard.
 *
 * Mirrors the winning nspace payout-service invariants:
 *  - A transaction that was broadcast MUST never be re-sent. Transactions that
 *    are `confirmed`, `included`, or `pending` are value-moving states.
 *  - Only `expired` / `invalidated` (provably dead) transactions allow re-sending.
 *  - Idempotent outbox (jsonl) so a crash between broadcast and ledger-write
 *    cannot cause a double payout.
 */

const OUTBOX_FILE = "payouts.jsonl";

let clientPromise = null;
let mutex = Promise.resolve();

function withMutex(fn) {
  const next = mutex.then(fn);
  mutex = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function isValueMovingState(state) {
  return state === "confirmed" || state === "included" || state === "pending";
}

function isDeadState(state) {
  return state === "expired" || state === "invalidated";
}

function outboxPath() {
  return path.join(config.dataDir, OUTBOX_FILE);
}

function readOutbox() {
  ensureDataDir();
  const file = outboxPath();
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t);
      if (o && o.id) rows.push(o);
    } catch {
      /* skip corrupt line */
    }
  }
  return rows;
}

function writeOutbox(rows) {
  ensureDataDir();
  const file = outboxPath();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
  fs.renameSync(tmp, file);
}

function appendOutbox(row) {
  ensureDataDir();
  fs.appendFileSync(outboxPath(), JSON.stringify(row) + "\n", "utf8");
}

async function getClient() {
  if (!clientPromise) {
    const Nimiq = await import("@nimiq/core");
    const { Client, ClientConfiguration } = Nimiq;
    const cfg = new ClientConfiguration();
    cfg.network(config.network);
    cfg.logLevel("warn");
    clientPromise = Client.create(cfg.build());
  }
  return clientPromise;
}

async function getKeyPair() {
  const Nimiq = await import("@nimiq/core");
  const hex = config.payoutPrivateKey?.trim();
  if (!hex) throw new Error("NIM_PAYOUT_PRIVATE_KEY is not set");
  return Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(hex));
}

export function isPayoutSignerConfigured() {
  const k = config.payoutPrivateKey?.trim();
  return !!k && k.length >= 64;
}

export async function getPayoutTreasuryAddress() {
  const kp = await getKeyPair();
  return kp.toAddress().toUserFriendlyAddress();
}

export async function getTreasuryBalanceLuna() {
  return withMutex(async () => {
    const client = await getClient();
    await client.waitForConsensusEstablished();
    const kp = await getKeyPair();
    const account = await client.getAccount(kp.toAddress());
    return BigInt(account.balance);
  });
}

async function sendOne(recipientAddress, amountLuna, memo) {
  const Nimiq = await import("@nimiq/core");
  const { TransactionBuilder, Address } = Nimiq;
  const client = await getClient();
  await client.waitForConsensusEstablished();
  const kp = await getKeyPair();
  const senderAddr = kp.toAddress();
  const recipient = Address.fromUserFriendlyAddress(recipientAddress);
  const head = await client.getHeadBlock();
  const height = head.height;
  const networkId = await client.getNetworkId();
  const txData = new TextEncoder().encode(memo);
  const tx = TransactionBuilder.newBasicWithData(
    senderAddr,
    recipient,
    txData,
    amountLuna,
    null,
    height,
    networkId
  );
  tx.sign(kp, undefined);
  return client.sendTransaction(tx);
}

async function txState(txHash) {
  try {
    const client = await getClient();
    const details = await client.getTransaction(txHash);
    return String(details.state || "unknown");
  } catch {
    return "unknown";
  }
}

async function awaitConfirmation(txHash, initialState, timeoutMs = config.txConfirmTimeoutMs) {
  let state = initialState;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (state === "confirmed" || state === "included" || state === "invalidated" || state === "expired") {
      return state;
    }
    if (Date.now() >= deadline) return state;
    await new Promise((r) => setTimeout(r, 2000));
    try {
      state = await txState(txHash);
    } catch {
      /* transient lookup failure: keep polling */
    }
  }
}

/** Push one payout row through its lifecycle. Never re-sends value-moving txs. */
async function processRow(row) {
  if (row.status === "completed") return row;
  if (row.status === "dead_letter") return row;

  // If we ever broadcast, honour the value-moving guard before anything else.
  if (row.txHash && isValueMovingState(row.state)) return row;

  row.attempts = (row.attempts || 0) + 1;
  row.status = "processing";
  row.lastError = undefined;

  try {
    const details = await sendOne(row.recipientAddress, row.amountLuna, row.memo);
    row.txHash = details.transactionHash;
    row.state = String(details.state || "pending");
    row.sentAt = row.sentAt || Date.now();
    // Broadcast happened: from here we must NOT re-send unless the tx provably died.
    const finalState = await awaitConfirmation(row.txHash, row.state);
    row.state = finalState;
    if (isValueMovingState(finalState)) row.status = "completed";
    else if (isDeadState(finalState)) row.status = "pending"; // safe to retry
    else row.status = "awaiting_confirmation";
    return row;
  } catch (e) {
    // Never broadcast (build/sign/submit error) -> safe to retry later.
    row.status = "pending";
    row.lastError = String(e?.message || e);
    row.nextRetryAt = Date.now() + Math.min(120_000 * (row.attempts || 1), 3_600_000);
    if (row.attempts >= 12) row.status = "dead_letter";
    return row;
  }
}

/**
 * Settle a completed day: pay the verified top-N the declared NIM spoils.
 * Returns the updated outbox. Idempotent — re-running skips aleady-completed rows.
 */
export async function runPayoutCycle(dateSeed) {
  if (!isPayoutSignerConfigured()) {
    throw new Error("payout_signer_not_configured");
  }
  const winners = getDailyWinners(dateSeed, DAILY_PRIZES_NIM.length);
  const outbox = readOutbox();
  const existing = new Set(outbox.map((r) => r.id));

  let changed = false;
  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const prizeNim = DAILY_PRIZES_NIM[i];
    const id = `payout-${dateSeed}-${winner.wallet}-${i + 1}`;
    if (existing.has(id)) continue;
    appendOutbox({
      id,
      dateSeed,
      rank: i + 1,
      recipientAddress: winner.wallet,
      amountLuna: prizeNim * LUNA_PER_NIM,
      amountNim: prizeNim,
      memo: `Luna Blade Daily Spoils ${dateSeed} #${i + 1}`,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
    existing.add(id);
    changed = true;
  }

  if (!changed && outbox.length === 0) return { outbox: [], processed: 0 };

  const rows = readOutbox();
  const balanceOk = await checkSignerBalance(rows.filter((r) => r.status === "pending").map((r) => r.amountLuna));
  if (!balanceOk) throw new Error("payout_insufficient_balance");

  let processed = 0;
  const updated = [];
  for (const row of rows) {
    if (row.status === "pending" || row.status === "awaiting_confirmation") {
      updated.push(await processRow(row));
      processed++;
    } else if (row.status === "completed") {
      // Re-check stale "awaiting" rows that may actually be value-moving now.
      if (row.txHash) {
        const s = await txState(row.txHash);
        if (isValueMovingState(s)) row.state = s;
      }
      updated.push(row);
    } else {
      updated.push(row);
    }
  }
  writeOutbox(updated);
  return { outbox: updated, processed };
}

async function checkSignerBalance(amountsLuna) {
  const total = amountsLuna.reduce((a, b) => a + BigInt(b), 0n);
  if (total <= 0n) return true;
  const balance = await getTreasuryBalanceLuna();
  return balance >= total;
}

export function getPayoutSummary() {
  const rows = readOutbox();
  const counts = { pending: 0, processing: 0, awaiting_confirmation: 0, completed: 0, dead_letter: 0 };
  const completed = [];
  for (const r of rows) {
    counts[r.status] = (counts[r.status] || 0) + 1;
    if (r.status === "completed" && r.txHash) completed.push({ dateSeed: r.dateSeed, rank: r.rank, txHash: r.txHash });
  }
  return { counts, completed };
}

export function todaySeedString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

let cronTimer = null;

export function startPayoutCron() {
  if (!config.payoutCronEnabled || cronTimer) return;
  cronTimer = setInterval(async () => {
    try {
      const row = readOutbox().find((r) => r.status === "pending");
      if (row) await runPayoutCycle(row.dateSeed);
    } catch (e) {
      console.error("[payout] cron error", e?.message || e);
    }
  }, config.payoutCronIntervalMs);
  console.log(`[payout] cron started (${config.payoutCronIntervalMs}ms)`);
}