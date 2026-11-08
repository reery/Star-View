import { BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, LineLoop, Mesh, MeshBasicMaterial, Quaternion, ShaderMaterial, Vector3 } from 'three'
import { LIGHT_YEARS_PER_PARSEC } from './astronomy'
import { earthOrbitMarker } from './earth-orbit'
import { VISIBLE_SKY_COLOR, type SkyCone } from './sky-grid'

// Two-degree steps, like the sky grid's own circles.
const SEGMENTS = 180
const RIM_EMPHASIS = 1.5
const BAND_EMPHASIS = 0.22
const BAND_WIDTH_DEG = 2.5
const WALL_OPACITY = 0.22
const WALL_LENGTH_PC = 7 / LIGHT_YEARS_PER_PARSEC
const UP = new Vector3(0, 1, 0)

export interface VisibilityConeLayer {
  rim: LineLoop
  /** A short cone from the Earth marker, to be added to the Earth orbit group so it hides and moves with it. */
  wall: Mesh
  setCone(cone: SkyCone, date: Date): void
  dispose(): void
}

/**
 * The visible sky's border as a circle at infinity, projected like the sky grid
 * so it lines up with the grid highlight from any camera position. A narrow band
 * fades from the circle towards the cone's centre to mark which side is visible.
 * Rim vertices come first, then the band's matching inner edge.
 */
export function createVisibilityConeLayer(opacity: { value: number }): VisibilityConeLayer {
  const positions = new Float32Array(SEGMENTS * 2 * 3)
  const positionAttribute = new BufferAttribute(positions, 3)
  const fadeAttribute = new Float32BufferAttribute(new Array<number>(SEGMENTS).fill(1).concat(new Array<number>(SEGMENTS).fill(0)), 1)
  const color = { value: new Color(VISIBLE_SKY_COLOR) }
  const makeMaterial = (emphasis: number) => new ShaderMaterial({
    uniforms: { color, opacity, emphasis: { value: emphasis } },
    transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide,
    vertexShader: `
      attribute float fade;
      varying float vertexFade;
      void main() {
        vertexFade = fade;
        // A sphere at infinity: translation and zoom distance cannot move it.
        gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 0.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      uniform float opacity;
      uniform float emphasis;
      varying float vertexFade;
      void main() {
        gl_FragColor = vec4(color, min(1.0, opacity * emphasis * vertexFade));
        #include <colorspace_fragment>
      }
    `,
  })
  const makeGeometry = () => new BufferGeometry().setAttribute('position', positionAttribute).setAttribute('fade', fadeAttribute)
  const rimGeometry = makeGeometry()
  rimGeometry.setDrawRange(0, SEGMENTS)
  const bandGeometry = makeGeometry()
  const bandIndex: number[] = []
  const wallIndex: number[] = []
  for (let segment = 0; segment < SEGMENTS; segment++) {
    const next = (segment + 1) % SEGMENTS
    bandIndex.push(segment, next, SEGMENTS + segment, next, SEGMENTS + next, SEGMENTS + segment)
    wallIndex.push(0, segment + 1, next + 1)
  }
  bandGeometry.setIndex(bandIndex)
  const rimMaterial = makeMaterial(RIM_EMPHASIS)
  const bandMaterial = makeMaterial(BAND_EMPHASIS)
  const rim = new LineLoop(rimGeometry, rimMaterial)
  const band = new Mesh(bandGeometry, bandMaterial)
  rim.name = 'visibility-cone'
  rim.add(band)
  // Over the sky grid and Milky Way, behind clouds and stars.
  rim.renderOrder = band.renderOrder = -0.4
  rim.frustumCulled = band.frustumCulled = false
  rim.visible = false

  // The apex is vertex 0, and the wall's alpha fades from it to nothing at the far edge.
  const wallPositions = new Float32Array((SEGMENTS + 1) * 3)
  const wallPositionAttribute = new BufferAttribute(wallPositions, 3)
  const wallColors = new Float32Array((SEGMENTS + 1) * 4).fill(1)
  for (let vertex = 1; vertex <= SEGMENTS; vertex++) wallColors[vertex * 4 + 3] = 0
  const wallGeometry = new BufferGeometry().setAttribute('position', wallPositionAttribute).setAttribute('color', new BufferAttribute(wallColors, 4))
  wallGeometry.setIndex(wallIndex)
  const wallMaterial = new MeshBasicMaterial({
    color: VISIBLE_SKY_COLOR, vertexColors: true, opacity: WALL_OPACITY,
    transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide, forceSinglePass: true,
  })
  const wall = new Mesh(wallGeometry, wallMaterial)
  wall.name = 'visibility-cone-wall'
  wall.frustumCulled = false
  // After the dust cloud bodies (1.8), like the Earth orbit line, and just before it.
  wall.renderOrder = 1.84
  wall.visible = false

  const turn = new Quaternion()
  const point = new Vector3()
  return {
    rim,
    wall,
    setCone(cone, date) {
      turn.setFromUnitVectors(UP, cone.axis)
      for (let segment = 0; segment < SEGMENTS; segment++) {
        const around = segment * 2 * Math.PI / SEGMENTS
        point.setFromSphericalCoords(1, cone.halfAngleDeg * Math.PI / 180, around).applyQuaternion(turn).toArray(positions, segment * 3)
        point.multiplyScalar(WALL_LENGTH_PC).toArray(wallPositions, (segment + 1) * 3)
        point.setFromSphericalCoords(1, (cone.halfAngleDeg - BAND_WIDTH_DEG) * Math.PI / 180, around).applyQuaternion(turn).toArray(positions, (SEGMENTS + segment) * 3)
      }
      positionAttribute.needsUpdate = true
      wallPositionAttribute.needsUpdate = true
      wall.position.copy(earthOrbitMarker(date).earthPosition)
    },
    dispose() {
      rimGeometry.dispose()
      bandGeometry.dispose()
      wallGeometry.dispose()
      rimMaterial.dispose()
      bandMaterial.dispose()
      wallMaterial.dispose()
    },
  }
}
