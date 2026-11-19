import { Color } from 'three'
import { starDisplayColor, type StarColorMode } from './astronomy'
import { isBubbleObject, isCompactObject, isGalaxyObject, isMolecularCloudObject, isNebulaObject, isStarClusterObject, type Star } from './catalog-model'

const renderedPreviews = new WeakMap<HTMLCanvasElement, string>()

function translucent(color: string, opacity: number): string {
  return `${color}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`
}

/** Soft radial glow fading from `opacity` at its center to nothing at `radius`. */
function blob(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string, opacity: number): void {
  const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, translucent(fill, opacity))
  gradient.addColorStop(1, translucent(fill, 0))
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

export function renderSelectedStarPreview(canvas: HTMLCanvasElement, star: Star, mode: StarColorMode, members: readonly Star[] = [star], hasKnownPlanets = false): void {
  const key = `${hasKnownPlanets}:` + members.map((member) => `${member.id}:${member.type}:${starDisplayColor(member, mode).getHexString()}:${member.radius_solar}:${member.luminosity_solar}`).join('|')
  if (renderedPreviews.get(canvas) === key) return
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = canvas.height = 168
  context.scale(3, 3)
  context.translate(28, 28)

  if (hasKnownPlanets) {
    context.save()
    context.rotate(-Math.PI / 6)
    context.strokeStyle = '#b29d8799'
    context.lineWidth = 0.8
    context.beginPath()
    context.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2)
    context.stroke()
    context.restore()
  }

  if (members.length === 1) {
    context.save()
    if (hasKnownPlanets) context.scale(0.72, 0.72)
    drawStarPreview(context, star, mode)
    context.restore()
  } else {
    // Illustrative arrangement, not binary orbital positions or separations.
    const placements: [number, number, number][] = members.length === 2 ? [[-11, -8, 0.56], [11, 9, 0.5]]
      : members.length === 3 ? [[-12, -9, 0.5], [12, -4, 0.46], [0, 15, 0.36]]
      : members.map<[number, number, number]>((_, index) => {
        const columns = Math.ceil(Math.sqrt(members.length))
        const rows = Math.ceil(members.length / columns)
        return [(index % columns + 0.5) * 48 / columns - 24,
          (Math.floor(index / columns) + 0.5) * 48 / rows - 24, 0.88 / columns]
      })
    members.forEach((member, index) => {
      const [x, y, scale] = placements[index]!
      context.save()
      context.translate(x, y)
      context.scale(scale, scale)
      drawStarPreview(context, member, mode)
      context.restore()
    })
  }
  if (hasKnownPlanets) {
    context.save()
    context.rotate(-Math.PI / 6)
    context.fillStyle = '#edc69b'
    context.strokeStyle = '#202224'
    context.lineWidth = 1
    context.beginPath()
    context.arc(24 * Math.cos(0.4), 15 * Math.sin(0.4), 2.6, 0, Math.PI * 2)
    context.fill()
    context.stroke()
    context.restore()
  }
  renderedPreviews.set(canvas, key)
}

/** Illustrative tilted two-armed spiral in the galaxy's display color around a warm central bulge. */
function drawGalaxyPreview(context: CanvasRenderingContext2D, displayColor: Color): void {
  const color = `#${displayColor.getHexString()}`
  const paleColor = `#${displayColor.clone().lerp(new Color(0xffffff), 0.65).getHexString()}`
  const bulgeColor = `#${displayColor.clone().lerp(new Color(0xffe4b8), 0.7).getHexString()}`

  context.save()
  context.rotate(-0.5)
  context.scale(1, 0.64)
  blob(context, 0, 0, 27, color, 0.42)
  context.globalCompositeOperation = 'lighter'
  // Logarithmic arms widening and fading outward, with brighter knots along them.
  const steps = 80, turn = 4.6, growth = Math.log(10) / turn
  for (const phase of [0, Math.PI]) {
    for (let step = 0; step < steps; step++) {
      const progress = step / (steps - 1)
      const angle = phase + progress * turn
      const radius = 2.5 * Math.exp(growth * progress * turn)
      const x = radius * Math.cos(angle), y = radius * Math.sin(angle)
      blob(context, x, y, 2.6 + 3.4 * progress, color, 0.2 * (1 - progress) ** 0.6)
      if (step % 11 === 6) blob(context, x, y, 1.6 + 0.8 * progress, paleColor, 0.35 * (1 - 0.5 * progress))
    }
  }
  context.restore()

  context.save()
  context.globalCompositeOperation = 'lighter'
  context.rotate(-0.5)
  context.scale(1, 0.8)
  blob(context, 0, 0, 10, bulgeColor, 0.8)
  blob(context, 0, 0, 3.5, '#ffffff', 0.9)
  context.restore()
}

/** Thin four-pointed diffraction spikes, as telescopes show around the brightest stars of a dense young cluster. */
function spikes(context: CanvasRenderingContext2D, x: number, y: number, length: number, fill: string): void {
  for (const angle of [0, Math.PI / 2]) {
    context.save()
    context.translate(x, y)
    context.rotate(angle + 0.12)
    const gradient = context.createLinearGradient(-length, 0, length, 0)
    gradient.addColorStop(0, translucent(fill, 0))
    gradient.addColorStop(0.5, translucent(fill, 0.85))
    gradient.addColorStop(1, translucent(fill, 0))
    context.fillStyle = gradient
    context.fillRect(-length, -0.3, length * 2, 0.6)
    context.restore()
  }
}

/**
 * Illustrative super star cluster: a few blazing stars with diffraction spikes over a compact, crowded core that thins
 * quickly into a sparse halo, in the cluster's display color.
 */
function drawSuperClusterPreview(context: CanvasRenderingContext2D, displayColor: Color): void {
  const color = `#${displayColor.getHexString()}`
  const paleColor = `#${displayColor.clone().lerp(new Color(0xffffff), 0.7).getHexString()}`
  blob(context, 0, 0, 25, color, 0.3)
  context.save()
  context.globalCompositeOperation = 'lighter'
  blob(context, 0, 0, 10, paleColor, 0.8)
  blob(context, 0, 0, 4, '#ffffff', 0.9)
  // Fixed golden-angle scatter with hashed radii, steeply concentrated toward the core.
  const count = 110
  for (let index = 0; index < count; index++) {
    const spread = Math.abs(Math.sin(index * 12.9898) * 43758.5453 % 1)
    const progress = (index + 0.5) / count
    const radius = 24 * progress ** 2 * (0.7 + 0.3 * spread)
    const angle = index * 2.39996
    const x = radius * Math.cos(angle), y = radius * Math.sin(angle)
    const size = 0.7 + 1.1 * spread
    blob(context, x, y, size, index % 3 ? paleColor : color, 0.95 - 0.35 * radius / 24)
    blob(context, x, y, size * 0.4, '#ffffff', 0.8)
  }
  for (const [x, y, length] of [[-5, -3, 13], [6, 4, 11], [2, -9, 8], [-11, 9, 7], [14, -12, 6]] as const) {
    blob(context, x, y, 2.6, paleColor, 0.95)
    blob(context, x, y, 1.2, '#ffffff', 1)
    spikes(context, x, y, length, paleColor)
  }
  context.restore()
}

/**
 * Illustrative star clusters in the cluster's display color: a loose swarm for an open cluster,
 * a dense ball crowding into a bright core for a globular cluster.
 */
function drawClusterPreview(context: CanvasRenderingContext2D, displayColor: Color, globular: boolean): void {
  const color = `#${displayColor.getHexString()}`
  const paleColor = `#${displayColor.clone().lerp(new Color(0xffffff), 0.7).getHexString()}`

  blob(context, 0, 0, globular ? 24 : 20, color, globular ? 0.45 : 0.28)
  context.save()
  context.globalCompositeOperation = 'lighter'
  if (globular) blob(context, 0, 0, 9, paleColor, 0.75)
  // Fixed golden-angle scatter with hashed radii, so every cluster of a kind shows the same arrangement.
  const count = globular ? 160 : 46
  for (let index = 0; index < count; index++) {
    const spread = Math.abs(Math.sin(index * 12.9898) * 43758.5453 % 1)
    const progress = (index + 0.5) / count
    const radius = globular ? 23 * progress ** 1.6 * (0.8 + 0.2 * spread) : 23 * progress ** 0.85 * (0.75 + 0.25 * spread)
    const angle = index * 2.39996
    const size = globular ? (index % 17 === 0 ? 2.2 : 0.8 + 0.8 * spread) : index % 9 === 0 ? 3.4 : 1.4 + 1.4 * spread
    const x = radius * Math.cos(angle), y = radius * Math.sin(angle)
    blob(context, x, y, size, index % 3 ? color : paleColor, 0.9 - 0.3 * radius / 23)
    blob(context, x, y, size * 0.35, '#ffffff', 0.75)
  }
  context.restore()
}

function drawStarPreview(context: CanvasRenderingContext2D, star: Star, mode: StarColorMode): void {
  const displayColor = starDisplayColor(star, mode)
  const color = `#${displayColor.getHexString()}`

  if (isGalaxyObject(star)) {
    drawGalaxyPreview(context, displayColor)
    return
  }

  if (star.type === 'super_star_cluster') {
    drawSuperClusterPreview(context, displayColor)
    return
  }

  if (isStarClusterObject(star)) {
    drawClusterPreview(context, displayColor, star.type === 'globular_cluster')
    return
  }

  if (isCompactObject(star) || isNebulaObject(star) || isMolecularCloudObject(star) || isBubbleObject(star)) {
    context.fillStyle = color
    context.shadowColor = color
    context.shadowBlur = 6
    context.beginPath()
    context.arc(0, 0, 5, 0, Math.PI * 2)
    context.fill()
    return
  }

  // Illustrative radius scale: Sun 24px, half-Sun ~22px, and supergiants
  // up to 56px. The largest bodies fill the preview with a tighter glow.
  const radius = star.radius_solar
  const diameter = radius !== null && Number.isFinite(radius) && radius > 0
    ? Math.max(16, Math.min(56, 24 * radius ** 0.14)) : 24
  const bodyFill = Math.max(0, Math.min(1, (diameter - 40) / 16))
  const luminosity = star.luminosity_solar
  const relativeLuminosity = luminosity !== null && Number.isFinite(luminosity) && luminosity > 0 ? luminosity : 1
  const emphasis = Math.max(0, Math.min(1, Math.log10(relativeLuminosity) / 5))
  const faintStrength = Math.min(1, relativeLuminosity ** 0.15)
  const paleColor = `#${displayColor.clone().lerp(new Color(0xffffff), 0.72).getHexString()}`
  // Make the inner light nearly white by ~1,000 solar luminosities,
  // retaining the temperature color in the outer body and bloom.
  const centerColor = `#${displayColor.clone().lerp(new Color(0xffffff), 0.72 + 0.27 * Math.min(1, emphasis * 5 / 3)).getHexString()}`
  const glare = 0.42 + 0.25 * faintStrength + 0.32 * emphasis
  const bloomRadius = Math.min(27, diameter * 0.65 + 8 + 5 * emphasis) * (1 - 0.16 * bodyFill)
  const bloomStrength = 1 - 0.45 * bodyFill

  const bloom = context.createRadialGradient(0, 0, 0, 0, 0, bloomRadius)
  bloom.addColorStop(0, translucent(paleColor, 0.65 * bloomStrength))
  bloom.addColorStop(0.18, translucent(color, (0.3 + 0.3 * emphasis) * bloomStrength))
  bloom.addColorStop(0.42, translucent(color, (0.12 + 0.2 * emphasis) * bloomStrength))
  bloom.addColorStop(0.7, translucent(color, (0.025 + 0.06 * emphasis) * bloomStrength))
  bloom.addColorStop(1, translucent(color, 0))
  context.fillStyle = bloom
  context.fillRect(-28, -28, 56, 56)

  const body = context.createRadialGradient(0, 0, 0, 0, 0, diameter / 2)
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.16 + 0.14 * emphasis + 0.08 * bodyFill, centerColor)
  body.addColorStop(0.38 + 0.05 * emphasis + 0.2 * bodyFill, translucent(color, 0.85))
  body.addColorStop(0.68 + 0.15 * bodyFill, translucent(color, 0.3 + 0.18 * bodyFill))
  body.addColorStop(1, translucent(color, 0))
  context.fillStyle = body
  context.fillRect(-diameter / 2, -diameter / 2, diameter, diameter)

  // Add the rays over the body so enlarging the star cannot bury its glare.
  context.globalCompositeOperation = 'lighter'

  // Curved, tapered rays with a fine bright spine, rather than a uniform cross.
  const ray = (angle: number, length: number, width: number, strength: number) => {
    context.save()
    context.rotate(angle)
    const gradient = context.createLinearGradient(-length, 0, length, 0)
    gradient.addColorStop(0, translucent(color, 0))
    gradient.addColorStop(0.22, translucent(paleColor, strength * 0.28))
    gradient.addColorStop(0.42, translucent(paleColor, strength * 0.75))
    gradient.addColorStop(0.5, translucent('#ffffff', strength))
    gradient.addColorStop(0.58, translucent(paleColor, strength * 0.75))
    gradient.addColorStop(0.78, translucent(paleColor, strength * 0.28))
    gradient.addColorStop(1, translucent(color, 0))
    context.fillStyle = gradient
    context.beginPath()
    context.moveTo(-length, 0)
    context.quadraticCurveTo(-length * 0.28, -width * 0.24, 0, -width)
    context.quadraticCurveTo(length * 0.28, -width * 0.24, length, 0)
    context.quadraticCurveTo(length * 0.28, width * 0.24, 0, width)
    context.quadraticCurveTo(-length * 0.28, width * 0.24, -length, 0)
    context.fill()
    context.restore()
  }
  for (const [angle, scale, strength] of [
    [0.08, 0.9, 0.85], [Math.PI / 2 + 0.08, 1, 1],
    [Math.PI / 4 + 0.08, 0.9, 0.65], [-Math.PI / 4 + 0.08, 0.82, 0.55],
  ] as const) {
    const length = Math.min(27, diameter / 2 + 12 + 3 * emphasis) * scale
    ray(angle, length, 1.8 + emphasis, glare * strength * 0.12)
    ray(angle, length, 0.5 + 0.2 * emphasis, glare * strength * 0.66)
  }

  context.globalCompositeOperation = 'source-over'
  const coreRadius = 1.2 + diameter * 0.14 + 2.8 * emphasis + 2 * bodyFill
  const core = context.createRadialGradient(0, 0, 0, 0, 0, coreRadius)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.35 + 0.2 * emphasis, '#fffffff5')
  core.addColorStop(0.7, translucent(centerColor, 0.8 + 0.2 * emphasis))
  core.addColorStop(1, translucent(centerColor, 0))
  context.fillStyle = core
  context.fillRect(-coreRadius, -coreRadius, coreRadius * 2, coreRadius * 2)
}
