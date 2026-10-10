import { DoubleSide, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Vector2 } from 'three'
import { MOTION_ARROW_DASH_PX, MOTION_ARROW_GAP_PX, MOTION_ARROW_HEAD_PX, MOTION_ARROW_STROKE_PX } from './viewer-primitives'

/** Screen-space motion arrows: one instanced quad per arrow, positioned in canvas CSS px each frame. */
export function createMotionArrowMesh(capacity: number) {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  const placements = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage)
  const shapes = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2).setUsage(DynamicDrawUsage)
  const colors = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage)
  geometry.setAttribute('arrowPlacement', placements)
  geometry.setAttribute('arrowShape', shapes)
  geometry.setAttribute('arrowColor', colors)
  geometry.instanceCount = 0
  const uniforms = {
    viewportSize: { value: new Vector2(1, 1) },
    pixelRatio: { value: 1 },
    strokeRadius: { value: MOTION_ARROW_STROKE_PX / 2 },
    headSize: { value: MOTION_ARROW_HEAD_PX },
    dashLength: { value: MOTION_ARROW_DASH_PX },
    gapLength: { value: MOTION_ARROW_GAP_PX },
  }
  const material = new ShaderMaterial({
    uniforms,
    // The CSS-to-clip-space y flip reverses the quad winding.
    side: DoubleSide,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute vec4 arrowPlacement;
      attribute vec2 arrowShape;
      attribute vec4 arrowColor;
      uniform vec2 viewportSize;
      uniform float pixelRatio;
      uniform float strokeRadius;
      uniform float headSize;
      varying vec2 arrowPoint;
      varying float arrowLength;
      varying float arrowDashed;
      varying vec4 arrowRgba;
      void main() {
        float pad = strokeRadius + 1.0 / pixelRatio;
        arrowLength = arrowShape.x;
        arrowDashed = arrowShape.y;
        arrowRgba = arrowColor;
        // x runs from the tail (0) to the tip (arrowLength); y spans the arrowhead.
        float start = min(0.0, arrowLength - headSize) - pad;
        arrowPoint = vec2(mix(start, arrowLength + pad, position.x), position.y * (headSize + pad));
        vec2 along = arrowPlacement.zw;
        vec2 across = vec2(-along.y, along.x);
        vec2 screenPoint = arrowPlacement.xy + along * arrowPoint.x + across * arrowPoint.y;
        gl_Position = vec4(screenPoint.x / viewportSize.x * 2.0 - 1.0, 1.0 - screenPoint.y / viewportSize.y * 2.0, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform float pixelRatio;
      uniform float strokeRadius;
      uniform float headSize;
      uniform float dashLength;
      uniform float gapLength;
      varying vec2 arrowPoint;
      varying float arrowLength;
      varying float arrowDashed;
      varying vec4 arrowRgba;
      float segmentDistance(vec2 point, vec2 start, vec2 end) {
        vec2 segment = end - start;
        float along = clamp(dot(point - start, segment) / max(dot(segment, segment), 1e-6), 0.0, 1.0);
        return length(point - start - segment * along);
      }
      float strokeCoverage(float offset) {
        return clamp((strokeRadius - offset) * pixelRatio + 0.5, 0.0, 1.0);
      }
      void main() {
        vec2 tip = vec2(arrowLength, 0.0);
        float coverage = strokeCoverage(min(
          segmentDistance(arrowPoint, tip, tip + vec2(-headSize, headSize)),
          segmentDistance(arrowPoint, tip, tip + vec2(-headSize, -headSize))));
        float shaft = strokeCoverage(segmentDistance(arrowPoint, vec2(0.0), tip));
        if (arrowDashed > 0.5 && arrowPoint.x > 0.0 && arrowPoint.x < arrowLength) {
          // Butt-capped dashes; the first dash keeps the round tail cap.
          float period = dashLength + gapLength;
          float phase = mod(arrowPoint.x, period);
          float inside = phase <= dashLength
            ? min(arrowPoint.x < dashLength ? dashLength : phase, dashLength - phase)
            : -min(phase - dashLength, period - phase);
          shaft *= clamp(inside * pixelRatio + 0.5, 0.0, 1.0);
        }
        coverage = max(coverage, shaft);
        if (coverage <= 0.0) discard;
        gl_FragColor = vec4(arrowRgba.rgb, arrowRgba.a * coverage);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 4
  mesh.visible = false
  return { mesh, geometry, material, placements, shapes, colors, uniforms }
}
