import { describe, expect, it } from 'vitest'
import { centeredForegroundLabelBounds } from './label-layout'

const viewport = { left: 0, top: 0, width: 500, height: 320 }

describe('distance label placement', () => {
  it('centers the label on the projected line midpoint', () => {
    expect(centeredForegroundLabelBounds({ x: 250, y: 160 }, 80, 20, viewport))
      .toEqual({ left: 210, top: 150, right: 290, bottom: 170 })
  })

  it('clamps only at the viewport inset', () => {
    expect(centeredForegroundLabelBounds({ x: 5, y: 5 }, 80, 20, viewport))
      .toEqual({ left: 12, top: 12, right: 92, bottom: 32 })
    expect(centeredForegroundLabelBounds({ x: 495, y: 315 }, 80, 20, viewport))
      .toEqual({ left: 408, top: 288, right: 488, bottom: 308 })
  })
})
