import {
  BufferGeometry, CanvasTexture, Color, ConeGeometry, ExtrudeGeometry, Float32BufferAttribute, Group, LatheGeometry,
  Matrix4, Mesh, MeshBasicMaterial, Points, PointsMaterial, Quaternion, Shape, SphereGeometry, SRGBColorSpace, Vector2, Vector3,
} from 'three'
import { Rocket } from 'lucide'
import { svgNode } from './spectral-chart'

/** Top speeds for Slow, Medium and Fast, in light-years per second; still to be settled in live tests. */
export const SPACESHIP_SPEEDS_LY_PER_S = [0.5, 5, 50] as const
export const SPACESHIP_LABELS = ['none', 'selected', 'all'] as const
export type SpaceshipLabels = typeof SPACESHIP_LABELS[number]
/** Keys by event code, so the layout stays WASD on every keyboard. */
export const SPACESHIP_KEYS = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e' } as const
export type SpaceshipKey = typeof SPACESHIP_KEYS[keyof typeof SPACESHIP_KEYS]
/** Turn rate for Q and E. */
const YAW_RADIANS_PER_S = Math.PI / 3
/** Time constant of thrust and turn changes, for gentle starts and stops. */
const RESPONSE_S = 0.35
/** Length of the parked rocket model. */
export const SPACESHIP_LENGTH_PC = 0.025
/** On-screen rocket sprite size when far away; it grows until the model is this long, then the model takes over. */
const SPRITE_MIN_PX = 28
const SPRITE_HANDOFF_PX = 36

/** The ship flies with the camera while piloting and stays where it was left otherwise. Its forward is local -Z. */
export interface Spaceship {
  position: Vector3
  quaternion: Quaternion
  /** World velocity in parsecs per second. */
  velocity: Vector3
  yawRate: number
  travelledPc: number
  piloting: boolean
}

/** Each axis ranges from -1 to 1: forward, right and left turn. */
export interface SpaceshipInput {
  forward: number
  strafe: number
  yaw: number
  topSpeedPc: number
}

export interface SpaceshipTelemetry {
  speedPc: number
  travelledPc: number
  /** Null without a selection. */
  selectedDistancePc: number | null
  /** World direction toward the selection. */
  selectedDirection: Vector3 | null
  /** View orientation: the camera while piloting, the parked ship otherwise. */
  orientation: Quaternion
}

const lookMatrix = new Matrix4()
const worldUp = new Vector3(0, 1, 0)

/** A ship where the camera is, facing where it looks. */
export function createSpaceship(position: readonly [number, number, number], target: readonly [number, number, number]): Spaceship {
  const eye = new Vector3(...position)
  return {
    position: eye,
    quaternion: new Quaternion().setFromRotationMatrix(lookMatrix.lookAt(eye, new Vector3(...target), worldUp)),
    velocity: new Vector3(),
    yawRate: 0,
    travelledPc: 0,
    piloting: true,
  }
}

const desiredVelocity = new Vector3()

/** Advances the ship along its current orientation; returns the yaw to apply this step. */
export function stepSpaceship(ship: Spaceship, input: SpaceshipInput, seconds: number): number {
  const response = 1 - Math.exp(-seconds / RESPONSE_S)
  desiredVelocity.set(input.strafe, 0, -input.forward).applyQuaternion(ship.quaternion).multiplyScalar(input.topSpeedPc)
  ship.velocity.lerp(desiredVelocity, response)
  if (!input.forward && !input.strafe && ship.velocity.length() < input.topSpeedPc * 1e-3) ship.velocity.set(0, 0, 0)
  ship.yawRate += (input.yaw * YAW_RADIANS_PER_S - ship.yawRate) * response
  if (!input.yaw && Math.abs(ship.yawRate) < 1e-3) ship.yawRate = 0
  ship.position.addScaledVector(ship.velocity, seconds)
  ship.travelledPc += ship.velocity.length() * seconds
  return ship.yawRate * seconds
}

export function spaceshipMoving(ship: Spaceship, input: SpaceshipInput): boolean {
  return Boolean(input.forward || input.strafe || input.yaw || ship.yawRate || ship.velocity.lengthSq())
}

/** Bakes a fixed key light into vertex colors, so the model needs no scene lights. */
function shaded(geometry: BufferGeometry, color: number): BufferGeometry {
  const normals = geometry.getAttribute('normal')
  const light = new Vector3(0.45, 0.75, 0.5).normalize()
  const base = new Color(color)
  const colors = new Float32Array(normals.count * 3)
  const normal = new Vector3()
  for (let index = 0; index < normals.count; index++) {
    normal.fromBufferAttribute(normals, index)
    const diffuse = Math.max(0, normal.dot(light))
    const rim = (1 - Math.abs(normal.z)) * 0.12
    const shade = 0.32 + 0.68 * diffuse + rim
    colors.set([base.r * shade, base.g * shade, base.b * shade], index * 3)
  }
  return geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
}

/** The rocket icon, glowing blue with an orange flame, for the far-away sprite. */
function rocketSpriteTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  // The 24-unit icon fills 96 px, leaving room for the glow.
  context.translate(16, 16)
  context.scale(4, 4)
  context.lineCap = context.lineJoin = 'round'
  context.lineWidth = 1.8
  context.shadowColor = '#4da3ff'
  context.shadowBlur = 14
  const [finBottom, flame, body, finLeft] = Rocket.map(([, attributes]) => new Path2D(String(attributes.d)))
  context.fillStyle = '#ffb35c'
  context.fill(flame!)
  context.fillStyle = '#3f86e0'
  for (const path of [finBottom!, finLeft!, body!]) context.fill(path)
  context.strokeStyle = '#d4ecff'
  for (const path of [finBottom!, flame!, body!, finLeft!]) context.stroke(path)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** A small blue rocket pointing along -Z; far away, a rocket sprite keeps it easy to find. */
export function createSpaceshipModel(): { group: Group; setScreenLength(lengthPx: number, pixelRatio: number): void; dispose(): void } {
  const group = new Group()
  const material = new MeshBasicMaterial({ vertexColors: true })
  // Lathe profile from tail to nose along +Y, turned to point along -Z.
  const body = new LatheGeometry([
    [0, -0.5], [0.1, -0.5], [0.135, -0.42], [0.15, -0.15], [0.145, 0.12], [0.12, 0.3], [0.075, 0.43], [0.025, 0.5], [0, 0.51],
  ].map(([x, y]) => new Vector2(x, y)), 32)
  const fin = new Shape([new Vector2(0.13, -0.48), new Vector2(0.32, -0.6), new Vector2(0.31, -0.42), new Vector2(0.14, -0.16)])
  const parts = [shaded(body, 0x6fa8e8)]
  for (let index = 0; index < 3; index++) {
    const geometry = new ExtrudeGeometry(fin, { depth: 0.024, bevelEnabled: false })
    geometry.translate(0, 0, -0.012)
    geometry.rotateY(index * Math.PI * 2 / 3)
    parts.push(shaded(geometry, 0x2f5fae))
  }
  const porthole = new SphereGeometry(0.05, 16, 12)
  porthole.scale(1, 1, 0.45)
  porthole.translate(0, 0.18, 0.135)
  parts.push(shaded(porthole, 0xd8f0ff))
  const nozzle = new ConeGeometry(0.09, 0.14, 24)
  nozzle.translate(0, -0.51, 0)
  parts.push(shaded(nozzle, 0x34465c))
  const model = new Group()
  for (const geometry of parts) model.add(new Mesh(geometry, material))
  model.rotation.x = -Math.PI / 2
  model.scale.setScalar(SPACESHIP_LENGTH_PC)
  const spriteGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  const spriteTexture = rocketSpriteTexture()
  const spriteMaterial = new PointsMaterial({
    size: SPRITE_MIN_PX, sizeAttenuation: false, map: spriteTexture, transparent: true, depthWrite: false, toneMapped: false,
  })
  const sprite = new Points(spriteGeometry, spriteMaterial)
  group.add(model, sprite)
  return {
    group,
    /** Shows the sprite while the model would be smaller than it, so the ship stays visible from any distance. */
    setScreenLength(lengthPx, pixelRatio) {
      sprite.visible = lengthPx < SPRITE_HANDOFF_PX
      model.visible = !sprite.visible
      // The icon fills three quarters of its texture.
      spriteMaterial.size = Math.max(SPRITE_MIN_PX, lengthPx) / 0.75 * pixelRatio
    },
    dispose() {
      parts.forEach((geometry) => geometry.dispose())
      material.dispose()
      spriteGeometry.dispose()
      spriteMaterial.dispose()
      spriteTexture.dispose()
    },
  }
}

// Galactic axes in map coordinates, labeled like the map grid: X toward the Galactic center, Z north.
const GIZMO_AXES = [
  { direction: new Vector3(1, 0, 0), label: 'X' },
  { direction: new Vector3(0, 0, -1), label: 'Y' },
  { direction: new Vector3(0, 1, 0), label: 'Z' },
] as const
const GIZMO_RADIUS = 40
const CIRCLE_STEPS = 64

/**
 * A navball: the sphere of directions around the ship, with the heading at its center. Directions ahead
 * lie on the solid front, those behind on the faint back, so steering the target ring to the center flies at it.
 */
export function createSpaceshipGizmo(container: Element): (orientation: Quaternion, target: Vector3 | null) => void {
  const svg = svgNode('svg', { viewBox: '-50 -50 100 100', class: 'spaceship-gizmo', role: 'img', 'aria-label': 'Ship orientation in galactic coordinates' })
  svg.append(svgNode('circle', { r: GIZMO_RADIUS, class: 'spaceship-gizmo-globe' }))
  // The Galactic plane and the meridian through the Galactic center and poles.
  const circles = [(angle: number) => new Vector3(Math.cos(angle), 0, Math.sin(angle)), (angle: number) => new Vector3(Math.cos(angle), Math.sin(angle), 0)]
    .map((point, index) => ({ point, back: svgNode('path', { class: `spaceship-gizmo-circle is-back${index ? '' : ' is-plane'}` }), front: svgNode('path', { class: `spaceship-gizmo-circle${index ? '' : ' is-plane'}` }) }))
  for (const circle of circles) svg.append(circle.back)
  const axes = GIZMO_AXES.map(({ label }, index) => {
    const line = svgNode('line', { x1: 0, y1: 0, class: `spaceship-gizmo-axis axis-${index}` })
    const text = svgNode('text', { class: `spaceship-gizmo-label axis-${index}`, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, label)
    return { line, text }
  })
  for (const circle of circles) svg.append(circle.front)
  for (const { line, text } of axes) svg.append(line, text)
  svg.append(svgNode('path', { d: 'M-5 0H-2M2 0H5M0 -5V-2M0 2V5', class: 'spaceship-gizmo-heading' }))
  const targetRing = svgNode('circle', { r: 4.5, class: 'spaceship-gizmo-target' })
  svg.append(targetRing)
  container.replaceChildren(svg)
  const inverse = new Quaternion()
  const view = new Vector3()
  // Screen position of a world direction; z < 0 lies ahead.
  const project = (direction: Vector3) => view.copy(direction).applyQuaternion(inverse)
  return (orientation, target) => {
    inverse.copy(orientation).invert()
    for (const circle of circles) {
      let front = '', back = '', previousAhead: boolean | null = null
      for (let step = 0; step <= CIRCLE_STEPS; step++) {
        const { x, y, z } = project(circle.point(step / CIRCLE_STEPS * Math.PI * 2))
        const ahead = z <= 0
        const command = ahead === previousAhead ? 'L' : 'M'
        const segment = `${command}${(x * GIZMO_RADIUS).toFixed(1)} ${(-y * GIZMO_RADIUS).toFixed(1)}`
        if (ahead) front += segment
        else back += segment
        previousAhead = ahead
      }
      circle.front.setAttribute('d', front)
      circle.back.setAttribute('d', back)
    }
    GIZMO_AXES.forEach(({ direction }, index) => {
      const { x, y, z } = project(direction)
      const { line, text } = axes[index]!
      line.setAttribute('x2', (x * GIZMO_RADIUS).toFixed(1))
      line.setAttribute('y2', (-y * GIZMO_RADIUS).toFixed(1))
      text.setAttribute('x', (x * (GIZMO_RADIUS + 6)).toFixed(1))
      text.setAttribute('y', (-y * (GIZMO_RADIUS + 6)).toFixed(1))
      line.classList.toggle('is-back', z > 0)
      text.classList.toggle('is-back', z > 0)
    })
    targetRing.toggleAttribute('hidden', !target)
    if (!target) return
    const { x, y, z } = project(target)
    targetRing.setAttribute('cx', (x * GIZMO_RADIUS).toFixed(1))
    targetRing.setAttribute('cy', (-y * GIZMO_RADIUS).toFixed(1))
    targetRing.classList.toggle('is-back', z > 0)
  }
}
