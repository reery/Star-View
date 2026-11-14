import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, Points, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3, Vector4, type Matrix4, type PerspectiveCamera, type PointsMaterial, type Texture } from 'three'
import moonMap from './assets/moons/moon-surface-map.jpg'
import planetarySystems from './data/planetary-systems.json'
import { displayMagnitude, haloGlowCanvas, type StarBrightness, type StarStyle } from './star-appearance'
import { earthShadowRadii, MOON_RADIUS_KM, solarSystemSky } from './solar-system-sky'
import { overlaps, type LabelRect } from './label-layout'
import { projectWorldPointInto, starApparentDiameter, starHaloDiameter, starHaloEmphasis, starHaloOpacity, STAR_DIAMETER_PX } from './viewer-primitives'

// Inside the nearest star but beyond the 0.01 pc near plane; the observer camera sits 1e-6 pc off the Sun,
// which shifts these points by about 2″. The Moon sits in front, so it covers the planets it passes.
const MOON_SKY_RADIUS_PC = 0.1
const PLANET_SKY_RADIUS_PC = 0.11
const PLANET_COUNT = 7
// Sunlit ground far outshines the night sky; earthshine from a full Earth keeps the unlit part of a crescent faintly visible.
const MOON_SUNLIGHT = 3
const MOON_EARTHSHINE = 0.012
// Sunlight bent through Earth's atmosphere into the umbra, as a share of full sunlight: a dim copper glow, about Danjon L2.
const MOON_UMBRA_LIGHT = '1.8e-4, 6.6e-5, 2.4e-5'
// In an eclipse the eye adapts to the Moon's brightest part, but only so far: a totally eclipsed Moon stays dim.
const MOON_MAX_ADAPTATION = 300
/** The share of the Sun seen from a point in Earth's penumbra, from 0 at the umbra's edge to 1 at its own. */
const SUNLIT_POWER = 1.5
// The Moon's glow: full at −12.7 mag, gone at −2 (about Jupiter); it reaches several Moon radii, and at
// least this far at low zoom, so the Moon stands out as the brightest body in the sky.
const MOON_GLOW_FULL_MAGNITUDE = -12.7
const MOON_GLOW_FAINT_MAGNITUDE = -2
const MOON_GLOW_MIN_WIDTH_PX = 16
const MOON_GLOW_SUNLIT = new Color(1, 0.95, 0.86)
const MOON_GLOW_UMBRA = new Color(0.9, 0.38, 0.16)
const MOON_GLOW_WIDTHS = 6
// Keeps the glow sprite within point sizes every GPU draws.
const MOON_GLOW_MAX_SIZE_PX = 500
// A name sits this far beside its planet, clear of the glow's bright center.
const LABEL_OFFSET_PX = 12
// The star shader's flag for a planet: lit like a star of its magnitude, without diffraction spikes.
const PLANET_CORE_SHAPE = -1
// Planets have a soft, round glow: their color shows rather than a star's white-hot center.
const PLANET_CORE_WHITE_STRENGTH = 0.5
const SOLAR_PLANETS = new Map(planetarySystems.systems.find(({ hostStarId }) => hostStarId === 'sun')!.planets.map((planet) => [planet.id, planet]))

export interface SolarSystemSkyLayer {
  group: Group
  /** Positions the bodies for a date and, standing on Earth, the zenith; sizes follow the star settings. */
  setSky(date: Date, zenith: Vector3 | null, brightness: StarBrightness, style: StarStyle): void
  /**
   * Sizes the Moon's disc and places the names before any star's, beside each body and clear of the others;
   * call each drawn frame while visible. Returns the bodies and names, for star names to keep clear of.
   */
  updateView(camera: PerspectiveCamera, viewProjection: Matrix4, viewport: DOMRect, renderHeight: number, pixelRatio: number): readonly LabelRect[]
  /** The body or name under a point in client pixels: a planet ID from the Solar System card, or moon. */
  pick(x: number, y: number, radius: number): string | null
  setVisible(visible: boolean): void
  dispose(): void
}

/**
 * The seven other major planets drawn with the map's own star materials, so their brightness matches
 * the stars' in either star style, but as round glows; and the Moon as a lit, textured disc at its true size.
 */
export function createSolarSystemSkyLayer(container: HTMLElement, starMaterial: PointsMaterial, haloMaterial: PointsMaterial, onTextureLoad: () => void): SolarSystemSkyLayer {
  const group = new Group()
  group.name = 'solar-system-sky'
  group.visible = false

  const attribute = (size: number, value = 0) => new Float32BufferAttribute(new Float32Array(PLANET_COUNT * size).fill(value), size)
  const positions = attribute(3)
  const colors = attribute(3)
  const selectionEmphases = attribute(1)
  const coreGeometry = new BufferGeometry()
    .setAttribute('position', positions).setAttribute('color', colors).setAttribute('selectionEmphasis', selectionEmphases)
    .setAttribute('coreDiameter', attribute(1)).setAttribute('starFlux', attribute(1)).setAttribute('coreEmphasis', attribute(1))
    .setAttribute('coreWhiteStrength', attribute(1, PLANET_CORE_WHITE_STRENGTH)).setAttribute('coreShape', attribute(1, PLANET_CORE_SHAPE))
  const haloGeometry = new BufferGeometry()
    .setAttribute('position', positions).setAttribute('color', colors).setAttribute('selectionEmphasis', selectionEmphases)
    .setAttribute('haloDiameter', attribute(1)).setAttribute('haloOpacity', attribute(1))
  // The illustrative halo without its spikes; the shader hook is not cloned, and the shared one keeps its uniforms.
  const glowTexture = new CanvasTexture(haloGlowCanvas())
  glowTexture.colorSpace = SRGBColorSpace
  const glowMaterial = haloMaterial.clone()
  glowMaterial.map = glowTexture
  glowMaterial.onBeforeCompile = haloMaterial.onBeforeCompile
  const cores = new Points(coreGeometry, starMaterial)
  const halos = new Points(haloGeometry, glowMaterial)
  // Just after the catalog's cores and halos, so the bright planets composite over the stars.
  cores.renderOrder = 2.1
  halos.renderOrder = 3.1

  let moonTexture: Texture | null = null
  const moonUniforms = {
    map: { value: null as Texture | null }, size: { value: 1 },
    right: { value: new Vector3() }, up: { value: new Vector3() }, toward: { value: new Vector3() },
    sun: { value: new Vector3() }, east: { value: new Vector3() }, north: { value: new Vector3() },
    // Earth's shadow: the Moon's center from Earth's (km), the shadow axis, and each cone's radius and widening per km.
    center: { value: new Vector3() }, shadowAxis: { value: new Vector3() }, umbra: { value: new Vector2() }, penumbra: { value: new Vector2() },
    exposure: { value: 1 }, earthshine: { value: 0 },
  }
  const moonMaterial = new ShaderMaterial({
    uniforms: moonUniforms,
    transparent: true, depthWrite: true, toneMapped: false,
    vertexShader: `
      uniform float size;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
      }
    `,
    // Each pixel of the sprite is a point on the near hemisphere: lit by the Sun, textured in the Moon's
    // own frame, whose 0° longitude faces Earth.
    fragmentShader: `
      uniform sampler2D map;
      uniform float size;
      uniform vec3 right, up, toward, sun, east, north, center, shadowAxis;
      uniform vec2 umbra, penumbra;
      uniform float exposure, earthshine;
      void main() {
        vec2 disc = (gl_PointCoord - 0.5) * vec2(2.0, -2.0);
        float radius = length(disc);
        if (radius > 1.0) discard;
        float emission = sqrt(1.0 - radius * radius);
        vec3 normal = disc.x * right + disc.y * up + emission * toward;
        vec3 body = vec3(dot(normal, east), dot(normal, north), emission);
        vec2 uv = vec2(0.5 + atan(body.x, body.z) / 6.2831853, 0.5 + asin(clamp(body.y, -1.0, 1.0)) / 3.1415927);
        vec3 albedo = texture2D(map, uv).rgb;
        // Lommel–Seeliger scattering suits the dusty lunar surface: a full Moon is evenly bright to its edge,
        // and a crescent's limb is its brightest part.
        float incidence = max(dot(normal, sun), 0.0);
        float scattering = 2.0 * incidence / (incidence + emission + 1e-4);
        // How much of the Sun this point sees past Earth: none in the umbra, rising across the penumbra.
        vec3 point = center + normal * ${MOON_RADIUS_KM.toFixed(1)};
        float along = dot(point, shadowAxis);
        float offset = length(point - along * shadowAxis);
        float umbraRadius = umbra.x + umbra.y * along;
        float sunlit = along < 0.0 ? 1.0 : pow(clamp((offset - umbraRadius) / (penumbra.x + penumbra.y * along - umbraRadius), 0.0, 1.0), ${SUNLIT_POWER.toFixed(1)});
        vec3 light = exposure * ${MOON_SUNLIGHT.toFixed(2)} * scattering * (sunlit + (1.0 - sunlit) * vec3(${MOON_UMBRA_LIGHT})) + earthshine;
        gl_FragColor = vec4(albedo * light, clamp((1.0 - radius) * size * 0.5, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
  })
  const moonGeometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  const moon = new Points(moonGeometry, moonMaterial)
  // Over the stars and planets: nothing in the sky lies in front of the Moon.
  moon.renderOrder = 3.2
  moon.visible = false
  const glowUniforms = {
    size: { value: 1 }, radius: { value: 1 }, width: { value: 1 }, strength: { value: 0 }, color: { value: new Color() },
    // The glare's center and core radius, from the lit part of the disc, and how much of it shows over the disc.
    offset: { value: new Vector2() }, core: { value: 1 }, overDisc: { value: 1 },
  }
  const moonGlow = new Points(moonGeometry, new ShaderMaterial({
    uniforms: glowUniforms,
    transparent: true, depthWrite: false, toneMapped: false, blending: AdditiveBlending,
    vertexShader: `
      uniform float size;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size;
      }
    `,
    // Glare forms in the eye, in front of everything: a bright inner aureole and a wide, faint halo around the
    // lit part of the disc. Lengths are in device pixels, with y up.
    fragmentShader: `
      uniform float size, radius, width, strength, core, overDisc;
      uniform vec3 color;
      uniform vec2 offset;
      void main() {
        vec2 point = (gl_PointCoord - 0.5) * vec2(size, -size);
        float beyond = max(length(point - offset) - core, 0.0);
        float glow = strength * (0.9 * exp(-2.0 * beyond / width) + 0.35 / (1.0 + beyond * beyond / (width * width)));
        // A resolved disc shows its own surface; an unresolved one drowns in its glare.
        glow *= mix(overDisc, 1.0, smoothstep(radius - 2.0, radius, length(point)));
        gl_FragColor = vec4(color, glow * (1.0 - smoothstep(0.6, 1.0, length(point) * 2.0 / size)));
        #include <colorspace_fragment>
      }
    `,
  }))
  moonGlow.renderOrder = 3.3
  // Where the Moon's light centers on its disc, along its east and north in Moon radii: lit by phase and shadow.
  const moonLightCenter = new Vector2()
  for (const points of [cores, halos, moon, moonGlow]) points.frustumCulled = false
  group.add(moon, moonGlow, cores, halos)

  const labelLayer = document.createElement('div')
  labelLayer.className = 'projected-axes solar-system-labels'
  labelLayer.setAttribute('aria-hidden', 'true')
  labelLayer.hidden = true
  container.append(labelLayer)
  // Planet slots run faintest first, as drawn; the Moon takes the last slot.
  const bodies = Array.from({ length: PLANET_COUNT + 1 }, () => {
    const anchor = document.createElement('div')
    anchor.className = 'map-anchor'
    const text = document.createElement('div')
    text.className = 'map-label star-label'
    anchor.append(text)
    labelLayer.append(anchor)
    const dot: LabelRect = { left: 0, right: 0, top: 0, bottom: 0 }
    return { id: '', anchor, text, position: new Vector3(), dot, name: null as LabelRect | null, width: 0, height: 0, x: 0, y: 0, visible: false }
  })
  const moonBody = bodies[PLANET_COUNT]!
  moonBody.id = 'moon'
  moonBody.text.textContent = 'Moon'
  const placed: LabelRect[] = []

  let moonRadius = 0
  let minMoonDiameterPx = 0
  const worldPoint = new Vector3()
  const clip = new Vector4()
  const projected = { x: 0, y: 0, depth: 0 }
  const color = new Color()

  return {
    group,
    setSky(date, zenith, brightness, style) {
      const sky = solarSystemSky(date, zenith)
      // Faintest first: realistic stars cover what they are drawn over.
      const planets = sky.planets.toSorted((first, second) => second.magnitude - first.magnitude)
      const attributes = coreGeometry.attributes
      planets.forEach((planet, index) => {
        const known = SOLAR_PLANETS.get(planet.id)!
        planet.direction.clone().multiplyScalar(PLANET_SKY_RADIUS_PC).toArray(positions.array, index * 3)
        color.set(known.color).toArray(colors.array, index * 3)
        // The same steps as catalog stars seen from the observer.
        const magnitude = displayMagnitude(planet.magnitude, { type: 'star' }, brightness)!
        const diameter = starApparentDiameter(magnitude)
        attributes.coreDiameter!.setX(index, diameter)
        attributes.starFlux!.setX(index, 10 ** (-0.4 * magnitude))
        attributes.coreEmphasis!.setX(index, starHaloEmphasis(magnitude))
        haloGeometry.attributes.haloDiameter!.setX(index, starHaloDiameter(magnitude) * Math.sqrt(diameter / STAR_DIAMETER_PX))
        haloGeometry.attributes.haloOpacity!.setX(index, starHaloOpacity(magnitude))
        const body = bodies[index]!
        if (body.id !== planet.id) {
          body.id = planet.id
          body.text.textContent = known.name
          body.width = 0
        }
        body.position.copy(planet.direction).multiplyScalar(PLANET_SKY_RADIUS_PC)
      })
      for (const geometry of [coreGeometry, haloGeometry]) for (const value of Object.values(geometry.attributes)) value.needsUpdate = true
      halos.visible = style === 'exaggerated'
      // Illustrative stars swell beyond their true size; the Moon keeps at least the largest star core.
      minMoonDiameterPx = style === 'exaggerated' ? starApparentDiameter(-Infinity) : 0

      moonBody.position.copy(sky.moon.direction).multiplyScalar(MOON_SKY_RADIUS_PC)
      moon.geometry.attributes.position!.setXYZ(0, moonBody.position.x, moonBody.position.y, moonBody.position.z)
      moon.geometry.attributes.position!.needsUpdate = true
      moonRadius = sky.moon.angularRadius
      const toward = moonUniforms.toward.value.copy(sky.moon.direction).negate()
      moonUniforms.sun.value.copy(sky.moon.sunDirection)
      moonUniforms.north.value.copy(sky.moon.north).addScaledVector(toward, -sky.moon.north.dot(toward)).normalize()
      moonUniforms.east.value.crossVectors(moonUniforms.north.value, toward)
      moonUniforms.center.value.copy(sky.moon.fromEarthKm)
      moonUniforms.shadowAxis.value.copy(sky.moon.shadowAxis)
      const atEarth = earthShadowRadii(0, sky.moon.sunDistanceKm)
      const perKm = earthShadowRadii(1, sky.moon.sunDistanceKm)
      moonUniforms.umbra.value.set(atEarth.umbra, perKm.umbra - atEarth.umbra)
      moonUniforms.penumbra.value.set(atEarth.penumbra, perKm.penumbra - atEarth.penumbra)
      // As in the shader: the share of the Sun a point on the Moon sees past Earth.
      const { fromEarthKm, shadowAxis, sunDistanceKm } = sky.moon
      const sunlit = (point: Vector3) => {
        const along = point.dot(shadowAxis)
        if (along < 0) return 1
        const shadow = earthShadowRadii(along, sunDistanceKm)
        const offset = worldPoint.copy(point).addScaledVector(shadowAxis, -along).length()
        return Math.min(1, Math.max(0, (offset - shadow.umbra) / (shadow.penumbra - shadow.umbra))) ** SUNLIT_POWER
      }
      // The eye adapts to the most sunlit point of the disc, the limb farthest from the shadow axis.
      const awayFromAxis = fromEarthKm.clone().addScaledVector(shadowAxis, -fromEarthKm.dot(shadowAxis)).normalize()
      const brightest = sunlit(fromEarthKm.clone().addScaledVector(awayFromAxis, MOON_RADIUS_KM))
      moonUniforms.exposure.value = Math.min(1 / Math.max(brightest, 1e-9), MOON_MAX_ADAPTATION)
      // The shadow's share of the Moon's light, averaged over the visible, scattering disc.
      let total = 0
      let shaded = 0
      let sunlight = 0
      moonLightCenter.set(0, 0)
      const normal = new Vector3()
      for (let x = -0.9; x < 1; x += 0.2) {
        for (let y = -0.9; y < 1; y += 0.2) {
          if (x * x + y * y > 1) continue
          const emission = Math.sqrt(1 - x * x - y * y)
          normal.copy(moonUniforms.east.value).multiplyScalar(x).addScaledVector(moonUniforms.north.value, y).addScaledVector(toward, emission)
          const incidence = Math.max(normal.dot(sky.moon.sunDirection), 0)
          const scattering = incidence / (incidence + emission)
          const lit = sunlit(normal.multiplyScalar(MOON_RADIUS_KM).add(fromEarthKm))
          total += scattering
          const light = scattering * (lit + (1 - lit) * 1e-4)
          shaded += light
          sunlight += scattering * lit
          moonLightCenter.x += light * x
          moonLightCenter.y += light * y
        }
      }
      if (shaded > 0) moonLightCenter.divideScalar(shaded)
      const magnitude = sky.moon.magnitude - 2.5 * Math.log10(total > 0 ? shaded / total : 1)
      // The square root keeps a crescent's glow strong; only a deeply eclipsed Moon fades much.
      glowUniforms.strength.value = Math.sqrt(Math.min(1, Math.max(0, (magnitude - MOON_GLOW_FAINT_MAGNITUDE) / (MOON_GLOW_FULL_MAGNITUDE - MOON_GLOW_FAINT_MAGNITUDE))))
      // Light from the umbra is copper, so the glow reddens as the shadow takes over.
      glowUniforms.color.value.lerpColors(MOON_GLOW_UMBRA, MOON_GLOW_SUNLIT, shaded > 0 ? sunlight / shaded : 1)
      // Earth seen from the Moon is full at new Moon and new at full Moon.
      moonUniforms.earthshine.value = MOON_EARTHSHINE * (1 - sky.moon.sunDirection.dot(toward)) / 2
      if (!moonTexture) {
        moonTexture = new TextureLoader().load(moonMap, () => {
          moon.visible = true
          onTextureLoad()
        })
        moonTexture.colorSpace = SRGBColorSpace
        moonUniforms.map.value = moonTexture
      }
    },
    updateView(camera, viewProjection, viewport, renderHeight, pixelRatio) {
      const pixelsPerRadian = camera.projectionMatrix.elements[5]! * renderHeight / 2
      const diameterPx = Math.max(2 * moonRadius * pixelsPerRadian, minMoonDiameterPx)
      moonUniforms.size.value = diameterPx * pixelRatio
      const toward = moonUniforms.toward.value
      const cameraUp = worldPoint.set(0, 1, 0).transformDirection(camera.matrixWorld)
      moonUniforms.right.value.crossVectors(cameraUp, toward).normalize()
      moonUniforms.up.value.crossVectors(toward, moonUniforms.right.value)
      // The glare centers on the Moon's light, turned from its own east and north onto the screen; the
      // farther the light sits off center, the thinner the lit part, so the tighter the glare's core.
      const glowRadius = diameterPx / 2 * pixelRatio
      const { east, north } = moonUniforms
      glowUniforms.offset.value.set(
        moonLightCenter.x * east.value.dot(moonUniforms.right.value) + moonLightCenter.y * north.value.dot(moonUniforms.right.value),
        moonLightCenter.x * east.value.dot(moonUniforms.up.value) + moonLightCenter.y * north.value.dot(moonUniforms.up.value),
      ).multiplyScalar(glowRadius)
      glowUniforms.core.value = glowRadius * Math.max(1 - moonLightCenter.length(), 0.3)
      glowUniforms.overDisc.value = Math.min(1, Math.max(0, 1 - (diameterPx / 2 - 4) / 12))
      const glowWidth = Math.min(Math.max(diameterPx / 2, MOON_GLOW_MIN_WIDTH_PX) * pixelRatio, (MOON_GLOW_MAX_SIZE_PX / 2 - 2 * glowRadius) / MOON_GLOW_WIDTHS)
      glowUniforms.radius.value = glowRadius
      glowUniforms.width.value = Math.max(glowWidth, 1)
      glowUniforms.size.value = 2 * (2 * glowRadius + MOON_GLOW_WIDTHS * glowUniforms.width.value)
      placed.length = 0
      bodies.forEach((body, index) => {
        body.visible = projectWorldPointInto(worldPoint.copy(body.position).add(group.position), viewProjection, viewport, clip, projected)
        body.x = projected.x
        body.y = projected.y
        const radius = index === PLANET_COUNT ? diameterPx / 2 : 3
        Object.assign(body.dot, { left: body.x - radius, right: body.x + radius, top: body.y - radius, bottom: body.y + radius })
        if (body.visible) placed.push(body.dot)
      })
      // The Moon and the brightest planets are named first, beside their own light and clear of
      // the other bodies and names: on the right, else on the left, else not at all.
      for (let index = bodies.length - 1; index >= 0; index--) {
        const body = bodies[index]!
        if (body.visible && body.width === 0) {
          body.anchor.hidden = false
          body.width = body.text.offsetWidth
          body.height = body.text.offsetHeight
        }
        const offset = index === PLANET_COUNT ? diameterPx / 2 + 6 : LABEL_OFFSET_PX
        const top = body.y - body.height / 2
        body.name = !body.visible ? null : [body.x + offset, body.x - offset - body.width]
          .map((left) => ({ left, right: left + body.width, top, bottom: top + body.height }))
          .find((bounds) => bounds.left >= viewport.left && bounds.right <= viewport.right
            && !placed.some((other) => other !== body.dot && overlaps(bounds, other, 2))) ?? null
        if (body.anchor.hidden !== !body.name) body.anchor.hidden = !body.name
        if (!body.name) continue
        placed.push(body.name)
        body.anchor.style.transform = `translate(${body.x - viewport.left}px, ${body.y - viewport.top}px)`
        body.text.style.transform = `translate(${body.name.left - body.x}px, -50%)`
      }
      return placed
    },
    pick(x, y, radius) {
      if (!group.visible) return null
      let picked: string | null = null
      let nearest = Infinity
      for (const body of bodies) {
        if (!body.visible) continue
        const inName = body.name !== null && x >= body.name.left && x <= body.name.right && y >= body.name.top && y <= body.name.bottom
        const distance = inName ? 0 : Math.hypot(x - body.x, y - body.y) - (body.dot.right - body.dot.left) / 2
        if (distance <= radius && distance < nearest) {
          picked = body.id
          nearest = distance
        }
      }
      return picked
    },
    setVisible(visible) {
      group.visible = visible
      labelLayer.hidden = !visible
      container.dataset.solarSystemSkyVisible = String(visible)
    },
    dispose() {
      // Geometries and materials are released with the viewer scene; the textures and names are owned here.
      glowTexture.dispose()
      moonTexture?.dispose()
      labelLayer.remove()
      delete container.dataset.solarSystemSkyVisible
    },
  }
}
