# 🌙 Luna Blade: The High Forest

> A fast-paced 2D pixel-art action-platformer and survival arcade game built with **Phaser 4**, designed for both modern web browsers and mobile **Nimiq Pay Mini Apps**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Phaser](https://img.shields.io/badge/Phaser-4.2-E44D26?logo=javascript&logoColor=white)](https://phaser.io/)
[![Nimiq](https://img.shields.io/badge/Nimiq-Mini%20App%20SDK-FFA000?logo=bitcoin&logoColor=white)](https://nimiq.com/)
[![Mobile Optimized](https://img.shields.io/badge/Mobile-Touch%20%26%20Landscape-success)](#mobile--mini-app-experience)

---

## 📖 Prologue: The Shattered Moon

*For an age, the silver light of the Lunar Core watched over the High Forest, keeping the ancient Blight slumbering deep beneath the elder roots.*

*Then came the Night of the Red Fracture. A cataclysmic tremor rent the moon asunder, raining searing lunar shards and crimson embers into the canopy. The seal shattered. Corrupted spores twisted gentle woodland fauna into rabid, armored abominations.*

*Guided by **Sylva the Moon Sprite**, a lone swordmaster must take up the enchanted **Luna Blade**, cleanse the Blight from the roots to the canopy, and face the horrors spawned by the fractured sky.*

---

## ⚔️ Key Features

### 1. 📜 Narrative Story Mode
- **Cinematic Prologue & Epilogue**: Multi-part animated cutscenes depicting the celestial cataclysm, raining meteors, and awakening of the forest.
- **Companion Dialogue**: In-game conversations with **Sylva the Moon Sprite**, complete with custom animated portraits, typewriter dialogue crawl, and skip controls.
- **Three Multi-Phase Chapters**:
  - **Chapter I: The Corrupted Glade** — Face infected forest dwellers and **Gorgok the Corrupted Troll**.
  - **Chapter II: The Hollow Canopy** — Scale ancient boughs guarded by aerial eyes and **Malakor the Blighted Sorcerer**.
  - **Chapter III: The Elder Roots** — Descend into the subterranean heart to sever the root of the celestial contagion.

### 2. 🎓 Guided Mobile Combat Tutorial
- **Professional Step-by-Step Training**: 6 progressive lessons guided by Sylva the Moon Sprite.
- **Interactive Button Guidance**: Dynamic glowing button highlights (`tutorial-highlight`) directly illuminate the exact touch control required for each maneuver.
- **Master Core Mechanics**:
  - *Lesson 1*: Running and traversal with D-Pad controls.
  - *Lesson 2*: Ground jump and mid-air double jump onto canopy platforms.
  - *Lesson 3*: Ground cleave attacks and breaking training crates.
  - *Lesson 4*: Upward aerial slash (`UP ATTK`) against airborne target orbs.
  - *Lesson 5*: Aerial stomp bounce mechanics dealing crushing `-25 HP` damage on enemy shells.
  - *Lesson 6*: Live sparring against combat dummies with active health gauges.

### 3. ⏳ Daily Luna Trial (Arcade Survival)
- **Deterministic Seeded Spawns**: A fresh daily seed powered by PRNG ensures an identical, fair challenge for all players worldwide each calendar day.
- **Progressive Wave Escalation**: Battle through escalating hordes of snails, explosive spore mushrooms, swooping stinger bees, charging wild boars, and aerial watchers.
- **Dynamic Combo System**: String attacks together without taking hits to rack up combo multipliers and speed-clear point bonuses.
- **Crate Drops**: Bash wooden crates to recover hearts (capped at 3 lives) and replenish stamina.

### 4. 🛡️ Fluid Combat & Traversal
- **Slash Combos**: Ground attack chains that cleave through charging enemies and deflect incoming projectile spores.
- **Upward Aerial Slash (`UP ATTK`)**: Launch into the sky to slice down diving bees and floating flyers.
- **Aerial Stomp Bounce**: Drop onto charging foes or sliding snail shells from above to deal crushing stomp damage (`-25 HP`) and bounce harmlessly into the air.
- **Shell Kick Mechanic**: Knock armored snails into their shells and send them ricocheting across the glade to bowl over other enemies.
- **Counter-Stagger Priority**: Strike charging boars or the Boss before impact to interrupt charges and deliver decisive counter-blows.

### 5. 📱 Mobile-First & Nimiq Pay Mini App Ready
- **Clean Touch-First UI**: Zero confusing desktop key hints (`[ESC]`, `[P]`, `[R]`, `J/K/Enter`) — clean mobile prompt labels (`TAP RESUME OR ⏸ TO CONTINUE`, `TAP RETRY`).
- **Adaptive Touch Controls**: Virtual D-Pad (Left/Right) and dedicated action buttons (`JUMP`, `SLASH`, `UP ATTK`) that elevate above bottom bezels and safe areas.
- **Smart Context Visibility**: Controls automatically hide during dialogue scenes and story intros, reappearing instantly when combat begins.
- **Full Landscape Canvas**: Stretches edge-to-edge with letterboxed pixel scaling, hiding intrusive browser headers on mobile.
- **Nimiq Wallet Integration**: Native integration with `@nimiq/mini-app-sdk` for instant wallet detection and seamless in-app tipping and rewards.

### 6. 🎶 16-Bit Retro Orchestral Soundtrack
- Bespoke retro fantasy soundtrack with distinct themes for **Title**, **The High Forest**, **Battle Waves**, **Boss Encounters**, and **Victory Epilogue**.
- Fallback Web Audio synth engine for sound effects (blade swooshes, impacts, crystal chimes, explosions).

---

## 🎮 Controls

### 📱 Mobile (Primary Touch Controls)
| On-Screen Button | Action |
| :--- | :--- |
| **◀ / ▶ (Left D-Pad)** | Run Left / Right |
| **JUMP** | Jump / Mid-Air Double Jump |
| **SLASH** | Cleave Sword Attack (Combos) |
| **UP ATTK** | Upward Aerial Slash (Anti-Air) |
| **JUMP (in air onto foe)** | Aerial Stomp Bounce (`-25 HP`) |
| **⏸ (Top Right)** | Pause / Resume / Main Menu |
| **Screen Tap / SKIP** | Advance Dialogue Crawl |

### 💻 Desktop (Keyboard Fallback)
| Key / Input | Action |
| :--- | :--- |
| <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> | Run Left / Right |
| <kbd>W</kbd> or <kbd>↑</kbd> or <kbd>Space</kbd> | Jump / Double Jump |
| <kbd>J</kbd> or <kbd>Z</kbd> or <kbd>Left Click</kbd> | Sword Slash |
| <kbd>K</kbd> or <kbd>X</kbd> or <kbd>Up Arrow + Slash</kbd> | Upward Air Slash (`UP ATTK`) |
| <kbd>S</kbd> or <kbd>↓</kbd> (in air) | Fast Fall / Stomp |
| <kbd>P</kbd> or <kbd>Esc</kbd> | Pause Game Menu |

---

## 👾 The Bestiary

| Foe | Behavior | Strategy |
| :--- | :--- | :--- |
| **Iron-Shelled Snail** | Patrols ground ledges; retreats into shell upon hit | Slash to send the shell sliding into other foes, or stomp bounce |
| **Blight Spore Mushroom** | Roots into ground and launches homing toxic spore bombs | Close distance quickly or slice spores out of the air |
| **High Forest Bee** | Hovers overhead, winds up, and swoops diagonally | Use `UP ATTK` to swat them as they dive |
| **Tusk Boar** | Roars, turns red, and charges at high speed | Time a slash for a counter-stagger, or jump stomp |
| **Corrupted Flying Eye** | Patrols high airspace and fires concentrated lasers | Lure down and strike with upward aerial slash |
| **Mirelurker (Ch 1)** | Water ambush amphibian; spits slowing mud and leaps | Stomp bounce mid-leap or slice mud balls out of the air |
| **Royal Hornet Guard (Ch 2)** | Armored golden hornet with pollen shield & drill dive | Upward slash (`UP ATTK`) breaks shield; strike while embedded |
| **Skeleton Legionnaire (Ch 3)** | Undead warrior with tower shield blocking front slashes | Stomp or upward-slash to break guard, or hit from behind for $3\times$ CRIT |
| **Cinder Drake (Ch 4)** | Magma-gliding dragon immune to lava; spits fire globs | Time a slash during dive-bomb for a counter stagger |
| **Astral Shade (Ch 5)** | Phasing void phantom; glides through platforms and casts rays | Punish during cast window and use upward slash to ground it |
| **Boss Gorgok the Troll** | Massive stone troll; stomps shockwaves and charges across the arena | **Only deals damage during active Charge**. Stomp bounce his head to deal 25 damage! |
| **Boss Malakor** | Blighted wizard; teleports across platforms and casts crimson lightning | Stay mobile, avoid lightning pillars, and strike during teleport recovery |

---

## 🛠️ Tech Stack

- **Game Engine**: [Phaser 4](https://phaser.io/) (Arcade Physics, Tilemaps, Tweening, Camera Systems)
- **Bundler & Dev Server**: [Vite 8](https://vitejs.dev/)
- **Mini App Integration**: [`@nimiq/mini-app-sdk`](https://github.com/nimiq/mini-app-sdk)
- **Audio**: Web Audio API + HTML5 Audio streaming
- **Visual FX**: Canvas Confetti, particle emitters, retro CRT shader filters

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### 1. Clone the Repository
```bash
git clone https://github.com/ScriptedBro/Luna-Blade.git
cd Luna-Blade
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173/` to play!

### 4. Build for Production
```bash
npm run build
```
The optimized static build will be generated in the `dist/` directory, ready to deploy to GitHub Pages, Vercel, Netlify, or AWS S3.

### 5. Preview Production Build
```bash
npm run preview
```

---

## 📁 Project Structure

```
Luna-Blade/
├── index.html               # Game shell, canvas container, and touch HUD markup
├── package.json             # Scripts & dependencies
├── vite.config.js           # Vite configuration & server options
├── public/
│   └── assets/
│       ├── audio/           # Soundtrack BGM (Title, Forest, Battle, Boss, Victory)
│       ├── character/       # Hero spritesheets (idle, run, attack, jump, hurt)
│       ├── companion/       # Sylva the Moon Sprite sprites and portraits
│       ├── env/             # Tilesets, parallax backgrounds, foreground foliage
│       ├── hud/             # Health hearts, icons, banners
│       └── mobs/            # Enemy spritesheets & boss animations
└── src/
    ├── config.js            # Global dimensions, gravity, physics settings
    ├── main.js              # Phaser game bootstrap
    ├── style.css            # Retro arcade framing, touch HUD, & responsive styling
    ├── engine/
    │   ├── Audio.js         # Sound manager (OST stream + Web Audio SFX)
    │   ├── NimiqService.js  # Nimiq Pay Mini App SDK client & wallet hooks
    │   ├── PauseService.js  # Universal pause modal & game loop orchestrator
    │   ├── PRNG.js          # Deterministic daily trial generator
    │   └── Storage.js       # Local storage save states (high scores, progress)
    ├── entities/            # Player, enemies, bosses, crates, and projectiles
    ├── scenes/
    │   ├── BootScene.js     # Asset preloading & animation builders
    │   ├── MenuScene.js     # Main menu, chapter select, trial launcher
    │   ├── TutorialScene.js # Guided mobile combat tutorial glade
    │   ├── StoryIntroScene.js # Prologue animated cutscenes & lore crawl
    │   ├── StoryScene.js    # 3-Chapter campaign mode
    │   ├── SurvivalScene.js # Endless/Daily Luna Trial mode
    │   ├── StoryEndingScene.js # Epilogue victory celebration
    │   ├── ForgeScene.js    # Weapon forge & stats upgrades
    │   └── LeaderboardScene.js # High scores display
    └── ui/
        ├── HeroHealthBar.js # Layered player hearts & HP HUD
        ├── BossHealthBar.js # Animated boss entrance & phase gauge
        ├── EnemyHealthBar.js# Floating enemy health indicators
        ├── StoryDialogueBox.js # Typewriter dialogue engine
        └── TouchControls.js # Mobile virtual D-Pad & action buttons
```

---

## 💎 Nimiq Pay Mini App Integration

Luna Blade runs as a standalone web game or directly inside the **Nimiq Pay** wallet via the Mini App framework:

1. **Auto-Detection**: The game automatically detects whether it is running within a Nimiq Mini App context (`window.ethereum` / `@nimiq/mini-app-sdk`).
2. **One-Tap Tipping**: Players can tip or support development with NIM directly from the title screen or pause menu.
3. **Optimized Viewport**: Adjusts seamlessly between standard mobile browser views and embedded wallet WebViews.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ⚔️ and 🌙 by <b>ScriptedBro</b>
</p>
