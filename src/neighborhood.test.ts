import { describe, expect, it } from 'vitest'
import { neighborhoodBounds } from './neighborhood'

describe('neighborhood bounds', () => {
  it('fills the sphere without a birth year', () => {
    expect(neighborhoodBounds(25, null, 2026)).toEqual({ innerLy: 0, outerLy: 25, sphereLy: 25 })
  })

  it('selects a ±1 ly shell at the light-travel distance since the birth year', () => {
    expect(neighborhoodBounds(25, 1990, 2026)).toEqual({ innerLy: 35, outerLy: 37, sphereLy: 36 })
    expect(neighborhoodBounds(25, 1900, 2026)).toEqual({ innerLy: 125, outerLy: 127, sphereLy: 126 })
  })

  it('keeps the inner bound at the center for recent years', () => {
    expect(neighborhoodBounds(25, 2026, 2026)).toEqual({ innerLy: 0, outerLy: 1, sphereLy: 0 })
  })
})
