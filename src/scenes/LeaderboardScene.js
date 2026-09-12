import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { getTodaySeedString } from '../engine/PRNG.js';
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

    // Background
    this.add.tileSprite(0, 0, w, h, 'env_bg').setOrigin(0, 0).setTint(0x334433);

    // Title
    this.add.text(w / 2, 20, 'DAILY TOURNAMENT LEADERBOARD', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#f6c026'
    }).setOrigin(0.5);

    this.add.text(w / 2, 34, `UTC Date: ${this.todaySeed} • Daily High Forest Trials`, {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#d0f0c0'
    }).setOrigin(0.5);

    // Daily Award Banner
    this.add.text(w / 2, 48, '🥇 1st: Gold Trophy | 🥈 2nd: Silver Trophy | 🥉 3rd: Bronze Trophy', {
      fontFamily: 'Press Start 2P',
      fontSize: '5.5px',
      color: '#e9b213'
    }).setOrigin(0.5);

    // Leaderboard List
    this.renderLeaderboardTable(w);

    // Bottom Action Buttons
    const backBtn = this.add.rectangle(70, h - 20, 100, 22, 0x1e331e).setStrokeStyle(1, 0x3d5c3d).setInteractive({ useHandCursor: true });
    this.add.text(70, h - 20, '◄ MENU', { fontFamily: 'Press Start 2P', fontSize: '6px', color: '#fff' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('MenuScene');
    });

    const playBtn = this.add.rectangle(w / 2, h - 20, 130, 22, 0x224422).setStrokeStyle(1, 0x98ff20).setInteractive({ useHandCursor: true });
    this.add.text(w / 2, h - 20, 'PLAY TRIAL', { fontFamily: 'Press Start 2P', fontSize: '6px', color: '#f6c026' }).setOrigin(0.5);
    playBtn.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('SurvivalScene');
    });

    // Daily Reward Claim Button
    const claimBtn = this.add.rectangle(w - 90, h - 20, 140, 22, 0x4a3a14).setStrokeStyle(1, 0xe9b213).setInteractive({ useHandCursor: true });
    const claimLabel = this.add.text(w - 90, h - 20, 'CLAIM REWARD 🎁', { fontFamily: 'Press Start 2P', fontSize: '5px', color: '#fff' }).setOrigin(0.5);

    claimBtn.on('pointerdown', () => {
      storage.addMaterials({ amber: 3, iron: 3, bark: 5 });
      sound.playVictory();
      try { confetti({ particleCount: 80, spread: 70 }); } catch (e) {}
      claimLabel.setText('CLAIMED! (+Spoils)');
      claimBtn.disableInteractive();
      alert('Daily Reward Claimed!\n+3 Amber, +3 Iron, +5 Bark added to your Satchel!');
    });
  }

  renderLeaderboardTable(w) {
    const tableContainer = this.add.container(0, 0);

    // Mock global entries + player's entry
    const playerRecord = storage.getDailyRecord(this.todaySeed);
    const myScore = playerRecord ? playerRecord.score : this.lastScore;

    const mockBoard = [
      { rank: '1st', name: 'Elder_Sylva', score: Math.max(1450, myScore + 120), time: '135s', prize: '🥇 Gold' },
      { rank: '2nd', name: 'HighBlade_7', score: Math.max(1180, myScore > 1000 ? myScore - 80 : 1020), time: '108s', prize: '🥈 Silver' },
      { rank: '3rd', name: 'Amber_Striker', score: Math.max(920, myScore > 800 ? myScore - 140 : 850), time: '82s', prize: '🥉 Bronze' },
      { rank: '4th', name: 'Moss_Ranger', score: 710, time: '64s', prize: '🌲 Honor' },
      { rank: '5th', name: 'YOU (Active)', nameColor: '#98ff20', score: myScore, time: `${playerRecord?.details?.duration || 0}s`, prize: myScore > 1180 ? '🥈 Silver' : '🌲 Honor' }
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
