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
import type { LeaderboardEntry } from './scores-api'

// ---------------------------------------------------------------------------
// Unicode characters
// ---------------------------------------------------------------------------

const EMPTY = '\u3000' // ideographic space (fullwidth)
const SNAKE = '\u25A6' // fullwidth-ish square
const FOOD = '\u25C6'  // black diamond

// ---------------------------------------------------------------------------
// Fullwidth text helpers
// ---------------------------------------------------------------------------

function toFullwidth(str: string): string {
  return str.replace(/[\x20-\x7E]/g, (ch) =>
    ch === ' ' ? '\u3000' : String.fromCharCode(ch.charCodeAt(0) + 0xFEE0),
  )
}

function fwPad(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const fw = toFullwidth(str)
  const len = [...fw].length
  const pad = Math.max(0, width - len)
  if (align === 'right') return EMPTY.repeat(pad) + fw
  if (align === 'center') {
    const left = Math.floor(pad / 2)
    const right = pad - left
    return EMPTY.repeat(left) + fw + EMPTY.repeat(right)
  }
  return fw + EMPTY.repeat(pad)
}

function fwRow(str: string): string {
  return fwPad(str, COLS, 'center')
}

function blankRow(): string {
  return EMPTY.repeat(COLS)
}

// ---------------------------------------------------------------------------
// Logo image
// ---------------------------------------------------------------------------

const IMG_W = 190
const IMG_H = 47
const IMG_X = Math.floor((DISPLAY_WIDTH - IMG_W) / 2)
const IMG_Y = 14

let logoBytes: number[] | null = null

const logoUrl = new URL('./logo.png', import.meta.url).href

async function loadLogo(): Promise<void> {
  if (logoBytes) return
  try {
    const res = await fetch(logoUrl)
    const buf = await res.arrayBuffer()
    logoBytes = Array.from(new Uint8Array(buf))
  } catch {
    appendEventLog('Snake: failed to load logo.png')
  }
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
// Arcade screen builders (fullwidth text for the lower portion)
// ---------------------------------------------------------------------------

const PLACEHOLDER_NAMES = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']

function zeroPad(score: number): string {
  return String(score).padStart(3, '0')
}

function buildScoreRows(): string[] {
  const top5: LeaderboardEntry[] = []
  for (let i = 0; i < 5; i++) {
    if (i < game.leaderboard.length) {
      top5.push(game.leaderboard[i])
    } else {
      top5.push({ name: PLACEHOLDER_NAMES[i], score: 0, uid: 0 })
    }
  }
  return top5.map((e, i) =>
    fwRow(`${i + 1}  ${e.name.padEnd(3)}  ${zeroPad(e.score)}`),
  )
}

function buildMenuText(): string {
  const rows: string[] = []
  if (game.over) {
    rows.push(fwRow(`SCORE ${zeroPad(game.score)}  BEST ${zeroPad(game.highScore)}`))
  } else {
    rows.push(fwRow(`BEST ${zeroPad(game.highScore)}`))
  }
  rows.push(blankRow())
  rows.push(...buildScoreRows())
  return rows.join('\n')
}

// ---------------------------------------------------------------------------
// Page layouts
// ---------------------------------------------------------------------------

let startupRendered = false
let pageSetUp = false

type PageMode = 'menu' | 'game'
let currentPage: PageMode = 'menu'

const TEXT_Y = IMG_Y + IMG_H + 4
const TEXT_H = DISPLAY_HEIGHT - TEXT_Y

function buildImagePage(text: string): object {
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
        borderWidth: 0,
      }),
      new TextContainerProperty({
        containerID: 3,
        containerName: 'info',
        content: text,
        xPosition: 0,
        yPosition: TEXT_Y,
        width: DISPLAY_WIDTH,
        height: TEXT_H,
        isEventCapture: 0,
        paddingLength: 0,
        borderWidth: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2,
        containerName: 'img',
        xPosition: IMG_X,
        yPosition: IMG_Y,
        width: IMG_W,
        height: IMG_H,
      }),
    ],
  }
}

async function setupMenuPage(): Promise<void> {
  if (!bridge) return
  const config = buildImagePage(buildMenuText())

  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
  pageSetUp = true
  currentPage = 'menu'

  await pushImage(logoBytes)
}

function scoreText(): string {
  return zeroPad(game.score)
}

async function setupGamePage(initialContent: string): Promise<void> {
  if (!bridge) return
  const config = {
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
        containerID: 2,
        containerName: 'screen',
        content: initialContent,
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_WIDTH,
        height: DISPLAY_HEIGHT,
        isEventCapture: 0,
        paddingLength: 0,
        borderWidth: 1,
        borderColor: 10,
        borderRadius: 4,
      }),
      new TextContainerProperty({
        containerID: 3,
        containerName: 'score',
        content: scoreText(),
        xPosition: 8,
        yPosition: 0,
        width: DISPLAY_WIDTH - 8,
        height: 32,
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
    text += (y < ROWS - 1) ? row + '\n' : row
  }
  return text
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
    // Transition from menu to game page
    if (currentPage === 'menu' && game.running) {
      const text = renderGrid()
      await setupGamePage(text)
      return
    }

    // Transition from game to menu (game over or quit)
    if (currentPage === 'game' && (game.over || !game.running)) {
      await setupMenuPage()
      return
    }

    // On menu page, update the info text
    if (currentPage === 'menu') {
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 3,
          containerName: 'info',
          contentOffset: 0,
          contentLength: 2000,
          content: buildMenuText(),
        }),
      )
      return
    }

    // Game page – update score and grid
    await Promise.all([
      bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 3,
          containerName: 'score',
          contentOffset: 0,
          contentLength: 200,
          content: scoreText(),
        }),
      ),
      bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 2,
          containerName: 'screen',
          contentOffset: 0,
          contentLength: 2000,
          content: renderGrid(),
        }),
      ),
    ])
  } finally {
    pushInFlight = false
  }
}

export async function showSplash(): Promise<void> {
  await setupMenuPage()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
  await loadLogo()
  await setupMenuPage()
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
