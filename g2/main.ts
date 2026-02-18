import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { AppActions, SetStatus } from '../_shared/app-types'
import { appendEventLog } from '../_shared/log'
import { initApp, startGame } from './app'

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Even bridge not detected within ${timeoutMs}ms`))
    }, timeoutMs)

    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer))
  })
}

export function createSnakeActions(setStatus: SetStatus): AppActions {
  let connected = false

  return {
    async connect() {
      setStatus('Snake: connecting to Even bridge...')
      appendEventLog('Snake: connect requested')

      try {
        const bridge = await withTimeout(waitForEvenAppBridge(), 6000)
        await initApp(bridge)
        connected = true
        setStatus('Snake: connected. Tap to start!')
        appendEventLog('Snake: connected to bridge')
      } catch (err) {
        console.error('[snake] connect failed', err)
        setStatus('Snake: bridge not found.')
        appendEventLog('Snake: connection failed')
      }
    },

    async action() {
      if (!connected) {
        setStatus('Snake: not connected')
        return
      }
      startGame()
      setStatus('Snake: new game!')
    },
  }
}
