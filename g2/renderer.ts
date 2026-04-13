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
// Characters
// ---------------------------------------------------------------------------

const EMPTY = '\u3000'
const SNAKE = '\u25A6'
const FOOD = '\u25C6'

// ---------------------------------------------------------------------------
// Fullwidth helpers
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
    return EMPTY.repeat(left) + fw + EMPTY.repeat(pad - left)
  }
  return fw + EMPTY.repeat(pad)
}

function fwRow(str: string): string {
  return fwPad(str, COLS, 'center')
}

function zeroPad(n: number): string {
  return String(n).padStart(3, '0')
}

// ---------------------------------------------------------------------------
// Leaderboard text (shared by splash + game over)
// ---------------------------------------------------------------------------

const PLACEHOLDERS = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE']

function scoreRows(): string[] {
  if (game.leaderboard.length === 0) {
    return Array.from({ length: 5 }, () => EMPTY.repeat(COLS))
  }
  return Array.from({ length: 5 }, (_, i) => {
    const e: LeaderboardEntry = game.leaderboard[i] ?? { name: PLACEHOLDERS[i], score: 0, uid: 0 }
    return fwRow(`${i + 1}  ${e.name.padEnd(3)}  ${zeroPad(e.score)}`)
  })
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

const IMG_W = 190
const IMG_H = 47
const IMG_X = Math.floor((DISPLAY_WIDTH - IMG_W) / 2)
const IMG_Y = 14
const TEXT_Y = IMG_Y + IMG_H + 4

let logoBytes: number[] | null = null
const logoUrl = new URL('./logo.png', import.meta.url).href

async function loadLogo(): Promise<void> {
  if (logoBytes) return
  try {
    const res = await fetch(logoUrl)
    logoBytes = Array.from(new Uint8Array(await res.arrayBuffer()))
  } catch {
    appendEventLog('Snake: failed to load logo')
  }
}

// ---------------------------------------------------------------------------
// Screen builders – each returns a full page config
// ---------------------------------------------------------------------------

// Hidden event-capture container (every page needs one)
function evtContainer(): TextContainerProperty {
  return new TextContainerProperty({
    containerID: 1, containerName: 'evt', content: ' ',
    xPosition: 0, yPosition: 0, width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT,
    isEventCapture: 1, paddingLength: 0, borderWidth: 0,
  })
}

function splashConfig(): object {
  const text = [
    fwRow(`BEST ${zeroPad(game.highScore)}`),
    EMPTY.repeat(COLS),
    ...scoreRows(),
  ].join('\n')

  return {
    containerTotalNum: 3,
    textObject: [
      evtContainer(),
      new TextContainerProperty({
        containerID: 3, containerName: 'info', content: text,
        xPosition: 0, yPosition: TEXT_Y,
        width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT - TEXT_Y,
        isEventCapture: 0, paddingLength: 0, borderWidth: 0,
      }),
    ],
    imageObject: [
      new ImageContainerProperty({
        containerID: 2, containerName: 'img',
        xPosition: IMG_X, yPosition: IMG_Y, width: IMG_W, height: IMG_H,
      }),
    ],
  }
}

function gameOverConfig(): object {
  const rows = [
    fwRow('GAME OVER'),
    EMPTY.repeat(COLS),
    fwRow(`SCORE ${zeroPad(game.score)}  BEST ${zeroPad(game.highScore)}`),
    EMPTY.repeat(COLS),
    ...scoreRows(),
  ]
  const text = rows.map((r, i) => i < rows.length - 1 ? r + '\n' : r).join('')

  return {
    containerTotalNum: 2,
    textObject: [
      evtContainer(),
      new TextContainerProperty({
        containerID: 3, containerName: 'info', content: text,
        xPosition: 0, yPosition: 0,
        width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT,
        isEventCapture: 0, paddingLength: 0, borderWidth: 0,
      }),
    ],
  }
}

function gameConfig(grid: string): object {
  return {
    containerTotalNum: 3,
    textObject: [
      evtContainer(),
      new TextContainerProperty({
        containerID: 2, containerName: 'screen', content: grid,
        xPosition: 0, yPosition: 0, width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT,
        isEventCapture: 0, paddingLength: 0,
        borderWidth: 1, borderColor: 10, borderRadius: 4,
      }),
      new TextContainerProperty({
        containerID: 3, containerName: 'score', content: zeroPad(game.score),
        xPosition: 8, yPosition: 0, width: DISPLAY_WIDTH - 8, height: 32,
        isEventCapture: 0, paddingLength: 0,
      }),
    ],
  }
}

// ---------------------------------------------------------------------------
// Grid renderer
// ---------------------------------------------------------------------------

function renderGrid(): string {
  const snakeSet = new Set(game.snake.map((p) => `${p.x},${p.y}`))
  const foodKey = `${game.food.x},${game.food.y}`
  let text = ''
  for (let y = 0; y < ROWS; y++) {
    let row = ''
    for (let x = 0; x < COLS; x++) {
      const key = `${x},${y}`
      row += snakeSet.has(key) ? SNAKE : key === foodKey ? FOOD : EMPTY
    }
    text += y < ROWS - 1 ? row + '\n' : row
  }
  return text
}

// ---------------------------------------------------------------------------
// Page management
// ---------------------------------------------------------------------------

let startupDone = false

async function showPage(config: object): Promise<void> {
  if (!bridge) return
  if (!startupDone) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupDone = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
}

// ---------------------------------------------------------------------------
// Public API – explicit screen transitions, no implicit state machine
// ---------------------------------------------------------------------------

export async function showSplash(): Promise<void> {
  await showPage(splashConfig())
  if (logoBytes) {
    await bridge!.updateImageRawData(new ImageRawDataUpdate({
      containerID: 2, containerName: 'img', imageData: logoBytes,
    }))
  }
}

export async function showGameOver(): Promise<void> {
  await showPage(gameOverConfig())
}

export async function showGame(): Promise<void> {
  await showPage(gameConfig(renderGrid()))
}

export async function updateGame(): Promise<void> {
  if (!bridge) return
  await Promise.all([
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 3, containerName: 'score',
      contentOffset: 0, contentLength: 200, content: zeroPad(game.score),
    })),
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 2, containerName: 'screen',
      contentOffset: 0, contentLength: 2000, content: renderGrid(),
    })),
  ])
}

export async function initDisplay(): Promise<void> {
  await loadLogo()
  await showSplash()
  appendEventLog('Snake: display initialized')
}
