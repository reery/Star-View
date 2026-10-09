import { BufferGeometry, Color, Float32BufferAttribute, LineSegments, ShaderMaterial } from 'three'

export function gridOpacityForDisplay(devicePixelRatio: number): number {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  return Math.min(0.9, 0.46 + Math.max(0, ratio - 1) * 0.22)
}

export function makeGridGeometry(spacingPc: number, halfSizePc: number): BufferGeometry {
  const limit = Math.floor(halfSizePc / spacingPc + 1e-9)
  const positions: number[] = []
  const colors: number[] = []
  const center = new Color(0x756d65)
  const ordinary = new Color(0x4a4642)
  for (let index = -limit; index <= limit; index++) {
    const offset = index * spacingPc
    positions.push(-halfSizePc, 0, offset, halfSizePc, 0, offset)
    positions.push(offset, 0, -halfSizePc, offset, 0, halfSizePc)
    const color = index === 0 ? center : ordinary
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

/** Plane grid whose lines fade out toward its radius. */
export function createMapGrid(spacingPc: number, halfSizePc: number, uniforms: { radius: { value: number }; opacity: { value: number } }): LineSegments {
  return new LineSegments(makeGridGeometry(spacingPc, halfSizePc), new ShaderMaterial({
    uniforms,
    vertexColors: true, transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec2 gridPosition;
      varying vec3 gridColor;
      void main() {
        gridPosition = position.xz;
        gridColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float radius;
      uniform float opacity;
      varying vec2 gridPosition;
      varying vec3 gridColor;
      void main() {
        float fade = 1.0 - smoothstep(radius * 0.55, radius, length(gridPosition));
        gl_FragColor = vec4(gridColor, opacity * fade);
        #include <colorspace_fragment>
      }
    `,
  }))
}
