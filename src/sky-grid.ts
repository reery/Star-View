import { BufferGeometry, Color, Float32BufferAttribute, LineSegments, ShaderMaterial, Vector3, Vector4, type PerspectiveCamera } from 'three'
import { equatorialToGalacticPc } from './catalog-model'
import { galacticToWorld } from './astronomy'
import { overlaps, type LabelRect, type LayoutViewport } from './label-layout'

export type SkyGridMode = 'off' | 'equatorial' | 'galactic'
type SkyGridFrame = Exclude<SkyGridMode, 'off'>

/** Unit sky directions, using the same fixed ICRS/Galactic axes as the catalog. */
export function skyGridDirection(frame: SkyGridFrame, longitudeDeg: number, latitudeDeg: number): Vector3 {
  if (frame === 'equatorial') return galacticToWorld(equatorialToGalacticPc(longitudeDeg, latitudeDeg, 1))
  const longitude = longitudeDeg * Math.PI / 180
  const latitude = latitudeDeg * Math.PI / 180
  return new Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude))
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
    uniforms: { color: { value: new Color(0x9daeb8) }, opacity },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute float emphasis;
      varying float lineEmphasis;
      void main() {
        lineEmphasis = emphasis;
        // A sphere at infinity: translation and zoom distance cannot move it.
        gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      varying float lineEmphasis;
      void main() {
        gl_FragColor = vec4(color, opacity * lineEmphasis * 0.65);
        #include <colorspace_fragment>
      }
    `,
  })
  const lines = new LineSegments(new BufferGeometry(), material)
  lines.frustumCulled = false
  lines.visible = false
  lines.renderOrder = -0.5
  let mode: SkyGridMode = 'off'
  let labels: Array<SkyGridLabelSlot & { direction: Vector3; anchor: HTMLDivElement; text: HTMLDivElement }> = []
  let layoutDirty = true
  const clip = new Vector4()
  container.dataset.skyGrid = mode

  return {
    lines,
    layer,
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
      delete container.dataset.skyGrid
    },
  }
}
