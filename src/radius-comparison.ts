import { starDisplayColor } from './astronomy'
import { isBubbleObject, isCompactObject, isMolecularCloudObject, isNebulaObject, type Star } from './catalog-model'
import jupiterMapUrl from './assets/radius-comparison/jupiter-map.png?url'
import earthMapUrl from './assets/radius-comparison/earth-map.png?url'
import earthCloudsUrl from './assets/radius-comparison/earth-clouds.jpg?url'

// IAU 2015 Resolution B3: https://arxiv.org/abs/1510.07674
export const SOLAR_RADIUS_KM = 695_700
export const JUPITER_RADIUS_KM = 71_492
const JUPITER_POLAR_RADIUS_KM = 66_854
export const EARTH_RADIUS_KM = 6_378.1
const EARTH_POLAR_RADIUS_KM = 6_356.8
export type RadiusReference = 'auto' | 'origin' | 'jupiter' | 'earth'

export interface RadiusBody {
  name: string
  radiusKm: number | null
  polarRadiusKm: number | null
  color: string
  kind: 'star' | 'dwarf' | 'jupiter' | 'earth'
}

export interface RadiusComparison {
  selected: RadiusBody
  reference: RadiusBody
  jupiterBenchmark: boolean
  referenceMode: Exclude<RadiusReference, 'auto'>
}

function stellarBody(star: Star): RadiusBody {
  const radius = star.radius_solar
  const available = !isCompactObject(star) && !isNebulaObject(star) && !isMolecularCloudObject(star) && !isBubbleObject(star)
    && radius !== null && Number.isFinite(radius) && radius > 0
  const radiusKm = available ? radius * SOLAR_RADIUS_KM : null
  return {
    name: star.name, radiusKm, polarRadiusKm: radiusKm,
    color: `#${starDisplayColor(star, 'real').getHexString()}`,
    kind: star.type === 'brown_dwarf' || star.type === 'sub_brown_dwarf' ? 'dwarf' : 'star',
  }
}

const jupiter: RadiusBody = {
  name: 'Jupiter', radiusKm: JUPITER_RADIUS_KM, polarRadiusKm: JUPITER_POLAR_RADIUS_KM,
  color: '#c7b49b', kind: 'jupiter',
}
const earth: RadiusBody = {
  name: 'Earth', radiusKm: EARTH_RADIUS_KM, polarRadiusKm: EARTH_POLAR_RADIUS_KM,
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

export function radiusStats(comparison: RadiusComparison): { label: string; values: { value: string }[] }[] {
  return [
    { label: 'Radius', measure: (body: RadiusBody) => body.radiusKm, unit: 'km' },
    { label: 'Diameter', measure: (body: RadiusBody) => body.radiusKm === null ? null : body.radiusKm * 2, unit: 'km' },
    { label: 'Surface area', measure: surfaceArea, unit: 'km²' },
    { label: 'Volume', measure: volume, unit: 'km³' },
  ].map(({ label, measure, unit }) => ({
    label,
    values: [comparison.selected, comparison.reference].map((body) => {
      const value = measure(body)
      const formatted = value === null ? null : label === 'Surface area' || label === 'Volume'
        ? value.toExponential(3).replace('e+', 'e') : dimensionNumber(value)
      return {
        value: formatted === null ? 'Not available' : `${formatted} ${unit}`,
      }
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

const renderedComparisons = new WeakMap<HTMLCanvasElement, string>()
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
    image.onload = () => {
      const surface = document.createElement('canvas')
      surface.width = image.naturalWidth
      surface.height = image.naturalHeight
      const context = surface.getContext('2d')!
      context.drawImage(image, 0, 0)
      entry.pixels = context.getImageData(0, 0, surface.width, surface.height)
      entry.settled = true
      resolve()
    }
    image.onerror = () => { entry.settled = true; resolve() }
    image.src = kind === 'jupiter' ? jupiterMapUrl : kind === 'earth' ? earthMapUrl : earthCloudsUrl
  })
  planetTextures.set(kind, entry)
  return entry
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
    : `Both objects use the same linear scale.${cropped ? ` The larger object extends beyond the frame; its ${selected.radiusKm! >= reference.radiusKm! ? 'upper-right' : 'upper-left'} limb is shown.` : ''}${unresolved ? ' The smaller disk is below one display pixel; a guide marks its location without enlarging it.' : ''} Glow is outside the measured radius.`
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
    const halo = context.createRadialGradient(x, y, radius - innerWidth, x, y, radius + haloWidth)
    halo.addColorStop(0, `${body.color}${cropped ? 'b0' : '90'}`)
    halo.addColorStop(0.28, `${body.color}${cropped ? '80' : '60'}`)
    halo.addColorStop(0.58, `${body.color}${cropped ? '30' : '20'}`)
    halo.addColorStop(1, `${body.color}00`)
    context.fillStyle = halo
    context.fillRect(paneX, 0, WIDTH / 2, HEIGHT)
    context.fillStyle = body.color
    context.beginPath()
    context.ellipse(x, y, radius, polarRadius, 0, 0, Math.PI * 2)
    context.fill()
  }

  // Rasterize only the visible pane, including for spheres many frame-widths
  // across. Smooth limb shading retains a crisp, measurable physical edge.
  const resolution = 3
  const image = context.createImageData(WIDTH / 2 * resolution, HEIGHT * resolution)
  const rgb = [1, 3, 5].map((offset) => parseInt(body.color.slice(offset, offset + 2), 16))
  const texture = body.kind === 'jupiter' || body.kind === 'earth' ? planetTextures.get(body.kind)?.pixels : undefined
  const clouds = body.kind === 'earth' ? planetTextures.get('earth-clouds')?.pixels : undefined
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
        const brightness = (stellar ? 0.72 + 0.28 * mu ** 0.55 : 0.48 + 0.52 * mu ** 0.6)
          * (1 + granulation * 0.004)
        const shine = stellar ? (body.kind === 'dwarf' ? 0.08 : 0.68) * mu ** 2.4 : 0
        for (let channel = 0; channel < 3; channel++) {
          const luminousColor = rgb[channel]! + (255 - rgb[channel]!) * shine
          image.data[offset + channel] = Math.min(255, luminousColor * brightness)
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
  if (stellar && !cropped && radius >= 3) {
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
    sheen.addColorStop(0, body.kind === 'dwarf' ? '#ffffff24' : '#ffffff75')
    sheen.addColorStop(0.4, body.kind === 'dwarf' ? '#ffffff0a' : '#ffffff2a')
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
