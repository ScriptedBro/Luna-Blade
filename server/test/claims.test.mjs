import test from "node:test";
import assert from "node:assert/strict";
import { KeyPair } from "@nimiq/core";
import {
  deviceKey,
  recordFirstBossClaim,
  hasClaimedFirstBoss,
  hasDeviceClaimedFirstBoss,
  recordCrystalHarvestClaim,
} from "../src/claims.js";

const freshId = (prefix) =>
  `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
const freshWallet = () => KeyPair.generate().toAddress().toUserFriendlyAddress();

test("deviceKey: stable, hashed, and null for empty input", () => {
  const id = freshId("dev");
  const a = deviceKey(id);
  const b = deviceKey(id);
  assert.equal(a, b);
  assert.equal(a.length, 64);
  assert.notEqual(a, id, "raw device identifier must never be stored");
  assert.equal(deviceKey(""), null);
  assert.equal(deviceKey(null), null);
});

test("First Boss bounty: limited to one per wallet and one per device", () => {
  const deviceId = freshId("dev");
  const walletA = freshWallet();
  const walletB = freshWallet();

  const first = recordFirstBossClaim(walletA, { chapterId: 1, bossName: "Gorgok", deviceId });
  assert.equal(first.ok, true);
  assert.equal(hasClaimedFirstBoss(walletA), true);
  assert.equal(hasDeviceClaimedFirstBoss(deviceId), true);

  // Same wallet again -> already claimed
  const again = recordFirstBossClaim(walletA, { chapterId: 2, bossName: "Malakor", deviceId });
  assert.equal(again.ok, false);
  assert.equal(again.alreadyClaimed, true);

  // Different wallet, SAME device -> device-capped (anti-farm), wallet not marked
  const farm = recordFirstBossClaim(walletB, { chapterId: 1, bossName: "Gorgok", deviceId });
  assert.equal(farm.ok, false);
  assert.equal(farm.deviceCapped, true);
  assert.equal(hasClaimedFirstBoss(walletB), false);
});

test("Crystal harvest: wallet cap and cross-wallet device cap", () => {
  const dateSeed = "2099-12-31";
  const deviceId = freshId("dev");
  const walletA = freshWallet();
  const walletB = freshWallet();

  // Wallet A harvests 1000 crystals -> credited only up to the 0.1 NIM wallet cap
  const a1 = recordCrystalHarvestClaim(walletA, dateSeed, 1000, deviceId);
  assert.equal(a1.ok, true);
  assert.equal(a1.creditedNim, 0.1);
  assert.equal(a1.status.isCapped, true);

  // Wallet B on the same device gets nothing more (device cap already consumed)
  const b1 = recordCrystalHarvestClaim(walletB, dateSeed, 100, deviceId);
  assert.equal(b1.ok, true);
  assert.equal(b1.creditedNim, 0);
  assert.equal(b1.status.deviceRemainingNim, 0);

  // Same wallet B on a fresh device can still earn normally
  const fresh = recordCrystalHarvestClaim(walletB, dateSeed, 25, freshId("dev"));
  assert.equal(fresh.creditedNim, 0.025);
});
