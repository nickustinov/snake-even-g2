import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string) {
  console.log(`[ui] ${text}`)
  const el = document.getElementById('status')
  if (el) el.textContent = text
}

// Lemon Squeezy overlay checkout. lemon.js's auto-scan runs at
// DOMContentLoaded; we drive the overlay programmatically and call Setup()
// to register an event handler – without it the close-X postMessage from
// the overlay iframe has no listener and the X appears dead.
type LemonSqueezy = {
  Setup: (opts: { eventHandler: (event: { event: string }) => void }) => void
  Url: { Open: (url: string) => void; Close: () => void }
  Refresh: () => void
}

declare global {
  interface Window {
    createLemonSqueezy?: () => void
    LemonSqueezy?: LemonSqueezy
  }
}

async function ensureLemonReady(): Promise<LemonSqueezy | null> {
  const start = Date.now()
  while (Date.now() - start < 4000) {
    if (window.LemonSqueezy) return window.LemonSqueezy
    if (window.createLemonSqueezy) {
      window.createLemonSqueezy()
      if (window.LemonSqueezy) return window.LemonSqueezy
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
}

function setupCoffeeButton() {
  const btn = document.getElementById('coffee-btn') as HTMLAnchorElement | null
  if (!btn) return
  const url = btn.href
  void ensureLemonReady().then((ls) => {
    if (ls) ls.Setup({ eventHandler: () => {} })
  })
  btn.addEventListener('click', (e) => {
    e.preventDefault()
    void ensureLemonReady().then((ls) => {
      if (ls) ls.Url.Open(url)
      else window.open(url, '_blank')
    })
  })
}

function setupInitialsUI(getInitials: () => string, setInitials: (v: string) => void) {
  const panel = document.getElementById('initials-panel')!
  const inputs = [
    document.getElementById('char0') as HTMLInputElement,
    document.getElementById('char1') as HTMLInputElement,
    document.getElementById('char2') as HTMLInputElement,
  ]
  const saveBtn = document.getElementById('save-initials')!

  // Populate from current value
  const current = getInitials()
  for (let i = 0; i < 3; i++) {
    inputs[i].value = (current[i] || 'A').toUpperCase()
  }

  // Auto-advance on input
  inputs.forEach((input, i) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(-1)
      if (input.value && i < 2) inputs[i + 1].focus()
    })

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && i > 0) {
        inputs[i - 1].focus()
      }
    })

    input.addEventListener('focus', () => input.select())
  })

  saveBtn.addEventListener('click', () => {
    const initials = inputs.map((inp) => inp.value || '-').join('').toUpperCase()
    setInitials(initials)
    updateStatus(`initials set: ${initials}`)
  })

  panel.style.display = ''
}

async function boot() {
  const module = await import('../g2/index')
  const app: AppModule = module.app ?? module.default

  document.title = `${app.name} \u2013 Even G2`
  updateStatus(app.initialStatus ?? `${app.name} app ready`)

  const actions = await app.createActions(updateStatus)
  await actions.connect()

  // Set up initials UI after connection
  const stateModule = await import('../g2/state')
  setupInitialsUI(
    () => stateModule.game.userInitials,
    (v) => stateModule.saveInitials(v),
  )

  setupCoffeeButton()
}

void boot().catch((error) => {
  console.error('[app-loader] boot failed', error)
  updateStatus('App boot failed')
})
