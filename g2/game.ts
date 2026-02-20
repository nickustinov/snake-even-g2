import { COLS, ROWS } from './layout'
import { game, spawnFood, submitScore } from './state'
import type { Dir, Pos } from './state'

const RIGHT: Record<Dir, Dir> = { up: 'right', right: 'down', down: 'left', left: 'up' }
const LEFT: Record<Dir, Dir> = { up: 'left', left: 'down', down: 'right', right: 'up' }

export function turnRight(): void {
  if (!game.running) return
  game.dir = RIGHT[game.dir]
}

export function turnLeft(): void {
  if (!game.running) return
  game.dir = LEFT[game.dir]
}

const DELTAS: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export type TickResult = {
  newHead: Pos
  removedTail: Pos | null  // null if snake grew (ate food)
  ate: boolean
  died: boolean
  newFood: Pos | null       // set when food was eaten
}

export function tick(): TickResult {
  const head = game.snake[0]
  const d = DELTAS[game.dir]
  const newHead: Pos = {
    x: head.x + d.x,
    y: head.y + d.y,
  }

  // Collision with walls or self
  const hitWall = newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS
  const hitSelf = game.snake.some((p) => p.x === newHead.x && p.y === newHead.y)
  if (hitWall || hitSelf) {
    game.running = false
    game.over = true
    void submitScore(game.score)
    return { newHead, removedTail: null, ate: false, died: true, newFood: null }
  }

  // Check food
  const ate = newHead.x === game.food.x && newHead.y === game.food.y

  game.snake.unshift(newHead)

  let removedTail: Pos | null = null
  let newFood: Pos | null = null

  if (ate) {
    game.score++
    newFood = spawnFood(game.snake)
    game.food = newFood
  } else {
    removedTail = game.snake.pop()!
  }

  return { newHead, removedTail, ate, died: false, newFood }
}
