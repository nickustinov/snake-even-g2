import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { appendEventLog } from '../_shared/log'
import { TICK_MS } from './layout'
import { game, setBridge, resetGame } from './state'
import { tick } from './game'
import {
  initDisplay,
  drawFullFrame,
  drawDelta,
  drawGameOver,
  pushFrame,
} from './renderer'
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
      drawGameOver()
      await pushFrame()
      appendEventLog(`Snake: game over, score=${game.score}`)
      break
    }

    drawDelta(result)
    await pushFrame()

    const elapsed = Date.now() - start
    await sleep(Math.max(0, TICK_MS - elapsed))
  }
}

export function startGame(): void {
  if (game.running) return
  resetGame()
  drawFullFrame()
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
  appendEventLog('Snake: ready. Tap to start.')
}
