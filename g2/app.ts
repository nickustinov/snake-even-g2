import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { TICK_MS } from './layout'
import { game, setBridge, resetGame, loadHighScore, loadInitials, loadUserInfo, updateHighScore } from './state'
import { tick } from './game'
import { initDisplay, pushFrame, showSplash } from './renderer'
import { onEvenHubEvent, setStartGame } from './events'
import { fetchLeaderboard, submitScore } from './scores-api'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function refreshLeaderboard(): Promise<void> {
  game.leaderboard = await fetchLeaderboard('snake')
}

async function submitAndRefresh(): Promise<void> {
  if (game.score <= 0) return
  const updated = await submitScore('snake', game.userInitials, game.score, game.userUid)
  if (updated.length > 0) game.leaderboard = updated
}

async function gameLoop(): Promise<void> {
  appendEventLog('Snake: game loop started')
  while (game.running) {
    const start = Date.now()

    const result = tick()

    if (result.died) {
      await pushFrame()
      appendEventLog(`Snake: game over, score=${game.score}`)
      // Submit score and refresh leaderboard in background
      void submitAndRefresh().then(() => pushFrame())
      break
    }

    await pushFrame()

    const elapsed = Date.now() - start
    await sleep(Math.max(0, TICK_MS - elapsed))
  }

  if (game.quit) {
    game.quit = false
    await refreshLeaderboard()
    await showSplash()
    appendEventLog('Snake: quit to menu')
  }
}

export function startGame(): void {
  if (game.running) return
  if (game.over) {
    // Game over -> return to splash screen
    game.over = false
    void refreshLeaderboard().then(() => showSplash())
    appendEventLog('Snake: back to splash')
    return
  }
  resetGame()
  void pushFrame().then(() => {
    void gameLoop()
  })
  appendEventLog('Snake: new game started')
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)

  // Load local state and user info in parallel
  await Promise.all([
    loadHighScore(),
    loadInitials(),
    loadUserInfo(),
  ])

  // Fetch global leaderboard (non-blocking for display)
  void refreshLeaderboard().then(() => pushFrame())

  setStartGame(startGame)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()

  appendEventLog('Snake: ready. Tap to start.')
}
