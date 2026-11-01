import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, Vector3 } from 'three'
import { AU_PER_PARSEC } from './star-systems'

// True to scale: the Hills cloud begins near 2,000 au and the outer cloud ends near 100,000 au.
export const OORT_CLOUD_RADIUS_PC = 100_000 / AU_PER_PARSEC
const OORT_CLOUD_INNER_EDGE = 2_000 / 100_000
const OORT_CLOUD_OPACITY = 0.22

export interface OortCloudLayer {
  sprite: Sprite
  /** 0 hides the cloud, 1 draws it at full strength. */
  setFade(fade: number): void
  dispose(): void
}

function oortCloudTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!
  // A clear core keeps the Sun readable; the haze thickens toward the outer shell and fades at its edge.
  const haze = context.createRadialGradient(128, 128, 0, 128, 128, 128)
  haze.addColorStop(0, '#aab0ba00')
  haze.addColorStop(OORT_CLOUD_INNER_EDGE * 3, '#aab0ba00')
  haze.addColorStop(0.35, '#aab0ba73')
  haze.addColorStop(0.72, '#aab0bad9')
  haze.addColorStop(0.88, '#aab0ba99')
  haze.addColorStop(1, '#aab0ba00')
  context.fillStyle = haze
  context.fillRect(0, 0, 256, 256)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export function createOortCloudLayer(sunPosition: Vector3): OortCloudLayer {
  const texture = oortCloudTexture()
  const material = new SpriteMaterial({
    map: texture, transparent: true, opacity: OORT_CLOUD_OPACITY, depthTest: true, depthWrite: false, toneMapped: false,
  })
  const sprite = new Sprite(material)
  sprite.name = 'oort-cloud'
  sprite.position.copy(sunPosition)
  sprite.scale.setScalar(OORT_CLOUD_RADIUS_PC * 2)
  // Behind star cores, above the Milky Way panorama.
  sprite.renderOrder = 1.5
  sprite.visible = false
  return {
    sprite,
    setFade(fade) {
      material.opacity = OORT_CLOUD_OPACITY * fade
    },
    dispose() {
      material.dispose()
      texture.dispose()
    },
  }
}
