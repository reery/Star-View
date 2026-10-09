import { BufferGeometry, CanvasTexture, Group, Line, LineBasicMaterial, Points, PointsMaterial, SRGBColorSpace, Vector3 } from 'three'
import { EARTH_AXIS_DISPLAY_HALF_LENGTH_PC, earthOrbitMarker, earthOrbitPoints } from './earth-orbit'

export interface EarthOrbitLayer {
  group: Group
  setDate(date: Date): ReturnType<typeof earthOrbitMarker>
  dispose(): void
}

function earthMarkerTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const context = canvas.getContext('2d')!
  const glow = context.createRadialGradient(29, 26, 3, 32, 32, 31)
  glow.addColorStop(0, '#d8fbffff')
  glow.addColorStop(0.28, '#51c8ffff')
  glow.addColorStop(0.62, '#176bbfff')
  glow.addColorStop(0.78, '#0b376fcc')
  glow.addColorStop(1, '#061c3a00')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)
  context.fillStyle = '#88b77dcc'
  context.beginPath()
  context.ellipse(25, 28, 5, 2.5, -0.35, 0, Math.PI * 2)
  context.ellipse(37, 36, 4, 2, 0.55, 0, Math.PI * 2)
  context.fill()
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createEarthOrbitLayer(sunPosition: Vector3): EarthOrbitLayer {
  const group = new Group()
  group.name = 'earth-orbit-reference'
  group.position.copy(sunPosition)
  const orbitLine = new Line(
    new BufferGeometry().setFromPoints(earthOrbitPoints()),
    new LineBasicMaterial({ color: 0x5dbfea, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false, toneMapped: false }),
  )
  orbitLine.name = 'earth-orbit-line'
  orbitLine.frustumCulled = false
  orbitLine.renderOrder = 1

  const texture = earthMarkerTexture()
  const pointGeometry = new BufferGeometry().setFromPoints([new Vector3()])
  const point = new Points(
    pointGeometry,
    new PointsMaterial({
      color: 0xffffff, size: 11, sizeAttenuation: false, map: texture, alphaTest: 0.05,
      transparent: true, depthTest: true, depthWrite: true, toneMapped: false,
    }),
  )
  point.name = 'earth-date-marker'
  point.frustumCulled = false
  point.renderOrder = 5
  const axisGeometry = new BufferGeometry().setFromPoints([new Vector3(), new Vector3()])
  const axisLine = new Line(
    axisGeometry,
    new LineBasicMaterial({ color: 0xe2f8ff, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false, toneMapped: false }),
  )
  axisLine.name = 'earth-axis-line'
  axisLine.frustumCulled = false
  axisLine.renderOrder = 6
  group.add(orbitLine, axisLine, point)
  const axisStart = new Vector3()
  const axisEnd = new Vector3()

  return {
    group,
    setDate(date) {
      const marker = earthOrbitMarker(date)
      pointGeometry.getAttribute('position').setXYZ(0, marker.earthPosition.x, marker.earthPosition.y, marker.earthPosition.z)
      pointGeometry.getAttribute('position').needsUpdate = true
      axisStart.copy(marker.earthPosition).addScaledVector(marker.axisDirection, -EARTH_AXIS_DISPLAY_HALF_LENGTH_PC)
      axisEnd.copy(marker.earthPosition).addScaledVector(marker.axisDirection, EARTH_AXIS_DISPLAY_HALF_LENGTH_PC)
      const axisPositions = axisGeometry.getAttribute('position')
      axisPositions.setXYZ(0, axisStart.x, axisStart.y, axisStart.z)
      axisPositions.setXYZ(1, axisEnd.x, axisEnd.y, axisEnd.z)
      axisPositions.needsUpdate = true
      return marker
    },
    dispose() {
      // Geometries and materials are released with the viewer scene; the texture is owned here.
      texture.dispose()
    },
  }
}
