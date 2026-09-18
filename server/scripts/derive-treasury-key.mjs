#!/usr/bin/env node
/**
 * Safe local derivation tool for Nimiq Treasury Key.
 *
 * Usage:
 *   node server/scripts/derive-treasury-key.mjs
 * Or with mnemonic directly:
 *   node server/scripts/derive-treasury-key.mjs "word1 word2 ... word24"
 */

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../.env");
const DEFAULT_TARGET = "NQ94 3E0E 4770 DSVL S6H7 NVR6 PTRY UTES 04FD";

async function main() {
  const Nimiq = await import("@nimiq/core");

  console.log("==================================================");
  console.log("   Luna Blade — Nimiq Treasury Key Derivation     ");
  console.log("==================================================");
  console.log("Target Treasury Address:", DEFAULT_TARGET);
  console.log("");

  let mnemonic = process.argv.slice(2).join(" ").trim();

  if (!mnemonic) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    mnemonic = await new Promise((resolve) => {
      rl.question("Enter your 24-word recovery phrase:\n> ", (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  if (!mnemonic) {
    console.error("Error: No recovery phrase provided.");
    process.exit(1);
  }

  // Normalize words
  const words = mnemonic.trim().replace(/\s+/g, " ");
  const wordCount = words.split(" ").length;
  console.log(`\nAnalyzing recovery phrase (${wordCount} words)...`);

  let seed;
  try {
    seed = Nimiq.MnemonicUtils.mnemonicToSeed(words);
  } catch (err) {
    console.error("Invalid recovery phrase:", err.message);
    process.exit(1);
  }

  const masterKey = Nimiq.ExtendedPrivateKey.generateMasterKey(seed);

  // Normalize target for comparison
  const normalizeAddr = (a) => a.replace(/\s+/g, "").toUpperCase();
  const targetNorm = normalizeAddr(DEFAULT_TARGET);

  // Candidate paths
  const pathsToTry = [
    "m/44'/242'/0'/0'",   // Standard Nimiq Hub Account 0
    "m/44'/242'/0'/0",
    "m/44'/242'/0'/1'",
    "m/44'/242'/1'/0'",
    "m/44'/242'/0'/2'",
    "m/44'/242'/2'/0'",
    "m/44'/242'/0'/3'",
    "m/44'/242'/3'/0'",
    "m/44'/242'/0'/4'",
    "m/44'/242'/4'/0'"
  ];

  let matched = null;

  // 1. Check BIP44 paths
  for (const p of pathsToTry) {
    try {
      const derived = masterKey.derivePath(p);
      const addr = derived.toAddress().toUserFriendlyAddress();
      if (normalizeAddr(addr) === targetNorm) {
        matched = {
          path: p,
          address: addr,
          privateKeyHex: derived.privateKey.toHex()
        };
        break;
      }
    } catch {
      // ignore
    }
  }

  // 2. Check root / legacy
  if (!matched) {
    try {
      const ext = Nimiq.MnemonicUtils.mnemonicToExtendedPrivateKey(words);
      const addr = ext.toAddress().toUserFriendlyAddress();
      if (normalizeAddr(addr) === targetNorm) {
        matched = {
          path: "Root / MnemonicExtendedKey",
          address: addr,
          privateKeyHex: ext.privateKey.toHex()
        };
      }
    } catch {
      // ignore
    }
  }

  if (matched) {
    console.log("\n==================================================");
    console.log(" MATCH FOUND!");
    console.log("==================================================");
    console.log("Derivation Path :", matched.path);
    console.log("Address         :", matched.address);
    console.log("Private Key Hex :", matched.privateKeyHex);
    console.log("==================================================\n");

    // Verify keypair derive
    const priv = Nimiq.PrivateKey.fromHex(matched.privateKeyHex);
    const kp = Nimiq.KeyPair.derive(priv);
    const verifiedAddr = kp.toAddress().toUserFriendlyAddress();

    if (normalizeAddr(verifiedAddr) !== targetNorm) {
      console.error("Verification failed: derived key does not match target address!");
      process.exit(1);
    }
    console.log("Key verification passed! (KeyPair correctly resolves to", verifiedAddr, ")");

    // Offer to update server/.env
    if (fs.existsSync(ENV_PATH)) {
      let envContent = fs.readFileSync(ENV_PATH, "utf8");

      // Update or add NIMIQ_TREASURY_ADDRESS
      if (envContent.includes("NIMIQ_TREASURY_ADDRESS=")) {
        envContent = envContent.replace(
          /NIMIQ_TREASURY_ADDRESS=.*/,
          `NIMIQ_TREASURY_ADDRESS=${matched.address}`
        );
      } else {
        envContent += `\nNIMIQ_TREASURY_ADDRESS=${matched.address}`;
      }

      // Update or add PAYOUT_ADMIN_ADDRESS
      if (envContent.includes("PAYOUT_ADMIN_ADDRESS=")) {
        envContent = envContent.replace(
          /PAYOUT_ADMIN_ADDRESS=.*/,
          `PAYOUT_ADMIN_ADDRESS=${matched.address}`
        );
      } else if (envContent.includes("#NIM_PAYOUT_ADDRESS=")) {
        envContent = envContent.replace(
          /#NIM_PAYOUT_ADDRESS=.*/,
          `PAYOUT_ADMIN_ADDRESS=${matched.address}`
        );
      } else {
        envContent += `\nPAYOUT_ADMIN_ADDRESS=${matched.address}`;
      }

      // Update or add NIM_PAYOUT_PRIVATE_KEY
      if (envContent.includes("NIM_PAYOUT_PRIVATE_KEY=")) {
        envContent = envContent.replace(
          /NIM_PAYOUT_PRIVATE_KEY=.*/,
          `NIM_PAYOUT_PRIVATE_KEY=${matched.privateKeyHex}`
        );
      } else if (envContent.includes("#NIM_PAYOUT_PRIVATE_KEY=")) {
        envContent = envContent.replace(
          /#NIM_PAYOUT_PRIVATE_KEY=.*/,
          `NIM_PAYOUT_PRIVATE_KEY=${matched.privateKeyHex}`
        );
      } else {
        envContent += `\nNIM_PAYOUT_PRIVATE_KEY=${matched.privateKeyHex}`;
      }

      // Enable payout cron
      envContent = envContent.replace(/PAYOUT_CRON_ENABLED=0/, "PAYOUT_CRON_ENABLED=1");

      fs.writeFileSync(ENV_PATH, envContent, "utf8");
      console.log("\n Successfully updated server/.env with treasury configuration:");
      console.log("  - NIMIQ_TREASURY_ADDRESS =", matched.address);
      console.log("  - PAYOUT_ADMIN_ADDRESS   =", matched.address);
      console.log("  - NIM_PAYOUT_PRIVATE_KEY = [CONFIGURED]");
      console.log("  - PAYOUT_CRON_ENABLED    = 1");
    }

    console.log("\nNext: Restart your server to load the new treasury signer:");
    console.log("  npm start --prefix server\n");

  } else {
    console.log("\n No direct match found for target address:", DEFAULT_TARGET);
    console.log("Here are the addresses generated from your recovery phrase:");
    console.log("----------------------------------------------------------------");
    for (const p of pathsToTry.slice(0, 5)) {
      try {
        const derived = masterKey.derivePath(p);
        console.log(` ${p.padEnd(20)} -> ${derived.toAddress().toUserFriendlyAddress()}`);
      } catch {}
    }
    const ext = Nimiq.MnemonicUtils.mnemonicToExtendedPrivateKey(words);
    console.log(` ${"Root Key".padEnd(20)} -> ${ext.toAddress().toUserFriendlyAddress()}`);
    console.log("----------------------------------------------------------------");
    console.log("Check if your address matches one of the above!");
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
