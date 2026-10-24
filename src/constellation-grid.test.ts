import { describe, expect, it } from 'vitest'
import { constellationGrid, type ConstellationGridView } from './constellation-grid'

const view: ConstellationGridView = {
  center: { ra_deg: 101, dec_deg: -22 }, centerX: 0, centerY: 0, scale: 700, width: 380, height: 357,
}

describe('constellation equatorial grid', () => {
  it('refines both coordinate intervals with magnification', () => {
    const overview = constellationGrid(view)
    const magnified = constellationGrid({ ...view, scale: view.scale * 3 })
    expect(magnified.raStep).toBeLessThan(overview.raStep)
    expect(magnified.decStep).toBeLessThan(overview.decStep)
    expect(overview.lines.some((line) => line.axis === 'ra' && line.label.includes('h'))).toBe(true)
    expect(overview.lines.some((line) => line.axis === 'dec' && line.label.includes('−'))).toBe(true)
  })

  it.each([
    { ra_deg: 0, dec_deg: 0 }, { ra_deg: 359, dec_deg: 20 },
    { ra_deg: 0, dec_deg: 90 }, { ra_deg: 180, dec_deg: -90 },
  ])('clips finite curves through the RA wrap and poles: %j', (center) => {
    const grid = constellationGrid({ ...view, center, scale: 240 })
    expect(grid.lines.length).toBeGreaterThan(4)
    for (const line of grid.lines) {
      expect(line.path).not.toMatch(/NaN|Infinity/)
      const coordinates = [...line.path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)]
      expect(coordinates.length).toBeGreaterThan(1)
      for (const [, x, y] of coordinates) {
        expect(Number(x)).toBeGreaterThanOrEqual(-0.01)
        expect(Number(x)).toBeLessThanOrEqual(view.width + 0.01)
        expect(Number(y)).toBeGreaterThanOrEqual(-0.01)
        expect(Number(y)).toBeLessThanOrEqual(view.height + 0.01)
      }
    }
    if (center.dec_deg === 0) {
      expect(grid.lines.find((line) => line.axis === 'dec' && line.value === 0)?.path).toContain(',178.50')
      expect(grid.lines.find((line) => line.axis === 'ra' && line.value === 0)?.path).toContain('190.00,')
    }
  })
})
