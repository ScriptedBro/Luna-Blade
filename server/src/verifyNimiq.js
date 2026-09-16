/**
 * Server-side Nimiq signed-message verification.
 * Must match the Keyguard / Hub `MSG_PREFIX` format (`@nimiq/hub-api`).
 * Ported 1:1 from the previous hackathon winner (nspace) `verifyNimiq.ts`.
 */

const NIMIQ_MSG_PREFIX = "\x16Nimiq Signed Message:\n";

export function normalizeNqAddr(v) {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Verifies the signed login message and returns the signer's user-friendly
 * address, or `null` when the signature is invalid.
 */
export async function verifySignedMessageDeriveAddress(
  message,
  signerPublicKeyB64,
  signatureB64
) {
  const { Hash, PublicKey, Signature } = await import("@nimiq/core");

  const pubBytes = Buffer.from(String(signerPublicKeyB64 || ""), "base64");
  const sigBytes = Buffer.from(String(signatureB64 || ""), "base64");

  if (pubBytes.length !== 32) return null;
  if (sigBytes.length !== 64) return null;

  const data = NIMIQ_MSG_PREFIX + String(message.length) + message;
  const dataBytes = new TextEncoder().encode(data);
  const hash = Hash.computeSha256(dataBytes);

  let publicKey;
  let signature;
  try {
    publicKey = new PublicKey(pubBytes);
    signature = Signature.deserialize(sigBytes);
  } catch {
    return null;
  }

  if (!publicKey.verify(signature, hash)) return null;

  return publicKey.toAddress().toUserFriendlyAddress();
}

/**
 * Verifies a Hub `signMessage` result against the exact UTF-8 message string.
 * Uses the same prefix + SHA256 + Ed25519 path as Keyguard.
 */
export async function verifySignedMessage(
  message,
  signerPublicKeyB64,
  signatureB64,
  expectedSigner
) {
  const addr = await verifySignedMessageDeriveAddress(
    message,
    signerPublicKeyB64,
    signatureB64
  );
  if (!addr) return false;
  return normalizeNqAddr(addr) === normalizeNqAddr(expectedSigner);
}