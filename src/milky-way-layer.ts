import { BackSide, BoxGeometry, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Texture, Vector2 } from 'three'
import milkyWayAvifUrl from './assets/milky-way.avif'
import milkyWayJpegUrl from './assets/milky-way.jpg'

export interface MilkyWayLayer {
  mesh: Mesh
  setVisible(visible: boolean): void
  setSaturation(saturation: number): void
  /** Reload after a restored WebGL context: the decoded panorama is not retained after upload. */
  reload(): void
  dispose(): void
}

// A 1×1 AVIF: browsers that cannot decode it receive the JPEG instead of downloading both.
const AVIF_PROBE = 'data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAAB4AAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAmbWRhdBIACgc4AAbQENBpMhEZQmMEwAA0AAAAkEDJHGFCvg=='

function supportsAvif(): Promise<boolean> {
  const image = new Image()
  image.src = AVIF_PROBE
  return image.decode().then(() => image.naturalWidth === 1, () => false)
}

async function loadPanorama(url: string): Promise<ImageBitmap> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load the Milky Way panorama (${response.status}).`)
  // Decode off the main thread, rather than synchronously during the WebGL upload.
  // WebGL ignores UNPACK_FLIP_Y for bitmaps, so orient it here as Three.js would.
  return createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' })
}

interface Panorama { texture: Texture<ImageBitmap>; width: number; height: number }

// The panorama is large: upload it once for the shared renderer, across viewer
// rebuilds. Its ~50 MB decoded copy is closed once the GPU holds the texture.
let texturePromise: Promise<Panorama> | undefined
function loadMilkyWayTexture(): Promise<Panorama> {
  texturePromise ??= supportsAvif().then((avif) => avif
    ? loadPanorama(milkyWayAvifUrl).catch(() => loadPanorama(milkyWayJpegUrl))
    : loadPanorama(milkyWayJpegUrl)).then((image) => {
    const texture = new Texture(image)
    texture.colorSpace = SRGBColorSpace
    texture.flipY = false
    texture.wrapS = RepeatWrapping
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    texture.magFilter = LinearFilter
    texture.onUpdate = () => image.close()
    texture.needsUpdate = true
    return { texture, width: image.width, height: image.height }
  })
  const pending = texturePromise
  pending.catch(() => {
    if (texturePromise === pending) texturePromise = undefined
  })
  return pending
}

function releaseMilkyWayTexture(contextLost = false): void {
  const pending = texturePromise
  texturePromise = undefined
  void pending?.then(({ texture }) => {
    // A lost context already freed the GPU copy; deleting it there only raises a WebGL error.
    if (!contextLost) texture.dispose()
    texture.image.close()
  }, () => undefined)
}

// Sample the equirectangular panorama directly rather than asking Three.js
// to expand it into six equally large cube faces. Besides saving GPU memory,
// this preserves its exact Galactic orientation: the centre points toward
// Galactic x, north is +world y, and increasing longitude points toward
// -world z, matching galacticToWorld().
export function createMilkyWayLayer(saturation: number, maxTextureSize: number, onLoad: (ready: boolean | null) => void): MilkyWayLayer {
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
  let requested: Promise<Panorama> | undefined
  let disposed = false

  function load(): void {
    if (uniforms.map.value) return
    const pending = loadMilkyWayTexture()
    if (pending === requested) return
    requested = pending
    pending.then(({ texture, width, height }) => {
      // Ignore a load that was released, superseded, or outlived this viewer.
      if (disposed || pending !== requested || pending !== texturePromise) return
      uniforms.map.value = texture
      const textureWidth = Math.min(width, maxTextureSize)
      const textureHeight = height * textureWidth / width
      uniforms.texelSize.value.set(1 / textureWidth, 1 / textureHeight)
      mesh.visible = visible
      onLoad(true)
    }, () => {
      if (disposed || pending !== requested) return
      requested = undefined
      onLoad(false)
    })
  }

  // Free the GPU texture while hidden; showing the layer again reloads it from the HTTP cache.
  // A rebuilt viewer that starts hidden also frees the texture shared by its predecessor.
  function release(contextLost = false): void {
    const loaded = requested !== undefined || uniforms.map.value !== null
    requested = undefined
    uniforms.map.value = null
    mesh.visible = false
    releaseMilkyWayTexture(contextLost)
    if (loaded) onLoad(null)
  }

  return {
    mesh,
    setVisible(next) {
      visible = next
      if (next) load()
      else release()
      mesh.visible = next && uniforms.map.value !== null
    },
    setSaturation(next) {
      uniforms.saturation.value = next
    },
    reload() {
      release(true)
      if (visible) load()
    },
    dispose() {
      disposed = true
      geometry.dispose()
      material.dispose()
    },
  }
}
