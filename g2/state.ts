import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { COLS, ROWS } from './layout'
import type { LeaderboardEntry } from './scores-api'

export type Dir = 'up' | 'down' | 'left' | 'right'

export type Pos = { x: number; y: number }

export type GameState = {
  snake: Pos[]
  dir: Dir
  food: Pos
  score: number
  running: boolean
  over: boolean
  quit: boolean
  highScore: number
  userInitials: string
  userUid: number
  leaderboard: LeaderboardEntry[]
}

const HIGH_SCORE_KEY = 'snake_high_score'
const INITIALS_KEY = 'snake_initials'

function localGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function localSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* noop */ }
}

export async function loadHighScore(): Promise<void> {
  const local = localGet(HIGH_SCORE_KEY)
  if (local) {
    const p = parseInt(local, 10)
    if (!isNaN(p)) game.highScore = p
  }
  if (!bridge) return
  const value = await bridge.getLocalStorage(HIGH_SCORE_KEY)
  if (value) {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed) && parsed > game.highScore) game.highScore = parsed
  }
}

export function updateHighScore(): void {
  if (game.score > game.highScore) {
    game.highScore = game.score
    localSet(HIGH_SCORE_KEY, String(game.highScore))
    if (bridge) {
      void bridge.setLocalStorage(HIGH_SCORE_KEY, String(game.highScore))
    }
  }
}

// Insert current score into the leaderboard in the right position
export function insertCurrentScore(): void {
  if (game.score <= 0) return
  game.leaderboard.push({ name: game.userInitials, score: game.score, uid: game.userUid })
  game.leaderboard.sort((a, b) => b.score - a.score)
}

export async function loadInitials(): Promise<void> {
  // Browser fallback first
  const local = localGet(INITIALS_KEY)
  if (local && local.length > 0) {
    game.userInitials = local.toUpperCase().slice(0, 3)
  }
  // Bridge overwrites if available
  if (!bridge) return
  const value = await bridge.getLocalStorage(INITIALS_KEY)
  if (value && value.length > 0) {
    game.userInitials = value.toUpperCase().slice(0, 3)
  }
}

export function saveInitials(initials: string): void {
  const upper = initials.toUpperCase().slice(0, 3)
  game.userInitials = upper
  localSet(INITIALS_KEY, upper)
  if (bridge) {
    void bridge.setLocalStorage(INITIALS_KEY, upper)
  }
}

export function deriveInitials(name: string): string {
  if (!name || name.trim().length === 0) return 'AAA'
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 3) {
    return (parts[0][0] + parts[1][0] + parts[2][0]).toUpperCase()
  }
  if (parts.length === 2) {
    return (parts[0][0] + parts[1][0] + (parts[1][1] || parts[0][1] || 'A')).toUpperCase()
  }
  return parts[0].slice(0, 3).toUpperCase().padEnd(3, 'A')
}

export async function loadUserInfo(): Promise<void> {
  if (!bridge) return
  try {
    const user = await bridge.getUserInfo()
    if (user.uid) game.userUid = user.uid
    // Only set initials from name if none saved yet
    if (game.userInitials === 'AAA' && user.name) {
      const derived = deriveInitials(user.name)
      game.userInitials = derived
      void bridge.setLocalStorage(INITIALS_KEY, derived)
    }
  } catch {
    // User info not available, keep defaults
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
  game.quit = false
}

export const game: GameState = {
  snake: spawnSnake(),
  dir: 'right',
  food: { x: 0, y: 0 },
  score: 0,
  running: false,
  over: false,
  quit: false,
  highScore: 0,
  userInitials: 'AAA',
  userUid: 0,
  leaderboard: [],
}

// Initialize food after snake is set
game.food = spawnFood(game.snake)

export let bridge: EvenAppBridge | null = null

export function setBridge(b: EvenAppBridge): void {
  bridge = b
}
