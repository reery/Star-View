import type { Box3, PerspectiveCamera, Vector3 } from 'three'

/** Keep close-up access while spending more depth precision on distant views. */
export function updateCameraNearPlane(camera: PerspectiveCamera, positions: readonly Vector3[], extendedBounds: readonly Box3[]): boolean {
  let clearanceSquared = camera.far ** 2
  for (const position of positions) clearanceSquared = Math.min(clearanceSquared, camera.position.distanceToSquared(position))
  let clearance = Math.sqrt(clearanceSquared)
  for (const bounds of extendedBounds) clearance = Math.min(clearance, bounds.distanceToPoint(camera.position))
  // Leave a hundredfold margin before the nearest object, including cloud surfaces.
  const near = Math.max(0.01, clearance / 100)
  if (camera.near === near) return false
  camera.near = near
  camera.updateProjectionMatrix()
  return true
}
