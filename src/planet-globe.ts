import {
  AmbientLight, Color, DirectionalLight, Euler, Mesh, MeshStandardMaterial, OrthographicCamera,
  Quaternion, RepeatWrapping, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
  type Texture,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import mercuryMap from './assets/planets/mercury-surface-map.png'
import venusMap from './assets/planets/venus-cloud-map.jpg'
import earthMap from './assets/planets/earth-global-map.jpg'

interface GlobeAppearance {
  readonly name: string
  readonly map: string
  readonly description: string
  readonly credit: string
  readonly roughness: number
  readonly mapBlend: number
  readonly tint: string
}

const appearances: Record<string, GlobeAppearance> = {
  mercury: {
    name: 'Mercury', map: mercuryMap, roughness: 0.62, mapBlend: 1, tint: '#ffffff',
    description: 'Cratered surface from MESSENGER imagery.',
    credit: 'NASA / JHUAPL · MESSENGER global monochrome mosaic. Illustrative lighting and orientation.',
  },
  venus: {
    name: 'Venus', map: venusMap, roughness: 1, mapBlend: 0.04, tint: '#fffdf1',
    description: 'Opaque, pale clouds in approximate visible-light color.',
    credit: 'NASA / JPL-Caltech / David Seal · illustrative cloud map repeated from a visible-light Mariner 10 image. Color and contrast softened to approximate the human-eye view; not a measured global cloud map.',
  },
  earth: {
    name: 'Earth', map: earthMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Blue oceans, continents, ice and white clouds from NASA’s Blue Marble composite.',
    credit: 'NASA / GSFC / Reto Stöckli / Robert Simmon · Blue Marble (2002), composed from satellite observations of land, ocean, ice and clouds taken at different times. Static composite, not current weather. Illustrative lighting and orientation.',
  },
}

function createPlanetGlobe(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  const scene = new Scene()
  const camera = new OrthographicCamera(-2.4, 2.4, 1.2, -1.2, 0.1, 20)
  camera.position.z = 5
  const geometry = new SphereGeometry(1, 64, 48)
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 })
  const cloudTint = { value: new Color('#ffffff') }
  const mapBlend = { value: 1 }
  // Venus's visible cloud markings are faint. Preserve Mercury's map unchanged.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.planetCloudTint = cloudTint
    shader.uniforms.planetMapBlend = mapBlend
    shader.fragmentShader = `uniform vec3 planetCloudTint;\nuniform float planetMapBlend;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = mix(planetCloudTint, diffuseColor.rgb, planetMapBlend);')
  }
  const sphere = new Mesh(geometry, material)
  sphere.rotation.set(0.08, -1.2, 0)
  // A faint fill keeps the lower-right night-side sliver just visible.
  scene.add(sphere, new AmbientLight(0xffffff, 0.08))
  const light = new DirectionalLight(0xffffff, 4)
  light.position.set(-3.5, 2.5, 5.5)
  scene.add(light)
  // Restrained bloom catches the brightest surface highlights.
  const composer = new EffectComposer(renderer)
  const renderPass = new RenderPass(scene, camera)
  const bloomPass = new UnrealBloomPass(new Vector2(1, 1), 0.08, 0.18, 0.22)
  const outputPass = new OutputPass()
  composer.addPass(renderPass)
  composer.addPass(bloomPass)
  composer.addPass(outputPass)

  let disposed = false
  let frame: number | null = null
  let width = 0
  let height = 0
  function requestRender(): void {
    if (disposed || frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      if (disposed || !canvas.isConnected || !canvas.getClientRects().length) return
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      if (width !== bounds.width || height !== bounds.height) {
        width = bounds.width
        height = bounds.height
        renderer.setSize(width, height, false)
        composer.setSize(width, height)
        camera.left = -1.2 * width / height
        camera.right = 1.2 * width / height
        camera.updateProjectionMatrix()
      }
      composer.render()
    })
  }

  let planetId: string | undefined
  let texture: Texture | undefined
  let textureVersion = 0
  function setPlanet(id: string, appearance: GlobeAppearance): void {
    if (planetId === id) return
    planetId = id
    const version = ++textureVersion
    texture?.dispose()
    material.map = null
    material.roughness = appearance.roughness
    cloudTint.value.set(appearance.tint)
    mapBlend.value = appearance.mapBlend
    material.needsUpdate = true
    bloomPass.strength = id === 'mercury' ? 0.08 : 0.03
    sphere.rotation.set(0.08, -1.2, 0)
    canvas.dataset.planetId = id
    canvas.dataset.textureReady = 'false'
    canvas.title = appearance.credit
    canvas.setAttribute('aria-label', `${appearance.name} globe. ${appearance.description} Drag or use arrow keys to rotate.`)
    texture = new TextureLoader().load(appearance.map, (map) => {
      if (disposed || version !== textureVersion) { map.dispose(); return }
      map.colorSpace = SRGBColorSpace
      map.wrapS = RepeatWrapping
      map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      material.map = map
      material.needsUpdate = true
      canvas.dataset.textureReady = 'true'
      requestRender()
    }, undefined, () => {
      if (!disposed && version === textureVersion) {
        canvas.setAttribute('aria-label', `${appearance.name} globe. Texture unavailable. Drag or use arrow keys to rotate.`)
      }
    })
    requestRender()
  }
  const events = new AbortController()
  const options = { signal: events.signal }
  const turn = new Quaternion()
  const angles = new Euler(0, 0, 0, 'YXZ')
  function rotate(x: number, y: number): void {
    angles.set(y, x, 0, 'YXZ')
    turn.setFromEuler(angles)
    sphere.quaternion.premultiply(turn).normalize()
    requestRender()
  }
  let drag: { id: number; x: number; y: number } | null = null
  canvas.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return
    event.preventDefault()
    canvas.focus({ preventScroll: true })
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
  }, options)
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return
    const speed = Math.PI / (height || 172)
    rotate((event.clientX - drag.x) * speed, (event.clientY - drag.y) * speed)
    drag.x = event.clientX
    drag.y = event.clientY
  }, options)
  const stopDrag = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return
    drag = null
    canvas.classList.remove('is-dragging')
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }
  canvas.addEventListener('pointerup', stopDrag, options)
  canvas.addEventListener('pointercancel', stopDrag, options)
  canvas.addEventListener('lostpointercapture', stopDrag, options)
  canvas.addEventListener('keydown', (event) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12],
    }
    const direction = directions[event.key]
    if (!direction) return
    event.preventDefault()
    event.stopPropagation()
    rotate(...direction)
  }, options)
  canvas.addEventListener('webglcontextrestored', requestRender, options)
  const resizeObserver = new ResizeObserver(requestRender)
  resizeObserver.observe(canvas)
  requestRender()

  return {
    canvas,
    setPlanet,
    requestRender,
    dispose() {
      disposed = true
      events.abort()
      resizeObserver.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
      canvas.classList.remove('is-dragging')
      texture?.dispose()
      geometry.dispose()
      material.dispose()
      renderPass.dispose()
      bloomPass.dispose()
      outputPass.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

let globe: ReturnType<typeof createPlanetGlobe> | undefined

export function renderPlanetGlobe(canvas: HTMLCanvasElement, planetId: string): boolean {
  const appearance = appearances[planetId]
  if (!appearance) return false
  if (globe?.canvas !== canvas) {
    disposePlanetGlobe()
    globe = createPlanetGlobe(canvas)
  }
  globe.setPlanet(planetId, appearance)
  globe.requestRender()
  return true
}

export function disposePlanetGlobe(): void {
  globe?.dispose()
  globe = undefined
}
