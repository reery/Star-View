import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three'
import { earthOrbitMarker } from './earth-orbit'
import { VISIBLE_SKY_COLOR, type SkyCone } from './sky-grid'

export interface VisibilityConeLayer {
  mesh: Mesh
  setCone(cone: SkyCone, date: Date): void
  /** Keeps the apex on Earth as the Sun moves through the simulation. */
  followSun(): void
  dispose(): void
}

/**
 * The visible sky as a faint cone of infinite length from the Earth marker. Seen
 * from the apex, a view ray sweeps through an arc of directions in one plane, so
 * the share of that arc inside the cone and the points where it crosses the wall
 * have exact solutions. Each pixel costs the same at any zoom, without ray marching.
 */
export function createVisibilityConeLayer(sunPosition: Vector3): VisibilityConeLayer {
  const apex = new Vector3()
  const earthOffset = new Vector3()
  const material = new ShaderMaterial({
    uniforms: {
      apex: { value: apex },
      axis: { value: new Vector3(0, 1, 0) },
      cosHalfAngle: { value: 1 },
      color: { value: new Color(VISIBLE_SKY_COLOR) },
    },
    transparent: true, depthWrite: false, toneMapped: false,
    vertexShader: `
      varying vec3 ray;
      void main() {
        gl_Position = vec4(position.xy, 1.0, 1.0);
        ray = transpose(mat3(viewMatrix)) * (inverse(projectionMatrix) * gl_Position).xyz;
      }
    `,
    fragmentShader: `
      uniform vec3 apex;
      uniform vec3 axis;
      uniform float cosHalfAngle;
      uniform vec3 color;
      varying vec3 ray;
      const float TAU = 6.283185307;
      float overlap(float low, float high, float sweep) {
        return max(0.0, min(high, sweep) - max(low, 0.0));
      }
      // The cone wall where the ray crosses it, fading with distance from the apex.
      float wall(float angle, float sweep, float sine) {
        if (angle < 0.0 || angle > sweep) return 0.0;
        float reachOfCamera = 2.0 * sine / max(sin(sweep - angle), 1e-4);
        return 1.0 / (1.0 + reachOfCamera * reachOfCamera);
      }
      void main() {
        vec3 direction = normalize(ray);
        vec3 start = normalize(cameraPosition - apex);
        float alongStart = dot(direction, start);
        float sweep = acos(clamp(alongStart, -1.0, 1.0));
        vec3 sideways = direction - alongStart * start;
        float sine = length(sideways);
        sideways /= max(sine, 1e-6);
        float axisStart = dot(start, axis);
        float axisSide = dot(sideways, axis);
        float reach = length(vec2(axisStart, axisSide));
        // The half-angle is always under 90°, so a plane that misses the cone stays outside it.
        if (reach <= cosHalfAngle) discard;
        float center = atan(axisSide, axisStart);
        float halfWidth = acos(cosHalfAngle / reach);
        float low = center - halfWidth;
        float high = center + halfWidth;
        float inside = overlap(low, high, sweep) + overlap(low + TAU, high + TAU, sweep);
        float walls = wall(low, sweep, sine) + wall(high, sweep, sine) + wall(low + TAU, sweep, sine) + wall(high + TAU, sweep, sine);
        // Strongest along rays passing near the apex, so the haze reads as coming from Earth.
        gl_FragColor = vec4(color, 0.008 / (sine + 0.12) * inside + 0.07 * walls);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), material)
  mesh.name = 'visibility-cone'
  mesh.frustumCulled = false
  // Over the sky grid and Milky Way, behind clouds and stars.
  mesh.renderOrder = -0.4
  mesh.visible = false
  const followSun = () => { apex.addVectors(sunPosition, earthOffset) }
  return {
    mesh,
    setCone(cone, date) {
      material.uniforms.axis!.value.copy(cone.axis)
      material.uniforms.cosHalfAngle!.value = Math.cos(cone.halfAngleDeg * Math.PI / 180)
      earthOffset.copy(earthOrbitMarker(date).earthPosition)
      followSun()
    },
    followSun,
    dispose() {
      material.dispose()
    },
  }
}
