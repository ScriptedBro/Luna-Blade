import { apiFetch } from "./api.js";
import { getToken, getAddress } from "./session.js";
import { signWireMessage } from "./auth.js";

export function todaySeedString() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

let cachedDeviceId = null;
export function getDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;
  const KEY = "luna-blade.device-id.v1";
  let id = null;
  try {
    id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = id || "anon";
  }
  cachedDeviceId = id;
  return cachedDeviceId;
}

export async function submitVerifiedScore({ score, mode, durationMs, kills }) {
  const addr = getAddress();
  if (!addr) {
    const err = new Error("not_connected");
    err.status = 401;
    throw err;
  }
  const dateSeed = todaySeedString();
  const message =
    `Luna Blade Score Proof: ${score} | Mode: ${mode || "SURVIVAL"} | ` +
    `Player: ${addr} | Date: ${dateSeed}`;
  const { signerPublicKey, signature } = await signWireMessage(message);
  return apiFetch("/api/scores/submit", {
    method: "POST",
    token: getToken(),
    body: JSON.stringify({
      message,
      signerPublicKey,
      signature,
      score,
      dateSeed,
      mode,
      durationMs,
      kills,
      deviceId: getDeviceId(),
    }),
  });
}

export async function fetchDailyBoard() {
  return apiFetch("/api/leaderboard/daily");
}

export async function fetchAllTimeBoard() {
  return apiFetch("/api/leaderboard/alltime");
}

export async function fetchPayoutStatus() {
  return apiFetch("/api/payouts/status");
}

export async function fetchConfig() {
  return apiFetch("/api/config");
}