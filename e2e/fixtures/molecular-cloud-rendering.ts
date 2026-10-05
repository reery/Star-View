import {
  AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, NoBlending,
  PerspectiveCamera, Points, PointsMaterial, Scene, Vector3, WebGLRenderer,
} from 'three'
import type { Star } from '../../src/catalog-model'
import type { StarColorMode } from '../../src/astronomy'
import { createMolecularCloudLayer } from '../../src/molecular-cloud-layer'
import { galacticToWorld } from '../../src/astronomy'
import { createStarViewer, type StarViewer } from '../../src/viewer'

export interface ViewerRenderOptions {
  stars: Star[]
  targetId: string
  observerView: boolean
  mode: StarColorMode
  showClouds: boolean
  targetDistancePc?: number
  powerSaving?: boolean
}

export interface CloudRenderOptions {
  cloud: Star
  samples: number
  mode: StarColorMode
  selected?: boolean
  fraction?: number
  blackSky?: boolean
  source?: 'foreground' | 'background' | 'halo' | 'nebula'
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

// Exercise the production shader and render ordering in a controlled scene.
Object.assign(window, {
  async renderViewer(options: ViewerRenderOptions): Promise<Record<string, { x: number; y: number }>> {
    viewer?.dispose()
    renderer.domElement.hidden = true
    viewerContainer.hidden = false
    const stars = options.stars.filter((star) => options.showClouds || !star.molecular_cloud)
    viewer = createStarViewer(viewerContainer, stars, {
      colorMode: options.mode, milkyWayVisible: false, earthOrbitDate: null,
      onInteraction() {}, onSelect() {}, onStatus() {},
    })
    viewer.setObjectDistanceLimit(2000)
    viewer.setVisibility('sun', 7)
    viewer.setGridVisible(false)
    viewer.setMotionArrowsVisible(false)
    viewer.setLabelLimit(0)
    viewer.setPowerSavingMode(options.powerSaving ?? false)
    viewer.select(null, false)
    const target = galacticToWorld(stars.find((star) => star.id === options.targetId)!)
    const position = options.targetDistancePc === undefined ? new Vector3()
      : target.clone().addScaledVector(target.clone().normalize(), -options.targetDistancePc)
    viewer.setViewState({ position: position.toArray(), target: target.toArray(), home: false, observerRollRadians: 0 })
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
  renderCloud(options: CloudRenderOptions): number[] {
    const scene = new Scene()
    scene.background = options.blackSky ? null : new Color('#808080')
    const cloud: Star = {
      ...options.cloud,
      molecular_cloud: {
        ...options.cloud.molecular_cloud!,
        sample_points_pc: Array(options.samples * 3).fill(0),
      },
    }
    const layer = createMolecularCloudLayer([cloud], options.mode)
    layer.setViewportHeight(128)
    layer.setLevelOfDetail(options.fraction ?? 1)
    layer.setVisible([options.samples > 0])
    layer.setSelected(options.selected ? cloud.id : null)
    scene.add(layer.root)
    const sourceGeometry = new BufferGeometry()
    sourceGeometry.setAttribute('position', new Float32BufferAttribute([0, 0, options.source === 'foreground' ? 10 : -10], 3))
    const sourceMaterial = new PointsMaterial({
      color: '#ffffff', size: 12, sizeAttenuation: false,
      transparent: true, blending: options.source === 'halo' || options.source === 'nebula' ? AdditiveBlending : NoBlending,
      depthWrite: options.source !== 'halo' && options.source !== 'nebula', toneMapped: false,
    })
    if (options.source) {
      const source = new Points(sourceGeometry, sourceMaterial)
      source.renderOrder = options.source === 'halo' ? 3 : options.source === 'nebula' ? 2.5 : 2
      scene.add(source)
    }
    renderer.render(scene, camera)
    const pixels = new Uint8Array(4)
    const gl = renderer.getContext()
    gl.readPixels(64, 64, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    layer.dispose()
    sourceGeometry.dispose()
    sourceMaterial.dispose()
    return Array.from(pixels)
  },
})
