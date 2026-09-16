import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * Minimal atomic JSON persistence (survives restarts, no native deps).
 * Each store is a single JSON file under `server/data/`.
 */
const cache = new Map();

export function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
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
  return data;
}

export function appendLine(name, line) {
  ensureDataDir();
  const file = path.join(config.dataDir, name);
  fs.appendFileSync(file, `\n${line}`, "utf8");
}