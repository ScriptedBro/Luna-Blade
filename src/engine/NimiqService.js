import { GAME_CONFIG } from '../config.js';

class NimiqService {
  constructor() {
    this.connected = false;
    this.address = 'NQ42 LUNA BLAD 1616 ALBA TROS 2026';
    this.shortAddress = 'NQ42 LUNA...2026';
    this.balanceNim = 150.0;
    this.network = 'Albatross PoS Testnet (Fast Finality ~1s)';
    this.txHistory = [];
    this.listeners = [];
  }

  init() {
    // Check if running inside Telegram Mini App or WebApp with Nimiq Provider
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    // Load cached simulated balance or wallet
    const saved = localStorage.getItem('LUNA_BLADE_NIMIQ');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.balanceNim = parsed.balanceNim ?? 150.0;
        this.txHistory = parsed.txHistory ?? [];
      } catch (e) {
        console.warn('Could not parse Nimiq wallet cache:', e);
      }
    }
    this.connected = true;
    this.notify();
  }

  save() {
    localStorage.setItem('LUNA_BLADE_NIMIQ', JSON.stringify({
      balanceNim: this.balanceNim,
      txHistory: this.txHistory
    }));
  }

  subscribe(callback) {
    this.listeners.push(callback);
    callback(this.getState());
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    const state = this.getState();
    this.listeners.forEach(cb => cb(state));
  }

  getState() {
    return {
      connected: this.connected,
      address: this.address,
      shortAddress: this.shortAddress,
      balanceNim: this.balanceNim,
      network: this.network,
      txHistory: this.txHistory
    };
  }

  async payNim(amount, purpose = 'In-game purchase') {
    if (this.balanceNim < amount) {
      return { success: false, error: 'Insufficient NIM balance' };
    }

    // Simulate Albatross PoS ~1s settlement
    await new Promise(resolve => setTimeout(resolve, 850));

    this.balanceNim -= amount;
    const txHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    
    const record = {
      type: 'PAYMENT',
      amount,
      purpose,
      txHash,
      timestamp: Date.now(),
      settledInMs: 850
    };

    this.txHistory.unshift(record);
    this.save();
    this.notify();

    return {
      success: true,
      txHash,
      newBalance: this.balanceNim,
      settledInMs: 850
    };
  }

  async testClaimPayout(rank = 1) {
    const pot = GAME_CONFIG.SURVIVAL.DAILY_PRIZE_POOL_NIM;
    let split = 0.60;
    if (rank === 2) split = 0.25;
    if (rank === 3) split = 0.15;
    const prize = Math.round(pot * split);

    await new Promise(resolve => setTimeout(resolve, 1000));
    this.balanceNim += prize;
    const txHash = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

    const record = {
      type: 'DAILY_PAYOUT',
      amount: prize,
      purpose: `Rank #${rank} Daily Luna Trial Prize`,
      txHash,
      timestamp: Date.now(),
      settledInMs: 1000
    };

    this.txHistory.unshift(record);
    this.save();
    this.notify();

    return {
      success: true,
      prize,
      txHash
    };
  }

  generateTelemetryProof(runData) {
    // Basic anti-cheat telemetry verification hash
    const payload = `${runData.seed}_${runData.duration}_${runData.kills}_${runData.score}_${runData.timestamp}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
    }
    return 'LUNA-PROOF-' + Math.abs(hash).toString(16).toUpperCase();
  }
}

export const nimiq = new NimiqService();
