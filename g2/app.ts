import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { TICK_MS } from './layout'
import { game, setBridge, resetGame, fetchBestScore } from './state'
import { tick } from './game'
import { initDisplay, pushFrame, showSplash } from './renderer'
import { onEvenHubEvent, setStartGame } from './events'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function gameLoop(): Promise<void> {
  appendEventLog('Snake: game loop started')
  while (game.running) {
    const start = Date.now()

    const result = tick()

    if (result.died) {
      await pushFrame()
      appendEventLog(`Snake: game over, score=${game.score}`)
      break
    }

    await pushFrame()

    const elapsed = Date.now() - start
    await sleep(Math.max(0, TICK_MS - elapsed))
  }
}

export function startGame(): void {
  if (game.running) return
  if (game.over) {
    // Game over → return to splash screen
    game.over = false
    void showSplash()
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
  setStartGame(startGame)

  appBridge.onEvenHubEvent((event) => {
    onEvenHubEvent(event)
  })

  await initDisplay()

  fetchBestScore().then(() => {
    if (!game.running) void pushFrame()
  })

  appendEventLog('Snake: ready. Tap to start.')
}
