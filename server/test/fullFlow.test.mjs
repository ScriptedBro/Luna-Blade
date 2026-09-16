import test from "node:test";
import assert from "node:assert/strict";
import { KeyPair, Hash, Signature } from "@nimiq/core";
import { createNonce, consumeNonce, signSession, verifySession } from "../src/auth.js";
import { verifySignedMessageDeriveAddress } from "../src/verifyNimiq.js";
import { submitScore, getDailyBoard, getAllTimeBoard, getDailyRank, getAllTimeRank } from "../src/leaderboard.js";
import { config } from "../config.js";

const NIMIQ_MSG_PREFIX = "\x16Nimiq Signed Message:\n";

function signMessageHelper(kp, message) {
  const data = NIMIQ_MSG_PREFIX + message.length + message;
  const hash = Hash.computeSha256(new TextEncoder().encode(data));
  const sig = Signature.create(kp.privateKey, kp.publicKey, hash);
  return {
    publicKeyB64: Buffer.from(kp.publicKey.serialize()).toString("base64"),
    signatureB64: Buffer.from(sig.serialize()).toString("base64"),
  };
}

test("Auth: complete challenge-response login round-trip", async () => {
  const kp = KeyPair.generate();
  const address = kp.toAddress().toUserFriendlyAddress();
  const { nonce } = createNonce();

  const msg = `Login:v1:${nonce}`;
  const { publicKeyB64, signatureB64 } = signMessageHelper(kp, msg);

  // Consume nonce
  assert.equal(consumeNonce(nonce), true);
  // Re-consuming same nonce must fail (replay protection)
  assert.equal(consumeNonce(nonce), false);

  // Verify signature and derive address
  const derived = await verifySignedMessageDeriveAddress(msg, publicKeyB64, signatureB64);
  assert.equal(derived, address);

  // Issue JWT
  const token = signSession(derived, config.jwtSecret, { nimiqPay: true });
  assert.ok(token);

  // Verify JWT
  const decoded = verifySession(token, config.jwtSecret);
  assert.equal(decoded.sub, address);
  assert.equal(decoded.nimiqPay, true);
});

test("Leaderboard: verified score proof and all-time aggregation", async () => {
  const kp = KeyPair.generate();
  const wallet = kp.toAddress().toUserFriendlyAddress();
  const dateSeed = "2026-09-16";
  const score = 4200;
  const mode = "SURVIVAL";

  const message = `Luna Blade Score Proof: ${score} | Mode: ${mode} | Player: ${wallet} | Date: ${dateSeed}`;
  const { publicKeyB64, signatureB64 } = signMessageHelper(kp, message);

  // Cryptographically verify the score proof matches the player wallet
  const derived = await verifySignedMessageDeriveAddress(message, publicKeyB64, signatureB64);
  assert.equal(derived, wallet);

  // Submit score
  const res1 = submitScore({
    wallet,
    dateSeed,
    score,
    durationMs: 65000,
    kills: 24,
    signedAt: Date.now(),
  });
  assert.equal(res1.isNewBest, true);

  // Lower score on same date must NOT overwrite
  const res2 = submitScore({
    wallet,
    dateSeed,
    score: 3000,
    durationMs: 40000,
    kills: 15,
    signedAt: Date.now(),
  });
  assert.equal(res2.isNewBest, false);

  // Daily board check
  const daily = getDailyBoard(dateSeed);
  const entry = daily.find((e) => e.wallet === wallet);
  assert.ok(entry);
  assert.equal(entry.score, 4200);

  // All-time board check
  const alltime = getAllTimeBoard();
  const allEntry = alltime.find((e) => e.wallet === wallet);
  assert.ok(allEntry);
  assert.equal(allEntry.score, 4200);
});
