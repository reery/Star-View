import { describe, expect, it } from 'vitest'
import { SelectionHistory } from './selection-history'

const available = () => true

describe('SelectionHistory', () => {
  it('moves backward and forward through selections', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record('proxima')

    expect(history.back(available)).toBe('sun')
    expect(history.back(available)).toBe('sirius')
    expect(history.canGoBack(available)).toBe(false)
    expect(history.forward(available)).toBe('sun')
    expect(history.forward(available)).toBe('proxima')
    expect(history.canGoForward(available)).toBe(false)
  })

  it('replaces the forward branch after a new selection', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record('proxima')
    history.back(available)
    history.record('barnard')

    expect(history.back(available)).toBe('sun')
    expect(history.forward(available)).toBe('barnard')
    expect(history.canGoForward(available)).toBe(false)
  })

  it('keeps only the latest 20 selections', () => {
    const history = new SelectionHistory('star-0')
    for (let index = 1; index <= 20; index++) history.record(`star-${index}`)

    const visited = ['star-20']
    while (history.canGoBack(available)) visited.push(history.back(available)!)
    expect(visited).toHaveLength(20)
    expect(visited.at(-1)).toBe('star-1')
  })

  it('skips selections unavailable in the active catalog', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record('catalog-only-star')

    expect(history.back((id) => id !== 'sun')).toBe('sirius')
    expect(history.forward((id) => id === 'catalog-only-star')).toBe('catalog-only-star')
  })
})
