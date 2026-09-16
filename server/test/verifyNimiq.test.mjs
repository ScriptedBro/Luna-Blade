import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySignedMessageDeriveAddress, verifySignedMessage, normalizeNqAddr } from "../src/verifyNimiq.js";
import { createNonce, consumeNonce } from "../src/auth.js";

const NIMIQ_MSG_PREFIX = "\x16Nimiq Signed Message:\n";

async function sign(message, kp, Nimiq) {
  const hash = Nimiq.Hash.computeSha256(new TextEncoder().encode(NIMIQ_MSG_PREFIX + String(message.length) + message));
  const sig = kp.sign(hash);
  return {
    publicKey: Buffer.from(kp.publicKey.serialize()).toString("base64"),
    signature: Buffer.from(sig.serialize()).toString("base64"),
  };
}

test("verifySignedMessageDeriveAddress round-trips a generated keypair", async () => {
  const Nimiq = await import("@nimiq/core");
  const kp = Nimiq.KeyPair.generate();
  const message = "Login:v1:deadbeef";
  const { publicKey, signature } = await sign(message, kp, Nimiq);
  const addr = await verifySignedMessageDeriveAddress(message, publicKey, signature);
  assert.equal(normalizeNqAddr(addr), normalizeNqAddr(kp.publicKey.toAddress().toUserFriendlyAddress()));
});

test("wrong message length / tampered message rejects", async () => {
  const Nimiq = await import("@nimiq/core");
  const kp = Nimiq.KeyPair.generate();
  const message = "Login:v1:deadbeef";
  const { publicKey, signature } = await sign(message, kp, Nimiq);
  // Same bytes signed but different message -> hash differs -> invalid.
  const addr = await verifySignedMessageDeriveAddress("Login:v1:other", publicKey, signature);
  assert.equal(addr, null);
});

test("different wallet signature rejects", async () => {
  const Nimiq = await import("@nimiq/core");
  const kp = Nimiq.KeyPair.generate();
  const kp2 = Nimiq.KeyPair.generate();
  const message = "Login:v1:deadbeef";
  const { publicKey, signature } = await sign(message, kp, Nimiq);
  const other = await verifySignedMessageDeriveAddress(message, Buffer.from(kp2.publicKey.serialize()).toString("base64"), signature);
  assert.equal(other, null);
});

test("malformed lengths return null (no crash)", async () => {
  const addr = await verifySignedMessageDeriveAddress("x", "AA==", "AAA=");
  assert.equal(addr, null);
});

test("verifySignedMessage matches expected signer", async () => {
  const Nimiq = await import("@nimiq/core");
  const kp = Nimiq.KeyPair.generate();
  const message = "Login:v1:deadbeef";
  const { publicKey, signature } = await sign(message, kp, Nimiq);
  const expected = kp.publicKey.toAddress().toUserFriendlyAddress();
  assert.equal(await verifySignedMessage(message, publicKey, signature, expected), true);
  assert.equal(await verifySignedMessage(message, publicKey, signature, "NQ99 9999 9999 9999 9999 9999 9999 9999 9999"), false);
});

test("nonce is single-use and expires", async () => {
  const { nonce } = createNonce();
  assert.equal(consumeNonce(nonce), true);
  assert.equal(consumeNonce(nonce), false);
});