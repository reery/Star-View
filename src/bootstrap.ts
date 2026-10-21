import './style.css'
import { createLoadError } from './load-recovery'

// Keep recovery independent of Three.js and the app's static dependency graph:
// a missing startup chunk otherwise prevents main.ts from executing at all.
async function start(): Promise<void> {
  const status = document.getElementById('scene-status')!
  status.textContent = 'Loading nearby-object map...'
  try {
    await import('./main')
  } catch (error) {
    console.error('Could not start Star View.', error)
    status.hidden = false
    status.replaceChildren(createLoadError('Star View', () => { void start() }))
  }
}

void start()
