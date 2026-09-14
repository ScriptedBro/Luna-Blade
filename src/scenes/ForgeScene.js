import Phaser from 'phaser';
import { GAME_CONFIG } from '../config.js';
import { sound } from '../engine/Audio.js';
import { storage } from '../engine/Storage.js';
import { nimiqModal } from '../ui/NimiqModal.js';
import confetti from 'canvas-confetti';

export default class ForgeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ForgeScene' });
  }

  create() {
    const w = GAME_CONFIG.WIDTH;
    const h = GAME_CONFIG.HEIGHT;

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    // Background
    this.add.tileSprite(0, 0, w, h, 'env_bg').setOrigin(0, 0).setTint(0x445544);

    // Header
    this.add.text(w / 2, 20, 'ANCIENT HIGH FOREST FORGE', {
      fontFamily: 'Press Start 2P',
      fontSize: '10px',
      color: '#f6c026'
    }).setOrigin(0.5);

    this.add.text(w / 2, 34, 'Fair Non-Pay-To-Win Material & Cosmetic System', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#a0c4a0'
    }).setOrigin(0.5);

    // Live Materials Bar
    this.matsText = this.add.text(w / 2, 48, '', {
      fontFamily: 'Press Start 2P',
      fontSize: '6px',
      color: '#98ff20'
    }).setOrigin(0.5);
    this.updateHeaderBar();

    // Tab Navigation
    this.currentTab = 'free'; // 'free' or 'nim'
    this.createTabs(w);

    // Content container
    this.contentContainer = this.add.container(0, 0);
    this.renderTabContent(w, h);

    // Return button
    const backBtn = this.add.rectangle(48, h - 16, 72, 20, 0x1a2e1a).setStrokeStyle(1, 0x3d5c3d).setInteractive({ useHandCursor: true });
    this.add.text(48, h - 16, '◄ MENU', { fontFamily: 'Press Start 2P', fontSize: '6px', color: '#fff' }).setOrigin(0.5);
    backBtn.on('pointerdown', () => {
      sound.playCoin();
      this.scene.start('MenuScene');
    });

    // Nimiq Altar button
    const nimiqBtn = this.add.rectangle(150, h - 16, 110, 20, 0x2b2205).setStrokeStyle(1, 0xf6c026).setInteractive({ useHandCursor: true });
    this.add.text(150, h - 16, '⚡ NIMIQ ALTAR', { fontFamily: 'Press Start 2P', fontSize: '5.5px', color: '#f6c026' }).setOrigin(0.5);
    nimiqBtn.on('pointerdown', () => {
      nimiqModal.open();
    });

    // Preview Sprite of equipped warrior
    this.heroPreview = this.add.sprite(w - 40, h - 34, 'char_idle').setScale(1.2);
    this.heroPreview.play('player_idle');
  }

  updateHeaderBar() {
    const mats = storage.getMaterials();
    this.matsText.setText(`🌲Bark: ${mats.bark} | 🍯Amber: ${mats.amber} | ⚙️Iron: ${mats.iron}`);
  }

  createTabs(w) {
    // Free Crafting Tab
    this.tabFree = this.add.rectangle(w / 2 - 80, 66, 150, 18, this.currentTab === 'free' ? 0x2d522d : 0x142414)
      .setStrokeStyle(1, 0x98ff20)
      .setInteractive({ useHandCursor: true });
    this.txtTabFree = this.add.text(w / 2 - 80, 66, 'STANDARD BLADES', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#fff'
    }).setOrigin(0.5);

    // Prestige Tab
    this.tabNim = this.add.rectangle(w / 2 + 80, 66, 150, 18, this.currentTab === 'nim' ? 0x524214 : 0x241d0a)
      .setStrokeStyle(1, 0xe9b213)
      .setInteractive({ useHandCursor: true });
    this.txtTabNim = this.add.text(w / 2 + 80, 66, 'CELESTIAL & COMPANIONS', {
      fontFamily: 'Press Start 2P',
      fontSize: '5px',
      color: '#f6c026'
    }).setOrigin(0.5);

    this.tabFree.on('pointerdown', () => {
      this.currentTab = 'free';
      sound.playSlash(1);
      this.refreshTabs();
      this.renderTabContent(w, GAME_CONFIG.HEIGHT);
    });

    this.tabNim.on('pointerdown', () => {
      this.currentTab = 'nim';
      sound.playSlash(1);
      this.refreshTabs();
      this.renderTabContent(w, GAME_CONFIG.HEIGHT);
    });
  }

  refreshTabs() {
    this.tabFree.setFillStyle(this.currentTab === 'free' ? 0x2d522d : 0x142414);
    this.tabNim.setFillStyle(this.currentTab === 'nim' ? 0x524214 : 0x241d0a);
  }

  renderTabContent(w, h) {
    this.contentContainer.removeAll(true);
    const equipped = storage.getEquippedWeapon();

    if (this.currentTab === 'free') {
      // Free Craftable Blades
      const freeWeapons = [
        GAME_CONFIG.WEAPONS.STARTER,
        GAME_CONFIG.WEAPONS.IRON_BROADSWORD,
        GAME_CONFIG.WEAPONS.FOREST_GLAIVE
      ];

      freeWeapons.forEach((weap, idx) => {
        const y = 92 + idx * 46;
        const unlocked = storage.isWeaponUnlocked(weap.id);
        const isEquipped = equipped === weap.id;

        const card = this.add.rectangle(w / 2, y, 360, 40, 0x122212, 0.9).setStrokeStyle(1, isEquipped ? 0x98ff20 : 0x2e4e2e);
        this.contentContainer.add(card);

        const name = this.add.text(w / 2 - 160, y - 10, weap.name, {
          fontFamily: 'Press Start 2P',
          fontSize: '7px',
          color: isEquipped ? '#98ff20' : '#ffffff'
        });
        this.contentContainer.add(name);

        const stats = this.add.text(w / 2 - 160, y + 4, `Dmg: x${weap.damageMul} • Reach: x${weap.rangeMul} • ${weap.tier}`, {
          fontFamily: 'Press Start 2P',
          fontSize: '5px',
          color: '#8cb38c'
        });
        this.contentContainer.add(stats);

        // Action Button
        let btnText = 'EQUIP';
        let btnColor = 0x2a542a;

        if (isEquipped) {
          btnText = 'EQUIPPED';
          btnColor = 0x183318;
        } else if (!unlocked && weap.cost) {
          btnText = `CRAFT (${weap.cost.bark}B/${weap.cost.iron}I)`;
          btnColor = 0x3d4414;
        }

        const btn = this.add.rectangle(w / 2 + 115, y, 86, 22, btnColor)
          .setStrokeStyle(1, isEquipped ? 0x98ff20 : 0x4a7d4a)
          .setInteractive({ useHandCursor: !isEquipped });
        this.contentContainer.add(btn);

        const btnLbl = this.add.text(w / 2 + 115, y, btnText, {
          fontFamily: 'Press Start 2P',
          fontSize: '5px',
          color: '#ffffff'
        }).setOrigin(0.5);
        this.contentContainer.add(btnLbl);

        if (!isEquipped) {
          btn.on('pointerdown', () => {
            if (unlocked) {
              storage.equipWeapon(weap.id);
              sound.playCoin();
              this.renderTabContent(w, h);
            } else if (weap.cost) {
              const spent = storage.spendMaterials(weap.cost);
              if (spent) {
                storage.unlockWeapon(weap.id);
                storage.equipWeapon(weap.id);
                sound.playVictory();
                try { confetti({ particleCount: 50, spread: 60 }); } catch (e) {}
                this.updateHeaderBar();
                this.renderTabContent(w, h);
              } else {
                sound.playHit();
                alert('Not enough materials gathered from Forest yet!');
              }
            }
          });
        }
      });
    } else {
      // Celestial Blades, Companions & Perk Re-roll (Forest Material Crafts)
      const prestigeItems = [
        {
          id: GAME_CONFIG.WEAPONS.GOLDEN_ALBATROSS.id,
          name: 'Golden Solar Blade',
          desc: 'Sun-forged golden sword trail & sparkling embers.',
          cost: { amber: 8, iron: 6 },
          costLabel: '8 Amber, 6 Iron',
          type: 'weapon'
        },
        {
          id: GAME_CONFIG.WEAPONS.CORRUPTED_VOID.id,
          name: 'Corrupted Void Edge',
          desc: 'Ancient twilight essence. Dark obsidian shadow slashes.',
          cost: { amber: 10, iron: 8 },
          costLabel: '10 Amber, 8 Iron',
          type: 'weapon'
        },
        {
          id: 'satchel_pet',
          name: 'Moon Sprite Satchel (Sylva)',
          desc: 'Cosmetic Moon Sprite fairy hovering by your shoulder in trials.',
          cost: { bark: 8, amber: 6 },
          costLabel: '8 Bark, 6 Amber',
          type: 'satchel'
        },
        {
          id: 'relic_reroll',
          name: 'Stat Catalyst Re-roll',
          desc: `Current Perk: ${storage.getActivePerk().toUpperCase()}. Re-roll relic perk.`,
          cost: { bark: 2, amber: 2 },
          costLabel: '2 Bark, 2 Amber',
          type: 'reroll'
        }
      ];

      prestigeItems.forEach((item, idx) => {
        const y = 90 + idx * 36;
        const unlocked = item.type === 'weapon' ? storage.isWeaponUnlocked(item.id) :
                         (item.type === 'satchel' ? storage.data.satchelUnlocked : false);
        const isEquipped = item.type === 'weapon' ? (equipped === item.id) :
                           (item.type === 'satchel' ? storage.isCompanionActive() : false);

        const card = this.add.rectangle(w / 2, y, 360, 30, 0x221d0f, 0.9).setStrokeStyle(1, 0x5a4818);
        this.contentContainer.add(card);

        const name = this.add.text(w / 2 - 160, y - 8, item.name, {
          fontFamily: 'Press Start 2P',
          fontSize: '6px',
          color: '#f6c026'
        });
        this.contentContainer.add(name);

        const desc = this.add.text(w / 2 - 160, y + 4, item.desc, {
          fontFamily: 'Press Start 2P',
          fontSize: '4.5px',
          color: '#bfa770'
        });
        this.contentContainer.add(desc);

        // Button label
        let btnText = `CRAFT (${item.costLabel})`;
        if (unlocked && item.type === 'weapon') {
          btnText = isEquipped ? 'EQUIPPED' : 'EQUIP';
        } else if (unlocked && item.type === 'satchel') {
          btnText = isEquipped ? 'PET ON' : 'PET OFF';
        } else if (item.type === 'reroll') {
          btnText = `REROLL (${item.costLabel})`;
        }

        const btn = this.add.rectangle(w / 2 + 120, y, 90, 20, isEquipped ? 0x1e3a1e : 0x4a3a14)
          .setStrokeStyle(1, 0xe9b213)
          .setInteractive({ useHandCursor: true });
        this.contentContainer.add(btn);

        const btnLbl = this.add.text(w / 2 + 120, y, btnText, {
          fontFamily: 'Press Start 2P',
          fontSize: '4.5px',
          color: '#ffffff'
        }).setOrigin(0.5);
        this.contentContainer.add(btnLbl);

        btn.on('pointerdown', () => {
          if (unlocked && item.type === 'weapon') {
            storage.equipWeapon(item.id);
            sound.playCoin();
            this.renderTabContent(w, h);
          } else if (unlocked && item.type === 'satchel') {
            storage.toggleCompanion();
            sound.playCoin();
            this.renderTabContent(w, h);
          } else {
            // Material craft / unlock
            const success = storage.consumeMaterials(item.cost);
            if (success) {
              sound.playVictory();
              try { confetti({ particleCount: 40, spread: 50 }); } catch (e) {}

              if (item.type === 'weapon') {
                storage.unlockWeapon(item.id);
                storage.equipWeapon(item.id);
              } else if (item.type === 'satchel') {
                storage.unlockSatchel();
              } else if (item.type === 'reroll') {
                const perks = GAME_CONFIG.PERKS;
                const current = storage.getActivePerk();
                const others = perks.filter(p => p.id !== current);
                const nextPerk = Phaser.Utils.Array.GetRandom(others);
                storage.setActivePerk(nextPerk.id);
                alert(`Relic Perk Re-rolled! Now equipped with: ${nextPerk.name} (${nextPerk.desc})`);
              }

              this.updateHeaderBar();
              this.renderTabContent(w, h);
            } else {
              sound.playHit();
              alert(`Not enough materials gathered! Requires: ${item.costLabel}`);
            }
          }
        });
      });
    }
  }
}
