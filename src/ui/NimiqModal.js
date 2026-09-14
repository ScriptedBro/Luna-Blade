import { nimiqService, NIMIQ_TREASURY_ADDRESS } from '../engine/NimiqService.js';
import { storage } from '../engine/Storage.js';
import { sound } from '../engine/Audio.js';

export class NimiqModal {
  constructor() {
    this.overlay = null;
    this.isOpen = false;
    this.createDom();
    nimiqService.subscribe(() => {
      if (this.isOpen) this.render();
    });
  }

  createDom() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'nimiq-modal-overlay';
    this.overlay.className = 'modal-overlay hidden';
    this.overlay.innerHTML = `
      <div class="modal-card nimiq-modal-card">
        <div class="modal-header nimiq-modal-header">
          <div class="modal-title-wrap">
            <span class="nimiq-logo-icon">⚡</span>
            <h3 id="nimiq-modal-title">NIMIQ CELESTIAL SHRINE</h3>
          </div>
          <button id="btn-close-nimiq-modal" class="pixel-close-btn" aria-label="Close">✖</button>
        </div>
        <div id="nimiq-modal-body" class="modal-body nimiq-modal-body">
          <!-- Dynamic Content -->
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    const btnClose = this.overlay.querySelector('#btn-close-nimiq-modal');
    btnClose.addEventListener('click', () => this.close());

    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  open() {
    this.isOpen = true;
    this.wasControlsVisible = Boolean(typeof window !== 'undefined' && window.touchController && window.touchController.isVisible);
    if (this.wasControlsVisible && window.touchController) {
      window.touchController.hide();
    }
    this.overlay.classList.remove('hidden');
    sound.playSelect();
    this.render();
  }

  close() {
    this.isOpen = false;
    this.overlay.classList.add('hidden');
    if (this.wasControlsVisible && typeof window !== 'undefined' && window.touchController) {
      window.touchController.show();
      this.wasControlsVisible = false;
    }
    sound.playBack();
  }

  render() {
    const body = this.overlay.querySelector('#nimiq-modal-body');
    const status = nimiqService.getStatus();
    const blessings = storage.data.moonBlessings || 0;

    let html = `
      <div class="nimiq-status-card ${status.connected ? 'connected' : 'disconnected'}">
        <div class="status-top">
          <div class="status-indicator">
            <span class="status-dot ${status.connected ? 'online' : 'offline'}"></span>
            <span class="status-text">${status.connected ? (status.isNimiqPay ? 'Nimiq Pay Connected' : 'Nimiq Web Sandbox Connected') : 'Not Connected'}</span>
          </div>
          ${status.connected ? `
            <button id="btn-nimiq-disconnect" class="pixel-btn-mini red">Disconnect</button>
          ` : `
            <button id="btn-nimiq-connect" class="pixel-btn-mini gold">Connect Wallet</button>
          `}
        </div>

        ${status.connected ? `
          <div class="address-display">
            <span class="addr-label">WALLET ADDRESS</span>
            <div class="addr-box">
              <code>${status.address}</code>
              <button id="btn-copy-addr" class="copy-btn" title="Copy Address">📋</button>
            </div>
            ${status.deviceId ? `<div class="device-id-tag">DEVICE ID: <code>${status.deviceId.slice(0, 8)}...${status.deviceId.slice(-6)}</code></div>` : ''}
          </div>
        ` : `
          <p class="connect-prompt">Connect your Nimiq wallet to receive Moon Blessings, verify leaderboard scores, and compete for the 1,000 NIM Daily Bounty!</p>
        `}
      </div>

      <div class="moon-blessings-panel">
        <div class="blessing-badge-row">
          <span class="moon-gem-icon">🌙</span>
          <div>
            <div class="blessing-title">CELESTIAL MOON BLESSINGS: <strong>${blessings} ACTIVE</strong></div>
            <small class="blessing-desc">${blessings > 0 ? '+10% Score Multiplier & Radiant Lunar Aura active on your runs!' : 'Make a Moon Offering to gain lunar blessings.'}</small>
          </div>
        </div>
      </div>

      <div class="offerings-section">
        <h4 class="section-title">⚡ SEND MOON OFFERING (NIM)</h4>
        <p class="offerings-sub">Micro-transactions to the High Forest Treasury in NIM & Luna (1 NIM = 100,000 Luna). Non-P2W vanity & run blessings.</p>

        <div class="offering-tiers">
          <button class="offering-card" data-amount="10">
            <div class="offering-top">
              <span class="nim-badge">10 NIM</span>
              <span class="luna-sub">(1M Luna)</span>
            </div>
            <div class="offering-reward">+1 Moon Blessing</div>
            <span class="offering-action-btn">OFFER ⚡</span>
          </button>

          <button class="offering-card featured" data-amount="50">
            <div class="offering-top">
              <span class="nim-badge">50 NIM</span>
              <span class="luna-sub">(5M Luna)</span>
            </div>
            <div class="offering-reward">+5 Moon Blessings</div>
            <span class="offering-action-btn">OFFER ⚡</span>
          </button>

          <button class="offering-card" data-amount="100">
            <div class="offering-top">
              <span class="nim-badge">100 NIM</span>
              <span class="luna-sub">(10M Luna)</span>
            </div>
            <div class="offering-reward">+12 Moon Blessings (Bonus!)</div>
            <span class="offering-action-btn">OFFER ⚡</span>
          </button>
        </div>
      </div>

      <div class="signer-section">
        <div class="signer-box">
          <span class="signer-title">VERIFIABLE PROOF OF SKILL</span>
          <p class="signer-desc">Cryptographically sign your run high score with your Nimiq private key to register tamper-proof leaderboard entries.</p>
          <button id="btn-sign-score" class="pixel-btn-secondary" ${!status.connected ? 'disabled' : ''}>
            ${status.connected ? '🔏 Sign Best Run (' + (storage.data.highScore || 0) + ' pts)' : 'Connect Wallet to Sign'}
          </button>
          <div id="sign-output" class="sign-output hidden"></div>
        </div>
      </div>
    `;

    body.innerHTML = html;
    this.bindEvents();
  }

  bindEvents() {
    const btnConnect = this.overlay.querySelector('#btn-nimiq-connect');
    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        btnConnect.textContent = 'Connecting...';
        btnConnect.disabled = true;
        await nimiqService.connect();
        this.render();
      });
    }

    const btnDisconnect = this.overlay.querySelector('#btn-nimiq-disconnect');
    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => {
        nimiqService.disconnect();
        this.render();
      });
    }

    const btnCopy = this.overlay.querySelector('#btn-copy-addr');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const addr = nimiqService.getStatus().address;
        if (addr && navigator.clipboard) {
          navigator.clipboard.writeText(addr).then(() => {
            btnCopy.textContent = '✅';
            setTimeout(() => { if (btnCopy) btnCopy.textContent = '📋'; }, 1500);
          }).catch(() => {});
        }
      });
    }

    // Offering buttons
    const offeringBtns = this.overlay.querySelectorAll('.offering-card');
    offeringBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const amount = Number(btn.dataset.amount);
        const originalText = btn.querySelector('.offering-action-btn').textContent;
        const actionSpan = btn.querySelector('.offering-action-btn');
        actionSpan.textContent = 'Sending...';
        btn.disabled = true;

        try {
          const res = await nimiqService.sendMoonOffering(amount, `Luna Blade: ${amount} NIM Offering`);
          sound.playCoin();
          actionSpan.textContent = 'Blessed! ✨';
          setTimeout(() => this.render(), 1200);
        } catch (err) {
          actionSpan.textContent = 'Failed ✖';
          setTimeout(() => {
            actionSpan.textContent = originalText;
            btn.disabled = false;
          }, 1500);
        }
      });
    });

    // Sign score button
    const btnSign = this.overlay.querySelector('#btn-sign-score');
    const signOutput = this.overlay.querySelector('#sign-output');
    if (btnSign) {
      btnSign.addEventListener('click', async () => {
        btnSign.textContent = 'Signing...';
        btnSign.disabled = true;
        const proof = await nimiqService.signScoreProof(storage.data.highScore || 0, 'SURVIVAL');
        if (proof && signOutput) {
          sound.playLevelUp();
          signOutput.classList.remove('hidden');
          signOutput.innerHTML = `
            <div class="proof-success">✅ Score Cryptographically Signed!</div>
            <div class="proof-sig">SIG: <code>${proof.signature.slice(0, 24)}...</code></div>
          `;
          btnSign.textContent = 'Signed ✅';
        } else {
          btnSign.textContent = 'Failed';
          btnSign.disabled = false;
        }
      });
    }
  }
}

export const nimiqModal = new NimiqModal();
