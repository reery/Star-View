import { brownDwarfAppearanceKelvin, brownDwarfSurfaceColor, starDisplayColor } from './astronomy'
import { MISSING_VALUE } from './format'
import { isBubbleObject, isCompactObject, isMolecularCloudObject, isNebulaObject, type Star } from './catalog-model'
import { SOLAR_RADIUS_METERS } from './luminosity-properties'
import jupiterMapUrl from './assets/radius-comparison/jupiter-map.webp?url'
import earthMapUrl from './assets/radius-comparison/earth-map.webp?url'
import earthCloudsUrl from './assets/radius-comparison/earth-clouds.jpg?url'

// IAU 2015 Resolution B3: https://arxiv.org/abs/1510.07674
export const SOLAR_RADIUS_KM = SOLAR_RADIUS_METERS / 1000
export const JUPITER_RADIUS_KM = 71_492
const JUPITER_POLAR_RADIUS_KM = 66_854
export const EARTH_RADIUS_KM = 6_378.1
const EARTH_POLAR_RADIUS_KM = 6_356.8
// NASA fact sheets: sidereal rotation; the Sun's equatorial rate is 14.37°/day.
const SOLAR_EQUATORIAL_ROTATION_DAYS = 360 / 14.37
const JUPITER_ROTATION_DAYS = 9.925 / 24
const EARTH_ROTATION_DAYS = 23.9345 / 24
export type RadiusReference = 'auto' | 'origin' | 'jupiter' | 'earth'

export interface RadiusBody {
  name: string
  radiusKm: number | null
  polarRadiusKm: number | null
  rotationPeriodDays: number | null
  equatorialVelocityKms: number | null
  color: string
  kind: 'star' | 'dwarf' | 'jupiter' | 'earth'
  /** Brown dwarfs only: drives the disk's look and may be a class stand-in, so it is never displayed. */
  appearanceKelvin?: number
}

export interface RadiusComparison {
  selected: RadiusBody
  reference: RadiusBody
  jupiterBenchmark: boolean
  referenceMode: Exclude<RadiusReference, 'auto'>
}

const equatorialVelocity = (radiusKm: number, periodDays: number) => 2 * Math.PI * radiusKm / (periodDays * 86_400)

function stellarBody(star: Star): RadiusBody {
  const radius = star.radius_solar
  const available = !isCompactObject(star) && !isNebulaObject(star) && !isMolecularCloudObject(star) && !isBubbleObject(star)
    && radius !== null && Number.isFinite(radius) && radius > 0
  const radiusKm = available ? radius * SOLAR_RADIUS_KM : null
  const rotation = star.stellar_observations?.rotation
  const solarPeriod = star.id === 'sun' ? SOLAR_EQUATORIAL_ROTATION_DAYS : null
  const appearanceKelvin = star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf' ? brownDwarfAppearanceKelvin(star) : undefined
  return {
    name: star.name, radiusKm,
    // The catalog radius is drawn as the equatorial radius of a measured rapid rotator.
    polarRadiusKm: radiusKm === null ? null : radiusKm * (rotation?.polar_to_equatorial_radius ?? 1),
    rotationPeriodDays: rotation?.period_days ?? solarPeriod,
    equatorialVelocityKms: rotation?.equatorial_velocity_kms ?? (solarPeriod && equatorialVelocity(SOLAR_RADIUS_KM, solarPeriod)),
    color: `#${(appearanceKelvin === undefined ? starDisplayColor(star, 'real') : brownDwarfSurfaceColor(appearanceKelvin)).getHexString()}`,
    kind: appearanceKelvin === undefined ? 'star' : 'dwarf',
    ...appearanceKelvin === undefined ? {} : { appearanceKelvin },
  }
}

const jupiter: RadiusBody = {
  name: 'Jupiter', radiusKm: JUPITER_RADIUS_KM, polarRadiusKm: JUPITER_POLAR_RADIUS_KM,
  rotationPeriodDays: JUPITER_ROTATION_DAYS, equatorialVelocityKms: equatorialVelocity(JUPITER_RADIUS_KM, JUPITER_ROTATION_DAYS),
  color: '#c7b49b', kind: 'jupiter',
}
const earth: RadiusBody = {
  name: 'Earth', radiusKm: EARTH_RADIUS_KM, polarRadiusKm: EARTH_POLAR_RADIUS_KM,
  rotationPeriodDays: EARTH_ROTATION_DAYS, equatorialVelocityKms: equatorialVelocity(EARTH_RADIUS_KM, EARTH_ROTATION_DAYS),
  color: '#739bd1', kind: 'earth',
}

export function radiusComparison(selectedStar: Star, origin: Star, mode: RadiusReference = 'auto'): RadiusComparison {
  const selected = stellarBody(selectedStar)
  const referenceMode = mode === 'auto'
    ? origin.id === 'sun' && selected.radiusKm !== null && selected.radiusKm <= 2 * JUPITER_RADIUS_KM ? 'jupiter' : 'origin'
    : mode
  const jupiterBenchmark = referenceMode === 'jupiter'
  return { selected, reference: referenceMode === 'earth' ? earth : jupiterBenchmark ? jupiter : stellarBody(origin), jupiterBenchmark, referenceMode }
}

function surfaceArea(body: RadiusBody): number | null {
  const a = body.radiusKm
  const c = body.polarRadiusKm
  if (a === null || c === null) return null
  if (a === c) return 4 * Math.PI * a * a
  const eccentricity = Math.sqrt(1 - (c / a) ** 2)
  return 2 * Math.PI * a * a * (1 + (1 - eccentricity ** 2) * Math.atanh(eccentricity) / eccentricity)
}

function volume(body: RadiusBody): number | null {
  return body.radiusKm === null || body.polarRadiusKm === null ? null : 4 * Math.PI * body.radiusKm ** 2 * body.polarRadiusKm / 3
}

export function dimensionNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumSignificantDigits: 4 })
}

const rotationNumber = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 3 })

export function radiusStats(comparison: RadiusComparison): { label: string; values: { value: string }[] }[] {
  const bodies = [comparison.selected, comparison.reference]
  const length = (value: number) => `${dimensionNumber(value)} km`
  const scientific = (unit: string) => (value: number) => `${value.toExponential(3).replace('e+', 'e')} ${unit}`
  const rows: { label: string; measure: (body: RadiusBody) => number | null; format: (value: number) => string }[] = [
    { label: 'Radius', measure: (body) => body.radiusKm, format: length },
    ...bodies.some((body) => body.polarRadiusKm !== body.radiusKm)
      ? [{ label: 'Polar radius', measure: (body: RadiusBody) => body.polarRadiusKm, format: length }] : [],
    { label: 'Diameter', measure: (body) => body.radiusKm === null ? null : body.radiusKm * 2, format: length },
    { label: 'Surface area', measure: surfaceArea, format: scientific('km²') },
    { label: 'Volume', measure: volume, format: scientific('km³') },
    ...comparison.selected.rotationPeriodDays === null ? [] : [
      { label: 'Rotation period', measure: (body: RadiusBody) => body.rotationPeriodDays,
        format: (days: number) => days < 2 ? `${rotationNumber(days * 24)} h` : `${rotationNumber(days)} days` },
      { label: 'Equatorial velocity', measure: (body: RadiusBody) => body.equatorialVelocityKms, format: (value: number) => `${rotationNumber(value)} km/s` },
    ],
  ]
  return rows.map(({ label, measure, format }) => ({
    label,
    values: bodies.map((body) => {
      const value = measure(body)
      return { value: value === null ? MISSING_VALUE : format(value) }
    }),
  }))
}

export function radiusSummary(comparison: RadiusComparison): string {
  const { selected, reference } = comparison
  if (selected.radiusKm === null || reference.radiusKm === null) {
    const missing = [selected, reference].filter((body) => body.radiusKm === null).map((body) => body.name).join(' and ')
    return `No catalog radius is available for ${missing}. A size comparison cannot be drawn accurately.`
  }
  const ratio = selected.radiusKm / reference.radiusKm
  const volumeRatio = volume(selected)! / volume(reference)!
  return `${selected.name} is ${dimensionNumber(ratio)}× the diameter of ${reference.name}, with ${dimensionNumber(volumeRatio)}× its volume.`
}

// A disk colder than this is too dark to read as a size against the sky without a hairline.
const OUTLINE_BELOW_KELVIN = 900
const hasOutline = (body: RadiusBody, kmPerPixel: number) =>
  body.appearanceKelvin !== undefined && body.appearanceKelvin < OUTLINE_BELOW_KELVIN && body.radiusKm! / kmPerPixel >= 2

function radiusDrawingNote(comparison: RadiusComparison, kmPerPixel: number): string {
  const bodies = [comparison.selected, comparison.reference]
  const outlined = bodies.filter((body) => hasOutline(body, kmPerPixel)).map(({ name }) => ` ${name} is nearly invisible at this temperature; a hairline marks its edge.`)
  return `${outlined.join('')}${bodies.some(({ kind }) => kind === 'dwarf') ? ' Brown dwarf colors and cloud bands are illustrative.' : ''}`
}

/** Smooth lattice value noise in [-1, 1]; three octaves of it make the turbulent cloud deck below. */
function cloudNoise(x: number, y: number, z: number): number {
  let total = 0
  for (let octave = 0, scale = 1, weight = 0.57; octave < 3; octave++, scale *= 2.1, weight *= 0.5) {
    const sx = x * scale, sy = y * scale, sz = z * scale
    const ix = Math.floor(sx), iy = Math.floor(sy), iz = Math.floor(sz)
    const fx = sx - ix, fy = sy - iy, fz = sz - iz
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
    let value = 0
    for (let corner = 0; corner < 8; corner++) {
      const cx = corner & 1, cy = corner >> 1 & 1, cz = corner >> 2
      let hash = Math.imul(ix + cx, 374761393) ^ Math.imul(iy + cy, 668265263) ^ Math.imul(iz + cz + octave * 101, 1274126177)
      hash = Math.imul(hash ^ hash >>> 13, 1274126177)
      value += ((hash ^ hash >>> 16) >>> 0) / 0x7fffffff * (cx ? u : 1 - u) * (cy ? v : 1 - v) * (cz ? w : 1 - w)
    }
    total += (value - 1) * weight
  }
  return total
}

/**
 * Turbulent zonal bands, streaks and patchy spots on a sphere whose spin axis leans toward the viewer,
 * seeded per object. Returns the local cloud clearing near [-1, 1]: positive where thinner cloud reveals
 * deeper, hotter layers.
 */
function dwarfClouds(dx: number, dy: number, mu: number, seed: number): number {
  const roll = (seed / Math.PI - 1) * 0.18
  const lean = 0.2 + 0.25 * (seed * 7 % (2 * Math.PI)) / (2 * Math.PI)
  const east = dx * Math.cos(roll) + dy * Math.sin(roll)
  const south = dy * Math.cos(roll) - dx * Math.sin(roll)
  const north = mu * Math.sin(lean) - south * Math.cos(lean)
  const toward = mu * Math.cos(lean) + south * Math.sin(lean)
  const longitude = Math.atan2(east, toward) + seed
  const ring = Math.sqrt(Math.max(0, 1 - north * north))
  const x = Math.cos(longitude) * ring, z = Math.sin(longitude) * ring
  const latitude = Math.asin(Math.max(-1, Math.min(1, north))) + 0.16 * cloudNoise(2.2 * x + seed, 2.2 * north, 2.2 * z)
  const bands = 0.6 * Math.sin(6.5 * latitude + seed) + 0.4 * Math.sin(13 * latitude + 2.3 * seed)
  const streaks = cloudNoise(5 * x, 28 * latitude + seed, 5 * z)
  const patches = cloudNoise(4 * x - seed, 4 * north, 4 * z)
  return 0.55 * bands + 0.45 * streaks + 0.6 * patches
}

let renderedComparisons = new WeakMap<HTMLCanvasElement, string>()
const WIDTH = 340
const HEIGHT = 172
const MIDLINE = HEIGHT / 2

type PlanetTexture = 'jupiter' | 'earth' | 'earth-clouds'
interface TextureEntry { pixels?: ImageData; settled: boolean; promise: Promise<void> }
const planetTextures = new Map<PlanetTexture, TextureEntry>()

function planetTexture(kind: PlanetTexture): TextureEntry {
  const existing = planetTextures.get(kind)
  if (existing) return existing
  const entry: TextureEntry = { settled: false, promise: Promise.resolve() }
  entry.promise = new Promise<void>((resolve) => {
    const image = new Image()
    const settle = () => {
      // Blink can keep the element alive; detached handlers no longer retain this entry's pixels.
      image.onload = image.onerror = null
      image.removeAttribute('src')
      entry.settled = true
      resolve()
    }
    image.onload = () => {
      // A released entry is no longer drawn; skip decoding its pixels.
      if (planetTextures.get(kind) === entry) {
        const surface = document.createElement('canvas')
        surface.width = image.naturalWidth
        surface.height = image.naturalHeight
        // A CPU-backed canvas: a GPU canvas would keep a second, accelerated copy for this one-time readback.
        const context = surface.getContext('2d', { willReadFrequently: true })!
        context.drawImage(image, 0, 0)
        entry.pixels = context.getImageData(0, 0, surface.width, surface.height)
        surface.width = surface.height = 0
      }
      settle()
    }
    image.onerror = settle
    image.src = kind === 'jupiter' ? jupiterMapUrl : kind === 'earth' ? earthMapUrl : earthCloudsUrl
  })
  planetTextures.set(kind, entry)
  return entry
}

/** Free the decoded planet maps (tens of MB) once the radius card closes; they reload on next use. */
export function releaseRadiusComparisonTextures(): void {
  planetTextures.clear()
  renderedComparisons = new WeakMap()
}

export function renderRadiusComparison(canvas: HTMLCanvasElement, comparison: RadiusComparison): string {
  const { selected, reference } = comparison
  const key = JSON.stringify(comparison)
  const missing = selected.radiusKm === null || reference.radiusKm === null
  const radii = [selected.radiusKm ?? 1, reference.radiusKm ?? 1]
  const ratio = Math.max(...radii) / Math.min(...radii)
  // Enlarge the common scale for extreme pairs, revealing the giant's limb while
  // preserving the small disk. Never clamp either body's physical pixel radius.
  const largePixelRadius = 70 * (ratio > 6 ? Math.sqrt(ratio / 6) : 1)
  const kmPerPixel = Math.max(...radii) / largePixelRadius
  const cropped = !missing && largePixelRadius > 74
  const displayScale = (canvas.getBoundingClientRect().width || WIDTH) / WIDTH
  const unresolved = !missing && Math.min(...radii) / kmPerPixel * 2 * displayScale < 1
  const note = missing ? 'No sizes are inferred from spectral type, luminosity, or temperature.'
    : `Both objects use the same linear scale.${[selected, reference].filter(({ kind, radiusKm, polarRadiusKm }) => kind === 'star' && polarRadiusKm !== radiusKm)
      .map(({ name, radiusKm, polarRadiusKm }) => ` ${name} is drawn flattened by its rotation: the polar radius is ${dimensionNumber(polarRadiusKm! / radiusKm!)}× the equatorial radius.`).join('')}${cropped ? ` The larger object extends beyond the frame; its ${selected.radiusKm! >= reference.radiusKm! ? 'upper-right' : 'upper-left'} limb is shown.` : ''}${unresolved ? ' The smaller disk is below one display pixel; a guide marks its location without enlarging it.' : ''}${radiusDrawingNote(comparison, kmPerPixel)} Glow is outside the measured radius.`
  canvas.setAttribute('aria-label', `${radiusSummary(comparison)} ${note}`)
  if (renderedComparisons.get(canvas) === key) return note
  if (!missing && (reference.kind === 'jupiter' || reference.kind === 'earth')) {
    const textures = reference.kind === 'earth'
      ? [planetTexture('earth'), planetTexture('earth-clouds')] : [planetTexture('jupiter')]
    if (textures.some((texture) => !texture.settled)) {
      void Promise.all(textures.map((texture) => texture.promise)).then(() => {
        if (!textures.some((texture) => texture.pixels) || renderedComparisons.get(canvas) !== key) return
        renderedComparisons.delete(canvas)
        renderRadiusComparison(canvas, comparison)
      })
    }
  }
  const context = canvas.getContext('2d')
  if (!context) return note
  // Fixed backing resolution keeps the shared scale stable as the card resizes.
  canvas.width = WIDTH * 3
  canvas.height = HEIGHT * 3
  context.scale(3, 3)
  context.fillStyle = '#090b10'
  context.fillRect(0, 0, WIDTH, HEIGHT)
  if (missing) {
    context.fillStyle = '#a7abb3'
    context.font = `12px ${getComputedStyle(canvas).fontFamily}`
    context.textAlign = 'center'
    context.fillText('Radius comparison unavailable', WIDTH / 2, MIDLINE)
  } else {
    drawBody(context, selected, 0, kmPerPixel)
    drawBody(context, reference, WIDTH / 2, kmPerPixel)
  }
  renderedComparisons.set(canvas, key)
  return note
}

function drawBody(context: CanvasRenderingContext2D, body: RadiusBody, paneX: number, kmPerPixel: number): void {
  const radius = body.radiusKm! / kmPerPixel
  const polarRadius = body.polarRadiusKm! / kmPerPixel
  const cropped = radius > 74
  const rightPane = paneX > 0
  const x = paneX + (cropped ? rightPane ? 45 + radius / Math.SQRT2 : 125 - radius / Math.SQRT2 : 85)
  const y = cropped ? MIDLINE - 40 + polarRadius / Math.SQRT2 : MIDLINE
  context.save()
  context.beginPath()
  context.rect(paneX, 0, WIDTH / 2, HEIGHT)
  context.clip()
  const stellar = body.kind === 'star' || body.kind === 'dwarf'
  const kelvin = body.appearanceKelvin
  if (!stellar && radius >= 2) {
    // Thin atmospheric light outside the geometric limb; the disk keeps its
    // measured equatorial and polar dimensions. Earth has a blue scattering rim.
    context.save()
    context.translate(x, y)
    context.scale(radius, polarRadius)
    const outerRadius = 1 + Math.min(2, radius * 0.025) / radius
    const atmosphere = context.createRadialGradient(0, 0, 1, 0, 0, outerRadius)
    atmosphere.addColorStop(0, body.kind === 'earth' ? '#68afff70' : '#eef1f51a')
    atmosphere.addColorStop(1, '#00000000')
    context.fillStyle = atmosphere
    context.beginPath()
    context.arc(0, 0, outerRadius, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
  if (stellar && radius >= 2) {
    const haloWidth = cropped ? 24 : Math.min(18, 6 + radius * 0.13)
    // Anchor the transition to the visible limb in display pixels. An inward
    // radius fraction puts an extreme giant's surface near the faded end of
    // the gradient, leaving almost no light outside its cropped physical edge.
    const innerWidth = Math.min(6, radius * 0.08)
    // A rotationally flattened star keeps its glow parallel to the oblate limb.
    const flattening = polarRadius / radius
    context.save()
    context.translate(x, y)
    context.scale(1, flattening)
    // A dim object blooms less: the coldest dwarfs keep only a trace of dark glow.
    if (kelvin !== undefined) context.globalAlpha = 0.1 + 0.55 * Math.min(1, kelvin / 2400) ** 2
    const halo = context.createRadialGradient(0, 0, radius - innerWidth, 0, 0, radius + haloWidth)
    halo.addColorStop(0, `${body.color}${cropped ? 'b0' : '90'}`)
    halo.addColorStop(0.28, `${body.color}${cropped ? '80' : '60'}`)
    halo.addColorStop(0.58, `${body.color}${cropped ? '30' : '20'}`)
    halo.addColorStop(1, `${body.color}00`)
    context.fillStyle = halo
    context.fillRect(paneX - x, -y / flattening, WIDTH / 2, HEIGHT / flattening)
    context.restore()
    // A dwarf's limb darkens well below this flat color, which would show as a bright rim.
    if (body.kind === 'star') {
      context.fillStyle = body.color
      context.beginPath()
      context.ellipse(x, y, radius, polarRadius, 0, 0, Math.PI * 2)
      context.fill()
    }
  }

  // Rasterize only the visible pane, including for spheres many frame-widths
  // across. Smooth limb shading retains a crisp, measurable physical edge.
  const resolution = 3
  const image = context.createImageData(WIDTH / 2 * resolution, HEIGHT * resolution)
  const rgb = [1, 3, 5].map((offset) => parseInt(body.color.slice(offset, offset + 2), 16))
  const texture = body.kind === 'jupiter' || body.kind === 'earth' ? planetTextures.get(body.kind)?.pixels : undefined
  const clouds = body.kind === 'earth' ? planetTextures.get('earth-clouds')?.pixels : undefined
  const cloudSeed = [...body.name].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 7) / 997 * 2 * Math.PI
  // Zonal bands and spots follow Apai et al. 2017 (https://doi.org/10.1126/science.aam9848). The contrast is
  // illustrative, set strongest at the patchy L/T transition near 1,300 K.
  // Dust cannot condense in the hottest atmospheres, so bands fade out approaching M-dwarf temperatures.
  const cloudContrast = kelvin === undefined ? 0
    : (0.06 + 0.1 * Math.exp(-(((kelvin - 1300) / 500) ** 2))) * Math.max(0, Math.min(1, (2800 - kelvin) / 800))
  // A self-luminous atmosphere: cloud gaps and the disk center show deeper, hotter layers, so they read
  // brighter and more orange than thick cloud and the cooler limb. Shades come from the surface ramp.
  const DWARF_SHADES = 96
  const dwarfShades = kelvin === undefined ? [] : Array.from({ length: DWARF_SHADES }, (_, index) => {
    const hex = brownDwarfSurfaceColor(kelvin * (0.6 + 0.75 * index / (DWARF_SHADES - 1))).getHexString()
    return [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  })
  for (let py = 0; py < image.height; py++) {
    const dy = (py / resolution + 0.5 / resolution - y) / polarRadius
    for (let px = 0; px < image.width; px++) {
      const dx = (paneX + px / resolution + 0.5 / resolution - x) / radius
      const distanceSquared = dx * dx + dy * dy
      if (distanceSquared >= 1) continue
      const mu = Math.sqrt(1 - distanceSquared)
      const offset = (py * image.width + px) * 4
      if (texture) {
        // Orthographic projection of the photographic global map. Face the Great
        // Red Spot toward the viewer rather than using the current rotation phase.
        const meridian = body.kind === 'jupiter' ? 0.245 : 0.53
        const longitude = Math.atan2(dx, mu)
        const latitudeFraction = 0.5 + Math.asin(dy) / Math.PI
        const u = (meridian + longitude / (2 * Math.PI) + 1) % 1
        // Hubble's map omits latitudes beyond 80 degrees: extend its last
        // observed row into the small polar caps rather than showing black bands.
        const v = body.kind === 'jupiter' ? Math.max(0.06, Math.min(0.94, latitudeFraction)) : latitudeFraction
        const source = (Math.min(texture.height - 1, Math.floor(v * texture.height)) * texture.width + Math.floor(u * texture.width)) * 4
        const cloudSource = clouds ? (Math.min(clouds.height - 1, Math.floor(v * clouds.height)) * clouds.width + Math.floor(u * clouds.width)) * 4 : 0
        const cloudOpacity = clouds ? clouds.data[cloudSource]! / 255 * 0.96 : 0
        const ocean = body.kind === 'earth' && texture.data[source + 2]! > texture.data[source]! * 1.5
          && texture.data[source + 2]! > texture.data[source + 1]! * 1.4
        // Slightly off-axis daylight gives depth; grazing-angle atmospheric
        // scattering gently softens color at the limb without washing out detail.
        const daylight = Math.max(0, mu * 0.97 - dx * 0.16 - dy * 0.18)
        const illumination = 0.3 + 0.7 * daylight ** 0.65
        const fresnel = (1 - mu) ** (body.kind === 'earth' ? 3 : 2)
        const haze = fresnel * (body.kind === 'earth' ? 0.52 : 0.36)
        // Pale inner-limb scattering, judged against Hubble's 2019 portrait
        // and Cassini's true-color PIA04866 mosaic. Its brightness follows
        // daylight so the atmosphere retains the photographed limb darkening.
        const hazeColor = body.kind === 'earth' ? [85, 160, 245] : [238, 240, 244]
        const hazeIllumination = body.kind === 'earth' ? 1 : 0.45 + 0.55 * Math.sqrt(daylight)
        const oceanColor = [9, 47, 105]
        for (let channel = 0; channel < 3; channel++) {
          const ground = ocean ? oceanColor[channel]! : texture.data[source + channel]!
          const color = ground * (1 - cloudOpacity) + 250 * cloudOpacity
          image.data[offset + channel] = color * illumination * (1 - haze) + hazeColor[channel]! * haze * hazeIllumination
        }
      } else {
        // Very faint, independent grain at backing-pixel resolution also
        // dithers the smooth shading, without any larger surface patterns.
        let grain = Math.imul(px + py * 8191, 1597334677)
        grain = Math.imul(grain ^ grain >>> 16, 2246822519)
        const granulation = (grain >>> 0) / 0xffffffff * 2 - 1
        const shading = body.kind === 'dwarf' ? 0.42 + 0.58 * mu ** 0.8 : stellar ? 0.72 + 0.28 * mu ** 0.55 : 0.48 + 0.52 * mu ** 0.6
        const brightness = shading * (1 + granulation * 0.004)
        const shine = body.kind === 'star' ? 0.68 * mu ** 2.4 : 0
        // Near-black shades have so few 8-bit levels that they need absolute dither to avoid contours.
        const dither = body.kind === 'dwarf' ? granulation * 0.7 : 0
        const color = body.kind === 'dwarf'
          ? dwarfShades[Math.round(Math.max(0, Math.min(1, ((0.84 + 0.16 * mu ** 0.5) * (1 + cloudContrast * dwarfClouds(dx, dy, mu, cloudSeed)) - 0.6) / 0.75)) * (DWARF_SHADES - 1))]!
          : rgb
        for (let channel = 0; channel < 3; channel++) {
          const luminousColor = color[channel]! + (255 - color[channel]!) * shine
          image.data[offset + channel] = Math.min(255, luminousColor * brightness + dither)
        }
      }
      const limbPixels = (1 - Math.sqrt(distanceSquared)) * Math.min(radius, polarRadius)
      if (body.kind === 'jupiter') {
        // Feather only the last display pixel. The opaque interior keeps all
        // photographic detail while this fringe reveals the soft optical copy.
        const coverage = Math.min(1, limbPixels / 0.9)
        image.data[offset + 3] = Math.round(coverage * coverage * (3 - 2 * coverage) * 255)
      } else {
        image.data[offset + 3] = Math.round(Math.min(1, limbPixels * resolution) * 255)
      }
    }
  }
  const surface = document.createElement('canvas')
  surface.width = image.width
  surface.height = image.height
  surface.getContext('2d')!.putImageData(image, 0, 0)
  if (body.kind === 'jupiter' && radius >= 2) {
    // A faint optical spread softens the silhouette. The sharp opaque disk
    // drawn next covers this copy everywhere except its feathered limb.
    context.save()
    context.filter = `blur(${0.65 * resolution}px)`
    context.globalAlpha = 0.45
    context.drawImage(surface, paneX, 0, WIDTH / 2, HEIGHT)
    context.restore()
  }
  context.drawImage(surface, paneX, 0, WIDTH / 2, HEIGHT)
  if (hasOutline(body, kmPerPixel)) {
    // A chart mark like the locator below, not light: it keeps the measured size readable.
    context.save()
    context.globalAlpha = 0.32 * Math.min(1, (OUTLINE_BELOW_KELVIN - kelvin!) / 300)
    context.strokeStyle = '#747c8a'
    context.lineWidth = 0.5
    context.beginPath()
    context.ellipse(x, y, radius, polarRadius, 0, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }
  if (body.kind === 'star' && !cropped && radius >= 3) {
    // Restrained optical flare: fine rays and a luminous central sheen retain
    // the disk's temperature color and do not alter its physical edge.
    context.save()
    context.globalCompositeOperation = 'screen'
    context.translate(x, y)
    for (const angle of [0.13, Math.PI / 2 + 0.13]) {
      context.save()
      context.rotate(angle)
      const length = radius + Math.min(14, radius * 0.3)
      const ray = context.createLinearGradient(-length, 0, length, 0)
      ray.addColorStop(0, '#ffffff00')
      ray.addColorStop(0.45, '#ffffff14')
      ray.addColorStop(0.5, '#ffffff45')
      ray.addColorStop(0.55, '#ffffff14')
      ray.addColorStop(1, '#ffffff00')
      context.fillStyle = ray
      context.fillRect(-length, -0.35, length * 2, 0.7)
      context.restore()
    }
    const sheen = context.createRadialGradient(0, 0, 0, 0, 0, radius * 0.7)
    sheen.addColorStop(0, '#ffffff75')
    sheen.addColorStop(0.4, '#ffffff2a')
    sheen.addColorStop(1, '#ffffff00')
    context.fillStyle = sheen
    context.fillRect(-radius, -radius, radius * 2, radius * 2)
    context.restore()
  }
  // Tiny bodies are drawn analytically so subpixel disks retain their true size
  // even if no raster sample falls inside them. The locator is not a size marker.
  if (radius < 2) {
    context.fillStyle = body.color
    context.beginPath()
    context.ellipse(x, y, radius, polarRadius, 0, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = '#747c8a'
    context.lineWidth = 0.5
    context.beginPath()
    context.moveTo(x, y + Math.max(polarRadius + 3, 6))
    context.lineTo(x, 157)
    context.stroke()
  }
  context.restore()
}
