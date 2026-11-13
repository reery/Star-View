import { BufferGeometry, Color, Float32BufferAttribute, LineSegments, ShaderMaterial, Vector3, Vector4, type PerspectiveCamera } from 'three'
import { equatorialToGalacticPc } from './catalog-model'
import { galacticToWorld } from './astronomy'
import { sunEquatorialPosition, type SkyHours } from './constellation-visibility'
import { overlaps, type LabelRect, type LayoutViewport } from './label-layout'

export type SkyGridMode = 'off' | 'equatorial' | 'galactic'
type SkyGridFrame = Exclude<SkyGridMode, 'off'>

/** The Earth orbit marker's blue, shared by the visible-sky highlight and circle. */
export const VISIBLE_SKY_COLOR = 0x51c8ff

/** Unit sky directions, using the same fixed ICRS/Galactic axes as the catalog. */
export function skyGridDirection(frame: SkyGridFrame, longitudeDeg: number, latitudeDeg: number): Vector3 {
  if (frame === 'equatorial') return galacticToWorld(equatorialToGalacticPc(longitudeDeg, latitudeDeg, 1))
  const longitude = longitudeDeg * Math.PI / 180
  const latitude = latitudeDeg * Math.PI / 180
  return new Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude))
}

export interface SkyCone { axis: Vector3; halfAngleDeg: number }

/**
 * The round cone of sky that stays above a level horizon through a window of
 * local solar hours. The zenith traces the latitude's declination as Earth turns,
 * so this is the widest cone within 90° of the zenith at both ends of the window.
 * Declination carries Earth's axial tilt, and the Sun's position carries the date.
 */
export function skyWindowCone(latitude: number, date: Date, hours: SkyHours): SkyCone {
  const sunRa = sunEquatorialPosition(date).ra
  const first = skyGridDirection('equatorial', sunRa + (hours.start - 12) * 15, latitude)
  const last = skyGridDirection('equatorial', sunRa + (hours.end - 12) * 15, latitude)
  return { axis: first.clone().add(last).normalize(), halfAngleDeg: 90 - first.angleTo(last) * 90 / Math.PI }
}

// Compass letters sit just outside the rim, clear of its inner band.
const CARDINAL_OFFSET_DEG = 1

/** N, E, S and W horizon directions around a sky cone's rim. */
export function skyConeCardinals(cone: SkyCone): Vector3[] {
  // East is square to the zenith and the celestial pole; at a pole any horizon direction serves.
  const east = skyGridDirection('equatorial', 0, 90).cross(cone.axis)
  if (east.lengthSq() < 1e-12) east.copy(skyGridDirection('equatorial', 90, 0))
  east.normalize()
  const north = cone.axis.clone().cross(east)
  const angle = (cone.halfAngleDeg + CARDINAL_OFFSET_DEG) * Math.PI / 180
  const around = (side: Vector3, sign: number) => cone.axis.clone().multiplyScalar(Math.cos(angle)).addScaledVector(side, sign * Math.sin(angle))
  return [around(north, 1), around(east, 1), around(north, -1), around(east, -1)]
}

export function makeSkyGridGeometry(frame: SkyGridFrame): BufferGeometry {
  const positions: number[] = []
  const emphasis: number[] = []
  function segment(longitude1: number, latitude1: number, longitude2: number, latitude2: number, strength: number): void {
    positions.push(...skyGridDirection(frame, longitude1, latitude1).toArray(), ...skyGridDirection(frame, longitude2, latitude2).toArray())
    emphasis.push(strength, strength)
  }
  // Two-hour RA / 30-degree longitude meridians, with 20-degree parallels.
  for (let longitude = 0; longitude < 360; longitude += 30) {
    for (let latitude = -90; latitude < 90; latitude += 2) segment(longitude, latitude, longitude, latitude + 2, longitude === 0 ? 0.75 : 0.45)
  }
  for (let latitude = -80; latitude <= 80; latitude += 20) {
    for (let longitude = 0; longitude < 360; longitude += 2) segment(longitude, latitude, longitude + 2, latitude, latitude === 0 ? 1 : 0.45)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('emphasis', new Float32BufferAttribute(emphasis, 1))
  return geometry
}

export function skyGridMarkers(frame: SkyGridFrame): Array<{ direction: Vector3; text: string }> {
  const markers = [
    { direction: skyGridDirection(frame, 0, 90), text: frame === 'equatorial' ? 'North celestial pole' : 'North galactic pole' },
    { direction: skyGridDirection(frame, 0, -90), text: frame === 'equatorial' ? 'South celestial pole' : 'South galactic pole' },
  ]
  for (let latitude = -80; latitude <= 80; latitude += 20) {
    for (let longitude = 0; longitude < 360; longitude += 30) {
      markers.push({ direction: skyGridDirection(frame, longitude, latitude), text: frame === 'equatorial' ? `${longitude / 15}h` : `l ${longitude}°` })
    }
    // Offset latitude labels from intersections to keep the two readings apart.
    for (let longitude = 15; longitude < 360; longitude += 60) {
      markers.push({ direction: skyGridDirection(frame, longitude, latitude), text: `${frame === 'equatorial' ? 'Dec' : 'b'} ${latitude > 0 ? '+' : latitude < 0 ? '−' : ''}${Math.abs(latitude)}°` })
    }
  }
  return markers
}

export interface SkyGridLabelSlot {
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  placed: boolean
}

/**
 * Collision checks run only on `relayout` passes, which follow the throttled
 * star-name layout. Between passes, star names are not re-inserted as
 * obstacles, so re-checking would toggle grid labels on every other frame.
 * Placed labels instead keep tracking their anchors until the next pass.
 */
export function placeSkyGridLabels(
  labels: SkyGridLabelSlot[],
  viewport: LayoutViewport,
  isBlocked: (bounds: LabelRect) => boolean,
  relayout: boolean,
): void {
  const placed: LabelRect[] = []
  for (const label of labels) {
    if (!label.visible || (!relayout && !label.placed)) {
      label.placed = false
      continue
    }
    const left = viewport.left + label.x + 7
    const top = viewport.top + label.y + 5
    const bounds = { left, top, right: left + label.width, bottom: top + label.height }
    const insideMargins = left >= viewport.left + 12 && bounds.right <= viewport.left + viewport.width - 12 &&
      top >= viewport.top + 12 && bounds.bottom <= viewport.top + viewport.height - 12
    label.placed = insideMargins && (!relayout || (!isBlocked(bounds) && !placed.some((other) => overlaps(bounds, other))))
    if (label.placed && relayout) placed.push(bounds)
  }
}

export function createSkyGridLayer(container: HTMLElement, opacity: { value: number }) {
  const layer = document.createElement('div')
  layer.className = 'projected-axes sky-grid-labels'
  layer.setAttribute('aria-hidden', 'true')
  layer.hidden = true
  container.append(layer)
  const material = new ShaderMaterial({
    uniforms: {
      color: { value: new Color(0x9daeb8) }, opacity,
      visibleColor: { value: new Color(VISIBLE_SKY_COLOR) }, visibleAxis: { value: new Vector3(0, 1, 0) }, visibleCos: { value: -1 }, highlight: { value: 0 },
    },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute float emphasis;
      varying float lineEmphasis;
      varying vec3 lineDirection;
      void main() {
        lineEmphasis = emphasis;
        lineDirection = position;
        // A sphere at infinity: translation and zoom distance cannot move it.
        gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform vec3 visibleColor;
      uniform vec3 visibleAxis;
      uniform float visibleCos;
      uniform float highlight;
      varying float lineEmphasis;
      varying vec3 lineDirection;
      void main() {
        float visible = highlight * step(visibleCos, dot(normalize(lineDirection), visibleAxis));
        gl_FragColor = vec4(mix(color, visibleColor, visible), min(1.0, opacity * lineEmphasis * (1.0 + 1.1 * visible)));
        #include <colorspace_fragment>
      }
    `,
  })
  const cardinalLayer = document.createElement('div')
  cardinalLayer.className = 'projected-axes'
  cardinalLayer.setAttribute('aria-hidden', 'true')
  cardinalLayer.hidden = true
  container.append(cardinalLayer)
  const cardinals = ['N', 'E', 'S', 'W'].map((content) => {
    const anchor = document.createElement('div')
    anchor.className = 'map-anchor'
    const text = document.createElement('div')
    text.className = 'map-label visibility-cone-label'
    text.style.color = `#${VISIBLE_SKY_COLOR.toString(16).padStart(6, '0')}`
    text.textContent = content
    anchor.append(text)
    cardinalLayer.append(anchor)
    return { anchor, direction: new Vector3() }
  })
  const lines = new LineSegments(new BufferGeometry(), material)
  lines.frustumCulled = false
  lines.visible = false
  // After the dust cloud bodies (1.8), which darken everything drawn before them.
  lines.renderOrder = 1.81
  let mode: SkyGridMode = 'off'
  let labels: Array<SkyGridLabelSlot & { direction: Vector3; anchor: HTMLDivElement; text: HTMLDivElement }> = []
  let layoutDirty = true
  const clip = new Vector4()
  container.dataset.skyGrid = mode

  return {
    lines,
    layer,
    cardinalLayer,
    setVisibleCone(cone: SkyCone | null) {
      material.uniforms.highlight!.value = cone ? 1 : 0
      cardinalLayer.hidden = !cone
      if (cone) {
        material.uniforms.visibleAxis!.value.copy(cone.axis)
        material.uniforms.visibleCos!.value = Math.cos(cone.halfAngleDeg * Math.PI / 180)
        skyConeCardinals(cone).forEach((direction, index) => cardinals[index]!.direction.copy(direction))
      }
    },
    setMode(next: SkyGridMode) {
      if (next === mode) return
      mode = next
      container.dataset.skyGrid = next
      lines.visible = next !== 'off'
      layer.hidden = next === 'off'
      layer.replaceChildren()
      labels = []
      lines.geometry.dispose()
      lines.geometry = next === 'off' ? new BufferGeometry() : makeSkyGridGeometry(next)
      if (next === 'off') return
      material.uniforms.color!.value.set(next === 'equatorial' ? 0x9daeb8 : 0xb5a28e)
      labels = skyGridMarkers(next).map(({ direction, text: content }) => {
        const anchor = document.createElement('div')
        anchor.className = 'map-anchor'
        anchor.hidden = true
        const text = document.createElement('div')
        text.className = 'map-label sky-grid-label'
        text.textContent = content
        anchor.append(text)
        layer.append(anchor)
        return { direction, anchor, text, visible: false, x: 0, y: 0, width: 0, height: 0, placed: false }
      })
      layoutDirty = true
    },
    /** `relayout` should be true on frames where ordinary star names were laid out. */
    updateLabels(camera: PerspectiveCamera, viewport: LayoutViewport, isBlocked: (bounds: LabelRect) => boolean, relayout = true) {
      // Compass letters always show with the cone, so they skip collision checks.
      if (!cardinalLayer.hidden) {
        for (const { anchor, direction } of cardinals) {
          clip.set(direction.x, direction.y, direction.z, 0).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix)
          const visible = clip.w > 0 && Math.abs(clip.x) < clip.w && Math.abs(clip.y) < clip.w
          if (anchor.hidden === visible) anchor.hidden = !visible
          if (visible) anchor.style.transform = `translate(${(clip.x / clip.w + 1) * viewport.width / 2}px, ${(1 - clip.y / clip.w) * viewport.height / 2}px)`
        }
      }
      if (mode === 'off') return
      relayout ||= layoutDirty
      layoutDirty = false
      // Project directions with w=0, matching the translation-free shader.
      for (const label of labels) {
        if (!relayout && !label.placed) continue
        clip.set(label.direction.x, label.direction.y, label.direction.z, 0)
          .applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix)
        label.visible = clip.w > 0 && Math.abs(clip.x) < clip.w && Math.abs(clip.y) < clip.w
        if (!label.visible) continue
        label.x = (clip.x / clip.w + 1) * viewport.width / 2
        label.y = (1 - clip.y / clip.w) * viewport.height / 2
      }
      // Label text is fixed, so sizes are read once in a single layout pass until fonts change.
      if (relayout) {
        for (const label of labels) if (label.visible && label.width === 0) label.anchor.hidden = false
        for (const label of labels) {
          if (!label.visible || label.width > 0) continue
          label.width = label.text.offsetWidth
          label.height = label.text.offsetHeight
        }
      }
      placeSkyGridLabels(labels, viewport, isBlocked, relayout)
      for (const label of labels) {
        if (label.anchor.hidden !== !label.placed) label.anchor.hidden = !label.placed
        if (label.placed) label.anchor.style.transform = `translate(${label.x}px, ${label.y}px)`
      }
    },
    invalidateLabelSizes() {
      for (const label of labels) {
        label.width = 0
        label.height = 0
      }
      layoutDirty = true
    },
    dispose() {
      lines.geometry.dispose()
      material.dispose()
      layer.remove()
      cardinalLayer.remove()
      delete container.dataset.skyGrid
    },
  }
}
