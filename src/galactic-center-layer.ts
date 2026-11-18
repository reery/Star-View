import {
  BufferGeometry, Color, CustomBlending, Float32BufferAttribute, Group, LineSegments, Mesh, OneFactor, OneMinusSrcAlphaFactor,
  PlaneGeometry, Points, ShaderMaterial, Vector3, type Camera,
} from 'three'
import { ICRS_TO_GALACTIC_ROWS } from './catalog-model'
import type { StellarOrbit } from './stellar-orbits'

/** Sagittarius A* and the system whose star orbits the layer draws. */
export const GALACTIC_CENTER_ID = 'sgr-a-star'
export const GALACTIC_CENTER_SYSTEM_ID = 'sgr-a-star-system'

const AU_PER_PC = 206264.806
const ORBIT_SEGMENTS = 192
// The orbits appear as the camera closes in on the black hole, and are fully drawn within a fifth of a parsec.
const ORBIT_FADE_PC = [0.2, 1.5] as const

export function decimalYear(date: Date): number {
  const year = date.getUTCFullYear()
  const start = Date.UTC(year, 0, 1)
  return year + (date.getTime() - start) / (Date.UTC(year + 1, 0, 1) - start)
}

/** Unit vectors toward north, east and away from the Sun at a sky position, in the world frame. */
export function skyBasis(raDeg: number, decDeg: number): { north: Vector3; east: Vector3; away: Vector3 } {
  const ra = raDeg * Math.PI / 180, dec = decDeg * Math.PI / 180
  const world = (x: number, y: number, z: number) => {
    const [gx, gy, gz] = ICRS_TO_GALACTIC_ROWS.map((row) => row[0] * x + row[1] * y + row[2] * z) as [number, number, number]
    // Galactic (x, y, z) maps to the world as (x, z, −y), as in galacticToWorld.
    return new Vector3(gx, gz, -gy)
  }
  return {
    north: world(-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)),
    east: world(-Math.sin(ra), Math.cos(ra), 0),
    away: world(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)),
  }
}

function eccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  let anomaly = eccentricity < 0.8 ? meanAnomaly : Math.PI
  for (let step = 0; step < 30; step++) {
    const delta = (anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(anomaly))
    anomaly -= delta
    if (Math.abs(delta) < 1e-12) break
  }
  return anomaly
}

/**
 * The secondary's offset from the black hole in parsecs, for a complete published orbit (argument of the secondary,
 * node east of north, ascending node receding). Thiele–Innes constants turn the orbital plane into north, east and depth.
 */
export function orbitPointPc(orbit: StellarOrbit, anomaly: number, basis: ReturnType<typeof skyBasis>, target: Vector3): Vector3 {
  const radians = Math.PI / 180
  const w = orbit.argumentDeg! * radians, node = orbit.nodeDeg! * radians, inclination = orbit.inclinationDeg! * radians
  const e = orbit.eccentricity!, axis = orbit.semiMajorAxisAu! / AU_PER_PC
  const x = axis * (Math.cos(anomaly) - e), y = axis * Math.sqrt(1 - e * e) * Math.sin(anomaly)
  const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(inclination), si = Math.sin(inclination)
  const north = (cw * cn - sw * sn * ci) * x + (-sw * cn - cw * sn * ci) * y
  const east = (cw * sn + sw * cn * ci) * x + (-sw * sn + cw * cn * ci) * y
  const away = sw * si * x + cw * si * y
  return target.copy(basis.north).multiplyScalar(north).addScaledVector(basis.east, east).addScaledVector(basis.away, away)
}

/** Where the star stands on its orbit in a decimal year, from Kepler's equation. */
export function orbitPositionPc(orbit: StellarOrbit, year: number, basis: ReturnType<typeof skyBasis>, target: Vector3): Vector3 {
  const phase = ((year - orbit.periastronEpoch!) / orbit.periodYears) % 1
  return orbitPointPc(orbit, eccentricAnomaly(2 * Math.PI * phase, orbit.eccentricity!), basis, target)
}

export function completeOrbit(orbit: StellarOrbit): boolean {
  return [orbit.semiMajorAxisAu, orbit.eccentricity, orbit.inclinationDeg, orbit.nodeDeg, orbit.argumentDeg, orbit.periastronEpoch].every((value) => value !== null)
    && orbit.epochKind === 'Decimal year'
}

const smooth = (value: number, [start, end]: readonly [number, number]) => {
  const t = Math.min(1, Math.max(0, (Math.log(value) - Math.log(end)) / (Math.log(start) - Math.log(end))))
  return t * t * (3 - 2 * t)
}

// A billboard in device pixels: the shadow, a thin photon ring and the glowing flow around it, brighter on its approaching
// side. The shadow covers what lies behind it; the glow adds light (premultiplied alpha). Static, like every map object.
const blackHoleVertex = /* glsl */ `
uniform float radiusPx;
uniform vec2 viewport;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 center = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  gl_Position = center + vec4(position.xy * 2.0 * radiusPx / viewport * center.w, 0.0, 0.0);
}`
const blackHoleFragment = /* glsl */ `
uniform float opacity;
uniform float brightAngle;
varying vec2 vUv;
vec3 glow(float level) {
  // A warm ramp from deep red through orange to white, like the Event Horizon Telescope's rendering.
  return clamp(vec3(level * 1.7, level * 1.45 - 0.3, level * 1.6 - 1.05), 0.0, 1.0);
}
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float angle = atan(vUv.y, vUv.x);
  float side = 0.5 + 0.5 * cos(angle - brightAngle);
  float doppler = 0.3 + 0.7 * side * side;
  float knots = 0.8 + 0.13 * cos(3.0 * angle + 0.9) + 0.07 * cos(7.0 * angle - 1.7);
  float photonRing = exp(-pow((r - 0.30) / 0.016, 2.0)) * (0.55 + 0.45 * side);
  float flow = exp(-pow((r - 0.36) / 0.11, 2.0)) * doppler * knots;
  float haze = exp(-max(r - 0.3, 0.0) / 0.2) * 0.42 * (0.55 + 0.45 * side) * smoothstep(1.0, 0.55, r);
  float shadow = 1.0 - smoothstep(0.255, 0.29, r);
  float level = (0.85 * photonRing + 1.1 * flow + haze) * (1.0 - 0.95 * shadow) + 0.02 * shadow;
  gl_FragColor = vec4(glow(level) * min(level, 1.0) * opacity, shadow * opacity);
}`

const orbitVertex = /* glsl */ `
attribute float orbitIndex;
uniform float selectedIndex;
varying float vSelected;
void main() {
  vSelected = abs(orbitIndex - selectedIndex) < 0.5 ? 1.0 : 0.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const orbitFragment = /* glsl */ `
uniform float opacity;
varying float vSelected;
void main() {
  vec3 color = mix(vec3(0.55, 0.66, 0.9), vec3(1.0, 0.86, 0.62), vSelected);
  gl_FragColor = vec4(color * opacity * mix(0.32, 0.85, vSelected), 0.0);
}`

const starVertex = /* glsl */ `
attribute vec3 starColor;
attribute float selected;
uniform float pixelRatio;
varying vec3 vColor;
varying float vSelected;
void main() {
  vColor = starColor;
  vSelected = selected;
  gl_PointSize = (selected > 0.5 ? 15.0 : 10.0) * pixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const starFragment = /* glsl */ `
uniform float opacity;
varying vec3 vColor;
varying float vSelected;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.32, 0.18, r);
  float halo = exp(-r * r * 6.0) * 0.55;
  vec3 color = mix(vColor, vec3(1.0), core * 0.7) * (core + halo);
  gl_FragColor = vec4(color * opacity, 0.0);
}`

const premultiplied = { transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor } as const

export interface GalacticCenterLayer {
  /** Placed at the black hole's map position, so its contents stay precise however far the Galactic Center is. */
  group: Group
  /** Complete published orbits of the loaded stars, with each star's map color. */
  setOrbits(orbits: readonly StellarOrbit[], colors: ReadonlyMap<string, Color>): void
  setColors(colors: ReadonlyMap<string, Color>): void
  /** Moves the stars to their places on a decimal year. */
  setYear(year: number): void
  /** A star's offset from the black hole, in parsecs, for the year last set. */
  offset(starId: string): Vector3 | undefined
  setVisible(blackHole: boolean, stars: ReadonlySet<string>): void
  setSelected(id: string | null): void
  /** Sizes the black hole and fades the orbits for the coming frame. */
  update(camera: Camera, width: number, height: number, pixelRatio: number): void
  dispose(): void
}

export function createGalacticCenterLayer(raDeg: number, decDeg: number): GalacticCenterLayer {
  const basis = skyBasis(raDeg, decDeg)
  const group = new Group()
  group.renderOrder = 4
  const blackHoleMaterial = new ShaderMaterial({
    vertexShader: blackHoleVertex, fragmentShader: blackHoleFragment, ...premultiplied,
    uniforms: { radiusPx: { value: 20 }, viewport: { value: [1, 1] }, opacity: { value: 1 }, brightAngle: { value: 0 } },
  })
  const blackHole = new Mesh(new PlaneGeometry(2, 2), blackHoleMaterial)
  blackHole.frustumCulled = false
  blackHole.renderOrder = 5
  const orbitMaterial = new ShaderMaterial({
    vertexShader: orbitVertex, fragmentShader: orbitFragment, ...premultiplied,
    uniforms: { opacity: { value: 0 }, selectedIndex: { value: -1 } },
  })
  const orbitLines = new LineSegments(new BufferGeometry(), orbitMaterial)
  orbitLines.frustumCulled = false
  const starMaterial = new ShaderMaterial({
    vertexShader: starVertex, fragmentShader: starFragment, ...premultiplied,
    uniforms: { opacity: { value: 0 }, pixelRatio: { value: 1 } },
  })
  const starPoints = new Points(new BufferGeometry(), starMaterial)
  starPoints.frustumCulled = false
  starPoints.renderOrder = 6
  group.add(orbitLines, starPoints, blackHole)

  let orbits: readonly StellarOrbit[] = []
  let shown = new Set<string>()
  let selectedId: string | null = null
  const offsets = new Map<string, Vector3>()
  const center = new Vector3(), side = new Vector3(), centerScreen = new Vector3()

  function starId(orbit: StellarOrbit): string {
    return orbit.secondaryIds[0]!
  }

  function rebuild(): void {
    const drawn = orbits.filter((orbit) => shown.has(starId(orbit)))
    const positions: number[] = [], indices: number[] = []
    const point = new Vector3(), previous = new Vector3()
    drawn.forEach((orbit, index) => {
      for (let step = 0; step <= ORBIT_SEGMENTS; step++) {
        orbitPointPc(orbit, step / ORBIT_SEGMENTS * Math.PI * 2, basis, point)
        if (step > 0) {
          positions.push(previous.x, previous.y, previous.z, point.x, point.y, point.z)
          indices.push(index, index)
        }
        previous.copy(point)
      }
    })
    orbitLines.geometry.dispose()
    orbitLines.geometry = new BufferGeometry()
    orbitLines.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    orbitLines.geometry.setAttribute('orbitIndex', new Float32BufferAttribute(indices, 1))
    orbitMaterial.uniforms.selectedIndex!.value = drawn.findIndex((orbit) => starId(orbit) === selectedId)
    const stars = new BufferGeometry()
    stars.setAttribute('position', new Float32BufferAttribute(drawn.flatMap((orbit) => offsets.get(starId(orbit))!.toArray()), 3))
    stars.setAttribute('starColor', new Float32BufferAttribute(drawn.flatMap((orbit) => (colors.get(starId(orbit)) ?? new Color(0xcfdcff)).toArray()), 3))
    stars.setAttribute('selected', new Float32BufferAttribute(drawn.map((orbit) => starId(orbit) === selectedId ? 1 : 0), 1))
    starPoints.geometry.dispose()
    starPoints.geometry = stars
  }

  /** A new date only moves the stars; the orbits stay as sampled. */
  function moveStars(): void {
    const positions = starPoints.geometry.getAttribute('position')
    if (!positions) return
    orbits.filter((orbit) => shown.has(starId(orbit))).forEach((orbit, index) => {
      const offset = offsets.get(starId(orbit))!
      positions.setXYZ(index, offset.x, offset.y, offset.z)
    })
    positions.needsUpdate = true
  }

  let colors: ReadonlyMap<string, Color> = new Map()
  let year = decimalYear(new Date())
  function setYear(next: number): void {
    year = next
    for (const orbit of orbits) {
      const id = starId(orbit)
      if (!offsets.has(id)) offsets.set(id, new Vector3())
      orbitPositionPc(orbit, year, basis, offsets.get(id)!)
    }
    moveStars()
  }
  return {
    group,
    setOrbits(next, nextColors) {
      orbits = next.filter(completeOrbit)
      colors = nextColors
      setYear(year)
      rebuild()
    },
    setYear,
    setColors(next) {
      colors = next
      rebuild()
    },
    offset: (id) => offsets.get(id),
    setVisible(visible, stars) {
      blackHole.visible = visible
      orbitLines.visible = starPoints.visible = visible && stars.size > 0
      if (stars.size !== shown.size || [...stars].some((id) => !shown.has(id))) {
        shown = new Set(stars)
        rebuild()
      }
    },
    setSelected(id) {
      if (id === selectedId) return
      selectedId = id
      rebuild()
    },
    update(camera, width, height, pixelRatio) {
      if (!blackHole.visible) return
      center.setFromMatrixPosition(group.matrixWorld)
      const distance = Math.max(1e-6, camera.position.distanceTo(center))
      // Not to scale, like every map symbol: about 90 px across up close, shrinking to a 14 px mark from afar.
      blackHoleMaterial.uniforms.radiusPx!.value = Math.min(44, Math.max(9, 24 * distance ** -0.22)) * pixelRatio
      blackHoleMaterial.uniforms.viewport!.value = [width * pixelRatio, height * pixelRatio]
      // The flow is brighter on the side that moves toward the camera: it circles the sky's east–west axis, so that side
      // lies across the line of sight from it, and turns as the camera orbits.
      side.subVectors(center, camera.position).cross(basis.east).normalize().multiplyScalar(distance * 0.01).add(center).project(camera)
      centerScreen.copy(center).project(camera)
      blackHoleMaterial.uniforms.brightAngle!.value = Math.atan2(side.y - centerScreen.y, (side.x - centerScreen.x) * width / height)
      const fade = smooth(distance, ORBIT_FADE_PC)
      orbitMaterial.uniforms.opacity!.value = fade
      starMaterial.uniforms.opacity!.value = fade
      starMaterial.uniforms.pixelRatio!.value = pixelRatio
    },
    dispose() {
      blackHole.geometry.dispose()
      blackHoleMaterial.dispose()
      orbitLines.geometry.dispose()
      orbitMaterial.dispose()
      starPoints.geometry.dispose()
      starMaterial.dispose()
    },
  }
}
