// Line clear base scores (indexed by lines cleared)
const LINE_SCORES = [0, 100, 300, 500, 800]

// Drop intervals per level in ms (NES-inspired curve)
const DROP_INTERVALS = [
  800, 720, 630, 550, 470,   // 0-4
  380, 300, 220, 140, 100,   // 5-9
  80, 80, 80, 70, 70,        // 10-14
  70, 50, 50, 50, 30,        // 15-19
  30, 30, 30, 30, 30,        // 20-24
  20, 20, 20, 20, 17,        // 25-29
]

const MAX_LEVEL = 29
const LINES_PER_LEVEL = 10

export function calculateScore(linesCleared, level) {
  if (linesCleared <= 0) return 0
  const base = LINE_SCORES[Math.min(linesCleared, 4)]
  return base * (level + 1)
}

export function calculateLevel(totalLinesCleared) {
  return Math.min(Math.floor(totalLinesCleared / LINES_PER_LEVEL), MAX_LEVEL)
}

export function getDropInterval(level) {
  return DROP_INTERVALS[Math.min(level, MAX_LEVEL)]
}

export function createScoring() {
  return { score: 0, level: 0, linesCleared: 0 }
}

export function addLineClears(state, lines) {
  const newLinesCleared = state.linesCleared + lines
  const newLevel = calculateLevel(newLinesCleared)
  const points = calculateScore(lines, state.level)
  return {
    score: state.score + points,
    level: newLevel,
    linesCleared: newLinesCleared,
  }
}

export function addSoftDrop(state, cells) {
  return { ...state, score: state.score + cells }
}

export function addHardDrop(state, cells) {
  return { ...state, score: state.score + cells * 2 }
}
