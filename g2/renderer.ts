import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  RebuildPageContainer,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, CELL, COLS, ROWS } from './layout'
import { game, bridge } from './state'
import type { TickResult } from './game'

// ---------------------------------------------------------------------------
// Persistent canvas – we never recreate it, only paint deltas
// ---------------------------------------------------------------------------

const canvas = document.createElement('canvas')
canvas.width = DISPLAY_WIDTH
canvas.height = DISPLAY_HEIGHT
const ctx = canvas.getContext('2d')!

let startupRendered = false
let pageSetUp = false

// ---------------------------------------------------------------------------
// Page setup – called ONCE, never rebuilt during gameplay
// ---------------------------------------------------------------------------

async function setupPage(): Promise<void> {
  if (!bridge) return
  // Text container behind the image captures scroll + click events.
  // Image container on top renders the game.
  const config = {
    containerTotalNum: 2,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'evt',
        content: ' ',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 1,
        paddingLength: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'screen',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
      }),
    ],
  }

  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
  pageSetUp = true
}

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

function cellRect(x: number, y: number, color: string): void {
  ctx.fillStyle = color
  ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2)
}

function drawFood(x: number, y: number): void {
  const cx = x * CELL + CELL / 2
  const cy = y * CELL + CELL / 2
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx, cy, CELL / 2 - 2, 0, Math.PI * 2)
  ctx.fill()
}

function clearCell(x: number, y: number): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
}

function drawScore(): void {
  // Black background behind score text
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 80, 16)
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#888'
  ctx.textAlign = 'left'
  ctx.fillText(`${game.score}`, 4, 12)
}

// ---------------------------------------------------------------------------
// Full redraw – used for initial render and game restart
// ---------------------------------------------------------------------------

export function drawFullFrame(): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)

  // Snake
  for (let i = 0; i < game.snake.length; i++) {
    const p = game.snake[i]
    const brightness = i === 0 ? '#fff' : '#aaa'
    cellRect(p.x, p.y, brightness)
  }

  // Food
  drawFood(game.food.x, game.food.y)

  drawScore()
}

// ---------------------------------------------------------------------------
// Delta redraw – only changed cells, called each tick
// ---------------------------------------------------------------------------

export function drawDelta(result: TickResult): void {
  // Old head becomes body
  if (game.snake.length > 1) {
    const oldHead = game.snake[1]
    cellRect(oldHead.x, oldHead.y, '#aaa')
  }

  // New head
  cellRect(result.newHead.x, result.newHead.y, '#fff')

  // Removed tail
  if (result.removedTail) {
    clearCell(result.removedTail.x, result.removedTail.y)
  }

  // New food
  if (result.newFood) {
    drawFood(result.newFood.x, result.newFood.y)
  }

  drawScore()
}

// ---------------------------------------------------------------------------
// Game over overlay
// ---------------------------------------------------------------------------

export function drawGameOver(): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)

  ctx.textAlign = 'center'

  ctx.font = 'bold 32px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('GAME OVER', DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20)

  ctx.font = '18px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#aaa'
  ctx.fillText(`Score: ${game.score}`, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 15)

  if (game.highScore > 0) {
    ctx.font = '14px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#666'
    ctx.fillText(`Best: ${game.highScore}`, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 40)
  }

  ctx.font = '12px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#555'
  ctx.fillText('Tap to play again', DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 65)

  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------------

export function drawTitleScreen(): void {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT)

  ctx.textAlign = 'center'

  ctx.font = 'bold 36px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#fff'
  ctx.fillText('SNAKE', DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20)

  ctx.font = '14px system-ui, -apple-system, sans-serif'
  ctx.fillStyle = '#888'
  ctx.fillText('Swipe to steer \u00B7 Tap to start', DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 15)

  if (game.highScore > 0) {
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = '#555'
    ctx.fillText(`Best: ${game.highScore}`, DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 40)
  }

  ctx.textAlign = 'left'
}

// ---------------------------------------------------------------------------
// Image push – the only way frames reach the glasses
// ---------------------------------------------------------------------------

let pushInFlight = false

export async function pushFrame(): Promise<void> {
  if (!bridge || !pageSetUp) return
  if (pushInFlight) return // skip frame if previous push still in progress
  pushInFlight = true
  try {
    const dataUrl = canvas.toDataURL('image/png')
    const binary = atob(dataUrl.split(',')[1])
    const bytes: number[] = new Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: 2,
        containerName: 'screen',
        imageData: bytes,
      }),
    )
  } finally {
    pushInFlight = false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
  await setupPage()
  drawTitleScreen()
  await pushFrame()
  appendEventLog('Snake: display initialized')
}

export async function showLoading(): Promise<void> {
  if (!bridge) return
  const config = {
    containerTotalNum: 1,
    textObject: [
      new TextContainerProperty({
        containerID: 1,
        containerName: 'loading',
        content: 'Snake loading...',
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 4,
      }),
    ],
  }
  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
}
