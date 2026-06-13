import type {
  LevelConfig,
  Material,
  MaterialBag,
  GameEvent,
  GameStats,
  GameResult,
  MisplacedRecord,
  CapacityTriggerRecord
} from './types';

export type EngineEvent =
  | 'materialSpawned'
  | 'materialPlaced'
  | 'materialMisplaced'
  | 'materialMissed'
  | 'bagCapacityWarning'
  | 'gameEventTriggered'
  | 'gameEventEnded'
  | 'timeUpdated'
  | 'gameOver'
  | 'statsUpdated'
  | 'pendingAdded'
  | 'pendingReviewed';

export class GameEngine {
  private level: LevelConfig;
  private bags: MaterialBag[] = [];
  private pendingMaterials: Material[] = [];
  private spawnQueue: Material[] = [];
  private processedMaterials: Set<string> = new Set();
  private stats: GameStats;
  private isRunning = false;
  private isPaused = false;
  private startTime = 0;
  private elapsedTime = 0;
  private lastSpawnTime = 0;
  private pausedTime = 0;
  private totalPausedTime = 0;
  private activeEvents: GameEvent[] = [];
  private triggeredEvents: Set<string> = new Set();
  private listeners: Map<EngineEvent, Function[]> = new Map();
  private animationFrameId: number | null = null;
  private processingTimes: number[] = [];
  private materialSpawnTimes: Map<string, number> = new Map();
  private pendingMaterials_list: Material[] = [];

  constructor(level: LevelConfig) {
    this.level = level;
    this.stats = this.createInitialStats();
    this.initLevel();
  }

  private createInitialStats(): GameStats {
    return {
      totalMaterials: this.level.materials.length,
      correctPlacements: 0,
      misplacedCount: 0,
      missedCount: 0,
      pendingUnreviewed: 0,
      misplacedRecords: [],
      capacityTriggers: [],
      startTime: 0,
      avgProcessingTime: 0
    };
  }

  private initLevel(): void {
    this.bags = this.level.bags.map(bag => ({ ...bag, currentCount: 0 }));
    this.spawnQueue = [...this.level.materials].sort(() => Math.random() - 0.5);
    this.pendingMaterials = [];
    this.pendingMaterials_list = [];
    this.processedMaterials.clear();
    this.activeEvents = [];
    this.triggeredEvents.clear();
    this.materialSpawnTimes.clear();
    this.processingTimes = [];
    this.stats = this.createInitialStats();
    this.elapsedTime = 0;
    this.totalPausedTime = 0;
  }

  on(event: EngineEvent, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: EngineEvent, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private emit(event: EngineEvent, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(...args));
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.lastSpawnTime = 0;
    this.stats.startTime = Date.now();
    this.gameLoop();
  }

  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.pausedTime = performance.now();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    const pauseDuration = performance.now() - this.pausedTime;
    this.totalPausedTime += pauseDuration;
    this.gameLoop();
  }

  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private gameLoop = (): void => {
    if (!this.isRunning || this.isPaused) return;

    const now = performance.now();
    const gameTime = (now - this.startTime - this.totalPausedTime) / 1000;
    this.elapsedTime = gameTime;

    this.checkEvents(gameTime);
    this.updateActiveEvents(gameTime);
    this.trySpawnMaterial(gameTime);
    this.checkMissedMaterials();
    this.emit('timeUpdated', this.getTimeLeft(), gameTime);
    this.emit('statsUpdated', this.stats);

    if (gameTime >= this.level.duration) {
      this.endGame();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private trySpawnMaterial(gameTime: number): void {
    if (this.spawnQueue.length === 0) return;

    const adjustedInterval = this.getAdjustedSpawnInterval();

    if (gameTime - this.lastSpawnTime >= adjustedInterval / 1000) {
      const material = this.spawnQueue.shift();
      if (material) {
        const isPaused = this.isMaterialPaused(material);
        if (isPaused) {
          this.spawnQueue.push(material);
          return;
        }

        const isSimilar = this.isSimilarLabelsActive();
        const displayMaterial = {
          ...material,
          isPending: false,
          difficulty: isSimilar ? material.difficulty + 1 : material.difficulty
        };

        this.pendingMaterials.push(displayMaterial);
        this.materialSpawnTimes.set(material.id, gameTime);
        this.lastSpawnTime = gameTime;
        this.emit('materialSpawned', displayMaterial);
      }
    }
  }

  private getAdjustedSpawnInterval(): number {
    let interval = this.level.spawnInterval;
    if (this.isSimilarLabelsActive()) {
      interval *= 0.7;
    }
    return interval;
  }

  private isMaterialPaused(material: Material): boolean {
    return this.activeEvents.some(
      event => event.type === 'pause_issue' && event.affectedCourse === material.course
    );
  }

  private isSimilarLabelsActive(): boolean {
    return this.activeEvents.some(event => event.type === 'similar_labels');
  }

  private checkEvents(gameTime: number): void {
    for (const event of this.level.events) {
      if (!this.triggeredEvents.has(event.id) && gameTime >= event.triggerTime) {
        this.triggeredEvents.add(event.id);
        this.triggerEvent(event);
      }
    }
  }

  private triggerEvent(event: GameEvent): void {
    this.activeEvents.push(event);
    this.emit('gameEventTriggered', event);

    if (event.type === 'extra_print' && event.extraMaterials) {
      event.extraMaterials.forEach(mat => {
        this.spawnQueue.push(mat);
        this.stats.totalMaterials++;
      });
      this.spawnQueue.sort(() => Math.random() - 0.5);
    }

    if (event.type === 'capacity_warning') {
      this.emit('bagCapacityWarning', event);
    }

    if (event.duration) {
      setTimeout(() => {
        this.endEvent(event);
      }, event.duration * 1000);
    }
  }

  private endEvent(event: GameEvent): void {
    const index = this.activeEvents.indexOf(event);
    if (index > -1) {
      this.activeEvents.splice(index, 1);
      this.emit('gameEventEnded', event);
    }
  }

  private updateActiveEvents(gameTime: number): void {
    this.activeEvents = this.activeEvents.filter(event => {
      if (event.duration && gameTime - event.triggerTime >= event.duration) {
        this.emit('gameEventEnded', event);
        return false;
      }
      return true;
    });
  }

  private checkMissedMaterials(): void {
    const now = performance.now();
    const gameTime = (now - this.startTime - this.totalPausedTime) / 1000;

    const maxWaitTime = 15;
    const missed: Material[] = [];

    this.pendingMaterials = this.pendingMaterials.filter(material => {
      const spawnTime = this.materialSpawnTimes.get(material.id) || 0;
      if (gameTime - spawnTime > maxWaitTime) {
        missed.push(material);
        return false;
      }
      return true;
    });

    missed.forEach(material => {
      this.stats.missedCount++;
      this.processedMaterials.add(material.id);
      this.materialSpawnTimes.delete(material.id);
      this.emit('materialMissed', material);
    });
  }

  placeMaterial(materialId: string, bagId: string): boolean {
    const materialIndex = this.pendingMaterials.findIndex(m => m.id === materialId);
    if (materialIndex === -1) return false;

    const material = this.pendingMaterials[materialIndex];
    const bag = this.bags.find(b => b.id === bagId);

    if (!bag) return false;

    this.pendingMaterials.splice(materialIndex, 1);
    this.processedMaterials.add(material.id);

    const spawnTime = this.materialSpawnTimes.get(material.id) || 0;
    const gameTime = this.elapsedTime;
    const processingTime = gameTime - spawnTime;
    this.processingTimes.push(processingTime);
    this.stats.avgProcessingTime =
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    this.materialSpawnTimes.delete(material.id);

    if (bag.currentCount >= bag.capacity) {
      const record: CapacityTriggerRecord = {
        bagId: bag.id,
        time: gameTime,
        overflowCount: 1
      };
      this.stats.capacityTriggers.push(record);

      const misplacedRecord: MisplacedRecord = {
        material,
        wrongBagId: bagId,
        correctBagId: material.targetBagId,
        reason: `${bag.name}已满，资料溢出`,
        time: gameTime
      };
      this.stats.misplacedCount++;
      this.stats.misplacedRecords.push(misplacedRecord);
      this.emit('materialMisplaced', misplacedRecord);
      return false;
    }

    if (material.targetBagId === bagId) {
      bag.currentCount++;
      this.stats.correctPlacements++;
      this.emit('materialPlaced', material, bag, true);
      return true;
    } else {
      bag.currentCount++;

      const misplacedRecord: MisplacedRecord = {
        material,
        wrongBagId: bagId,
        correctBagId: material.targetBagId,
        reason: `资料应归入 ${this.getBagName(material.targetBagId)}，错放入了 ${bag.name}`,
        time: gameTime
      };
      this.stats.misplacedCount++;
      this.stats.misplacedRecords.push(misplacedRecord);
      this.emit('materialMisplaced', misplacedRecord);
      this.emit('materialPlaced', material, bag, false);
      return false;
    }
  }

  markAsPending(materialId: string): void {
    const materialIndex = this.pendingMaterials.findIndex(m => m.id === materialId);
    if (materialIndex === -1) return;
    const material = this.pendingMaterials[materialIndex];
    if (material.isPending) return;
    material.isPending = true;
    this.pendingMaterials.splice(materialIndex, 1);
    this.pendingMaterials_list.push(material);
    this.materialSpawnTimes.delete(material.id);
    this.stats.pendingUnreviewed++;
    this.emit('pendingAdded', material);
  }

  reviewPending(materialId: string, bagId: string): boolean {
    if (this.processedMaterials.has(materialId)) return false;
    const index = this.pendingMaterials_list.findIndex(m => m.id === materialId);
    if (index === -1) return false;

    const material = this.pendingMaterials_list[index];
    material.isPending = false;
    this.pendingMaterials_list.splice(index, 1);
    this.stats.pendingUnreviewed--;
    this.processedMaterials.add(material.id);
    this.materialSpawnTimes.delete(material.id);

    const result = this.placeMaterialDirectly(material, bagId);
    this.emit('pendingReviewed', material, result);
    return result;
  }

  private placeMaterialDirectly(material: Material, bagId: string): boolean {
    const bag = this.bags.find(b => b.id === bagId);
    if (!bag) return false;

    const gameTime = this.elapsedTime;

    if (bag.currentCount >= bag.capacity) {
      const record: CapacityTriggerRecord = {
        bagId: bag.id,
        time: gameTime,
        overflowCount: 1
      };
      this.stats.capacityTriggers.push(record);
      this.stats.misplacedCount++;
      this.stats.misplacedRecords.push({
        material,
        wrongBagId: bagId,
        correctBagId: material.targetBagId,
        reason: `${bag.name}已满，资料溢出`,
        time: gameTime
      });
      return false;
    }

    bag.currentCount++;

    if (material.targetBagId === bagId) {
      this.stats.correctPlacements++;
      return true;
    } else {
      this.stats.misplacedCount++;
      this.stats.misplacedRecords.push({
        material,
        wrongBagId: bagId,
        correctBagId: material.targetBagId,
        reason: `资料应归入 ${this.getBagName(material.targetBagId)}，错放入了 ${bag.name}`,
        time: gameTime
      });
      return false;
    }
  }

  private getBagName(bagId: string): string {
    const bag = this.bags.find(b => b.id === bagId);
    return bag ? bag.name : '未知资料包';
  }

  private endGame(): void {
    this.stop();
    this.stats.endTime = Date.now();

    this.pendingMaterials.forEach(material => {
      this.stats.missedCount++;
      this.materialSpawnTimes.delete(material.id);
    });
    this.pendingMaterials = [];

    this.pendingMaterials_list.forEach(() => {
      this.stats.missedCount++;
    });
    this.stats.pendingUnreviewed = this.pendingMaterials_list.length;
    this.pendingMaterials_list = [];

    const result = this.calculateResult();
    this.emit('gameOver', result);
  }

  private calculateResult(): GameResult {
    const total = this.stats.correctPlacements + this.stats.misplacedCount + this.stats.missedCount;
    const accuracy = total > 0 ? (this.stats.correctPlacements / total) * 100 : 0;

    const baseScore = this.stats.correctPlacements * 10;
    const misplacedPenalty = this.stats.misplacedCount * 5;
    const missedPenalty = this.stats.missedCount * 3;
    const pendingPenalty = this.stats.pendingUnreviewed * 2;

    const avgTime = this.stats.avgProcessingTime || 5;
    const speedBonus = Math.max(0, Math.floor((5 - avgTime) * 2));

    const score = Math.max(0, Math.floor(baseScore - misplacedPenalty - missedPenalty - pendingPenalty + speedBonus * this.stats.correctPlacements * 0.5));

    const suggestions = this.generateSuggestions();

    return {
      levelId: this.level.id,
      score,
      accuracy,
      speedBonus,
      stats: { ...this.stats },
      suggestions,
      timestamp: Date.now()
    };
  }

  private generateSuggestions(): string[] {
    const suggestions: string[] = [];

    if (this.stats.misplacedCount > 3) {
      suggestions.push('错放数量较多，建议仔细核对资料名称和科目后再放置');
    }

    if (this.stats.missedCount > 2) {
      suggestions.push('遗漏的资料有点多，试着加快处理速度');
    }

    if (this.stats.pendingUnreviewed > 0) {
      suggestions.push('别忘了及时复核待确认的资料');
    }

    if (this.stats.capacityTriggers.length > 0) {
      suggestions.push('有资料包溢出了，注意观察容量条');
    }

    if (this.stats.avgProcessingTime > 3) {
      suggestions.push('可以尝试使用键盘快捷键来提高速度');
    }

    if (suggestions.length === 0) {
      suggestions.push('表现不错！继续挑战更高难度吧');
    }

    return suggestions;
  }

  getTimeLeft(): number {
    return Math.max(0, this.level.duration - this.elapsedTime);
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  getPendingMaterials(): Material[] {
    return [...this.pendingMaterials];
  }

  getPendingReviewMaterials(): Material[] {
    return [...this.pendingMaterials_list];
  }

  getBags(): MaterialBag[] {
    return this.bags.map(bag => ({ ...bag }));
  }

  getStats(): GameStats {
    return { ...this.stats };
  }

  getLevel(): LevelConfig {
    return { ...this.level };
  }

  getActiveEvents(): GameEvent[] {
    return [...this.activeEvents];
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  getBagByIndex(index: number): MaterialBag | null {
    return this.bags[index] || null;
  }
}
