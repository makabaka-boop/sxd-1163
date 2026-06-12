import { GameEngine } from './gameEngine';
import { levels, getMaterialTypeName, courseColors } from './levels';
import { loadHistory, saveResult, getLevelHistory } from './storage';
import type {
  GameEvent,
  GameResult,
  GameStats,
  LevelHistory
} from './types';

type GameView = 'menu' | 'levelSelect' | 'tutorial' | 'playing' | 'paused' | 'result' | 'history';

export class SortingGameApp {
  private container: HTMLElement;
  private engine: GameEngine | null = null;
  private currentView: GameView = 'menu';
  private currentLevelId: number = 1;
  private histories: LevelHistory[] = [];

  private selectedMaterialId: string | null = null;
  private selectedBagIndex: number = 0;
  private pendingSelectedIndex: number = 0;
  private eventBanners: GameEvent[] = [];

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container ${containerId} not found`);
    this.container = el;
    this.histories = loadHistory();
    this.bindGlobalKeyboard();
    this.showMenu();
  }

  private bindGlobalKeyboard(): void {
    document.addEventListener('keydown', (e) => {
      if (this.currentView === 'playing' && this.engine && !this.engine.getIsPaused()) {
        this.handlePlayingKeydown(e);
      }
      if (e.key === 'Escape') {
        if (this.currentView === 'playing') {
          this.pauseGame();
        } else if (this.currentView === 'paused') {
          this.resumeGame();
        }
      }
    });
  }

  private handlePlayingKeydown(e: KeyboardEvent): void {
    if (!this.engine) return;

    const bags = this.engine.getBags();

    if (e.key >= '1' && e.key <= '9') {
      const index = parseInt(e.key) - 1;
      if (index < bags.length) {
        this.selectedBagIndex = index;
        this.highlightSelectedBag();
        if (this.selectedMaterialId) {
          const bag = bags[index];
          this.engine.placeMaterial(this.selectedMaterialId, bag.id);
          this.selectedMaterialId = null;
          this.updatePendingList();
          this.updateBags();
          this.updateStats();
        }
      }
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const pending = this.engine.getPendingMaterials();
      if (pending.length > 0) {
        if (this.selectedMaterialId) {
          const currentIndex = pending.findIndex(m => m.id === this.selectedMaterialId);
          const nextIndex = e.shiftKey
            ? (currentIndex - 1 + pending.length) % pending.length
            : (currentIndex + 1) % pending.length;
          this.selectedMaterialId = pending[nextIndex].id;
        } else {
          this.selectedMaterialId = pending[0].id;
        }
        this.highlightSelectedMaterial();
      }
    }

    if (e.key === 'p' || e.key === 'P') {
      if (this.selectedMaterialId) {
        this.engine.markAsPending(this.selectedMaterialId);
        this.selectedMaterialId = null;
        this.updatePendingList();
        this.updatePendingReviewList();
      }
    }

    if (e.key === 'r' || e.key === 'R') {
      const pendingReview = this.engine.getPendingReviewMaterials();
      if (pendingReview.length > 0) {
        const mat = pendingReview[this.pendingSelectedIndex % pendingReview.length];
        const bags = this.engine.getBags();
        if (bags[this.selectedBagIndex]) {
          this.engine.reviewPending(mat.id, bags[this.selectedBagIndex].id);
          this.updatePendingReviewList();
          this.updateBags();
          this.updateStats();
        }
      }
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      this.selectedBagIndex = (this.selectedBagIndex + direction + bags.length) % bags.length;
      this.highlightSelectedBag();
    }

    if (e.key === ' ') {
      e.preventDefault();
      const pending = this.engine.getPendingMaterials();
      if (pending.length > 0 && !this.selectedMaterialId) {
        this.selectedMaterialId = pending[0].id;
        this.highlightSelectedMaterial();
      } else if (this.selectedMaterialId && bags[this.selectedBagIndex]) {
        this.engine.placeMaterial(this.selectedMaterialId, bags[this.selectedBagIndex].id);
        this.selectedMaterialId = null;
        this.updatePendingList();
        this.updateBags();
        this.updateStats();
      }
    }
  }

  private showMenu(): void {
    this.currentView = 'menu';
    this.container.innerHTML = `
      <div class="menu-screen">
        <div class="menu-content">
          <h1 class="game-title">📚 资料分拣大师</h1>
          <p class="game-subtitle">在资料准备区负责把不同课程资料归入正确资料包</p>
          <div class="menu-buttons">
            <button class="btn btn-primary btn-large" id="btn-start">开始游戏</button>
            <button class="btn btn-secondary" id="btn-levels">关卡选择</button>
            <button class="btn btn-secondary" id="btn-history">历史成绩</button>
            <button class="btn btn-secondary" id="btn-tutorial">游戏教程</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-start')?.addEventListener('click', () => this.startLevel(1));
    document.getElementById('btn-levels')?.addEventListener('click', () => this.showLevelSelect());
    document.getElementById('btn-history')?.addEventListener('click', () => this.showHistory());
    document.getElementById('btn-tutorial')?.addEventListener('click', () => this.showTutorial());
  }

  private showLevelSelect(): void {
    this.currentView = 'levelSelect';
    this.histories = loadHistory();

    const levelsHtml = levels.map(level => {
      const history = this.histories.find(h => h.levelId === level.id);
      const isUnlocked = history?.unlocked ?? false;

      return `
        <div class="level-card ${isUnlocked ? '' : 'locked'}" data-level="${level.id}">
          <div class="level-header">
            <span class="level-number">第 ${level.id} 关</span>
            <span class="level-name">${level.name}</span>
          </div>
          <p class="level-desc">${level.description}</p>
          <div class="level-info">
            <span>⏱️ ${level.duration}秒</span>
            <span>📦 ${level.bags.length}个资料包</span>
          </div>
          ${isUnlocked ? `
            <div class="level-stats">
              <span>最高分：${history?.highScore ?? 0}</span>
              <span>游戏次数：${history?.playCount ?? 0}</span>
            </div>
            <button class="btn btn-primary level-btn" data-level="${level.id}">开始挑战</button>
          ` : `
            <div class="level-locked">
              🔒 解锁分数：${level.unlockScore}
            </div>
          `}
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="level-select-screen">
        <div class="screen-header">
          <button class="btn btn-back" id="btn-back-menu">← 返回</button>
          <h2>关卡选择</h2>
        </div>
        <div class="level-grid">
          ${levelsHtml}
        </div>
      </div>
    `;

    document.getElementById('btn-back-menu')?.addEventListener('click', () => this.showMenu());

    document.querySelectorAll('.level-card.locked').forEach(card => {
      card.addEventListener('click', () => {
        alert('此关卡尚未解锁，请先完成前一关卡达到指定分数');
      });
    });

    document.querySelectorAll('.level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const levelId = parseInt(btn.getAttribute('data-level') || '1');
        this.startLevel(levelId);
      });
    });
  }

  private showTutorial(): void {
    this.currentView = 'tutorial';
    this.container.innerHTML = `
      <div class="tutorial-screen">
        <div class="screen-header">
          <button class="btn btn-back" id="btn-back-menu">← 返回</button>
          <h2>游戏教程</h2>
        </div>
        <div class="tutorial-content">
          <section class="tutorial-section">
            <h3>🎯 游戏目标</h3>
            <p>在倒计时内，将待分拣区的课程资料、贴纸和提示卡等正确归入对应的资料包，尽量减少错放和遗漏。</p>
          </section>

          <section class="tutorial-section">
            <h3>🕹️ 操作方式</h3>
            <ul>
              <li><strong>鼠标拖拽</strong>：拖动资料卡到对应的资料包</li>
              <li><strong>数字键 1-9</strong>：快速切换资料包并放置选中的资料</li>
              <li><strong>方向键 ←→</strong>：切换选中的资料包</li>
              <li><strong>Tab 键</strong>：切换选中的待分拣资料</li>
              <li><strong>空格键</strong>：选中资料 / 放置到选中的资料包</li>
              <li><strong>P 键</strong>：将选中的资料标记为待确认</li>
              <li><strong>R 键</strong>：复核待确认资料并放置</li>
              <li><strong>ESC 键</strong>：暂停 / 继续游戏</li>
            </ul>
          </section>

          <section class="tutorial-section">
            <h3>⚠️ 游戏事件</h3>
            <ul>
              <li><strong>相似标签</strong>：出现外观相似的资料，需要更仔细分辨</li>
              <li><strong>容量警告</strong>：资料包快满了，注意观察容量条</li>
              <li><strong>临时加印</strong>：突然新增一批资料，加快速度</li>
              <li><strong>暂停发放</strong>：某类资料暂时不会出现</li>
            </ul>
          </section>

          <section class="tutorial-section">
            <h3>📊 评分标准</h3>
            <ul>
              <li>正确放置：+10分/个</li>
              <li>错放：-5分/个</li>
              <li>遗漏：-3分/个</li>
              <li>待确认未复核：-2分/个</li>
              <li>处理速度快可获得速度加成</li>
            </ul>
          </section>
        </div>
      </div>
    `;

    document.getElementById('btn-back-menu')?.addEventListener('click', () => this.showMenu());
  }

  private showHistory(): void {
    this.currentView = 'history';
    this.histories = loadHistory();

    const historyHtml = levels.map(level => {
      const history = this.histories.find(h => h.levelId === level.id);

      return `
        <div class="history-card">
          <div class="history-header">
            <span class="history-level">第 ${level.id} 关 - ${level.name}</span>
            ${history?.unlocked ? '' : '<span class="lock-badge">🔒 未解锁</span>'}
          </div>
          <div class="history-stats">
            <div class="stat-item">
              <span class="stat-label">最高分</span>
              <span class="stat-value highlight">${history?.highScore ?? 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">最近成绩</span>
              <span class="stat-value">${history?.lastScore ?? 0}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">游戏次数</span>
              <span class="stat-value">${history?.playCount ?? 0}</span>
            </div>
          </div>
          ${history?.lastResult ? `
            <div class="history-detail">
              <p>正确率：${history.lastResult.accuracy.toFixed(1)}%</p>
              <p>正确放置：${history.lastResult.stats.correctPlacements} 个</p>
              <p>错放：${history.lastResult.stats.misplacedCount} 个</p>
              <p>遗漏：${history.lastResult.stats.missedCount} 个</p>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div class="history-screen">
        <div class="screen-header">
          <button class="btn btn-back" id="btn-back-menu">← 返回</button>
          <h2>历史成绩</h2>
        </div>
        <div class="history-list">
          ${historyHtml}
        </div>
      </div>
    `;

    document.getElementById('btn-back-menu')?.addEventListener('click', () => this.showMenu());
  }

  private startLevel(levelId: number): void {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;

    const history = getLevelHistory(levelId);
    if (!history?.unlocked && levelId > 1) {
      alert('此关卡尚未解锁！');
      return;
    }

    this.currentLevelId = levelId;
    this.engine = new GameEngine(level);
    this.selectedMaterialId = null;
    this.selectedBagIndex = 0;
    this.pendingSelectedIndex = 0;
    this.eventBanners = [];
    this.setupGameEvents();
    this.renderGameScreen();
    this.currentView = 'playing';
    this.engine.start();
  }

  private setupGameEvents(): void {
    if (!this.engine) return;

    this.engine.on('timeUpdated', (timeLeft: number) => {
      this.updateTimer(timeLeft);
    });

    this.engine.on('materialSpawned', () => {
      this.updatePendingList();
    });

    this.engine.on('materialPlaced', () => {
      this.updateBags();
      this.updateStats();
    });

    this.engine.on('materialMisplaced', () => {
      this.updateStats();
      this.showMisplacedFlash();
    });

    this.engine.on('materialMissed', () => {
      this.updatePendingList();
      this.updateStats();
    });

    this.engine.on('gameEventTriggered', (event: GameEvent) => {
      this.showEventBanner(event);
    });

    this.engine.on('gameEventEnded', (event: GameEvent) => {
      this.hideEventBanner(event);
    });

    this.engine.on('bagCapacityWarning', () => {
      this.flashCapacityWarning();
    });

    this.engine.on('statsUpdated', () => {
      this.updateStats();
    });

    this.engine.on('pendingAdded', () => {
      this.updatePendingList();
      this.updatePendingReviewList();
    });

    this.engine.on('pendingReviewed', () => {
      this.updatePendingReviewList();
    });

    this.engine.on('gameOver', (result: GameResult) => {
      this.handleGameOver(result);
    });
  }

  private renderGameScreen(): void {
    if (!this.engine) return;
    const level = this.engine.getLevel();

    this.container.innerHTML = `
      <div class="game-screen">
        <div class="game-header">
          <div class="header-left">
            <button class="btn btn-small" id="btn-pause">⏸️ 暂停</button>
            <span class="level-indicator">第 ${level.id} 关 - ${level.name}</span>
          </div>
          <div class="timer-container">
            <div class="timer-bar">
              <div class="timer-fill" id="timer-fill"></div>
            </div>
            <span class="timer-text" id="timer-text">${level.duration}s</span>
          </div>
          <div class="header-right">
            <span class="score-display">得分：<span id="score-value">0</span></span>
          </div>
        </div>

        <div class="event-banner-container" id="event-banners"></div>

        <div class="game-main">
          <div class="pending-section">
            <div class="section-header">
              <h3>📥 待分拣区</h3>
              <span class="pending-count" id="pending-count">0</span>
            </div>
            <div class="pending-list" id="pending-list"></div>

            <div class="section-header" style="margin-top: 16px;">
              <h3>📋 待确认区</h3>
              <span class="pending-count" id="pending-review-count">0</span>
            </div>
            <div class="pending-review-list" id="pending-review-list"></div>
          </div>

          <div class="bags-section">
            <div class="section-header">
              <h3>📦 资料包</h3>
            </div>
            <div class="bags-grid" id="bags-grid"></div>
          </div>

          <div class="info-panel">
            <div class="panel-section">
              <h4>📊 统计</h4>
              <div class="stat-row">
                <span>正确放置</span>
                <span id="stat-correct">0</span>
              </div>
              <div class="stat-row">
                <span>错放</span>
                <span id="stat-misplaced" class="text-red">0</span>
              </div>
              <div class="stat-row">
                <span>遗漏</span>
                <span id="stat-missed" class="text-orange">0</span>
              </div>
              <div class="stat-row">
                <span>待确认</span>
                <span id="stat-pending" class="text-yellow">0</span>
              </div>
            </div>

            <div class="panel-section">
              <h4>⌨️ 快捷键</h4>
              <div class="shortcut-hint">
                <span>1-9</span> 快速放置<br>
                <span>←→</span> 切换资料包<br>
                <span>Tab</span> 切换资料<br>
                <span>空格</span> 选中/放置<br>
                <span>P</span> 待确认<br>
                <span>R</span> 复核待确认<br>
                <span>ESC</span> 暂停
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-pause')?.addEventListener('click', () => this.pauseGame());

    this.updateBags();
    this.updatePendingList();
    this.updatePendingReviewList();
    this.updateStats();
    this.updateTimer(level.duration);
  }

  private updateTimer(timeLeft: number): void {
    const timerText = document.getElementById('timer-text');
    const timerFill = document.getElementById('timer-fill');

    if (timerText) {
      timerText.textContent = `${Math.ceil(timeLeft)}s`;
    }

    if (timerFill && this.engine) {
      const level = this.engine.getLevel();
      const percent = (timeLeft / level.duration) * 100;
      timerFill.style.width = `${percent}%`;

      if (percent < 20) {
        timerFill.classList.add('danger');
      } else if (percent < 50) {
        timerFill.classList.add('warning');
      }
    }
  }

  private updatePendingList(): void {
    if (!this.engine) return;

    const pendingList = document.getElementById('pending-list');
    const pendingCount = document.getElementById('pending-count');

    if (!pendingList || !pendingCount) return;

    const materials = this.engine.getPendingMaterials();
    pendingCount.textContent = materials.length.toString();

    pendingList.innerHTML = materials.map(material => {
      const isSelected = material.id === this.selectedMaterialId;
      const color = courseColors[material.course] || '#999';

      return `
        <div class="material-card ${isSelected ? 'selected' : ''} ${material.isPending ? 'pending' : ''}"
             data-id="${material.id}"
             draggable="true"
             style="border-left-color: ${color}">
          <div class="material-icon">${this.getMaterialIcon(material.type)}</div>
          <div class="material-info">
            <div class="material-name">${material.name}</div>
            <div class="material-type">${getMaterialTypeName(material.type)}</div>
          </div>
          <button class="btn-pending" data-id="${material.id}" title="标记待确认 (P)">?</button>
        </div>
      `;
    }).join('');

    this.bindDragEvents(pendingList);
    this.bindMaterialClicks(pendingList);

    pendingList.querySelectorAll('.btn-pending').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          this.engine?.markAsPending(id);
          if (this.selectedMaterialId === id) {
            this.selectedMaterialId = null;
          }
        }
      });
    });
  }

  private updatePendingReviewList(): void {
    if (!this.engine) return;

    const reviewList = document.getElementById('pending-review-list');
    const reviewCount = document.getElementById('pending-review-count');

    if (!reviewList || !reviewCount) return;

    const materials = this.engine.getPendingReviewMaterials();
    reviewCount.textContent = materials.length.toString();

    reviewList.innerHTML = materials.map((material, index) => {
      const color = courseColors[material.course] || '#999';
      const isSelected = index === this.pendingSelectedIndex;

      return `
        <div class="material-card pending-review ${isSelected ? 'selected' : ''}"
             data-id="${material.id}"
             data-index="${index}"
             draggable="true"
             style="border-left-color: ${color}">
          <div class="material-icon">${this.getMaterialIcon(material.type)}</div>
          <div class="material-info">
            <div class="material-name">${material.name}</div>
            <div class="material-type">待复核</div>
          </div>
        </div>
      `;
    }).join('');

    reviewList.querySelectorAll('.material-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.getAttribute('data-index') || '0');
        this.pendingSelectedIndex = index;
        this.updatePendingReviewList();
      });
    });

    this.bindDragEvents(reviewList, true);
  }

  private getMaterialIcon(type: string): string {
    const icons: Record<string, string> = {
      handout: '📄',
      sticker: '🌟',
      hint: '💡',
      worksheet: '📝',
      quiz: '📋',
      syllabus: '📅'
    };
    return icons[type] || '📄';
  }

  private bindDragEvents(container: HTMLElement, isReview: boolean = false): void {
    const cards = container.querySelectorAll('.material-card');

    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        const id = card.getAttribute('data-id');
        if (id) {
          (e as DragEvent).dataTransfer?.setData('text/plain', id);
          (e as DragEvent).dataTransfer?.setData('isReview', isReview.toString());
          card.classList.add('dragging');
        }
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    });
  }

  private bindMaterialClicks(container: HTMLElement): void {
    const cards = container.querySelectorAll('.material-card');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        if (id) {
          this.selectedMaterialId = this.selectedMaterialId === id ? null : id;
          this.highlightSelectedMaterial();
        }
      });
    });
  }

  private highlightSelectedMaterial(): void {
    const pendingList = document.getElementById('pending-list');
    if (!pendingList) return;

    pendingList.querySelectorAll('.material-card').forEach(card => {
      const id = card.getAttribute('data-id');
      if (id === this.selectedMaterialId) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  private updateBags(): void {
    if (!this.engine) return;

    const bagsGrid = document.getElementById('bags-grid');
    if (!bagsGrid) return;

    const bags = this.engine.getBags();

    bagsGrid.innerHTML = bags.map((bag, index) => {
      const fillPercent = (bag.currentCount / bag.capacity) * 100;
      const isSelected = index === this.selectedBagIndex;
      const isFull = bag.currentCount >= bag.capacity;
      const isNearFull = fillPercent >= 80;

      return `
        <div class="bag-card ${isSelected ? 'selected' : ''} ${isFull ? 'full' : ''} ${isNearFull ? 'near-full' : ''}"
             data-id="${bag.id}"
             data-index="${index}">
          <div class="bag-header">
            <span class="bag-icon">${bag.icon}</span>
            <span class="bag-name">${bag.name}</span>
            <span class="bag-hint">[${index + 1}]</span>
          </div>
          <div class="bag-content">
            <div class="bag-count">
              <span class="count-current">${bag.currentCount}</span>
              <span class="count-sep">/</span>
              <span class="count-max">${bag.capacity}</span>
            </div>
            <div class="bag-progress">
              <div class="bag-progress-fill" style="width: ${fillPercent}%; background: ${bag.color}"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    bagsGrid.querySelectorAll('.bag-card').forEach(card => {
      card.addEventListener('click', () => {
        const bagId = card.getAttribute('data-id');
        const index = parseInt(card.getAttribute('data-index') || '0');
        this.selectedBagIndex = index;
        this.highlightSelectedBag();

        if (this.selectedMaterialId) {
          this.engine?.placeMaterial(this.selectedMaterialId, bagId || '');
          this.selectedMaterialId = null;
          this.updatePendingList();
          this.updateBags();
          this.updateStats();
        }
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        const dragEvent = e as DragEvent;
        const materialId = dragEvent.dataTransfer?.getData('text/plain');
        const isReview = dragEvent.dataTransfer?.getData('isReview') === 'true';
        const bagId = card.getAttribute('data-id');

        if (materialId && bagId) {
          if (isReview) {
            this.engine?.reviewPending(materialId, bagId);
          } else {
            this.engine?.placeMaterial(materialId, bagId);
          }
          this.updatePendingList();
          this.updatePendingReviewList();
          this.updateBags();
          this.updateStats();
        }
      });
    });
  }

  private highlightSelectedBag(): void {
    const bagsGrid = document.getElementById('bags-grid');
    if (!bagsGrid) return;

    bagsGrid.querySelectorAll('.bag-card').forEach(card => {
      const index = parseInt(card.getAttribute('data-index') || '-1');
      if (index === this.selectedBagIndex) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  private updateStats(): void {
    if (!this.engine) return;

    const stats = this.engine.getStats();

    const scoreEl = document.getElementById('score-value');
    const correctEl = document.getElementById('stat-correct');
    const misplacedEl = document.getElementById('stat-misplaced');
    const missedEl = document.getElementById('stat-missed');
    const pendingEl = document.getElementById('stat-pending');

    const score = this.calculateCurrentScore(stats);

    if (scoreEl) scoreEl.textContent = score.toString();
    if (correctEl) correctEl.textContent = stats.correctPlacements.toString();
    if (misplacedEl) misplacedEl.textContent = stats.misplacedCount.toString();
    if (missedEl) missedEl.textContent = stats.missedCount.toString();
    if (pendingEl) pendingEl.textContent = stats.pendingUnreviewed.toString();
  }

  private calculateCurrentScore(stats: GameStats): number {
    const baseScore = stats.correctPlacements * 10;
    const misplacedPenalty = stats.misplacedCount * 5;
    const missedPenalty = stats.missedCount * 3;
    const pendingPenalty = stats.pendingUnreviewed * 2;
    return Math.max(0, Math.floor(baseScore - misplacedPenalty - missedPenalty - pendingPenalty));
  }

  private showMisplacedFlash(): void {
    const gameScreen = document.querySelector('.game-screen');
    if (gameScreen) {
      gameScreen.classList.add('misplaced-flash');
      setTimeout(() => gameScreen.classList.remove('misplaced-flash'), 200);
    }
  }

  private flashCapacityWarning(): void {
    const bagsGrid = document.getElementById('bags-grid');
    if (bagsGrid) {
      bagsGrid.classList.add('capacity-flash');
      setTimeout(() => bagsGrid.classList.remove('capacity-flash'), 500);
    }
  }

  private showEventBanner(event: GameEvent): void {
    this.eventBanners.push(event);
    this.renderEventBanners();
  }

  private hideEventBanner(event: GameEvent): void {
    this.eventBanners = this.eventBanners.filter(e => e.id !== event.id);
    this.renderEventBanners();
  }

  private renderEventBanners(): void {
    const container = document.getElementById('event-banners');
    if (!container) return;

    container.innerHTML = this.eventBanners.map(event => {
      let bgColor = '#3498db';
      if (event.type === 'similar_labels') bgColor = '#9b59b6';
      if (event.type === 'capacity_warning') bgColor = '#e67e22';
      if (event.type === 'extra_print') bgColor = '#27ae60';
      if (event.type === 'pause_issue') bgColor = '#e74c3c';

      return `
        <div class="event-banner" style="background: ${bgColor}">
          <span class="event-text">${event.description}</span>
          ${event.duration ? `<span class="event-duration">${event.duration}s</span>` : ''}
        </div>
      `;
    }).join('');
  }

  private pauseGame(): void {
    if (!this.engine || !this.engine.getIsRunning()) return;

    this.engine.pause();
    this.currentView = 'paused';
    this.showPauseOverlay();
  }

  private showPauseOverlay(): void {
    const overlay = document.createElement('div');
    overlay.id = 'pause-overlay';
    overlay.className = 'pause-overlay';
    overlay.innerHTML = `
      <div class="pause-panel">
        <h2>⏸️ 游戏暂停</h2>
        <div class="pause-buttons">
          <button class="btn btn-primary" id="btn-resume">继续游戏</button>
          <button class="btn btn-secondary" id="btn-restart">重新挑战</button>
          <button class="btn btn-secondary" id="btn-quit">退出关卡</button>
        </div>
      </div>
    `;
    this.container.appendChild(overlay);

    document.getElementById('btn-resume')?.addEventListener('click', () => this.resumeGame());
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      overlay.remove();
      this.startLevel(this.currentLevelId);
    });
    document.getElementById('btn-quit')?.addEventListener('click', () => {
      this.engine?.stop();
      overlay.remove();
      this.showLevelSelect();
    });
  }

  private resumeGame(): void {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.remove();

    this.engine?.resume();
    this.currentView = 'playing';
  }

  private handleGameOver(result: GameResult): void {
    this.currentView = 'result';

    const level = levels.find(l => l.id === result.levelId);
    if (level) {
      saveResult(result, level.unlockScore);
    }
    this.histories = loadHistory();

    this.showResultScreen(result);
  }

  private showResultScreen(result: GameResult): void {
    const level = levels.find(l => l.id === result.levelId);
    const history = this.histories.find(h => h.levelId === result.levelId);
    const isNewHigh = result.score >= (history?.highScore ?? 0) && result.score > 0;

    const misplacedHtml = result.stats.misplacedRecords.length > 0
      ? result.stats.misplacedRecords.slice(0, 5).map(record => `
          <div class="misplaced-item">
            <span class="misplaced-material">${record.material.name}</span>
            <span class="misplaced-arrow">→</span>
            <span class="misplaced-wrong">${this.getBagNameById(record.wrongBagId)}</span>
            <span class="misplaced-reason">(${record.reason})</span>
          </div>
        `).join('')
      : '<p class="empty-text">本局没有错放，太棒了！</p>';

    const capacityHtml = result.stats.capacityTriggers.length > 0
      ? result.stats.capacityTriggers.map(record => `
          <div class="capacity-item">
            <span>${this.getBagNameById(record.bagId)}</span>
            <span>溢出 ${record.overflowCount} 份</span>
            <span class="capacity-time">第 ${record.time.toFixed(1)} 秒</span>
          </div>
        `).join('')
      : '<p class="empty-text">所有资料包都管理得很好！</p>';

    const suggestionsHtml = result.suggestions.map(s => `
      <li>${s}</li>
    `).join('');

    const nextLevel = levels.find(l => l.id === result.levelId + 1);
    const justUnlocked = nextLevel && history?.unlocked && result.score >= (nextLevel?.unlockScore ?? Infinity);

    this.container.innerHTML = `
      <div class="result-screen">
        <div class="result-header">
          <h2>第 ${result.levelId} 关 - ${level?.name ?? ''}</h2>
          ${isNewHigh ? '<div class="new-high-badge">🏆 新纪录！</div>' : ''}
          ${justUnlocked ? '<div class="unlock-badge">🔓 解锁新关卡！</div>' : ''}
        </div>

        <div class="result-score">
          <div class="score-circle">
            <span class="score-number">${result.score}</span>
            <span class="score-label">分</span>
          </div>
          <div class="score-details">
            <div class="detail-row">
              <span>正确率</span>
              <span class="highlight">${result.accuracy.toFixed(1)}%</span>
            </div>
            <div class="detail-row">
              <span>速度加成</span>
              <span class="highlight">+${result.speedBonus}</span>
            </div>
          </div>
        </div>

        <div class="result-stats-grid">
          <div class="stat-box correct">
            <div class="stat-num">${result.stats.correctPlacements}</div>
            <div class="stat-label">正确放置</div>
          </div>
          <div class="stat-box misplaced">
            <div class="stat-num">${result.stats.misplacedCount}</div>
            <div class="stat-label">错放</div>
          </div>
          <div class="stat-box missed">
            <div class="stat-num">${result.stats.missedCount}</div>
            <div class="stat-label">遗漏</div>
          </div>
          <div class="stat-box pending">
            <div class="stat-num">${result.stats.pendingUnreviewed}</div>
            <div class="stat-label">未复核</div>
          </div>
        </div>

        <div class="result-sections">
          <div class="result-section">
            <h3>❌ 错放原因</h3>
            <div class="misplaced-list">
              ${misplacedHtml}
            </div>
          </div>

          <div class="result-section">
            <h3>📦 容量触发情况</h3>
            <div class="capacity-list">
              ${capacityHtml}
            </div>
          </div>
        </div>

        <div class="result-section suggestions">
          <h3>💡 下一局改进提示</h3>
          <ul class="suggestions-list">
            ${suggestionsHtml}
          </ul>
        </div>

        <div class="result-buttons">
          <button class="btn btn-secondary" id="btn-back-levels">返回关卡</button>
          <button class="btn btn-primary" id="btn-retry">重新挑战</button>
          ${nextLevel && history?.unlocked ? `
            <button class="btn btn-success" id="btn-next">下一关 →</button>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('btn-back-levels')?.addEventListener('click', () => this.showLevelSelect());
    document.getElementById('btn-retry')?.addEventListener('click', () => this.startLevel(result.levelId));
    document.getElementById('btn-next')?.addEventListener('click', () => {
      if (result.levelId < levels.length) {
        this.startLevel(result.levelId + 1);
      }
    });
  }

  private getBagNameById(bagId: string): string {
    if (!this.engine) {
      const level = levels.find(l => l.id === this.currentLevelId);
      const bag = level?.bags.find(b => b.id === bagId);
      return bag?.name ?? '未知';
    }
    const bags = this.engine.getBags();
    const bag = bags.find(b => b.id === bagId);
    return bag?.name ?? '未知';
  }
}
