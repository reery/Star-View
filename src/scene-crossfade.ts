import { CustomBlending, FramebufferTexture, Mesh, OneFactor, OneMinusSrcAlphaFactor, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial, Vector2, type WebGLRenderer } from 'three'

export interface SceneCrossfade {
  /** Draws the current scene and keeps the frame, to fade out over the frames that follow. */
  capture(renderer: WebGLRenderer, draw: () => void): void
  /** Draws the kept frame over the one just drawn; returns true while the fade needs more frames. */
  draw(renderer: WebGLRenderer, time: number): boolean
  dispose(): void
}

export function createSceneCrossfade(durationMs: number): SceneCrossfade {
  const frame = { value: null as FramebufferTexture | null }
  const opacity = { value: 1 }
  const material = new ShaderMaterial({
    uniforms: { frame, opacity },
    // The copied canvas is already display-encoded and premultiplied, so it is drawn back unchanged.
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D frame;
      uniform float opacity;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(frame, vUv) * opacity;
      }`,
  })
  const geometry = new PlaneGeometry(2, 2)
  const overlay = new Scene().add(new Mesh(geometry, material))
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const size = new Vector2()
  let started: number | null = null

  function release(): void {
    frame.value?.dispose()
    frame.value = null
    started = null
  }

  return {
    capture(renderer, draw) {
      draw()
      renderer.getDrawingBufferSize(size)
      if (!frame.value || frame.value.image.width !== size.x || frame.value.image.height !== size.y) {
        frame.value?.dispose()
        frame.value = new FramebufferTexture(size.x, size.y)
      }
      // As in the scene pass: three skips activating unit 0 when the target's binding there is cached.
      renderer.state.activeTexture(renderer.getContext().TEXTURE0)
      renderer.copyFramebufferToTexture(frame.value)
      // The fade starts with the first frame of the new scene, which may wait for its programs to compile.
      started = null
    },
    draw(renderer, time) {
      if (!frame.value) return false
      started ??= time
      const progress = Math.min(1, (time - started) / durationMs)
      if (progress >= 1) {
        release()
        return false
      }
      opacity.value = 1 - progress * progress * (3 - 2 * progress)
      const autoClear = renderer.autoClear
      renderer.autoClear = false
      try {
        renderer.render(overlay, camera)
      } finally {
        renderer.autoClear = autoClear
      }
      return true
    },
    dispose() {
      release()
      geometry.dispose()
      material.dispose()
    },
  }
}
