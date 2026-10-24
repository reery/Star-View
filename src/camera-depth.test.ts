import { expect, it } from 'vitest'
import { Box3, PerspectiveCamera, Vector3 } from 'three'
import { updateCameraNearPlane } from './camera-depth'

it('keeps foreground and background depths distinct while orbiting far from a crowded region', () => {
  const camera = new PerspectiveCamera(44, 1, 0.01, 2_000_000)
  const points = [new Vector3(-1, 0, 0), new Vector3(1, 0, 0)]
  const quantizedDepth = (depth: number) => Math.round(
    (camera.far / (camera.far - camera.near) - camera.far * camera.near / ((camera.far - camera.near) * depth)) * (2 ** 24 - 1),
  )
  // The former fixed near plane loses even a full parsec of separation here.
  expect(quantizedDepth(100_000)).toBe(quantizedDepth(100_001))
  for (let step = 0; step < 36; step++) {
    const angle = step * Math.PI / 18
    camera.position.set(Math.sin(angle) * 100_000, 0, Math.cos(angle) * 100_000)
    updateCameraNearPlane(camera, points, [])
    expect(quantizedDepth(100_001) - quantizedDepth(100_000)).toBeGreaterThan(0)
    expect(camera.near).toBeLessThanOrEqual(camera.position.distanceTo(points[0]!) / 100)
  }
})

it('restores the close-up near plane and protects extended cloud surfaces', () => {
  const camera = new PerspectiveCamera(44, 1, 0.01, 2_000_000)
  const positions = [new Vector3()]
  camera.position.set(0, 0, 100_000)
  expect(updateCameraNearPlane(camera, positions, [])).toBe(true)
  const cloud = new Box3(new Vector3(-1, -1, 99_999), new Vector3(1, 1, 100_001))
  updateCameraNearPlane(camera, positions, [cloud])
  expect(camera.near).toBe(0.01)
  camera.position.set(0, 0, 0.08)
  expect(updateCameraNearPlane(camera, positions, [])).toBe(false)
  expect(camera.near).toBe(0.01)
})
