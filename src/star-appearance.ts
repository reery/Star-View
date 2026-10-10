import { AdditiveBlending, CanvasTexture, LessDepth, NoBlending, PointsMaterial, SRGBColorSpace } from 'three'
import {
  STAR_CORE_FULL_STRENGTH_DISTANCE_PC, STAR_CORE_MIN_DIAMETER_PX, STAR_CORE_MIN_VIEW_SCALE,
  STAR_CORE_PHYSICAL_FULL_STRENGTH_DISTANCE_PC, STAR_CORE_VIEW_DISTANCE_FALLOFF_POWER,
  STAR_HALO_FULL_STRENGTH_DISTANCE_PC, STAR_HALO_MIN_OPACITY_SCALE, STAR_HALO_MIN_VIEW_SCALE,
} from './viewer-primitives'

// Shared by the map and distance card: identical textures, colors and shaders.
export function createStarAppearance(starViewDistance: { value: number }, pointDistance?: { value: number }) {
  // Diagram coordinates are pixels, so its virtual camera supplies a physical
  // viewing distance instead of letting pixel offsets masquerade as parsecs.
  const physicalDistance = pointDistance ? 'starPointDistance' : 'length(mvPosition.xyz)'
  const distanceUniform = pointDistance ? 'uniform float starPointDistance;\n' : ''
  const textureCanvas = document.createElement('canvas')
  textureCanvas.width = textureCanvas.height = 64
  const context = textureCanvas.getContext('2d')!
  const coreGradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  coreGradient.addColorStop(0, '#ffffffff')
  coreGradient.addColorStop(0.30, '#ffffffff')
  coreGradient.addColorStop(0.52, '#fffffff2')
  coreGradient.addColorStop(0.72, '#ffffff66')
  coreGradient.addColorStop(0.90, '#ffffff00')
  context.fillStyle = coreGradient
  context.fillRect(0, 0, 64, 64)
  const dotTexture = new CanvasTexture(textureCanvas)
  dotTexture.colorSpace = SRGBColorSpace
  const starMaterial = new PointsMaterial({
    size: 1, sizeAttenuation: false, map: dotTexture,
    vertexColors: true, alphaTest: 0.2, depthTest: true, depthWrite: true, toneMapped: false,
    transparent: true, blending: NoBlending,
  })
  starMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.starViewDistance = starViewDistance
    if (pointDistance) shader.uniforms.starPointDistance = pointDistance
    shader.vertexShader = `${distanceUniform}uniform float starViewDistance;\nattribute float coreDiameter;\nattribute float coreFocus;\nattribute float coreEmphasis;\nattribute float coreWhiteStrength;\nvarying float vCoreDiameter;\nvarying float vCoreEmphasis;\nvarying float vCoreWhiteStrength;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', `float coreOverviewRatio = pow(min(1.0, ${STAR_CORE_FULL_STRENGTH_DISTANCE_PC} / max(starViewDistance, ${STAR_CORE_FULL_STRENGTH_DISTANCE_PC})), ${STAR_CORE_VIEW_DISTANCE_FALLOFF_POWER});
      float corePhysicalRatio = min(1.0, ${STAR_CORE_PHYSICAL_FULL_STRENGTH_DISTANCE_PC} / max(${physicalDistance}, ${STAR_CORE_PHYSICAL_FULL_STRENGTH_DISTANCE_PC}));
      float coreOverviewScale = max(${STAR_CORE_MIN_VIEW_SCALE}, sqrt(coreOverviewRatio));
      float corePhysicalScale = mix(max(${STAR_CORE_MIN_VIEW_SCALE}, sqrt(corePhysicalRatio)), 1.0, coreFocus);
      float brightCoreFloor = mix(${STAR_CORE_MIN_VIEW_SCALE}, 0.55, coreEmphasis);
      corePhysicalScale = max(corePhysicalScale, brightCoreFloor);
      float coreViewScale = min(coreOverviewScale, corePhysicalScale);
      gl_PointSize = size * max(${STAR_CORE_MIN_DIAMETER_PX}.0, coreDiameter * coreViewScale);
      vCoreDiameter = coreDiameter * coreViewScale;
      vCoreEmphasis = coreEmphasis;
      vCoreWhiteStrength = coreWhiteStrength;`)
    shader.fragmentShader = `varying float vCoreDiameter;\nvarying float vCoreEmphasis;\nvarying float vCoreWhiteStrength;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float coreRadius = length(gl_PointCoord - vec2(0.5)) * 2.0;
      float compactCore = 1.0 - smoothstep(3.0, 4.0, vCoreDiameter);
      float compactEmphasis = compactCore * vCoreEmphasis;
      float hotCenterInner = mix(vCoreDiameter > 3.0 ? 0.28 : 0.06, 0.20, compactEmphasis);
      float hotCenterOuter = mix(vCoreDiameter > 3.0 ? 0.74 : 0.42, 0.68, compactEmphasis);
      float hotCenter = 1.0 - smoothstep(hotCenterInner, hotCenterOuter, coreRadius);
      float whiteStrength = mix(vCoreWhiteStrength, 1.0, 0.55 * vCoreEmphasis);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), hotCenter * whiteStrength);`,
    )
  }
  const haloCanvas = document.createElement('canvas')
  haloCanvas.width = haloCanvas.height = 128
  const haloContext = haloCanvas.getContext('2d')!
  const haloGradient = haloContext.createRadialGradient(64, 64, 0, 64, 64, 64)
  haloGradient.addColorStop(0, '#ffffffff')
  haloGradient.addColorStop(0.08, '#ffffffff')
  haloGradient.addColorStop(0.20, '#ffffffc7')
  haloGradient.addColorStop(0.40, '#ffffff69')
  haloGradient.addColorStop(0.68, '#ffffff26')
  haloGradient.addColorStop(1, '#ffffff00')
  haloContext.fillStyle = haloGradient
  haloContext.fillRect(0, 0, 128, 128)
  haloContext.globalCompositeOperation = 'lighter'
  const drawSpike = (angle: number, length: number, width: number, alpha: string) => {
    haloContext.save()
    haloContext.translate(64, 64)
    haloContext.rotate(angle)
    const spikeGradient = haloContext.createLinearGradient(-length, 0, length, 0)
    spikeGradient.addColorStop(0, '#ffffff00')
    spikeGradient.addColorStop(0.32, '#ffffff12')
    spikeGradient.addColorStop(0.5, alpha)
    spikeGradient.addColorStop(0.68, '#ffffff12')
    spikeGradient.addColorStop(1, '#ffffff00')
    haloContext.fillStyle = spikeGradient
    haloContext.beginPath()
    haloContext.moveTo(-length, 0)
    haloContext.lineTo(0, -width)
    haloContext.lineTo(length, 0)
    haloContext.lineTo(0, width)
    haloContext.fill()
    haloContext.restore()
  }
  drawSpike(Math.PI / 4, 60, 1.7, '#ffffffa8')
  drawSpike(-Math.PI / 4, 56, 1.55, '#ffffff90')
  drawSpike(0, 40, 0.8, '#ffffff44')
  drawSpike(Math.PI / 2, 44, 0.9, '#ffffff50')
  const haloTexture = new CanvasTexture(haloCanvas)
  haloTexture.colorSpace = SRGBColorSpace
  const haloMaterial = new PointsMaterial({
    size: 1, sizeAttenuation: false, map: haloTexture, vertexColors: true,
    blending: AdditiveBlending, transparent: true, depthTest: true, depthFunc: LessDepth, depthWrite: false, toneMapped: false,
  })
  haloMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.starViewDistance = starViewDistance
    if (pointDistance) shader.uniforms.starPointDistance = pointDistance
    shader.vertexShader = `${distanceUniform}uniform float starViewDistance;\nattribute float haloDiameter;\nattribute float haloOpacity;\nattribute float haloEmphasis;\nvarying float vHaloOpacity;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', `float overviewRatio = min(1.0, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC} / max(starViewDistance, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC}));
      float physicalRatio = min(1.0, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC} / max(${physicalDistance}, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC}));
      float overviewSizeScale = max(${STAR_HALO_MIN_VIEW_SCALE}, sqrt(sqrt(overviewRatio)));
      float overviewOpacityScale = max(${STAR_HALO_MIN_OPACITY_SCALE}, sqrt(overviewRatio));
      float physicalSizeScale = mix(max(${STAR_HALO_MIN_VIEW_SCALE}, sqrt(sqrt(physicalRatio))), 1.0, haloEmphasis);
      float physicalOpacityScale = mix(max(${STAR_HALO_MIN_OPACITY_SCALE}, sqrt(physicalRatio)), 1.0, haloEmphasis);
      float haloViewScale = min(overviewSizeScale, physicalSizeScale);
      float haloViewOpacityScale = min(overviewOpacityScale, physicalOpacityScale);
      gl_PointSize = size * haloDiameter * haloViewScale;
      vHaloOpacity = haloOpacity * haloViewOpacityScale;`)
    shader.fragmentShader = `varying float vHaloOpacity;\n${shader.fragmentShader}`
      .replace('#include <map_particle_fragment>', '#include <map_particle_fragment>\ndiffuseColor.a *= vHaloOpacity;')
  }
  return { dotTexture, haloTexture, starMaterial, haloMaterial }
}
