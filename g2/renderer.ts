import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { DISPLAY_WIDTH, DISPLAY_HEIGHT, COLS, ROWS } from './layout'
import { game, bridge } from './state'

// ---------------------------------------------------------------------------
// Unicode characters for the grid
// ---------------------------------------------------------------------------

const EMPTY = '\u25A1' // □ white square
const SNAKE = '\u25A6' // ▦ square with orthogonal crosshatch
const FOOD = '\u25C6'  // ◆ black diamond

// ---------------------------------------------------------------------------
// Logo image
// ---------------------------------------------------------------------------

const LOGO_W = 200
const LOGO_H = 100
const LOGO_X = Math.floor((DISPLAY_WIDTH - LOGO_W) / 2)
const LOGO_Y = 70

let logoBytes: number[] | null = null
let gameoverBytes: number[] | null = null

async function loadImages(): Promise<void> {
  const load = async (path: string): Promise<number[] | null> => {
    try {
      const url = new URL(path, import.meta.url).href
      const res = await fetch(url)
      const buf = await res.arrayBuffer()
      return Array.from(new Uint8Array(buf))
    } catch {
      appendEventLog(`Snake: failed to load ${path}`)
      return null
    }
  }
  if (!logoBytes) logoBytes = await load('./logo.png')
  if (!gameoverBytes) gameoverBytes = await load('./gameover.png')
}

async function pushImage(bytes: number[] | null): Promise<void> {
  if (!bridge || !bytes) return
  await bridge.updateImageRawData(
    new ImageRawDataUpdate({
      containerID: 2,
      containerName: 'img',
      imageData: bytes,
    }),
  )
}

// ---------------------------------------------------------------------------
// Page layouts
// ---------------------------------------------------------------------------

let startupRendered = false
let pageSetUp = false

type PageMode = 'splash' | 'game' | 'gameover'
let currentPage: PageMode = 'splash'

function splashText(): string {
  const parts: string[] = []
  if (game.highScore > 0) parts.push(`Best: ${game.highScore}`)
  parts.push('Tap to start')
  parts.push('Swipe to steer')
  return parts.join(' \u00B7 ')
}

function buildImagePage(text: string, textX: number): object {
  return {
    containerTotalNum: 3,
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
      new TextContainerProperty({
        containerID: 3,
        containerName: 'info',
        content: text,
        xPosition: textX,
        yPosition: LOGO_Y + LOGO_H + 15,
        width: DISPLAY_WIDTH - textX,
        height: DISPLAY_HEIGHT - LOGO_Y - LOGO_H - 15,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img',
        xPosition: LOGO_X,
        yPosition: LOGO_Y,
        width: LOGO_W,
        height: LOGO_H,
      }),
    ],
  }
}

async function setupSplashPage(): Promise<void> {
  if (!bridge) return
  const config = buildImagePage(splashText(), 130)

  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
  pageSetUp = true
  currentPage = 'splash'

  await pushImage(logoBytes)
}

async function setupGameOverPage(): Promise<void> {
  if (!bridge) return
  const config = buildImagePage(gameOverText(), 132)
  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  pageSetUp = true
  currentPage = 'gameover'

  await pushImage(gameoverBytes)
}

async function setupGamePage(initialContent: string): Promise<void> {
  if (!bridge) return
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
      new TextContainerProperty({
        containerID: 2,
        containerName: 'screen',
        content: initialContent,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 0,
      }),
    ],
  }

  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  pageSetUp = true
  currentPage = 'game'
}

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

function renderGrid(): string {
  const snakeSet = new Set(game.snake.map((p) => `${p.x},${p.y}`))
  const foodKey = `${game.food.x},${game.food.y}`

  let text = ''
  for (let y = 0; y < ROWS; y++) {
    let row = ''
    for (let x = 0; x < COLS; x++) {
      const key = `${x},${y}`
      if (snakeSet.has(key)) {
        row += SNAKE
      } else if (key === foodKey) {
        row += FOOD
      } else {
        row += EMPTY
      }
    }
    text += row + '\n'
  }
  return text
}

function gameOverText(): string {
  const parts = [`Score: ${game.score}`]
  if (game.highScore > 0) parts.push(`Best: ${game.highScore}`)
  parts.push('Tap to play again')
  return parts.join(' \u00B7 ')
}

// ---------------------------------------------------------------------------
// Frame push
// ---------------------------------------------------------------------------

let pushInFlight = false

export async function pushFrame(): Promise<void> {
  if (!bridge || !pageSetUp) return
  if (pushInFlight) return
  pushInFlight = true
  try {
    // Transition from splash/gameover to game page
    if (currentPage !== 'game' && game.running) {
      const text = renderGrid()
      await setupGamePage(text)
      return
    }

    // Transition from game to game over page
    if (currentPage === 'game' && game.over) {
      await setupGameOverPage()
      return
    }

    // On splash/gameover page, update the info text
    if (currentPage === 'splash' || currentPage === 'gameover') {
      const text = currentPage === 'splash' ? splashText() : gameOverText()
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 3,
          containerName: 'info',
          contentOffset: 0,
          contentLength: 2000,
          content: text,
        }),
      )
      return
    }

    // Game page – update grid
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 2,
        containerName: 'screen',
        contentOffset: 0,
        contentLength: 2000,
        content: renderGrid(),
      }),
    )
  } finally {
    pushInFlight = false
  }
}

export async function showSplash(): Promise<void> {
  await setupSplashPage()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
  await loadImages()
  await setupSplashPage()
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
