import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { COLS, ROWS } from './layout'

export type Dir = 'up' | 'down' | 'left' | 'right'

export type Pos = { x: number; y: number }

export type GameState = {
  snake: Pos[]
  dir: Dir
  food: Pos
  score: number
  running: boolean
  over: boolean
  highScore: number
}

const HS_KEY = 'snake:best'

function loadCachedHighScore(): number {
  const v = localStorage.getItem(HS_KEY)
  return v ? parseInt(v, 10) || 0 : 0
}

function cacheHighScore(score: number): void {
  localStorage.setItem(HS_KEY, String(score))
}

export async function fetchBestScore(): Promise<number> {
  try {
    const res = await fetch('/api/best-score')
    const data = await res.json()
    const score: number = data.score ?? 0
    if (score > game.highScore) {
      game.highScore = score
      cacheHighScore(score)
    }
    return game.highScore
  } catch {
    return game.highScore
  }
}

export async function submitScore(score: number): Promise<void> {
  if (score > game.highScore) {
    game.highScore = score
    cacheHighScore(score)
  }
  try {
    const res = await fetch('/api/best-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
    const data = await res.json()
    const best: number = data.score ?? score
    if (best > game.highScore) {
      game.highScore = best
      cacheHighScore(best)
    }
  } catch {
    // localStorage already updated above
  }
}

function spawnSnake(): Pos[] {
  const cx = Math.floor(COLS / 2)
  const cy = Math.floor(ROWS / 2)
  return [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ]
}

export function spawnFood(snake: Pos[]): Pos {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  let pos: Pos
  do {
    pos = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    }
  } while (occupied.has(`${pos.x},${pos.y}`))
  return pos
}

export function resetGame(): void {
  const snake = spawnSnake()
  game.snake = snake
  game.dir = 'right'
  game.food = spawnFood(snake)
  game.score = 0
  game.running = true
  game.over = false
}

export const game: GameState = {
  snake: spawnSnake(),
  dir: 'right',
  food: { x: 0, y: 0 },
  score: 0,
  running: false,
  over: false,
  highScore: loadCachedHighScore(),
}

// Initialize food after snake is set
game.food = spawnFood(game.snake)

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
