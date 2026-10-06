import { Color } from 'three'
import { starDisplayColor, type StarColorMode } from './astronomy'
import { isBubbleObject, isCompactObject, isMolecularCloudObject, isNebulaObject, type Star } from './catalog-model'

const renderedPreviews = new WeakMap<HTMLCanvasElement, string>()

function translucent(color: string, opacity: number): string {
  return `${color}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`
}

export function renderSelectedStarPreview(canvas: HTMLCanvasElement, star: Star, mode: StarColorMode, members: readonly Star[] = [star]): void {
  const key = members.map((member) => `${member.id}:${member.type}:${starDisplayColor(member, mode).getHexString()}:${member.radius_solar}:${member.luminosity_solar}`).join('|')
  if (renderedPreviews.get(canvas) === key) return
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = canvas.height = 168
  context.scale(3, 3)
  context.translate(28, 28)

  if (members.length === 1) {
    drawStarPreview(context, star, mode)
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
  renderedPreviews.set(canvas, key)
}

function drawStarPreview(context: CanvasRenderingContext2D, star: Star, mode: StarColorMode): void {
  const displayColor = starDisplayColor(star, mode)
  const color = `#${displayColor.getHexString()}`

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
