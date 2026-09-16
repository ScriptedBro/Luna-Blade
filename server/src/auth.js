import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { JWT_TTL_SEC, NONCE_TTL_MS } from "../config.js";

const nonces = new Map();

export function createNonce() {
  const nonce = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + NONCE_TTL_MS;
  nonces.set(nonce, expiresAt);
  pruneNonces();
  return { nonce, expiresAt };
}

function pruneNonces() {
  const now = Date.now();
  for (const [n, exp] of nonces) {
    if (exp < now) nonces.delete(n);
  }
}

export function consumeNonce(nonce) {
  pruneNonces();
  const exp = nonces.get(nonce);
  if (!exp || exp < Date.now()) return false;
  nonces.delete(nonce);
  return true;
}

export function signSession(address, jwtSecret, opts = {}) {
  const payload = { sub: address };
  if (opts.nimiqPay) payload.nimiqPay = true;
  return jwt.sign(payload, jwtSecret, { expiresIn: JWT_TTL_SEC });
}

export function verifySession(token, jwtSecret) {
  return jwt.verify(token, jwtSecret);
}

/** Express middleware: requires a valid Bearer session JWT for the wallet `sub`. */
export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    req.session = verifySession(token, res.locals.jwtSecret || process.env.JWT_SECRET || "");
    next();
  } catch {
    return res.status(401).json({ error: "invalid_session" });
  }
}