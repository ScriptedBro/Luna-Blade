import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * Atomic JSON persistence with optional Upstash Redis cloud sync.
 *
 * - Local / Dev: reads & writes to `server/data/<name>`.
 * - Cloud / Render: if UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set,
 *   syncs state on boot and pushes state on every save. Zero npm dependencies!
 */

const cache = new Map();

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isUpstashConfigured = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

/**
 * Execute command against Upstash Redis REST API.
 */
async function upstashCommand(commandArray) {
  if (!isUpstashConfigured) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commandArray),
    });
    if (!res.ok) {
      console.warn(`[upstash] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.result;
  } catch (err) {
    console.warn("[upstash] fetch error:", err.message);
    return null;
  }
}

/**
 * On server boot, pull state from Upstash if available.
 */
export async function initCloudStorage() {
  if (!isUpstashConfigured) {
    console.log("[db] Using local JSON file store (Upstash not configured)");
    return;
  }
  console.log("[db] Upstash Redis detected! Syncing persistent cloud state...");
  const files = ["leaderboard.json", "claims.json", "payouts.jsonl"];
  for (const name of files) {
    const key = `luna_blade:${name}`;
    const raw = await upstashCommand(["GET", key]);
    if (raw) {
      try {
        ensureDataDir();
        const file = path.join(config.dataDir, name);
        const content = typeof raw === "string" ? raw : JSON.stringify(raw);
        fs.writeFileSync(file, content, "utf8");
        if (name.endsWith(".json")) {
          cache.set(file, JSON.parse(content));
        }
        console.log(`[upstash] Synced ${name} from Upstash cloud.`);
      } catch (e) {
        console.warn(`[upstash] Failed to parse ${name} from Upstash:`, e.message);
      }
    } else {
      const file = path.join(config.dataDir, name);
      if (fs.existsSync(file)) {
        const local = fs.readFileSync(file, "utf8");
        await upstashCommand(["SET", key, local]);
        console.log(`[upstash] Seeded initial ${name} to Upstash.`);
      }
    }
  }
}

export function loadJson(name, fallback) {
  ensureDataDir();
  const file = path.join(config.dataDir, name);
  if (cache.has(file)) return cache.get(file);
  let data = fallback;
  try {
    const raw = fs.readFileSync(file, "utf8");
    if (raw.trim()) data = JSON.parse(raw);
  } catch {
    /* first run or corrupt -> fallback */
  }
  cache.set(file, data);
  return data;
}

export function saveJson(name, data) {
  ensureDataDir();
  const file = path.join(config.dataDir, name);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
  cache.set(file, data);

  // Sync to Upstash in background
  if (isUpstashConfigured) {
    const key = `luna_blade:${name}`;
    upstashCommand(["SET", key, JSON.stringify(data)]).catch((e) => {
      console.warn(`[upstash] Failed to save ${name}:`, e.message);
    });
  }

  return data;
}

export function appendLine(name, line) {
  ensureDataDir();
  const file = path.join(config.dataDir, name);
  fs.appendFileSync(file, `\n${line}`, "utf8");

  if (isUpstashConfigured) {
    const key = `luna_blade:${name}`;
    upstashCommand(["RPUSH", key, line]).catch(() => {});
  }
}

export async function pushRemoteFile(name, content) {
  if (!isUpstashConfigured) return;
  try {
    await upstashCommand(["SET", `luna_blade:${name}`, content]);
  } catch (err) {
    console.warn(`[upstash] Failed to sync ${name}:`, err.message);
  }
}