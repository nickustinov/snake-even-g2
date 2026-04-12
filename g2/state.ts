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

const HIGH_SCORE_KEY = 'snake_high_score'

export async function loadHighScore(): Promise<void> {
  if (!bridge) return
  const value = await bridge.getLocalStorage(HIGH_SCORE_KEY)
  if (value) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) game.highScore = parsed
  }
}

export function updateHighScore(): void {
  if (game.score > game.highScore) {
    game.highScore = game.score
    if (bridge) {
      void bridge.setLocalStorage(HIGH_SCORE_KEY, String(game.highScore))
    }
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
  highScore: 0,
}

// Initialize food after snake is set
game.food = spawnFood(game.snake)

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
