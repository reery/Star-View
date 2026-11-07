/** Johnson V distance modulus, with the source's existing extinction assumptions. */
export function apparentVisualMagnitude(absoluteMagnitude: number | null, distancePc: number): number | null {
  if (absoluteMagnitude === null || !Number.isFinite(absoluteMagnitude) || !Number.isFinite(distancePc) || distancePc <= 0) return null
  const magnitude = absoluteMagnitude + 5 * (Math.log10(distancePc) - 1)
  return Number.isFinite(magnitude) ? magnitude : null
}

/** Map display only: an unresolved parent shows its blended light, which is never an individual measurement. */
export function mapAbsoluteMagnitude(star: { absolute_mag: number | null; x_pc: number; y_pc: number; z_pc: number; unresolved_photometry?: { magnitude_v: number } }): number | null {
  if (star.absolute_mag !== null) return star.absolute_mag
  const distancePc = Math.hypot(star.x_pc, star.y_pc, star.z_pc)
  const apparent = star.unresolved_photometry?.magnitude_v
  return apparent === undefined || distancePc === 0 ? null : apparent - 5 * Math.log10(distancePc / 10)
}
