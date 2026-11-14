import { BackSide, BoxGeometry, Group, LinearFilter, Mesh, RepeatWrapping, ShaderMaterial, SRGBColorSpace, Texture, Vector2 } from 'three'
import { LIGHT_YEARS_PER_PARSEC, type StarColorMode } from './astronomy'
import type { GalaxyLayer } from './galaxy-layer'
import type { StarStyle } from './star-appearance'
import milkyWayAvifUrl from './assets/milky-way.avif'
import milkyWayJpegUrl from './assets/milky-way.jpg'

export interface MilkyWayLayer {
  /** The panorama and, once loaded, the Galaxy seen from outside. */
  group: Group
  setVisible(visible: boolean): void
  setColorMode(mode: StarColorMode): void
  /** Realistic stars remove the panorama's own star peaks, which blur into blobs when magnified. */
  setStarStyle(style: StarStyle): void
  /** Crossfades from the Sun's sky panorama to the Galaxy as the camera leaves the Sun. */
  setSunDistance(distancePc: number): void
  setViewportHeight(pixels: number): void
  /** Fades the panorama under telescope magnification: to 63% at 1.6× and 25% at 4×, so its own stars do not swell into blobs. */
  setMagnification(zoom: number): void
  /** Dims the panorama like the stars while the eye adapts to a bright star. */
  setExposure(exposure: number): void
  /** Reload after a restored WebGL context: the decoded panorama is not retained after upload. */
  reload(): void
  /** Advances the fade-in; returns true while another frame is needed. */
  updateFade(time: number): boolean
  dispose(): void
}

const FADE_MS = 800
const PANORAMA_INTENSITY = 0.12
// The panorama is the Sun's sky: it fades out between 2,000 and 15,000 ly from the Sun,
// while the Galaxy builds up from 3,000 ly to full strength at 40,000 ly.
const PANORAMA_FADE_PC = [2_000, 15_000].map((ly) => ly / LIGHT_YEARS_PER_PARSEC) as [number, number]
const GALAXY_FADE_PC = [3_000, 40_000].map((ly) => ly / LIGHT_YEARS_PER_PARSEC) as [number, number]

/** Smoothstep over the logarithm of distance, so each zoom step changes the fade alike. */
export function distanceFade(distancePc: number, [start, end]: readonly [number, number]): number {
  const t = Math.min(1, Math.max(0, Math.log(distancePc / start) / Math.log(end / start)))
  return t * t * (3 - 2 * t)
}

const saturationForMode = (mode: StarColorMode) => mode === 'exaggerated' ? 1.3 : 1

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

// `shown` lets a rebuilt viewer reuse the shared texture without fading in again.
interface Panorama { texture: Texture<ImageBitmap>; width: number; height: number; shown: boolean }

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
    return { texture, width: image.width, height: image.height, shown: false }
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
export function createMilkyWayLayer(
  mode: StarColorMode, maxTextureSize: number, reducedMotion: MediaQueryList,
  onLoad: (ready: boolean | null) => void, onGalaxyLoad: () => void,
): MilkyWayLayer {
  const uniforms = {
    map: { value: null as Texture | null },
    texelSize: { value: new Vector2() },
    intensity: { value: PANORAMA_INTENSITY },
    saturation: { value: saturationForMode(mode) },
    peakSuppression: { value: 0.25 },
    opacity: { value: 1 },
    distanceOpacity: { value: 1 },
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
      uniform float peakSuppression;
      uniform float opacity;
      uniform float distanceOpacity;
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
        panorama -= peakSuppression * max(panorama - nearby, vec3(0.0));
        float luminance = dot(panorama, vec3(0.2126, 0.7152, 0.0722));
        vec3 skyColor = max(mix(vec3(luminance), panorama, saturation), vec3(0.0)) * intensity;
        // Keep empty sky transparent so the DOM axis captions behind the
        // canvas remain visible, while preserving the same color over black.
        float skyAlpha = max(max(skyColor.r, skyColor.g), skyColor.b);
        gl_FragColor = vec4(skyColor, skyAlpha);
        #include <colorspace_fragment>
        gl_FragColor *= opacity * distanceOpacity;
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
  const group = new Group()
  group.add(mesh)
  let visible = false
  let magnification = 1
  let exposure = 1
  let requested: Promise<Panorama> | undefined
  let disposed = false
  let fadeStarted: number | null = null
  let fading = false
  let colorMode = mode
  let viewportHeight = 1
  let galaxyOpacity = 0
  let galaxy: GalaxyLayer | null = null
  let galaxyRequested = false

  function updateMeshVisibility(): void {
    mesh.visible = visible && uniforms.map.value !== null && uniforms.distanceOpacity.value > 0
  }

  // Generated on first need from a small separate module; never fetched while the Milky Way is hidden.
  function updateGalaxy(): void {
    if (galaxy) galaxy.setOpacity(visible ? galaxyOpacity : 0)
    else if (visible && galaxyOpacity > 0 && !galaxyRequested) {
      galaxyRequested = true
      import('./galaxy-layer').then(({ createGalaxyLayer }) => {
        if (disposed) return
        galaxy = createGalaxyLayer(colorMode)
        galaxy.setViewportHeight(viewportHeight)
        group.add(galaxy.group)
        updateGalaxy()
        onGalaxyLoad()
      }, () => {
        galaxyRequested = false
      })
    }
  }

  function load(): void {
    if (uniforms.map.value) return
    const pending = loadMilkyWayTexture()
    if (pending === requested) return
    requested = pending
    pending.then((panorama) => {
      const { texture, width, height } = panorama
      // Ignore a load that was released, superseded, or outlived this viewer.
      if (disposed || pending !== requested || pending !== texturePromise) return
      fading = !panorama.shown && !reducedMotion.matches
      fadeStarted = null
      uniforms.opacity.value = fading ? 0 : 1
      panorama.shown = true
      uniforms.map.value = texture
      const textureWidth = Math.min(width, maxTextureSize)
      const textureHeight = height * textureWidth / width
      uniforms.texelSize.value.set(1 / textureWidth, 1 / textureHeight)
      updateMeshVisibility()
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
    group,
    setVisible(next) {
      visible = next
      if (next) load()
      else release()
      updateMeshVisibility()
      updateGalaxy()
    },
    setColorMode(next) {
      colorMode = next
      uniforms.saturation.value = saturationForMode(next)
      galaxy?.setColorMode(next)
    },
    setStarStyle(next) {
      uniforms.peakSuppression.value = next === 'exaggerated' ? 0.25 : 1
    },
    setSunDistance(distance) {
      uniforms.distanceOpacity.value = 1 - distanceFade(distance, PANORAMA_FADE_PC)
      updateMeshVisibility()
      galaxyOpacity = distanceFade(distance, GALAXY_FADE_PC)
      updateGalaxy()
    },
    setViewportHeight(pixels) {
      viewportHeight = pixels
      galaxy?.setViewportHeight(pixels)
    },
    setMagnification(zoom) {
      magnification = zoom
      uniforms.intensity.value = PANORAMA_INTENSITY * exposure / magnification
    },
    setExposure(next) {
      exposure = next
      uniforms.intensity.value = PANORAMA_INTENSITY * exposure / magnification
    },
    reload() {
      release(true)
      if (visible) load()
    },
    updateFade(time) {
      if (!fading || !mesh.visible) return false
      fadeStarted ??= time
      const progress = Math.min(1, (time - fadeStarted) / FADE_MS)
      uniforms.opacity.value = progress * progress * (3 - 2 * progress)
      fading = progress < 1
      return fading
    },
    dispose() {
      disposed = true
      geometry.dispose()
      material.dispose()
      galaxy?.dispose()
    },
  }
}
