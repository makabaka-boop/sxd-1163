// 资料类型
export type MaterialType = 'handout' | 'sticker' | 'hint' | 'worksheet' | 'quiz' | 'syllabus';

// 资料信息
export interface Material {
  id: string;
  type: MaterialType;
  name: string;
  course: string;
  targetBagId: string;
  difficulty: number;
  isPending?: boolean;
  isPaused?: boolean;
}

// 资料包
export interface MaterialBag {
  id: string;
  name: string;
  course: string;
  capacity: number;
  currentCount: number;
  color: string;
  icon: string;
}

// 事件类型
export type EventType = 'similar_labels' | 'capacity_warning' | 'extra_print' | 'pause_issue';

// 游戏事件
export interface GameEvent {
  id: string;
  type: EventType;
  triggerTime: number;
  duration?: number;
  description: string;
  affectedCourse?: string;
  affectedType?: MaterialType;
  extraMaterials?: Material[];
}

// 关卡配置
export interface LevelConfig {
  id: number;
  name: string;
  description: string;
  duration: number;
  materials: Material[];
  bags: MaterialBag[];
  events: GameEvent[];
  spawnInterval: number;
  unlockScore: number;
}

// 错放记录
export interface MisplacedRecord {
  material: Material;
  wrongBagId: string;
  correctBagId: string;
  reason: string;
  time: number;
}

// 容量触发记录
export interface CapacityTriggerRecord {
  bagId: string;
  time: number;
  overflowCount: number;
}

// 游戏状态
export type GameState = 'menu' | 'tutorial' | 'playing' | 'paused' | 'result' | 'history' | 'levelSelect';

// 游戏统计
export interface GameStats {
  totalMaterials: number;
  correctPlacements: number;
  misplacedCount: number;
  missedCount: number;
  pendingUnreviewed: number;
  misplacedRecords: MisplacedRecord[];
  capacityTriggers: CapacityTriggerRecord[];
  startTime: number;
  endTime?: number;
  avgProcessingTime: number;
}

// 结算结果
export interface GameResult {
  levelId: number;
  score: number;
  accuracy: number;
  speedBonus: number;
  stats: GameStats;
  suggestions: string[];
  timestamp: number;
}

// 历史记录
export interface LevelHistory {
  levelId: number;
  highScore: number;
  lastScore: number;
  lastResult?: GameResult;
  playCount: number;
  unlocked: boolean;
}

// 游戏配置
export interface GameConfig {
  levels: LevelConfig[];
}
