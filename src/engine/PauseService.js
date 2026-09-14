import { sound } from './Audio.js';

export class PauseService {
  constructor() {
    this.activeScene = null;
    this.modeName = '';
    this.isPaused = false;
    this.buttonsVisible = false;

    this.btnHeader = null;
    this.btnLandscape = null;
    this.modal = null;
    this.txtMode = null;

    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => this.initDOM());
      if (document.readyState === 'interactive' || document.readyState === 'complete') {
        this.initDOM();
      }
    }
  }

  initDOM() {
    if (this.modal) return;

    this.btnHeader = document.getElementById('btn-pause-header');
    this.btnLandscape = document.getElementById('btn-pause-landscape');
    this.modal = document.getElementById('pause-modal');
    this.txtMode = document.getElementById('pause-mode-desc');

    const btnClose = document.getElementById('btn-close-pause');
    const btnResume = document.getElementById('btn-pause-resume');
    const btnRetry = document.getElementById('btn-pause-retry');
    const btnMenu = document.getElementById('btn-pause-menu');

    if (this.btnHeader) {
      this.btnHeader.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    }

    if (this.btnLandscape) {
      this.btnLandscape.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggle();
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => this.resume());
    }

    if (btnResume) {
      btnResume.addEventListener('click', () => this.resume());
    }

    if (btnRetry) {
      btnRetry.addEventListener('click', () => this.retry());
    }

    if (btnMenu) {
      btnMenu.addEventListener('click', () => this.goToMenu());
    }

    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.resume();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP' || (e.code === 'Escape' && this.isPaused)) {
        if (this.activeScene) {
          if (this.isPaused) {
            e.preventDefault();
            this.resume();
          } else if (this.canPause()) {
            e.preventDefault();
            this.pause();
          }
        }
      }
    });
  }

  canPause() {
    if (!this.activeScene) return false;
    if (this.activeScene.inDialogue) return false;
    if (this.activeScene.isVictory) return false;
    if (this.activeScene.isGameOver) return false;
    if (this.activeScene.player && this.activeScene.player.isDead) return false;
    return true;
  }

  attachScene(scene, modeName = '') {
    this.initDOM();
    this.activeScene = scene;
    this.modeName = modeName;
    this.isPaused = false;
    this.showButtons();
  }

  detachScene() {
    if (this.isPaused) {
      this.resume();
    }
    this.activeScene = null;
    this.modeName = '';
    this.hideButtons();
  }

  showButtons() {
    this.buttonsVisible = true;
    if (this.btnHeader) this.btnHeader.classList.remove('hidden');
    if (this.btnLandscape) this.btnLandscape.classList.remove('hidden');
  }

  hideButtons() {
    this.buttonsVisible = false;
    if (this.btnHeader) this.btnHeader.classList.add('hidden');
    if (this.btnLandscape) this.btnLandscape.classList.add('hidden');
  }

  toggle() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  pause() {
    if (!this.canPause()) return;
    this.isPaused = true;

    if (this.activeScene && this.activeScene.physics) {
      this.activeScene.physics.pause();
    }

    if (typeof window !== 'undefined' && window.touchController) {
      window.touchController.hide();
    }

    if (this.txtMode) {
      this.txtMode.textContent = this.modeName || 'BATTLE IN PROGRESS';
    }

    if (this.modal) {
      this.modal.classList.remove('hidden');
    }

    sound.playSelect();
  }

  resume() {
    if (!this.isPaused) return;
    this.isPaused = false;

    if (this.modal) {
      this.modal.classList.add('hidden');
    }

    if (this.activeScene && this.activeScene.physics) {
      this.activeScene.physics.resume();
    }

    if (this.canPause() && typeof window !== 'undefined' && window.touchController) {
      window.touchController.show();
    }

    sound.playSelect();
  }

  retry() {
    if (!this.activeScene) return;
    const sceneToRestart = this.activeScene;
    this.isPaused = false;
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
    sound.playCoin();

    if (sceneToRestart.chapterId) {
      sceneToRestart.scene.restart({ chapter: sceneToRestart.chapterId, skipIntroCard: true });
    } else {
      sceneToRestart.scene.restart();
    }
  }

  goToMenu() {
    this.isPaused = false;
    if (this.modal) {
      this.modal.classList.add('hidden');
    }
    sound.playSelect();

    const scene = this.activeScene;
    this.detachScene();

    if (scene && scene.scene) {
      scene.scene.start('MenuScene');
    } else if (typeof window !== 'undefined' && window.game) {
      window.game.scene.start('MenuScene');
    }
  }
}

export const pauseService = new PauseService();
if (typeof window !== 'undefined') {
  window.pauseService = pauseService;
}
