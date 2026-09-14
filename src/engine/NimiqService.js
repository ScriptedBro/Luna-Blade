import { init, getHostLanguage, requestDeviceIdentifier } from '@nimiq/mini-app-sdk';
import { storage } from './Storage.js';

// Official Community / Game Treasury Address for Luna Blade Offerings
export const NIMIQ_TREASURY_ADDRESS = 'NQ25 7E2B 2B1B GHE8 L7T1 2P8N V83C P94B T89X';

// 1 NIM = 100,000 Luna (the smallest atomic unit in Nimiq)
export const LUNA_PER_NIM = 100000;

class NimiqServiceManager {
  constructor() {
    this.provider = null;
    this.address = storage.getNimiqAccount() || null;
    this.deviceId = null;
    this.isNimiqPay = false;
    this.isInitialized = false;
    this.isSimulated = false;
    this.listeners = new Set();

    // Check host language synchronously from Nimiq Pay host context
    this.language = (typeof getHostLanguage === 'function' ? getHostLanguage() : null) ||
      (typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] : 'en') || 'en';

    // Auto-initialize when loaded
    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // Check if window.nimiq already injected or wait with short timeout
      if (typeof window !== 'undefined' && window.nimiq) {
        this.provider = window.nimiq;
        this.isNimiqPay = true;
      } else {
        // If top-level outside iframe, Nimiq Pay is not injecting, use swift check
        const isEmbedded = typeof window !== 'undefined' && (window.self !== window.top || window.opener);
        const timeoutMs = isEmbedded ? 600 : 200;

        // Attempt init from SDK (resolves when Nimiq Pay injects provider)
        const nimiq = await Promise.race([
          init({ timeout: timeoutMs }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Nimiq Pay host timeout')), timeoutMs + 50))
        ]);
        if (nimiq) {
          this.provider = nimiq;
          this.isNimiqPay = true;
        }
      }
    } catch {
      // Running in standard browser outside Nimiq Pay
      this.isNimiqPay = false;
    }

    // If inside Nimiq Pay, fetch current accounts
    if (this.isNimiqPay && this.provider) {
      try {
        const accounts = await this.provider.listAccounts();
        if (Array.isArray(accounts) && accounts.length > 0) {
          this.address = accounts[0];
          storage.setNimiqAccount(this.address);
        }
      } catch (err) {
        console.warn('Could not auto-list Nimiq accounts:', err);
      }

      // Try fetching device identifier for leaderboard & anti-cheat
      try {
        this.deviceId = await requestDeviceIdentifier({ reason: 'Luna Blade: Forest Warden Profile' });
      } catch {
        // User denied or prompt postponed
      }
    }

    this.isInitialized = true;
    this.notify();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => this.listeners.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    this.listeners.forEach(cb => {
      try { cb(status); } catch (e) { console.error(e); }
    });
  }

  getStatus() {
    return {
      connected: !!this.address,
      address: this.address,
      shortAddress: this.getShortAddress(),
      isNimiqPay: this.isNimiqPay,
      isSimulated: this.isSimulated,
      deviceId: this.deviceId,
      language: this.language,
      hasBlessing: storage.hasMoonBlessing()
    };
  }

  getShortAddress() {
    if (!this.address) return '';
    const clean = this.address.replace(/\s+/g, '');
    if (clean.length < 10) return clean;
    return `${clean.slice(0, 4)}...${clean.slice(-4)}`;
  }

  async connect() {
    if (this.isNimiqPay && this.provider) {
      try {
        const accounts = await this.provider.listAccounts();
        if (Array.isArray(accounts) && accounts.length > 0) {
          this.address = accounts[0];
          this.isSimulated = false;
          storage.setNimiqAccount(this.address);
          this.notify();
          return { success: true, address: this.address };
        }
      } catch (err) {
        return { success: false, error: err.message || 'Connection failed' };
      }
    }

    // Standalone fallback: connect demo / sandbox Nimiq wallet for web testing
    this.isSimulated = true;
    this.address = storage.getNimiqAccount() || 'NQ14 9F4S R61V D7A2 B5Q8 W9N3 C2X4 K8J1 L7P9';
    storage.setNimiqAccount(this.address);
    this.notify();
    return { success: true, address: this.address, simulated: true };
  }

  disconnect() {
    this.address = null;
    this.isSimulated = false;
    storage.setNimiqAccount(null);
    this.notify();
  }

  async sendMoonOffering(nimAmount, note = 'Luna Blade: Moon Offering') {
    if (!this.address) {
      const conn = await this.connect();
      if (!conn.success) throw new Error('Please connect your Nimiq wallet first');
    }

    const lunaValue = Math.round(nimAmount * LUNA_PER_NIM);

    if (this.isNimiqPay && this.provider) {
      try {
        const tx = await this.provider.sendBasicTransactionWithData({
          recipient: NIMIQ_TREASURY_ADDRESS,
          value: lunaValue,
          data: note
        });

        if (tx && typeof tx === 'object' && 'error' in tx) {
          throw new Error(tx.error?.message || 'Transaction rejected');
        }

        // Bestow in-game Moon Blessing
        storage.addMoonBlessing(nimAmount);
        this.notify();
        return { success: true, txHash: typeof tx === 'string' ? tx : 'tx_confirmed', simulated: false };
      } catch (err) {
        console.error('Nimiq Pay transaction failed:', err);
        throw err;
      }
    }

    // Standalone / Sandbox mode simulation
    await new Promise(r => setTimeout(r, 600));
    const mockHash = 'nim_' + Math.random().toString(16).slice(2, 10) + Math.random().toString(16).slice(2, 10);
    storage.addMoonBlessing(nimAmount);
    this.notify();
    return { success: true, txHash: mockHash, simulated: true };
  }

  async signScoreProof(score, mode = 'SURVIVAL') {
    if (!this.address) return null;

    const message = `Luna Blade Score Proof: ${score} pts | Mode: ${mode} | Player: ${this.address} | Time: ${Date.now()}`;

    if (this.isNimiqPay && this.provider) {
      try {
        const res = await this.provider.sign(message);
        if (res && 'signature' in res) {
          return { message, signature: res.signature, publicKey: res.publicKey };
        }
      } catch (e) {
        console.warn('Sign score rejected:', e);
      }
    }

    // Standalone fallback signature
    return {
      message,
      signature: 'sim_sig_' + Math.random().toString(36).substring(2, 18),
      publicKey: 'sim_pk_' + this.address.replace(/\s+/g, '')
    };
  }
}

export const nimiqService = new NimiqServiceManager();
