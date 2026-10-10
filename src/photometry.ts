/** Johnson V distance modulus, with the source's existing extinction assumptions. */
export function apparentVisualMagnitude(absoluteMagnitude: number | null, distancePc: number): number | null {
  if (absoluteMagnitude === null || !Number.isFinite(absoluteMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) return null
  const magnitude = absoluteMagnitude + 5 * (Math.log10(distancePc) - 1)
  return Number.isFinite(magnitude) ? magnitude : null
}
