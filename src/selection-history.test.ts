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

  it('restores the last selection before moving farther back after deselection', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record('proxima')
    history.record(null)
    history.record(null)

    expect(history.peekBack(available)).toBe('proxima')
    expect(history.peekBack(available)).toBe('proxima')
    expect(history.canGoForward(available)).toBe(false)
    expect(history.back(available)).toBe('proxima')
    expect(history.back(available)).toBe('sun')
    expect(history.forward(available)).toBe('proxima')
  })

  it('restores the initial selection without adding a duplicate history entry', () => {
    const history = new SelectionHistory('sirius')
    history.record(null)

    expect(history.canGoBack(available)).toBe(true)
    expect(history.back(available)).toBe('sirius')
    expect(history.canGoBack(available)).toBe(false)
    expect(history.canGoForward(available)).toBe(false)
  })

  it('preserves the forward branch on deselection and clears it on a new selection', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record('proxima')
    history.back(available)
    history.record(null)

    expect(history.peekBack(available)).toBe('sun')
    expect(history.peekForward(available)).toBe('proxima')
    expect(history.forward(available)).toBe('proxima')
    expect(history.back(available)).toBe('sun')
    history.record(null)
    history.record('barnard')
    expect(history.canGoForward(available)).toBe(false)
    expect(history.back(available)).toBe('sun')
  })

  it('resumes normal history when the deselected object is selected directly', () => {
    const history = new SelectionHistory('sirius')
    history.record('sun')
    history.record(null)
    history.record('sun')

    expect(history.peekBack(available)).toBe('sirius')
    expect(history.back(available)).toBe('sirius')
    expect(history.forward(available)).toBe('sun')
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
    history.record(null)
    expect(history.peekBack((id) => id !== 'catalog-only-star')).toBe('sun')
    expect(history.back((id) => id !== 'catalog-only-star')).toBe('sun')
  })
})
