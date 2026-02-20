import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
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

export async function fetchBestScore(): Promise<number> {
  appendEventLog('Score: fetching best score')
  try {
    const res = await fetch('/api/best-score')
    appendEventLog(`Score: GET status=${res.status}`)
    const data = await res.json()
    appendEventLog(`Score: GET response=${JSON.stringify(data)}`)
    const score: number = data.score ?? 0
    if (score > game.highScore) {
      game.highScore = score
    }
    return game.highScore
  } catch (err) {
    appendEventLog(`Score: GET failed: ${err}`)
    throw err
  }
}

export async function submitScore(score: number): Promise<void> {
  appendEventLog(`Score: submitting score=${score}`)
  try {
    const res = await fetch('/api/best-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    })
    appendEventLog(`Score: POST status=${res.status}`)
    const data = await res.json()
    appendEventLog(`Score: POST response=${JSON.stringify(data)}`)
    game.highScore = data.score ?? score
  } catch (err) {
    appendEventLog(`Score: POST failed: ${err}`)
    throw err
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
