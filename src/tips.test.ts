import { describe, expect, it } from 'vitest'
import { exploredCards, TIP_FEATURES, tipLevel } from './tips'

const opened = TIP_FEATURES.filter(({ card }) => !card).map(({ id }) => id)
const cards = [...new Set(TIP_FEATURES.flatMap(({ card }) => card ? [card] : []))]
/** Two in-depth features of each card. */
const depth = cards.flatMap((card) => TIP_FEATURES.filter((feature) => feature.card === card).slice(0, 2).map(({ id, key }) => key ? `${id}:a` : id))

describe('tipLevel', () => {
  it('starts every visitor as a novice', () => {
    expect(tipLevel(new Set())).toBe('novice')
    expect(tipLevel(new Set(opened.slice(0, Math.floor(opened.length / 2))))).toBe('novice')
  })

  it('makes a visitor who opened most features an intermediate', () => {
    expect(tipLevel(new Set(opened))).toBe('intermediate')
  })

  it('makes a visitor who used two in-depth features in almost every card a pro', () => {
    expect(tipLevel(new Set([...opened, ...depth]))).toBe('pro')
    expect(tipLevel(new Set([...opened, ...depth.slice(0, depth.length / 2)]))).toBe('intermediate')
  })
})

describe('exploredCards', () => {
  it('needs two different uses in a card', () => {
    expect(exploredCards(new Set(['paint-setting:mass'])).has('paint')).toBe(false)
    expect(exploredCards(new Set(['paint-setting:mass', 'paint-setting:distance'])).has('paint')).toBe(true)
    expect(exploredCards(new Set(['paint-setting:mass', 'paint-scale'])).has('paint')).toBe(true)
  })

  it('ignores opening a card without using it', () => {
    expect(exploredCards(new Set(['paint', 'graphs', 'filter'])).size).toBe(0)
  })
})
