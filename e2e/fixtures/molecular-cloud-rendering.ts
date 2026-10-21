import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, NoBlending,
  PerspectiveCamera, Points, PointsMaterial, Scene, Vector3, WebGLRenderer,
} from 'three'
import type { Star } from '../../src/catalog-model'
import type { StarColorMode } from '../../src/astronomy'
import { createMolecularCloudLayer } from '../../src/molecular-cloud-layer'
import { galacticToWorld } from '../../src/astronomy'
import { createStarViewer, type StarViewer } from '../../src/viewer'
import { renderConstellationStars } from '../../src/constellation-star-appearance'
import { FILTER_KEYS } from '../../src/object-filter'

export interface ViewerRenderOptions {
  stars: Star[]
  targetId: string
  observerView: boolean
  mode: StarColorMode
  showClouds: boolean
  targetDistancePc?: number
  orbitDistancePc?: number
  powerSaving?: boolean
  hideSun?: boolean
  selectedId?: string
  cameraOffsetPc?: [number, number, number]
}

export interface CloudRenderOptions {
  cloud: Star
  samples: number
  mode: StarColorMode
  selected?: boolean
  fraction?: number
  blackSky?: boolean
  cloudOffsetPc?: number
  sourceBrightness?: number
  source?: 'foreground' | 'background' | 'halo' | 'nebula'
  sourceDepth?: 'foreground' | 'background'
}

const renderer = new WebGLRenderer({ alpha: true, preserveDrawingBuffer: true })
renderer.setSize(128, 128)
renderer.setClearColor(0x000000, 0)
document.body.append(renderer.domElement)
const camera = new PerspectiveCamera(44, 1, 0.1, 100)
camera.position.z = 20
let viewer: StarViewer | undefined
const viewerContainer = document.createElement('div')
viewerContainer.style.cssText = 'position:fixed;inset:0;background:black;'
viewerContainer.hidden = true
document.body.append(viewerContainer)
const earthChart = document.createElement('canvas')
earthChart.id = 'earth-chart'
earthChart.style.cssText = 'position:fixed;inset:0;background:black;'
earthChart.hidden = true
document.body.append(earthChart)

// Exercise the production shader and render ordering in a controlled scene.
Object.assign(window, {
  async renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> {
    viewer?.dispose()
    earthChart.hidden = true
    renderer.domElement.hidden = true
    viewerContainer.hidden = false
    const stars = options.stars.filter((star) => options.showClouds || !star.molecular_cloud)
    viewer = createStarViewer(viewerContainer, stars, {
      colorMode: options.mode, milkyWayVisible: false, earthOrbitDate: null,
      onInteraction() {}, onSelect() {}, onStatus() {},
    })
    viewer.setObjectDistanceLimit(2000)
    viewer.setVisibility('sun', 7)
    if (options.hideSun) viewer.setObjectFilter(FILTER_KEYS.filter((key) => key !== 'sun'))
    viewer.setGridVisible(false)
    viewer.setMotionArrowsVisible(false)
    viewer.setLabelLimit(0)
    viewer.setPowerSavingMode(options.powerSaving ?? false)
    viewer.select(options.selectedId ?? null, false)
    const target = galacticToWorld(stars.find((star) => star.id === options.targetId)!)
    const position = options.cameraOffsetPc ? target.clone().add(new Vector3(...options.cameraOffsetPc))
      : options.targetDistancePc === undefined ? new Vector3()
      : target.clone().addScaledVector(target.clone().normalize(), -options.targetDistancePc)
    const orbitTarget = options.orbitDistancePc === undefined ? target
      : target.clone().sub(position).setLength(options.orbitDistancePc).add(position)
    viewer.setViewState({ position: position.toArray(), target: orbitTarget.toArray(), home: false, observerRollRadians: 0 })
    if (options.observerView) viewer.setObserverView(true, 'sun')
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const state = viewer.getViewState()
    const camera = new PerspectiveCamera(44, viewerContainer.clientWidth / viewerContainer.clientHeight, 0.01, 10000)
    camera.position.fromArray(state.position)
    camera.lookAt(...state.target)
    camera.updateMatrixWorld()
    return Object.fromEntries(stars.map((star) => {
      const position = galacticToWorld(star).project(camera)
      return [star.id, { x: (position.x + 1) * viewerContainer.clientWidth / 2, y: (1 - position.y) * viewerContainer.clientHeight / 2 }]
    }))
  },
  async selectViewer(id: string | null): Promise<void> {
    viewer!.select(id, false)
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  },
  renderEarthChart(stars: Star[], points: Record<string, { x: number; y: number }>, mode: StarColorMode): void {
    viewerContainer.hidden = true
    earthChart.hidden = false
    renderConstellationStars(earthChart, stars.filter((star) => star.id !== 'sun').map((object) => ({
      object, ...points[object.id]!, magnitude: object.apparent_mag ?? null,
    })), window.innerWidth, window.innerHeight, mode)
  },
  renderCloud(options: CloudRenderOptions): number[] {
    const scene = new Scene()
    scene.background = options.blackSky ? null : new Color('#808080')
    const cloud: Star = {
      ...options.cloud,
      molecular_cloud: {
        ...options.cloud.molecular_cloud!,
        sample_points_pc: Array.from({ length: options.samples * 3 }, (_, index) => index % 3 === 0 ? options.cloudOffsetPc ?? 0 : 0),
      },
    }
    const layer = createMolecularCloudLayer([cloud], options.mode)
    layer.setViewportHeight(128)
    layer.setLevelOfDetail(options.fraction ?? 1)
    layer.setVisible([options.samples > 0])
    layer.setSelected(options.selected ? cloud.id : null)
    scene.add(layer.root)
    const sourceGeometry = new BufferGeometry()
    const foreground = options.sourceDepth === 'foreground' || options.source === 'foreground'
    sourceGeometry.setAttribute('position', new Float32BufferAttribute([0, 0, foreground ? 10 : -10], 3))
    const sourceMaterial = new PointsMaterial({
      color: new Color().setScalar(options.sourceBrightness ?? 1), size: 12, sizeAttenuation: false,
      transparent: true, blending: options.source === 'halo' || options.source === 'nebula' ? AdditiveBlending : NoBlending,
      depthWrite: options.source !== 'halo' && options.source !== 'nebula', toneMapped: false,
    })
    if (options.source) {
      const source = new Points(sourceGeometry, sourceMaterial)
      source.renderOrder = options.source === 'halo' ? 3 : options.source === 'nebula' ? 2.5 : 2
      scene.add(source)
    }
    layer.render(renderer, scene, camera)
    const pixels = new Uint8Array(4)
    const gl = renderer.getContext()
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    layer.dispose()
    sourceGeometry.dispose()
    sourceMaterial.dispose()
    return Array.from(pixels)
  },
})
