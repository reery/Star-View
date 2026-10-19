import { CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type PerspectiveCamera } from 'three'
import type { LabelRect, LayoutViewport } from './label-layout'

/** A fixed-size screen label that shares the stars' depth buffer. */
export function createDepthLabel() {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // This label stays the same screen size; mipmaps only soften its small text.
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  const geometry = new PlaneGeometry(1, 1)
  const material = new MeshBasicMaterial({
    map: texture, transparent: true, depthTest: true, depthWrite: true, toneMapped: false,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  // Paint the label before the cores/halos, so nearer stars can cover it.
  mesh.renderOrder = 1
  mesh.visible = false

  return {
    mesh,
    updateTexture(element: HTMLElement, width: number, height: number): void {
      const style = getComputedStyle(element)
      const ratio = Math.max(2, window.devicePixelRatio || 1)
      canvas.width = Math.ceil(width * ratio)
      canvas.height = Math.ceil(height * ratio)
      context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
      context.fillStyle = style.backgroundColor
      context.fillRect(0, 0, width, height)
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      context.fillStyle = style.color
      context.textAlign = 'center'
      const text = element.textContent ?? ''
      const metrics = context.measureText(text)
      context.fillText(text, width / 2, (height + metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2)
      texture.needsUpdate = true
    },
    place(bounds: LabelRect, depth: number, camera: PerspectiveCamera, viewport: LayoutViewport, pixelRatio: number): void {
      const width = bounds.right - bounds.left
      const height = bounds.bottom - bounds.top
      const left = Math.round((bounds.left - viewport.left) * pixelRatio) / pixelRatio
      const top = Math.round((bounds.top - viewport.top) * pixelRatio) / pixelRatio
      const x = ((left + width / 2) / viewport.width) * 2 - 1
      const y = 1 - ((top + height / 2) / viewport.height) * 2
      const projection = camera.projectionMatrix.elements
      mesh.position.set(x * depth / projection[0]!, y * depth / projection[5]!, -depth)
        .applyMatrix4(camera.matrixWorld)
      mesh.quaternion.copy(camera.quaternion)
      const worldPerPixel = 2 * depth / (viewport.height * projection[5]!)
      mesh.scale.set(width * worldPerPixel, height * worldPerPixel, 1)
      mesh.visible = true
    },
    dispose(): void {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
