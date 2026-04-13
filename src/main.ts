import type { AppModule } from '../_shared/app-types'

function updateStatus(text: string) {
  console.log(`[ui] ${text}`)
  const el = document.getElementById('status')
  if (el) el.textContent = text
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
}

void boot().catch((error) => {
  console.error('[app-loader] boot failed', error)
  updateStatus('App boot failed')
})
