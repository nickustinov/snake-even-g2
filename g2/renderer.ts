import {
  CreateStartUpPageContainer,
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
  // Count fullwidth characters (each counts as 1 column in our grid)
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
// Arcade screen builders
// ---------------------------------------------------------------------------

function formatRank(n: number): string {
  if (n < 10) return ` ${n}`
  return `${n}`
}

function formatScore(score: number, width: number): string {
  const s = String(score)
  return s.length >= width ? s.slice(0, width) : ' '.repeat(width - s.length) + s
}

function buildLeaderboardRows(entries: LeaderboardEntry[]): string[] {
  // Two columns: ranks 1-5 left, ranks 6-10 right
  // Each entry: rank(2) + name(3) + score(4) = 9 chars
  // Two entries + 2 separator + padding = 9 + 2 + 9 + padding = 20 + 8 = 28
  const rows: string[] = []
  const COL_W = 12 // chars per column

  for (let i = 0; i < 5; i++) {
    const left = entries[i]
    const right = entries[i + 5]

    let leftStr = ''
    if (left) {
      leftStr = `${formatRank(i + 1)} ${left.name.padEnd(3)}${formatScore(left.score, 5)}`
    }

    let rightStr = ''
    if (right) {
      rightStr = `${formatRank(i + 6)} ${right.name.padEnd(3)}${formatScore(right.score, 5)}`
    }

    // Pad each column and combine
    const leftFw = fwPad(leftStr, COL_W, 'left')
    const rightFw = right ? fwPad(rightStr, COLS - COL_W, 'left') : EMPTY.repeat(COLS - COL_W)
    rows.push(leftFw + rightFw)
  }

  return rows
}

function buildSplashScreen(): string {
  const lb = game.leaderboard
  const rows: string[] = []

  // Row 0: title
  rows.push(fwRow('* SNAKE *'))

  if (lb.length > 0) {
    // Row 1: subtitle
    rows.push(fwRow('HI SCORES'))
    // Rows 2-6: leaderboard (two columns)
    rows.push(...buildLeaderboardRows(lb))
    // Row 7: blank or your best
    rows.push(blankRow())
    // Row 8: your info
    const bestStr = `BEST:${game.highScore} YOU:${game.userInitials}`
    rows.push(fwRow(bestStr))
  } else {
    // No leaderboard yet
    rows.push(blankRow())
    rows.push(fwRow(`BEST: ${game.highScore}`))
    rows.push(blankRow())
    rows.push(blankRow())
    rows.push(blankRow())
    rows.push(blankRow())
    rows.push(fwRow(`YOU: ${game.userInitials}`))
  }

  // Row 9: action hint
  rows.push(fwRow('TAP TO START'))

  // Pad to exactly ROWS rows
  while (rows.length < ROWS) rows.splice(rows.length - 1, 0, blankRow())

  // Join without trailing newline on last row
  return rows.map((r, i) => i < rows.length - 1 ? r + '\n' : r).join('')
}

function buildGameOverScreen(): string {
  const lb = game.leaderboard
  const rows: string[] = []

  // Row 0: game over
  rows.push(fwRow('GAME OVER'))

  // Row 1: your score
  rows.push(fwRow(`SCORE: ${game.score}`))

  if (lb.length > 0) {
    // Rows 2-6: leaderboard
    rows.push(...buildLeaderboardRows(lb))
    // Row 7: blank
    rows.push(blankRow())
  } else {
    rows.push(blankRow())
    rows.push(fwRow(`BEST: ${game.highScore}`))
    rows.push(blankRow())
    rows.push(blankRow())
    rows.push(blankRow())
    rows.push(blankRow())
  }

  // Row 8: your info
  const bestStr = `BEST:${game.highScore} YOU:${game.userInitials}`
  rows.push(fwRow(bestStr))

  // Row 9: action hint
  rows.push(fwRow('TAP TO PLAY'))

  while (rows.length < ROWS) rows.splice(rows.length - 1, 0, blankRow())

  return rows.map((r, i) => i < rows.length - 1 ? r + '\n' : r).join('')
}

// ---------------------------------------------------------------------------
// Page layouts
// ---------------------------------------------------------------------------

let startupRendered = false
let pageSetUp = false

type PageMode = 'splash' | 'game' | 'gameover'
let currentPage: PageMode = 'splash'

function buildTextPage(content: string): object {
  return {
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
        content,
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
    ],
  }
}

async function setupSplashPage(): Promise<void> {
  if (!bridge) return
  const content = buildSplashScreen()
  const config = buildTextPage(content)

  if (!startupRendered) {
    await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config))
    startupRendered = true
  } else {
    await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  }
  pageSetUp = true
  currentPage = 'splash'
}

async function setupGameOverPage(): Promise<void> {
  if (!bridge) return
  const content = buildGameOverScreen()
  const config = buildTextPage(content)
  await bridge.rebuildPageContainer(new RebuildPageContainer(config))
  pageSetUp = true
  currentPage = 'gameover'
}

function scoreText(): string {
  const globalHi = game.leaderboard.length > 0 ? game.leaderboard[0].score : game.highScore
  const hi = Math.max(globalHi, game.highScore)
  return `Score: ${game.score}  \u00B7  Hi: ${hi}`
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

    // On splash/gameover page, update the screen text
    if (currentPage === 'splash' || currentPage === 'gameover') {
      const text = currentPage === 'splash' ? buildSplashScreen() : buildGameOverScreen()
      await bridge.textContainerUpgrade(
        new TextContainerUpgrade({
          containerID: 2,
          containerName: 'screen',
          contentOffset: 0,
          contentLength: 2000,
          content: text,
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
  await setupSplashPage()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initDisplay(): Promise<void> {
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
