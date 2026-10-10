import { BackSide, BoxGeometry, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, type Texture } from 'three'
import milkyWayImageUrl from './assets/milky-way.jpg'

export interface MilkyWayLayer {
  mesh: Mesh
  setVisible(visible: boolean): void
  setSaturation(saturation: number): void
  dispose(): void
}

// The panorama is large: decode and upload it once for the shared renderer, across viewer rebuilds.
let texturePromise: Promise<Texture<HTMLImageElement>> | undefined
function loadMilkyWayTexture(): Promise<Texture<HTMLImageElement>> {
  texturePromise ??= new TextureLoader().loadAsync(milkyWayImageUrl).then((texture) => {
    texture.colorSpace = SRGBColorSpace
    texture.wrapS = RepeatWrapping
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    return texture
  }).catch((error: unknown) => {
    texturePromise = undefined
    throw error
  })
  return texturePromise
}

// Sample the equirectangular panorama directly rather than asking Three.js
// to expand it into six equally large cube faces. Besides saving GPU memory,
// this preserves its exact Galactic orientation: the centre points toward
// Galactic x, north is +world y, and increasing longitude points toward
// -world z, matching galacticToWorld().
export function createMilkyWayLayer(saturation: number, maxTextureSize: number, onLoad: (ready: boolean) => void): MilkyWayLayer {
  const uniforms = {
    map: { value: null as Texture | null },
    texelSize: { value: new Vector2() },
    intensity: { value: 0.12 },
    saturation: { value: saturation },
  }
  const geometry = new BoxGeometry(1, 1, 1)
  const material = new ShaderMaterial({
    uniforms,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 worldDirection;
      #include <common>
      void main() {
        worldDirection = transformDirection(position, modelMatrix);
        #include <begin_vertex>
        #include <project_vertex>
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec2 texelSize;
      uniform float intensity;
      uniform float saturation;
      varying vec3 worldDirection;
      #include <common>
      void main() {
        vec2 uv = equirectUv(normalize(worldDirection));
        vec3 panorama = texture2D(map, uv).rgb;
        // Reduce tiny star peaks without blurring the broad dust lanes.
        vec3 nearby = 0.25 * (
          texture2D(map, uv + vec2(texelSize.x, 0.0)).rgb +
          texture2D(map, uv - vec2(texelSize.x, 0.0)).rgb +
          texture2D(map, uv + vec2(0.0, texelSize.y)).rgb +
          texture2D(map, uv - vec2(0.0, texelSize.y)).rgb
        );
        panorama -= 0.25 * max(panorama - nearby, vec3(0.0));
        float luminance = dot(panorama, vec3(0.2126, 0.7152, 0.0722));
        vec3 skyColor = max(mix(vec3(luminance), panorama, saturation), vec3(0.0)) * intensity;
        // Keep empty sky transparent so the DOM axis captions behind the
        // canvas remain visible, while preserving the same color over black.
        float skyAlpha = max(max(skyColor.r, skyColor.g), skyColor.b);
        gl_FragColor = vec4(skyColor, skyAlpha);
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  mesh.visible = false
  mesh.onBeforeRender = (_renderer, _scene, activeCamera) => {
    mesh.matrixWorld.copyPosition(activeCamera.matrixWorld)
  }
  let visible = false
  let loading = false
  let disposed = false

  function load(): void {
    if (loading || uniforms.map.value) return
    loading = true
    loadMilkyWayTexture().then((texture) => {
      loading = false
      if (disposed) return
      uniforms.map.value = texture
      const textureWidth = Math.min(texture.image.width, maxTextureSize)
      const textureHeight = texture.image.height * textureWidth / texture.image.width
      uniforms.texelSize.value.set(1 / textureWidth, 1 / textureHeight)
      mesh.visible = visible
      onLoad(true)
    }, () => {
      loading = false
      if (!disposed) onLoad(false)
    })
  }

  return {
    mesh,
    setVisible(next) {
      visible = next
      if (next) load()
      mesh.visible = next && uniforms.map.value !== null
    },
    setSaturation(next) {
      uniforms.saturation.value = next
    },
    dispose() {
      disposed = true
      geometry.dispose()
      material.dispose()
    },
  }
}
