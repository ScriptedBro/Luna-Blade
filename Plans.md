# Plans.md — Full Nimiq Integration for Luna Blade: The High Forest

> Branch: `FullNimiqIntegration`
> Goal: Turn Luna Blade from a game that *simulates* Nimiq into a game that **properly integrates** the Nimiq ecosystem — real wallet authentication (signature-verified), a **verified two-section on-chain leaderboard** (All-Time + Daily) with automated payouts, and a production-grade Nimiq Pay mini-app experience. Pattern-matched against the previous hackathon winner **[nspace](https://github.com/Harlski/nspace)** (cloned at `/home/fredrick/Desktop/Winner/nspace`).
>
> **This document is a plan only. No code is written yet. It awaits review before implementation.** *(Status 2026-09-15: implemented and verified — Phases 0-1, 2-3 below, gate, and cleanup are shipping.)*
>
> **Locked decisions (2026-09-15):**
> - Backend: **local only for now** — Express API runs locally in dev; hosting decided later.
> - Network: **`testalbatross` (testnet)** for all on-chain verification and payouts.
> - Payout parity: **Tier 2 — automated payout worker** with `NIM_PAYOUT_PRIVATE_KEY`.
> - Nimiq Pay first-contact tutorial: **skipped entirely** this round.
> - **Moon Offerings / Nimiq Shrine: removed from scope.** No player-initiated NIM transactions (offerings, fees, blessings, shop). NIM flows only one way: treasury → daily winners via the payout worker.
> - **Leaderboard: two sections** — **All-Time** (best verified score per wallet across all dates) and **Daily** (per UTC date). Arena layout uses a fixed seed (`CLASSIC_ARENA_SEED`) so every player faces the same layout, making All-Time scores comparable. The API takes **no seed parameter**; daily grouping is server-side by UTC date.

---

## 0. Executive Summary

Luna Blade currently ships with a **"fake" Nimiq integration**: it detects the Nimiq Pay injected provider, `listAccounts()`s the wallet, stores an address in `localStorage`, sends a *plain-text* memo through `sendBasicTransactionWithData`, returns **simulated** wallet/signature/transactions in any normal browser, and shows a **mock** leaderboard that claims a 1,000 NIM bounty nobody can actually claim.

"Proper" Nimiq integration — as demonstrated by the winner — means:

1. **Real wallet identity.** A challenge-response login where the wallet signs a server nonce (`Login:v1:{nonce}`), the **server** cryptographically verifies the signature with `@nimiq/core` (Ed25519), derives the wallet address from the public key, and issues a JWT session. No trusting the client's claimed address.
2. **Two-section, tamper-proof leaderboard.** Scores are signed score-proofs verified server-side; a fixed arena seed keeps every player on the same layout so an All-Time best-per-wallet board is fair, alongside the per-day Daily board. Neither board leaks full wallet addresses.
3. **On-chain honesty for rewards.** Leaderboard bounties pay out on-chain via an idempotent payout worker — never faked client-side. Low-stakes offline play is allowed but clearly marked "unverified".
4. **Mini-app polish.** Nimiq Pay host detection (`window.nimiqPay`), wait-for-host, host language, device identifier for anti-cheat, `?payEmulate` dev harness, portrait/landscape + immersive viewport handling, and a **connect-first gate** before game access.

---

## 1. Current State of Luna Blade (the gaps)

| Area | Current implementation | Problem |
|---|---|---|
| Wallet connect | `NimiqService.init()` calls `init()`/`listAccounts()`, stores address in `localStorage` | Address is **client-claimed** — anyone can impersonate any wallet. No proof of ownership, no server involvement. |
| Auth/session | None | No nonce, no signed challenge, no JWT. |
| Standalone browser mode | `connect()` falls back to a **hardcoded fake NQ address** and `isSimulated = true` | Purely cosmetic; identical to the "sandbox" lie. |
| Sign score | `provider.sign(message)` in Pay; **random fake sig** everywhere else | Nobody ever verifies the signature; leaderboard entries are not tamper-proof. |
| Leaderboard | `LeaderboardScene` renders a **hardcoded mock board** with fake names/scores and a fake "CLAIM SPOILS" that just gifts materials | Not global, not verified, "1,000 NIM Prize Pool • 1st 500 NIM" is unpayable fiction. |
| Payouts | None | No way to actually pay winners. |
| Nimiq Pay host handling | Detects `window.nimiq` but not `window.nimiqPay`; no wait-for-host, no emulation, no immersive/portrait handling | Pay WebView UX is fragile and untestable on desktop. |
| Avatar/identity polish | Plain shortened address in menu/leaderboard rows | No identicon, no Hub/Pay-aware display beyond a shortened address. |

**Dependencies already present:** `@nimiq/mini-app-sdk@0.1.0` (correct, current), `phaser`, `vite`, `canvas-confetti`.

**Dependencies needed (from winner + Nimiq docs):**

| Package | Where | Purpose |
|---|---|---|
| `@nimiq/core` (2.20.0) | `server/` | Signature verification → address derivation, tx verification (light client / RPC). |
| `@nimiq/hub-api` (`^1.13.0`) | `client/` | Browser sign-in via https://hub.nimiq.com. |
| `@nimiq/identicons` (`^1.6.2`) | `client/` + `server/` (optional) | Wallet avatar = same face as the wallet (menu/leaderboard rows). |
| `express`, `jsonwebtoken`, `cors` | `server/` | API + JWT sessions. |
| `dotenv` | `server/` | Config. |
| `@nimiq/style`, `nimiq-icons` | `client/` (optional) | Nimiq-styled UI bits if desired. |

---

## 2. Reference — How the Winner (nspace) Did It "Properly"

Extracted from `/home/fredrick/Desktop/Winner/nspace` (all paths relative to that repo).

### 2.1 Auth flow (`client/src/auth/nimiq.ts`, `server/src/auth.ts`, `server/src/verifyNimiq.ts`, `server/src/index.ts`)
- `GET /api/auth/nonce` → 32-byte hex nonce, 5-min TTL, single-use (in-memory map on server).
- Client signs `Login:v1:{nonce}`.
  - **Nimiq Pay path** (`isNimiqPayMiniApp()` = `window.nimiqPay != null`): `init()` then `nimiq.sign(message)`; **coerce** the returned `publicKey`/`signature` (they may be base64 string, hex string, `Uint8Array`, `ArrayBuffer`, or number array) → base64 → send `signer: ""` (present-but-empty) + `nimiqPayClient: true`.
  - **Hub path**: `new HubApi(VITE_HUB_URL || "https://hub.nimiq.com")`, `hubApi.signMessage({ appName, message })`; **omit** `signer` key when empty so the server can distinguish Hub vs Pay.
- `POST /api/auth/verify` on server:
  1. `consumeNonce` (replay protection).
  2. Recompute hash: `Hash.computeSha256("\x16Nimiq Signed Message:\n" + message.length + message)` — the exact **Keyguard `MSG_PREFIX`**.
  3. `new PublicKey(pub).verify(signature, hash)` via `@nimiq/core`.
  4. `publicKey.toAddress().toUserFriendlyAddress()` → the canonical wallet address (never trust the client's claimed address).
  5. Optional claimed-signer mismatch check; then **sign session** (JWT, 12h TTL) with `{ sub: address, nimiqPay }`.
- Sessions cached in `localStorage` (`nspace_auth_v1`, multi-account LRU of 5), `isTokenExpired` with 120s skew, JWT `exp` parsed client-side.

### 2.2 Player-side payments — REMOVED from scope
The winner's payment patterns (three-way memo encoding, Nimiq Pay `sendBasicTransactionWithData` retries, Hub `checkout`) powered nspace's player-initiated NIM transactions. Luna Blade **removed** that whole surface: no Moon Offerings, no blessings, no shop. The only outbound NIM is the **payout worker** (§2.3) — treasury → daily winners. This eliminates the memo-encoding, Hub-checkout, and offer-quote complexity from the client entirely; the client only ever **signs** (auth challenge + score proofs).

### 2.3 Server-side verification & payouts
- `server/src/verifyNimiq.ts` is a small, single-responsibility module (`verifySignedMessageDeriveAddress`), used by the auth path. **Keep this module pattern.**
- `payout-service` (port 3091): single signer wallet (`KeyPair.derive(PrivateKey.fromHex(NIM_PAYOUT_PRIVATE_KEY))`), idempotent outbox (`delivered-claim-ids.jsonl`), statuses pending → processing → awaiting_confirmation → completed / dead_letter, **never re-sends** confirmed/included/pending txs (isValueMovingState guard), reconciliation pass.

### 2.4 Mini-app / Pay-host UX (`client/src/ui/pseudoFullscreen.ts`, `main.ts`)
- `window.nimiqPay != null` = host marker (injected **before** scripts). After cross-mini-app navigation it can appear a few frames late → `waitForNimiqPayWebViewHost()`.
- `?payEmulate` dev stub hangs a fake `window.nimiqPay.sendBasicTransactionWithData` (also used to develop the Pay HUD on desktop).
- Immersive/pseudo-fullscreen + portrait/landscape layout helpers; host language via `getHostLanguage()` (already used by Luna Blade); `requestDeviceIdentifier({ reason })` for anti-cheat.
- Nimiq Pay first-time **tutorial** routes Pay sign-ins into a guided receive + send, with an "optimistic ack" (trust Pay send success for v1) + a visible escape timer. A useful pattern for Luna Blade's onboarding.

---

## 3. Target Architecture for Luna Blade

Luna Blade is a **single-player arcade game**, not a multiplayer world — the full nspace multi-service topology (game server + payment-intent + payout + analytics) is overkill. Recommended: **one lightweight Express API server** (`server/`) behind the existing Vite SPA + a separate payout worker module inside the same process. This keeps the "server is the source of truth" property while remaining deployable on one cheap VPS / Render / Railway box.

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  Browser (desktop / mobile) │         │  Nimiq Pay WebView (Mini App)│
│  Luna Blade SPA (Vite+Phaser)│        │  window.nimiqPay (host ctx)  │
└──────────────┬──────────────┘         └──────────────┬───────────────┘
               │  hub.signMessage                      │  init() → window.nimiq
               │  (@nimiq/hub-api)                     │  sign()
               ▼                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │            Luna Blade API server (Node/Express)            │
        │  • POST /api/auth/nonce    GET /api/auth/verify             │
        │  • verify sigs via @nimiq/core → derive NQ address → JWT     │
        │  • POST /api/scores (submit verified run)                   │
        │  • GET  /api/leaderboard/daily + /api/leaderboard/alltime   │
        │  • payout worker (idempotent, NIQ payout signer)            │
        └──────────────────────┬──────────────────────────────────────┘
                               │          @nimiq/core Client / JSON-RPC
                               ▼          (verify txs, poll confirmations)
                        Nimiq Network (currently testalbatross)
```

**Runtime**: the API server runs **locally** during development (see §9 Q1); the SPA talks to it through the Vite `/api` dev proxy so they share an origin. Deployment target is a later decision.

**Split into three workstreams:** (A) server/auth, (B) two-section leaderboard, (C) rewards/payouts. Each independently shippable and testable.

---

## 4. Detailed Implementation Plan

### Phase 0 — Foundations, config, & host detection

**New files:**
- `server/` — Express application.
  - `server/package.json`, `server/index.js` (entry + express wiring), `server/config.js` (env parsing).
  - `server/.env.example`: `JWT_SECRET`, `PORT=3001`, `NIMIQ_NETWORK=testalbatross` (testnet only for now), `NIMIQ_RPC_URL` (defaults to `test.nimiqwatch.com` for testalbatross), `NIM_PAYOUT_PRIVATE_KEY`, `DEV_AUTH_BYPASS=0`, `CORS_ORIGINS`.
  - `package.json` root: add `"server"` workspace or `dev` script running Vite + server concurrently (mirror nspace's nx-less `concurrently`).
- `client` additions:
  - `.env.development` / `.env.production`: `VITE_API_URL=https://lunablade.example.com` (proxied in dev via Vite `server.proxy` so the SPA and API share an origin), `VITE_HUB_URL=https://hub.nimiq.com`, `VITE_DEV_AUTH_BYPASS=0`.
  - `src/nimiq/host.js` — single source of truth for host detection:
    - `isNimiqPayMiniApp()` → `window.nimiqPay != null`
    - `waitForNimiqPayWebViewHost(timeoutMs)` (host may appear a few frames late)
    - `getPayHostLanguage()` → already via `getHostLanguage()`
    - `?payEmulate` stub installer (dev only): builds `window.nimiqPay` + a `sign` stub so the full Pay UX is exercisable from desktop.

**Changes to existing files:**
- `vite.config.js`: add dev proxy `/api` → `http://localhost:3001`.
- `src/main.js` / `index.html`: run `waitForNimiqPayWebViewHost()` before boot if `isNimiqPayMiniApp()`; tag `<html class="nimiq-pay-host">`; apply viewport-fit/safe-area utilities; **defer `new Phaser.Game(...)` until the connect gate resolves**.
- `package.json`: add `@nimiq/core`, `@nimiq/hub-api`, `@nimiq/identicons`, `express`, `jsonwebtoken`, `cors`, `dotenv`, `concurrently`.

### Phase 1 — Real wallet authentication (core of "proper")

**Winner pattern, adapted:** challenge-response with server-side verification.

**Server endpoints:**
- `GET /api/auth/nonce` → `{ nonce, expiresAt }` (32-byte hex, 5-min TTL, single-use `Map`; prune on access).
- `POST /api/auth/verify` body `{ nonce, message, signer?, signerPublicKey, signature, nimiqPayClient? }`:
  1. Validate missing fields → 400; `consumeNonce` → 401 `invalid_nonce`; `message === "Login:v1:"+nonce` → else `message_mismatch`.
  2. `verifySignedMessageDeriveAddress(message, signerPublicKey, signature)` from `server/src/verifyNimiq.js` (import `@nimiq/core`; prefix `\x16Nimiq Signed Message:\n`; `Hash.computeSha256`; `PublicKey.verify`; `toAddress().toUserFriendlyAddress()`).
  3. Pay detection rule (from winner): `nimiqPay = claimsPayClient && signer === ""` (present-but-empty). A stray flag alone must not label a Hub login.
  4. Sign JWT (`{ sub: address, nimiqPay }`, 12h) → `{ token, address, nimiqPay }`.
- Session middleware `server/src/auth.js` (`requireAuth`) → express middleware verifying `Authorization: Bearer <jwt>`.

**Client (`src/nimiq/`):**
- `auth.js` (mirrors `nspace/client/src/auth/nimiq.ts`):
  - `fetchNonce()`
  - `signLoginChallenge({ nonce, appName })` → Pay path (`init()`, `nimiq.sign(message)`, coerce bytes, base64, `signer: ""`, `nimiqPayClient: true`) | Hub path (`HubApi.signMessage`).
  - `signInWithWallet()` (always returns Pay-capable payload), `verifyWithServer()` (POSTs, surfaces `terms_privacy_ack_required`-style errors if added later).
  - `decodeBinaryString` + `coerceSignBytes` helpers to survive Pay's flexible return types.
- `session.js` (mirrors `nspace/client/src/auth/session.ts`):
  - Store `{ token, address, nimiqPay, updatedAt }` under `LUNA_BLADE_AUTH_V1`; simple single-account cache + `getTokenExpiryMs()` / `isTokenExpired(skew=120s)`; logout clears.
- `src/engine/NimiqService.js` **rewrite** — `connect()` becomes:
  - In Pay or Hub: fetch nonce → open wallet sign prompt → verify → keep **JWT + server-derived address**.
  - `getStatus()` now reports `authenticated`, `address` (server-derived), `nimiqPay`, `deviceId`, `language`, and **drops** `isSimulated`/fake addresses entirely.
  - `disconnect()` clears token + cached session.
  - `requestDeviceIdentifier({ reason: "Luna Blade leaderboard & anti-cheat" })` stored for score anti-cheat.
- **Connect-first gate** (`src/ui/ConnectGate.js`): `main.js` blocks Phaser boot on `nimiqService.connect()`; a secondary "Continue Offline — scores unverified" escape keeps the game playable. The header wallet button reopens this gate after boot.

### Phase 2 — Verified Leaderboard (All-Time + Daily, real scores, real rewards)

Today the leaderboard is mock data with fake bounty claims. Replace with a **server-authoritative, per-wallet, signature-anchored** board split into All-Time (best per wallet) and Daily (per UTC date).

**Server endpoints:**
- `POST /api/scores/submit` (auth required) body `{ dateSeed, score, durationMs, publicKey, signature }` where `message` is the exact run-proof string the client signed with the wallet (`Luna Blade Score Proof: {score} | Mode: {mode} | Player: {address} | Date: {dateSeed}`). Server:
  1. `requireAuth` (JWT sub = wallet).
  2. `verifySignedMessageDeriveAddress(message, args.publicKey, signature)` → ensure derived address == JWT `sub` (tamper-proof).
  3. Basic sanity (score > 0, fits float limits, one best-per-wallet per date, no future timestamps).
  4. Upsert best per `(wallet, dateSeed)`; store `{ wallet, score, durationMs, signedAt, proof }`. Response includes `rank` (daily) and `allTimeRank`.
- `GET /api/leaderboard/daily` → today's top-N rows + `prizeNim`; server keys by **today's UTC date** — **no client seed** (the old `?seed=` param and response `seed` field are removed).
- `GET /api/leaderboard/alltime` → best score **per wallet** across all dates, sorted; `getAllTimeRank(wallet)` for the submit response.
- No full wallet addresses leaked beyond short/NQ prefix (or identicon tokens).
- Storage: `server/data/leaderboard.sqlite` (use `better-sqlite3`, as the winner does) or a JSON file store for v1 (recommend SQLite — winner uses it and it survives restarts cleanly).

**Arena fairness:** the survival arena uses a single fixed seed (`CLASSIC_ARENA_SEED` in `src/engine/PRNG.js`) instead of a per-day seed, so every player — on any date — faces the same layout. This makes the All-Time board a genuinely fair comparison.

**Client changes:**
- `src/engine/NimiqService.js`: new `signScoreProof(score, mode, meta)` that returns a wallet-signed proof (real signature in both Pay and Hub — never fake).
- `src/scenes/SurvivalScene.js`: on run end, if authenticated → submit score to server (best-effort, non-blocking to the death/continue flow); show "VERIFIED" badge when the server accepted it. HUD label reads "SURVIVAL TRIAL".
- `src/scenes/LeaderboardScene.js` **rewrite of data layer**:
  - Fetch both `GET /api/leaderboard/daily` and `GET /api/leaderboard/alltime`; render **ALL-TIME / DAILY tabs** (daily keeps the prize banner + payout/settlement status; all-time has none). Title is "⚡ LEADERBOARD".
  - Show real prize eligibility rules (below). Keep the retro Phaser table rendering.
- `src/engine/Storage.js`: keep local `dailyRecords`/`highScore` for offline play, but the **server board is authoritative** for the tournament.

### Phase 3 — Automated reward payouts (Tier 2)

Lock: **Tier 2 — automated payout worker.** Server signs and settles payouts for the verified daily leaderboard automatically, matching the winner's architecture (`payout-service`). `NIM_PAYOUT_PRIVATE_KEY` is a testnet-funded signer on `testalbatross`.

**Payout service (`server/src/payout.js`, runs in-process inside the same Express server for now):**
- On a daily cron (or manual trigger for v1, at day-end UTC): collect the verified top-N from the leaderboard store, build payout transactions to the winners' wallet addresses for the declared amounts (500/300/200 NIM), sign with `KeyPair.derive(PrivateKey.fromHex(NIM_PAYOUT_PRIVATE_KEY))`, and broadcast via `@nimiq/core`.
- **Idempotent outbox** (`server/data/payouts.jsonl`): append `{dateSeed, winnerAddress, amountLuna, txHash, status}` as they progress → processing → awaiting_confirmation → completed.
- **`isValueMovingState` guard (critical — winner lesson):** before re-processing a record, check the tx status on-chain; **never re-send** a transaction that is already `included`, `confirmed`, `finalized`, `pending`, or `mempool`. Dead-letter unresolvable failures so a human can intervene rather than risk a double-spend.
- **No payout cron in dev by default**: set `PAYOUT_CRON_ENABLED=0` in `server/.env` / `.env.example` (safe default); enable in the demo environment or by running `POST /api/payouts/trigger-run` manually to trigger an immediate cycle for testing.

**New server endpoints:**
- `POST /api/payouts/trigger-run` (auth required / admin-only for now) → immediately runs the payout worker for the latest completed day; returns the outbox state.
- `GET /api/payouts/status` → summary of the latest payout run (pending / processing / completed / dead_letter counts + tx hashes).

UI in `LeaderboardScene`: show payout status honestly — "Payout worker online/offline — daily spoils staged for settlement" and the payout status of the current day (e.g. "Payout pending", "Paid 1st/2nd/3rd — tx hashes shown"). No unbacked "prize pool" banner.

### Phase 4 — Mini-app, gate & identity polish

- **Connect-first gate:** the SPA boots to `src/ui/ConnectGate.js`, which requires `nimiqService.connect()` before the first scene; "Continue Offline" labels every subsequent claim as unverified. The header wallet button reopens the gate at any time.
- **Identicons (optional):** add `@nimiq/identicons` + `src/nimiq/identicon.js` (set `globalThis.IdenticonsAssets` once; normalize address to spaced 4-char groups via `toNimiqUserFriendlyForIdenticon` — a compact NQ string **hashes differently**, so the same face as the wallet requires the spaced form). Use in the menu status line and leaderboard rows.
- **Host UX:** safe-area insets on touch buttons (already mobile-first — extend to `env(safe-area-inset-*)`), `?payEmulate` for desktop testing, landscape/portrait consistent with existing `TouchControls`.
- **Language:** `getHostLanguage()` already used — ensure "Not Connected / CONNECT WALLET / SIGN BEST RUN" etc. accept a locale map (at minimum English with host-language fallback for the Pay banner).
- **Device identifier:** require `requestDeviceIdentifier` for score submission (anti-cheat) and include it in the signed proof message.
- ~~Nimiq Pay first-contact tutorial~~ — **skipped this round** (decision). The winner's faucet-tutorial flow is a potential future feature, not part of the current scope.

### Phase 5 — Honest offline/grace paths

- If not authenticated: leaderboard shows "SIGN IN TO VERIFY" state; local scores still tracked locally with a `unverified` tag; no fake wallets, no fake sigs, no fake txs.
- If running in a plain browser with no Hub (rare, e.g. detached iframe): show "NIMIQ NOT AVAILABLE" rather than injecting a fake address.

---

## 5. File-by-File Change Map (Luna Blade repo)

**New — client**
| File | Purpose |
|---|---|
| `src/nimiq/host.js` | Pay-host detection, `waitForNimiqPayWebViewHost`, `?payEmulate` stub. |
| `src/nimiq/auth.js` | nonce fetch, Pay/Hub sign, verify with server, `coerceSignBytes` helpers. |
| `src/nimiq/session.js` | JWT cache, expiry/skew, logout. |
| `src/ui/ConnectGate.js` | connect-first gate: blocks Phaser boot until wallet connect (or "Continue Offline"); reusable via `window.__lunaGate`. |
| `src/nimiq/identicon.js` | identicon data URLs + address normalization. |
| `src/nimiq/leaderboard.js` | submit proof + fetch daily/all-time board + payout status API. |
| `.env.development` / `.env.production` | `VITE_API_URL`, `VITE_HUB_URL`. |

**New — server**
| File | Purpose |
|---|---|
| `server/package.json`, `server/index.js`, `server/config.js` | Express app + env. |
| `server/src/auth.js` | nonce store, JWT sign/verify, `requireAuth` middleware. |
| `server/src/verifyNimiq.js` | `verifySignedMessageDeriveAddress` via `@nimiq/core`. |
| `server/src/leaderboard.js` | SQLite store, submit + daily/all-time queries + ranks. |
| `server/src/payout.js` | Tier 2 automated worker: outbox ledger, `isValueMovingState` guard, daily cron (disabled by default). |
| `server/.env.example` | all required env vars + comments. |
| `server/data/` | SQLite/JSONL data dir (gitignored). |

**Modified — client**
| File | Change |
|---|---|
| `src/engine/NimiqService.js` | Rewrite: real auth, verified proofs; remove simulated wallet/sigs/txs. |
| `src/engine/PRNG.js` | Fixed `CLASSIC_ARENA_SEED` — same survival arena for every player (no per-day seed). |
| `src/scenes/MenuScene.js` | Status line uses real auth state; "SIGN IN" affordance (seed/blessing banner removed). |
| `src/scenes/SurvivalScene.js` | Submit verified run on game over ("SURVIVAL TRIAL" HUD, no seed display). |
| `src/scenes/LeaderboardScene.js` | Real data source; ALL-TIME + DAILY tabs; verified rows; honest reward copy; no altar. |
| `src/scenes/ForgeScene.js` | Nimiq Altar removed; Celestial & Companions cosmetics tab kept. |
| `src/ui/TouchControls.js` | Header wallet button reopens the connect gate instead of the altar. |
| `src/engine/Storage.js` | session account cache (`nimiqAccount`); blessing state removed. |
| `src/main.js` | host-aware boot, connect-first gate (deferred Phaser boot), class tags. |
| `index.html` | status bar reflects auth; wallet button retitled; safe-area classes; loader copy; gate markup. |
| `vite.config.js` | `/api` dev proxy. |
| `package.json` | new deps + scripts. |
| `.gitignore` | `server/data/*`, `server/.env`. |

**Removed — no shrine / offerings anywhere**
`src/ui/NimiqModal.js`, `src/nimiq/payments.js`, `server/src/offerings.js`, `server/src/nimRpc.js`, `NIMIQ_TREASURY_ADDRESS` in `server/.env.example`. Player-initiated NIM transactions do not exist; only the payout worker sends NIM (treasury → winners).

---

## 6. Security Considerations (must-haves)

1. **Never trust client wallet claims.** Address always derived server-side from a verified signature (`server/src/verifyNimiq.js`).
2. **Nonce single-use + TTL** (replay protection), and the signed message must **include the nonce**.
3. **JWT secret** from env, `openssl rand -base64 32`; no fallback to a hardcoded default in production; 12h TTL.
4. **Signature verify byte handling:** accept Pay's flexible encodings (hex/base64/Uint8Array/array) on the *client*, but the server always expects the base64 you normalized — validate lengths (publicKey = 32 bytes Ed25519, signature = 64 bytes) to avoid alloc/DoS.
5. **Pay detection** must be `claimsPayClient && signer === ""` — a bare flag must not elevate a Hub login.
6. **Payout idempotency** — never re-send confirmed/included/pending txs; ledger + `isValueMovingState` guard (winner's hard-won lesson).
7. **No secrets in the SPA** — `NIM_PAYOUT_PRIVATE_KEY` lives only on the server.
8. **CORS** restricted to the SPA origin(s) via `CORS_ORIGINS`.
9. **Rate-limit** `/api/auth/nonce` and `/api/scores/submit` per IP (simple in-memory counter) to stop spam/brute-force.

---

## 7. Testing / Verification Plan

**Client (static, `npm run dev`):**
- `?payEmulate` on desktop: connect through the gate → sign challenge → play → submit a signed score; the header wallet button reopens the gate. Assert no Hub opens inside Pay.
- Normal browser (no emulation): connect uses **Hub** (`https://hub.nimiq.com`); sign score uses Hub. Assert no fake addresses/sigs anywhere in the DOM.
- Unauthenticated state: leaderboard shows honest "sign in to verify"; abandoned gate reports `cancelled`/`offline` honestly.
- Leaderboard tabs: ALL-TIME shows best-per-wallet across dates; DAILY shows today's rows + prize banner; both with a fixed arena seed (no `seed` in any URL/UI).

**Server (unit + integration, `node --test`):**
- `verifyNimiq.test` — fixture (publicKey, signature, message) → assert derived address matches; wrong key/sig → null. (Reuse a known-good Nimiq test vector; if none available, generate via `@nimiq/core` `KeyPair.generate` in the test and verify round-trip.)
- auth flow: nonce → (mock Pay payload) verify → JWT; replay of the same nonce → 401.
- leaderboard: submit with forged/unsigned proof → 401; dup best-score upsert keeps highest; daily rank + all-time aggregation (best per wallet) correct.

**End-to-end (manual, Nimiq Pay Testnet / `testalbatross`):**
- Fresh Nimiq Pay install → sign in → play a run → verified score appears on both leaderboard sections.
- Play a Daily run — the HUD shows "SURVIVAL TRIAL"; no seed/date line anywhere in the UI.
- Bounty payout → payout ledger marks paid exactly once (Tier 2 worker).

---

## 8. Milestones / Definition of Done

| # | Milestone | Done when |
|---|---|---|
| M1 | Foundations & host detection | `?payEmulate` boots the game with Pay-aware UI on desktop; `/api` proxy works; connect gate blocks Phaser boot until connect/offline choice. |
| M2 | Real auth (Pay + Hub) | Wallet sign-in returns a server-issued JWT; address derived on server; no fake addresses anywhere. |
| M3 | Verified leaderboard (All-Time + Daily) | Tests prove forged scores are rejected; both boards render server data on a fixed arena seed; no `seed` param/field. |
| M4 | Automated payouts (Tier 2) | Daily winners are paid by the worker; ledger idempotent; `isValueMovingState` guard proven. |
| M5 | Mini-app polish | Host language, immersive viewport, connect-first gate, header reconnect, honest offline states. |

**Definition of done overall:** the repo builds clean (`npm run build`), the game in a normal browser uses Nimiq **Hub** for wallet actions, inside Nimiq Pay it uses the **injected provider**, every Nimiq claim in the UI is honest, and the leaderboard is server-verified across its All-Time and Daily sections. Payouts run on `testalbatross` with the automated Tier 2 worker. No shrine, offerings, or seed plumbing remains.

---

## 9. Risks & Open Questions

**Resolved (locked):**
- **Payout tier:** Tier 2 (automated worker) — needs a `testalbatross`-funded signer wallet and the `isValueMovingState` double-spend guard tested before enabling.
- **Network:** `testalbatross` for everything this round.
- **Backend:** local-only at runtime now; hosting decided later.
- **Moon Offerings / Nimiq Shrine:** removed — no player-initiated NIM transactions; NIM flows only as verified payouts.
- **Leaderboard:** fixed arena seed (`CLASSIC_ARENA_SEED`) + All-Time / Daily tabs; API is seed-free.
- **First-contact tutorial:** skipped.

**Remaining questions:**
1. **Hosting later** — when it's demo time, a same-origin deploy (SPA + API on one box) is still recommended to avoid CORS; decide then.
2. **Dev budget for Tier 2 payouts** — the worker + dead-letter reconciliation is the most complex non-client piece. If demo-day approval risk matters, a Tier 1 manual trigger (`POST /api/payouts/trigger-run`) is the v1 fallback within the same worker so the ledger logic doesn't change.
3. **Prize pool honesty** — daily spoils are fixed at 500/300/200 NIM; confirm the `testalbatross` payout signer is funded to cover a full top-3 each day, and reflect the real pools in the UI copy.
4. **`@nimiq/core` in browser vs server** — signature verification runs **server-side only** (winner's architecture); keep `@nimiq/core` out of the SPA bundle to control bundle size.

---

## 10. Phased Handoff (what the implementer will do first)

Order of work: **Phase 0** (repo structure, deps, host detection, `?payEmulate`, connect gate) → **Phase 1** (auth server + client) → **Phase 2** (two-section leaderboard) → **Phase 3** (Tier 2 payout worker) → **Phase 4** (polish) → **Phase 5** (honest states) — matching the milestones M1→M5. Each phase is independently committable and testable.

*This plan mirrors the winner's (nspace) proven patterns — `Login:v1:{nonce}` challenge-response auth, Keyguard `MSG_PREFIX` verification with `@nimiq/core`, Pay-host detection with `?payEmulate`, a connect-first gate, and idempotent payout ledgers — scaled to a single-player arcade game, with the player-facing NIM transaction surface removed entirely.*