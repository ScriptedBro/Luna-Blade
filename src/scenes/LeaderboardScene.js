import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { getTodaySeedString } from '../engine/PRNG.js';
import { nimiqService } from '../engine/NimiqService.js';
import { nimiqModal } from '../ui/NimiqModal.js';
import { pauseService } from '../engine/PauseService.js';
import confetti from 'canvas-confetti';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LeaderboardScene' });
  }

  create(data) {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;
    this.todaySeed = getTodaySeedString();
    this.lastScore = data?.lastScore || 0;

    pauseService.detachScene();
    sound.playBGM('title');

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    // Background
    this.add.tileSprite(0, 0, w, h, 'env_bg').setOrigin(0, 0).setTint(0x334433);

    // Title
    this.add.text(w / 2, 16, '⚡ NIMIQ DAILY TOURNAMENT', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#f6c026'
    }).setOrigin(0.5);

    this.add.text(w / 2, 29, `Date: ${this.todaySeed} (UTC) • Verified on Nimiq Proof-of-Stake`, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#d0f0c0'
    }).setOrigin(0.5);

    // Daily Nimiq Award Banner
    this.add.text(w / 2, 42, '🏆 1,000 NIM PRIZE POOL • 1st: 500 NIM | 2nd: 300 NIM | 3rd: 200 NIM', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#ffd166',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // Leaderboard List
    this.renderLeaderboardTable(w);

    // Bottom Action Buttons
    const backBtn = this.add.rectangle(55, h - 18, 75, 20, 0x1e331e).setStrokeStyle(1, 0x3d5c3d).setInteractive({ useHandCursor: true });
    this.add.text(55, h - 18, '◄ MENU', { fontFamily: 'Press Start 2P', fontSize: '5.5px', color: '#fff' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('MenuScene');
    });

    const nimiqBtn = this.add.rectangle(155, h - 18, 105, 20, 0x2b2205).setStrokeStyle(1, 0xf6c026).setInteractive({ useHandCursor: true });
    this.add.text(155, h - 18, '⚡ NIMIQ ALTAR', { fontFamily: 'Press Start 2P', fontSize: '5.5px', color: '#f6c026' }).setOrigin(0.5);
    nimiqBtn.on('pointerdown', () => {
      nimiqModal.open();
    });

    const playBtn = this.add.rectangle(265, h - 18, 95, 20, 0x224422).setStrokeStyle(1, 0x98ff20).setInteractive({ useHandCursor: true });
    this.add.text(265, h - 18, 'PLAY TRIAL', { fontFamily: 'Press Start 2P', fontSize: '5.5px', color: '#f6c026' }).setOrigin(0.5);
    playBtn.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('SurvivalScene');
    });

    // Daily Reward Claim Button
    const claimBtn = this.add.rectangle(375, h - 18, 100, 20, 0x4a3a14).setStrokeStyle(1, 0xe9b213).setInteractive({ useHandCursor: true });
    const claimLabel = this.add.text(375, h - 18, 'CLAIM SPOILS 🎁', { fontFamily: 'Press Start 2P', fontSize: '5px', color: '#fff' }).setOrigin(0.5);

    claimBtn.on('pointerdown', () => {
      storage.addMaterials({ amber: 3, iron: 3, bark: 5 });
      sound.playVictory();
      try { confetti({ particleCount: 80, spread: 70 }); } catch (e) {}
      claimLabel.setText('CLAIMED! ✅');
      claimBtn.disableInteractive();
      alert('Daily Reward Claimed!\n+3 Amber, +3 Iron, +5 Bark added to your Satchel!');
    });
  }

  renderLeaderboardTable(w) {
    const tableContainer = this.add.container(0, 0);

    // Mock global entries + player's entry
    const playerRecord = storage.getDailyRecord(this.todaySeed);
    const myScore = playerRecord ? playerRecord.score : this.lastScore;
    const shortAddr = nimiqService.getShortAddress();
    const playerName = shortAddr ? `YOU (${shortAddr})` : 'YOU (Active)';

    const mockBoard = [
      { rank: '1st', name: 'NQ42 ElderSylva', score: Math.max(1450, myScore + 120), time: '135s', prize: '🥇 500 NIM' },
      { rank: '2nd', name: 'NQ19 HighBlade', score: Math.max(1180, myScore > 1000 ? myScore - 80 : 1020), time: '108s', prize: '🥈 300 NIM' },
      { rank: '3rd', name: 'NQ88 AmberStrike', score: Math.max(920, myScore > 800 ? myScore - 140 : 850), time: '82s', prize: '🥉 200 NIM' },
      { rank: '4th', name: 'NQ07 MossRanger', score: 710, time: '64s', prize: '🌲 Honor' },
      { rank: '5th', name: playerName, nameColor: '#98ff20', score: myScore, time: `${playerRecord?.details?.duration || 0}s`, prize: myScore > 1180 ? '🥈 300 NIM' : (myScore > 920 ? '🥉 200 NIM' : '🌲 Honor') }
    ];

    // Sort by score
    mockBoard.sort((a, b) => b.score - a.score);

    // Table Header
    const headBox = this.add.rectangle(w / 2, 68, 390, 16, 0x142014).setStrokeStyle(1, 0x2e4e2e);
    tableContainer.add(headBox);

    const headers = this.add.text(w / 2 - 180, 64, 'RANK   WARRIOR         TIME   SCORE      HONORS', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#8cb38c'
    });
    tableContainer.add(headers);

    // Rows
    mockBoard.forEach((row, idx) => {
      const y = 88 + idx * 22;
      const isPlayer = row.name.includes('YOU');

      const rowBox = this.add.rectangle(w / 2, y, 390, 18, isPlayer ? 0x223d22 : 0x111e11)
        .setStrokeStyle(1, isPlayer ? 0x98ff20 : 0x223822);
      tableContainer.add(rowBox);

      const rankText = this.add.text(w / 2 - 180, y - 3, `${idx + 1}.`, {
        fontFamily: 'Press Start 2P',
        fontSize: '6px',
        color: idx === 0 ? '#ffd700' : (idx === 1 ? '#e0e0e0' : (idx === 2 ? '#cd7f32' : '#888'))
      });
      tableContainer.add(rankText);

      const nameText = this.add.text(w / 2 - 140, y - 3, row.name, {
        fontFamily: 'Press Start 2P',
        fontSize: '5.5px',
        color: isPlayer ? '#98ff20' : '#ffffff'
      });
      tableContainer.add(nameText);

      const timeText = this.add.text(w / 2 + 10, y - 3, row.time, {
        fontFamily: 'Press Start 2P',
        fontSize: '5.5px',
        color: '#a0b8a0'
      });
      tableContainer.add(timeText);

      const scoreText = this.add.text(w / 2 + 65, y - 3, `${row.score} pts`, {
        fontFamily: 'Press Start 2P',
        fontSize: '6px',
        color: '#ffd700'
      });
      tableContainer.add(scoreText);

      const prizeText = this.add.text(w / 2 + 140, y - 3, row.prize, {
        fontFamily: 'Press Start 2P',
        fontSize: '5.5px',
        color: '#e9b213'
      });
      tableContainer.add(prizeText);
    });
  }
}
