import type { GameResult, LevelHistory } from './types';

const STORAGE_KEY = 'sorting_game_history';

interface StorageData {
  histories: LevelHistory[];
}

function getDefaultData(): StorageData {
  return {
    histories: [
      { levelId: 1, highScore: 0, lastScore: 0, playCount: 0, unlocked: true },
      { levelId: 2, highScore: 0, lastScore: 0, playCount: 0, unlocked: false },
      { levelId: 3, highScore: 0, lastScore: 0, playCount: 0, unlocked: false },
      { levelId: 4, highScore: 0, lastScore: 0, playCount: 0, unlocked: false }
    ]
  };
}

export function loadHistory(): LevelHistory[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data) as StorageData;
      return parsed.histories;
    }
  } catch (e) {
    console.error('Failed to load history:', e);
  }
  const defaultData = getDefaultData();
  saveHistory(defaultData.histories);
  return defaultData.histories;
}

export function saveHistory(histories: LevelHistory[]): void {
  try {
    const data: StorageData = { histories };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

export function saveResult(result: GameResult, unlockScore: number): LevelHistory[] {
  const histories = loadHistory();
  const history = histories.find(h => h.levelId === result.levelId);

  if (history) {
    history.lastScore = result.score;
    history.lastResult = result;
    history.playCount++;
    if (result.score > history.highScore) {
      history.highScore = result.score;
    }
  }

  const nextLevelId = result.levelId + 1;
  const nextHistory = histories.find(h => h.levelId === nextLevelId);
  if (nextHistory && !nextHistory.unlocked && result.score >= unlockScore) {
    nextHistory.unlocked = true;
  }

  saveHistory(histories);
  return histories;
}

export function getLevelHistory(levelId: number): LevelHistory | undefined {
  const histories = loadHistory();
  return histories.find(h => h.levelId === levelId);
}

export function isLevelUnlocked(levelId: number): boolean {
  const history = getLevelHistory(levelId);
  return history?.unlocked ?? false;
}

export function resetHistory(): void {
  const defaultData = getDefaultData();
  saveHistory(defaultData.histories);
}
