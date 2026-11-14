import { FramebufferTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, OrthographicCamera, PlaneGeometry, ShaderMaterial, Vector2, type WebGLRenderer } from 'three'
import type { Shader } from './viewer'

type ShaderStyle = Exclude<Shader, 'none'>

export interface ScenePass {
  /** Repaints the frame already on the canvas in the shader's style. */
  render(renderer: WebGLRenderer): void
  dispose(): void
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// Every style works on the displayed sRGB frame, so each layer is styled as it appears.
const prelude = /* glsl */ `
uniform sampler2D source;
uniform vec2 texel;
uniform float pixelRatio;
varying vec2 vUv;

float luma(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }
vec3 screen(vec3 base, vec3 light) { return 1.0 - (1.0 - base) * (1.0 - light); }
// Mip levels follow the drawing-buffer resolution; shifting them keeps blurs the same CSS size on every display.
float lodShift() { return log2(max(pixelRatio, 1.0)); }
// A mip level read with four diagonal taps one texel of that level apart, so magnified glows stay round, not blocky.
vec3 blurred(float level) {
  level += lodShift();
  vec2 step = texel * exp2(level);
  return (textureLod(source, vUv + vec2(step.x, step.y), level).rgb + textureLod(source, vUv - vec2(step.x, step.y), level).rgb
    + textureLod(source, vUv + vec2(step.x, -step.y), level).rgb + textureLod(source, vUv - vec2(step.x, -step.y), level).rgb) * 0.25;
}
// Light that spills only into darker surroundings, so wide bright areas are not lifted further.
vec3 spill(vec3 color, float gain, float floorLevel) {
  vec3 blur = blurred(2.0) * 0.3 + blurred(4.0) * 0.4 + blurred(6.0) * 0.3;
  vec3 glow = max((blur - color) * gain - floorLevel, 0.0);
  return glow / (1.0 + glow);
}
`

const styles: Record<ShaderStyle, string> = {
  // Retro-futuristic concept art: airbrushed glows, warm highlights against cool shadows, a luminous sky.
  concept: /* glsl */ `
void main() {
  vec3 color = textureLod(source, vUv, 0.0).rgb;
  float l = luma(color);
  vec3 glow = spill(color, 3.0, 0.02);
  vec3 graded = clamp(mix(vec3(l), color, 1.3), 0.0, 1.0);
  graded *= mix(vec3(0.88, 0.94, 1.15), vec3(1.12, 1.0, 0.84), smoothstep(0.12, 0.75, l));
  vec3 sky = mix(vec3(0.10, 0.035, 0.11), vec3(0.012, 0.016, 0.05), smoothstep(0.0, 0.8, vUv.y));
  vec2 centered = vUv - 0.5;
  vec3 result = screen(screen(graded, sky), glow * vec3(1.0, 0.8, 0.86));
  gl_FragColor = vec4(result * (1.0 - 0.6 * dot(centered, centered)), 1.0);
}`,
  // Long-exposure astrophotograph: red halation, lens color fringing, a faint sky glow and fine grain.
  exposure: /* glsl */ `
void main() {
  vec2 fringe = (vUv - 0.5) * 0.004;
  vec3 color = vec3(textureLod(source, vUv + fringe, 0.0).r, textureLod(source, vUv, 0.0).g, textureLod(source, vUv - fringe, 0.0).b);
  float l = luma(color);
  vec3 halation = spill(color, 2.5, 0.015) * vec3(1.0, 0.42, 0.24);
  vec3 graded = clamp(mix(vec3(l), color, 1.25), 0.0, 1.0);
  // Cool, slightly lifted shadows like a stretched photograph.
  graded = mix(graded + vec3(0.004, 0.008, 0.018), graded, smoothstep(0.0, 0.25, l));
  float grain = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  graded += grain * 0.03 * smoothstep(0.02, 0.2, l) * (1.0 - smoothstep(0.5, 0.9, l));
  vec2 centered = vUv - 0.5;
  gl_FragColor = vec4(screen(graded, halation) * (1.0 - 0.9 * dot(centered, centered)), 1.0);
}`,
  // Engraved star atlas: sepia ink on parchment, with colored light as hand-tinted washes.
  atlas: /* glsl */ `
void main() {
  vec3 color = textureLod(source, vUv, 0.0).rgb;
  float brightest = max(color.r, max(color.g, color.b));
  float saturation = (brightest - min(color.r, min(color.g, color.b))) / max(brightest, 1e-4);
  vec3 ink = mix(vec3(0.2, 0.13, 0.08), color / max(brightest, 1e-4) * 0.5, saturation * 0.8);
  vec2 centered = vUv - 0.5;
  vec3 paper = vec3(0.93, 0.88, 0.76) * (1.0 - 0.35 * dot(centered, centered));
  // Ink coverage rises steeply, so faint stars still register as dots.
  gl_FragColor = vec4(mix(paper, ink, 1.0 - exp(-luma(color) * 5.0)), 1.0);
}`,
}

export function createScenePass(style: ShaderStyle): ScenePass {
  const size = new Vector2()
  const material = new ShaderMaterial({
    uniforms: { source: { value: null }, texel: { value: new Vector2() }, pixelRatio: { value: 1 } },
    vertexShader, fragmentShader: prelude + styles[style], depthTest: false, depthWrite: false,
  })
  const geometry = new PlaneGeometry(2, 2)
  const quad = new Mesh(geometry, material)
  quad.frustumCulled = false
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  let texture: FramebufferTexture | null = null
  return {
    render(renderer) {
      renderer.getDrawingBufferSize(size)
      if (!texture || texture.image.width !== size.x || texture.image.height !== size.y) {
        texture?.dispose()
        texture = new FramebufferTexture(size.x, size.y)
        // Mip levels give the glows wide, smooth blurs for a few texture reads.
        texture.minFilter = LinearMipmapLinearFilter
        texture.magFilter = LinearFilter
        material.uniforms.source!.value = texture
        material.uniforms.texel!.value.set(1 / size.x, 1 / size.y)
      }
      renderer.copyFramebufferToTexture(texture)
      const gl = renderer.getContext()
      // three copies only the base level; build the rest of the chain on the same texture.
      renderer.state.bindTexture(gl.TEXTURE_2D, (renderer.properties.get(texture) as { __webglTexture: WebGLTexture }).__webglTexture)
      gl.generateMipmap(gl.TEXTURE_2D)
      renderer.state.unbindTexture()
      material.uniforms.pixelRatio!.value = renderer.getPixelRatio()
      renderer.render(quad, camera)
    },
    dispose() {
      texture?.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
