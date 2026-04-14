import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { TICK_MS } from './layout'
import { game, setBridge, resetGame, loadHighScore, loadInitials, loadUserInfo, updateHighScore, insertCurrentScore } from './state'
import { tick } from './game'
import { initDisplay, showSplash, showGame, showGameOver, updateGame, nextScreenGen, currentScreenGen } from './renderer'
import { onEvenHubEvent, setStartGame } from './events'
import { fetchLeaderboard, submitScore } from './scores-api'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function refreshLeaderboard(): Promise<void> {
  game.leaderboard = await fetchLeaderboard('snake')
}

async function gameLoop(): Promise<void> {
  while (game.running) {
    const start = Date.now()
    const result = tick()

    if (result.died) {
      // Show game over screen, then submit score in background
      const gen = nextScreenGen()
      await showGameOver()
      void submitScore('snake', game.userInitials, game.score, game.userUid)
        .then((scores) => { if (scores.length > 0) game.leaderboard = scores })
        .then(() => { if (currentScreenGen() === gen) return showGameOver() })
      break
    }

    await updateGame()
    const elapsed = Date.now() - start
    const remaining = Math.max(0, TICK_MS - elapsed)
    if (remaining > 0 && game.running) await sleep(remaining)
  }

  if (game.quit) {
    game.quit = false
    const gen = nextScreenGen()
    await showSplash()
    void refreshLeaderboard().then(() => {
      if (currentScreenGen() === gen) void showSplash()
    })
  }
}

export function startGame(): void {
  if (game.running) return
  game.over = false
  resetGame()
  nextScreenGen()
  void showGame().then(() => gameLoop())
}

export async function initApp(appBridge: EvenAppBridge): Promise<void> {
  setBridge(appBridge)

  await Promise.all([loadHighScore(), loadInitials(), loadUserInfo()])

  setStartGame(startGame)
  appBridge.onEvenHubEvent((event) => onEvenHubEvent(event))

  await initDisplay()

  // Fetch leaderboard in background, refresh splash only if still on splash
  const gen = currentScreenGen()
  void refreshLeaderboard().then(() => {
    if (currentScreenGen() === gen) void showSplash()
  })

  appendEventLog('Snake: ready')
}
