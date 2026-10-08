import {
  AmbientLight, BufferGeometry, Color, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, Mesh, MeshStandardMaterial, OrthographicCamera,
  PCFSoftShadowMap, Quaternion, RepeatWrapping, RingGeometry, Scene, SphereGeometry, SRGBColorSpace, TextureLoader, Vector2, WebGLRenderer,
  type Texture,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import mercuryMap from './assets/planets/mercury-surface-map.png'
import venusMap from './assets/planets/venus-cloud-map.jpg'
import earthMap from './assets/planets/earth-global-map.jpg'
import marsMap from './assets/planets/mars-surface-map.jpg'
import jupiterMap from './assets/radius-comparison/jupiter-map.png'
import saturnMap from './assets/planets/saturn-cloud-atlas.png'
import saturnRingMap from './assets/planets/saturn-rings.png'
import saturnMesh from './assets/planets/saturn-mesh.json'
import uranusMap from './assets/planets/uranus-cloud-map.jpg'
import neptuneMap from './assets/planets/neptune-cloud-map.jpg'
import { solarPlanetDescriptionForId as planetDescriptionForId } from './planet-properties'

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
    credit: 'NASA / GSFC / Reto Stöckli / Robert Simmon · Blue Marble (2002), composed from satellite observations of land, ocean, ice and clouds taken at different times. Ocean tones lightened toward NASA’s Artemis II “Hello, World” photograph; approximate photographic color, not a calibrated measurement. Static composite, not current weather. Illustrative lighting and orientation.',
  },
  mars: {
    name: 'Mars', map: marsMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Rust-red highlands, dark volcanic regions and white polar caps in approximate visible color.',
    credit: 'Caltech / JPL / USGS · global map from Viking images, processed at the USGS. Static map, not current weather or surface relief. Illustrative lighting and orientation.',
  },
  jupiter: {
    name: 'Jupiter', map: jupiterMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Photographic cloud bands and the Great Red Spot on Jupiter’s oblate shape.',
    credit: 'NASA / ESA / A. Simon (GSFC) / M. H. Wong (UC Berkeley) · Hubble OPAL global map (2019). Unobserved caps above 80° latitude extend the nearest mapped clouds. Static composite, not current weather. Shape uses the 1-bar equatorial and polar radii; pale inner-limb scattering, lighting and orientation are illustrative.',
  },
  saturn: {
    name: 'Saturn', map: saturnMap, roughness: 1, mapBlend: 1, tint: '#ffffff',
    description: 'Pale cloud bands on Saturn’s oblate globe, surrounded by icy rings and the Cassini Division.',
    credit: 'NASA / VTAD · cloud atlas and ring texture extracted from NASA’s Saturn 3D model. Illustrative model textures, not a measured global weather map. Shape uses the 1-bar radii; rings share the planet’s physical scale. Lighting, shadows and orientation are illustrative.',
  },
  uranus: {
    name: 'Uranus', map: uranusMap, roughness: 1, mapBlend: 0, tint: '#abd5d3',
    description: 'Pale blue-green clouds on an oblate globe with its rotation axis tipped sideways.',
    credit: 'NASA / JPL-Caltech / David Seal · solid-color illustrative texture, tinted pale blue-green. Shape uses the 1-bar radii. Color, lighting and orientation are illustrative, guided by visible-light observations; not a measured cloud map or current weather. Faint rings are not rendered.',
  },
  neptune: {
    name: 'Neptune', map: neptuneMap, roughness: 1, mapBlend: 0.18, tint: '#a8cfd3',
    description: 'Soft blue-green clouds and subtle bands on Neptune’s oblate globe.',
    credit: 'NASA / JPL-Caltech / Don Davis · illustrative cloud texture with softened color and contrast, guided by the 2024 visible-color reconstruction of Irwin et al. Not a calibrated color measurement, observed global map or current weather. Shape uses the 1-bar radii; lighting and orientation are illustrative. Faint rings are not rendered.',
  },
}

// Lift the map's almost-black, violet-blue water toward Artemis II's softer blue.
// Three.js decodes the sRGB map before this adjustment, so the lift is linear RGB.
const earthOceanLift = new Color('#315979').sub(new Color('#0a123b'))
const earthOceanFragment = `
  float blueDominance = (diffuseColor.b - max(diffuseColor.r, diffuseColor.g)) / max(diffuseColor.b, 0.0001);
  float oceanMask = smoothstep(0.2, 0.65, blueDominance) * smoothstep(0.002, 0.012, diffuseColor.b);
  diffuseColor.rgb += earthOceanLift * oceanMask * earthOceanAdjustment;
`

// Soften only the grazing-angle cloud detail, then add pale scattering inside
// the lit limb. Orthographic view normals keep the effect attached to the edge
// as the oblate globe rotates, including during Earth size comparisons.
const jupiterCloudFragment = `
  #ifdef USE_MAP
    if (jupiterLimbHaze > 0.0) {
      float limb = pow(1.0 - clamp(abs(normalize(vNormal).z), 0.0, 1.0), 2.4);
      vec2 dx = dFdx(vMapUv) * 1.35;
      vec2 dy = dFdy(vMapUv) * 1.35;
      vec3 softClouds = (jupiterCloudSample(vMapUv + dx) + jupiterCloudSample(vMapUv - dx)
        + jupiterCloudSample(vMapUv + dy) + jupiterCloudSample(vMapUv - dy)) * 0.25;
      diffuseColor.rgb = mix(diffuseColor.rgb, softClouds, limb * 0.85 * jupiterLimbHaze);
    }
  #endif
`
const jupiterLimbFragment = `
  if (jupiterLimbHaze > 0.0) {
    float limb = pow(1.0 - clamp(dot(normal, geometryViewDir), 0.0, 1.0), 2.4);
    float sunlight = smoothstep(-0.08, 0.65, dot(normal, directionalLights[0].direction));
    vec3 haze = jupiterHazeColor * (0.025 + 0.975 * sqrt(sunlight));
    outgoingLight = mix(outgoingLight, haze, limb * 0.62 * jupiterLimbHaze);
  }
`

function createPlanetGlobe(canvas: HTMLCanvasElement) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  const scene = new Scene()
  const camera = new OrthographicCamera(-2.4, 2.4, 1.2, -1.2, 0.1, 20)
  camera.position.z = 5
  const geometry = new SphereGeometry(1, 64, 48)
  const jupiter = planetDescriptionForId('jupiter')!
  const jupiterGeometry = geometry.clone()
  jupiterGeometry.scale(jupiter.equatorialRadiusKm! / jupiter.meanRadiusKm, jupiter.polarRadiusKm! / jupiter.meanRadiusKm, jupiter.equatorialRadiusKm! / jupiter.meanRadiusKm)
  // The Hubble map contains black, unobserved polar caps. Extend the nearest
  // mapped latitude, as in the existing radius comparison, to avoid black bands.
  const jupiterUv = jupiterGeometry.getAttribute('uv')
  for (let i = 0; i < jupiterUv.count; i++) jupiterUv.setY(i, Math.max(0.06, Math.min(0.94, jupiterUv.getY(i))))
  const iceGiantGeometries = new Map(['uranus', 'neptune'].map((id) => {
    const planet = planetDescriptionForId(id)!
    const ellipsoid = geometry.clone()
    ellipsoid.scale(planet.equatorialRadiusKm! / planet.meanRadiusKm, planet.polarRadiusKm! / planet.meanRadiusKm, planet.equatorialRadiusKm! / planet.meanRadiusKm)
    return [id, ellipsoid] as const
  }))
  const saturn = planetDescriptionForId('saturn')!
  // Keep NASA's cube-atlas UVs while matching the reviewed 1-bar ellipsoid.
  const saturnGeometry = new BufferGeometry()
  const saturnScale = [saturn.equatorialRadiusKm! / (500 * saturn.meanRadiusKm), saturn.polarRadiusKm! / (451.0190124511719 * saturn.meanRadiusKm), saturn.equatorialRadiusKm! / (500 * saturn.meanRadiusKm)]
  saturnGeometry.setAttribute('position', new Float32BufferAttribute(saturnMesh.positions.map((v, i) => v * saturnScale[i % 3]!), 3))
  saturnGeometry.setAttribute('normal', new Float32BufferAttribute(saturnMesh.normals.map((v, i) => v / saturnScale[i % 3]!), 3))
  saturnGeometry.normalizeNormals()
  saturnGeometry.setAttribute('uv', new Float32BufferAttribute(saturnMesh.uvs.map((v, i) => i % 2 ? 1 - v : v), 2))
  saturnGeometry.setIndex(saturnMesh.indices)
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 })
  const cloudTint = { value: new Color('#ffffff') }
  const mapBlend = { value: 1 }
  const earthOceanAdjustment = { value: 0 }
  const jupiterLimbHaze = { value: 0 }
  const oceanUniforms = 'uniform vec3 earthOceanLift;\nuniform float earthOceanAdjustment;\n'
  // Venus's visible cloud markings are faint; Earth needs a selective ocean lift.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.planetCloudTint = cloudTint
    shader.uniforms.planetMapBlend = mapBlend
    shader.uniforms.earthOceanLift = { value: earthOceanLift }
    shader.uniforms.earthOceanAdjustment = earthOceanAdjustment
    shader.uniforms.jupiterLimbHaze = jupiterLimbHaze
    shader.uniforms.jupiterHazeColor = { value: new Color('#eef0f4') }
    shader.fragmentShader = `${oceanUniforms}uniform float jupiterLimbHaze;\nuniform vec3 jupiterHazeColor;\nuniform vec3 planetCloudTint;\nuniform float planetMapBlend;\n${shader.fragmentShader}`
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
        #ifdef USE_MAP
          vec3 jupiterCloudSample(vec2 uv) {
            return texture2D(map, vec2(uv.x, clamp(uv.y, 0.06, 0.94))).rgb;
          }
        #endif`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${jupiterCloudFragment}\ndiffuseColor.rgb = mix(planetCloudTint, diffuseColor.rgb, planetMapBlend);\n${earthOceanFragment}`)
      .replace('#include <opaque_fragment>', `${jupiterLimbFragment}\n#include <opaque_fragment>`)
  }
  const sphere = new Mesh<BufferGeometry, MeshStandardMaterial>(geometry, material)
  const ringInnerRadius = 74658 / saturn.meanRadiusKm
  const ringOuterRadius = 139826 / saturn.meanRadiusKm
  const ringGeometry = new RingGeometry(ringInnerRadius, ringOuterRadius, 192)
  const ringPositions = ringGeometry.getAttribute('position')
  const ringUvs = ringGeometry.getAttribute('uv')
  for (let i = 0; i < ringUvs.count; i++) {
    const radius = Math.hypot(ringPositions.getX(i), ringPositions.getY(i))
    ringUvs.setXY(i, (radius - ringInnerRadius) / (ringOuterRadius - ringInnerRadius), 0.5)
  }
  ringGeometry.rotateX(-Math.PI / 2)
  const ringMaterial = new MeshStandardMaterial({ roughness: 1, metalness: 0, side: DoubleSide, transparent: true, alphaTest: 0.12, depthWrite: false })
  const rings = new Mesh(ringGeometry, ringMaterial)
  rings.visible = false
  rings.castShadow = true
  rings.receiveShadow = true
  sphere.add(rings)
  let ringTexture: Texture | undefined
  const earthMaterial = new MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 })
  earthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.earthOceanLift = { value: earthOceanLift }
    shader.uniforms.earthOceanAdjustment = { value: 1 }
    shader.fragmentShader = `${oceanUniforms}${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>\n${earthOceanFragment}`)
  }
  const earthSphere = new Mesh(geometry, earthMaterial)
  earthSphere.visible = false
  scene.add(earthSphere)
  sphere.rotation.set(0.08, -1.2, 0)
  // A faint fill keeps the lower-right night-side sliver just visible.
  scene.add(sphere, new AmbientLight(0xffffff, 0.08))
  const light = new DirectionalLight(0xffffff, 4)
  light.position.set(-3.5, 2.5, 5.5)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  light.shadow.camera.left = light.shadow.camera.bottom = -4.5
  light.shadow.camera.right = light.shadow.camera.top = 4.5
  light.shadow.camera.near = 0.1
  light.shadow.camera.far = 15
  light.shadow.normalBias = 0.015
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
  let comparingEarth = false
  let selectedRadius = 1
  let earthRadius = 1
  let velocityX = 0
  let velocityY = 0
  let inertiaTime: number | null = null
  function stopInertia(): void {
    velocityX = 0
    velocityY = 0
    inertiaTime = null
    canvas.dataset.spinning = 'false'
  }
  function layoutGlobes(): void {
    const hasRings = planetId === 'saturn'
    sphere.scale.setScalar(comparingEarth ? selectedRadius : 1)
    sphere.position.x = comparingEarth ? hasRings ? -0.7 : -1.12 : 0
    earthSphere.scale.setScalar(earthRadius)
    earthSphere.position.x = hasRings ? 2 : 1.12
    earthSphere.visible = comparingEarth
    const aspect = (width || 380) / (height || 172)
    const halfHeight = hasRings ? Math.max(ringOuterRadius * 1.08, (comparingEarth ? 3.3 : ringOuterRadius * 1.08) / aspect) : comparingEarth ? Math.max(1.2, 2.32 / aspect) : 1.2
    camera.top = halfHeight
    camera.bottom = -halfHeight
    camera.left = -halfHeight * aspect
    camera.right = halfHeight * aspect
    camera.updateProjectionMatrix()
  }
  function requestRender(): void {
    if (disposed || frame !== null) return
    frame = requestAnimationFrame((time) => {
      frame = null
      if (disposed || !canvas.isConnected || !canvas.getClientRects().length) {
        stopInertia()
        return
      }
      const bounds = canvas.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      if (width !== bounds.width || height !== bounds.height) {
        width = bounds.width
        height = bounds.height
        renderer.setSize(width, height, false)
        composer.setSize(width, height)
        layoutGlobes()
      }
      if (inertiaTime !== null) {
        const elapsed = Math.min(time - inertiaTime, 50)
        inertiaTime = time
        const decay = Math.exp(-elapsed / 325)
        rotate(velocityX * 325 * (1 - decay), velocityY * 325 * (1 - decay))
        velocityX *= decay
        velocityY *= decay
        if (Math.hypot(velocityX, velocityY) < 0.000015) stopInertia()
      }
      composer.render()
      if (inertiaTime !== null) requestRender()
    })
  }

  let planetId: string | undefined
  let texture: Texture | undefined
  let earthTexture: Texture | undefined
  let textureVersion = 0
  function setPlanet(id: string, appearance: GlobeAppearance): void {
    if (planetId === id) return
    planetId = id
    stopInertia()
    const version = ++textureVersion
    texture?.dispose()
    material.map = null
    material.roughness = appearance.roughness
    sphere.geometry = id === 'jupiter' ? jupiterGeometry : id === 'saturn' ? saturnGeometry : iceGiantGeometries.get(id) ?? geometry
    rings.visible = id === 'saturn' && ringMaterial.map !== null
    sphere.castShadow = sphere.receiveShadow = id === 'saturn'
    canvas.dataset.ringsVisible = String(rings.visible)
    cloudTint.value.set(appearance.tint)
    mapBlend.value = appearance.mapBlend
    earthOceanAdjustment.value = id === 'earth' ? 1 : 0
    jupiterLimbHaze.value = id === 'jupiter' ? 1 : 0
    material.needsUpdate = true
    bloomPass.strength = id === 'mercury' ? 0.08 : ['jupiter', 'saturn', 'uranus', 'neptune'].includes(id) ? 0 : 0.03
    // Start with the Great Red Spot slightly left of center.
    sphere.rotation.set(id === 'saturn' ? 0.48 : 0.08, id === 'jupiter' ? 0 : -1.2, id === 'saturn' ? -0.15 : id === 'uranus' ? 97.77 * Math.PI / 180 : 0)
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
    if (id === 'saturn' && !ringTexture) {
      canvas.dataset.ringsReady = 'false'
      ringTexture = new TextureLoader().load(saturnRingMap, (map) => {
        if (disposed) { map.dispose(); return }
        map.colorSpace = SRGBColorSpace
        ringMaterial.map = map
        ringMaterial.needsUpdate = true
        rings.visible = planetId === 'saturn'
        canvas.dataset.ringsReady = 'true'
        canvas.dataset.ringsVisible = String(rings.visible)
        requestRender()
      }, undefined, () => {
        if (disposed) return
        ringTexture?.dispose()
        ringTexture = undefined
        rings.visible = false
        canvas.dataset.ringsVisible = 'false'
        if (planetId === 'saturn') {
          canvas.title += ' Ring texture unavailable.'
          canvas.setAttribute('aria-label', 'Saturn globe. Ring texture unavailable. Drag or use arrow keys to rotate.')
        }
        requestRender()
      })
    }
    requestRender()
  }
  function setComparison(enabled: boolean): void {
    if (enabled && !comparingEarth) earthSphere.quaternion.copy(sphere.quaternion)
    comparingEarth = enabled && planetId !== 'earth'
    const radius = planetDescriptionForId(planetId ?? '')?.meanRadiusKm ?? 1
    const earthMeanRadius = planetDescriptionForId('earth')!.meanRadiusKm
    const largestRadius = Math.max(radius, earthMeanRadius)
    selectedRadius = radius / largestRadius
    earthRadius = earthMeanRadius / largestRadius
    canvas.dataset.comparingEarth = String(comparingEarth)
    const appearance = appearances[planetId ?? '']
    if (appearance) {
      canvas.title = `${appearance.credit}${comparingEarth ? ` Earth: ${appearances.earth!.credit} Both globes use the same diameter scale.` : ''}`
      canvas.setAttribute('aria-label', `${appearance.name}${comparingEarth ? ' and Earth globes at the same diameter scale' : ' globe'}. ${appearance.description} Drag or use arrow keys to rotate${comparingEarth ? ' both globes' : ''}. Release to coast; click to stop.`)
    }
    if (comparingEarth && !earthTexture) {
      canvas.dataset.earthTextureReady = 'false'
      earthTexture = new TextureLoader().load(earthMap, (map) => {
        if (disposed) { map.dispose(); return }
        map.colorSpace = SRGBColorSpace
        map.wrapS = RepeatWrapping
        map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
        earthMaterial.map = map
        earthMaterial.needsUpdate = true
        canvas.dataset.earthTextureReady = 'true'
        requestRender()
      }, undefined, () => {
        if (!disposed) {
          earthTexture?.dispose()
          earthTexture = undefined
          canvas.dataset.earthTextureReady = 'false'
          canvas.setAttribute('aria-label', `${appearance?.name} and Earth globes. Earth texture unavailable. Drag or use arrow keys to rotate.`)
        }
      })
    }
    layoutGlobes()
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
    if (comparingEarth) earthSphere.quaternion.premultiply(turn).normalize()
    requestRender()
  }
  let drag: { id: number; x: number; y: number; time: number } | null = null
  canvas.addEventListener('pointerdown', (event) => {
    if (drag || event.button !== 0) return
    event.preventDefault()
    stopInertia()
    canvas.focus({ preventScroll: true })
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
  }, options)
  canvas.addEventListener('pointermove', (event) => {
    if (drag?.id !== event.pointerId) return
    const speed = Math.PI / (height || 172)
    const x = (event.clientX - drag.x) * speed
    const y = (event.clientY - drag.y) * speed
    const elapsed = Math.max(1, event.timeStamp - drag.time)
    // Carry the actual drag speed into the coast, including short, fast flicks.
    velocityX = x / elapsed
    velocityY = y / elapsed
    rotate(x, y)
    drag.x = event.clientX
    drag.y = event.clientY
    drag.time = event.timeStamp
  }, options)
  const stopDrag = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return
    // A pause before release means the user has already stopped the globe.
    if (event.timeStamp - drag.time > 80) stopInertia()
    if (event.type === 'pointerup' && Math.hypot(velocityX, velocityY) >= 0.000015) {
      inertiaTime = performance.now()
      canvas.dataset.spinning = 'true'
      requestRender()
    } else stopInertia()
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
    stopInertia()
    rotate(...direction)
  }, options)
  canvas.addEventListener('webglcontextrestored', requestRender, options)
  const resizeObserver = new ResizeObserver(requestRender)
  resizeObserver.observe(canvas)
  requestRender()

  return {
    canvas,
    setPlanet,
    setComparison,
    requestRender,
    dispose() {
      disposed = true
      stopInertia()
      events.abort()
      resizeObserver.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
      if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
      canvas.classList.remove('is-dragging')
      texture?.dispose()
      earthTexture?.dispose()
      geometry.dispose()
      jupiterGeometry.dispose()
      for (const ellipsoid of iceGiantGeometries.values()) ellipsoid.dispose()
      saturnGeometry.dispose()
      ringGeometry.dispose()
      ringMaterial.dispose()
      ringTexture?.dispose()
      light.shadow.dispose()
      material.dispose()
      earthMaterial.dispose()
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

export function renderPlanetGlobe(canvas: HTMLCanvasElement, planetId: string, compareEarth = false): boolean {
  const appearance = appearances[planetId]
  if (!appearance) return false
  if (globe?.canvas !== canvas) {
    disposePlanetGlobe()
    globe = createPlanetGlobe(canvas)
  }
  globe.setPlanet(planetId, appearance)
  globe.setComparison(compareEarth)
  globe.requestRender()
  return true
}

export function disposePlanetGlobe(): void {
  globe?.dispose()
  globe = undefined
}
