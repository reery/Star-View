import { AdditiveBlending, CanvasTexture, CustomBlending, LessDepth, NoBlending, OneFactor, OneMinusSrcAlphaFactor, PointsMaterial, SRGBColorSpace } from 'three'
import {
  STAR_CORE_FULL_STRENGTH_DISTANCE_PC, STAR_CORE_MIN_DIAMETER_PX, STAR_CORE_MIN_VIEW_SCALE,
  STAR_CORE_VIEW_DISTANCE_FALLOFF_POWER,
  STAR_HALO_FULL_STRENGTH_DISTANCE_PC, STAR_HALO_MIN_OPACITY_SCALE, STAR_HALO_MIN_VIEW_SCALE, STAR_REMNANT_MIN_DIAMETER_PX,
  starCoreShape,
} from './viewer-primitives'
import type { Star } from './catalog-model'

export type StarStyle = 'exaggerated' | 'realistic'
export const STAR_STYLES: readonly StarStyle[] = ['exaggerated', 'realistic']
export type StarBrightness = 'normal' | 'high'
export const STAR_BRIGHTNESSES: readonly StarBrightness[] = ['normal', 'high']

/** Stars show one magnitude brighter at normal brightness and two at high; pulsar, neutron star and black hole icons are symbols and stay. */
export function displayMagnitude(magnitude: number | null, star: Pick<Star, 'type'>, brightness: StarBrightness): number | null {
  return magnitude !== null && starCoreShape(star) === 0 ? magnitude - (brightness === 'high' ? 2 : 1) : magnitude
}

/** How far overlapping realistic stars cover each other: 1 levels a crowd off at a glow, 0 adds all its light. */
export function starCrowdCoverage(brightness: StarBrightness): number {
  return brightness === 'high' ? 0.3 : 1
}

// Realistic stars are drawn like a photograph: a Moffat point spread function
// (with a faint scattered-light wing and diffraction spikes) scaled by flux,
// then saturated, so bright cores clip to white and only the wings keep color.
// Lengths are in CSS pixels; the peak is the central intensity of a 0 mag star.
const PSF_EXPOSURE = 160
const PSF_CORE_WIDTH = 1
const PSF_CORE_POWER = 2.4
const PSF = {
  coreWidth: PSF_CORE_WIDTH, corePower: PSF_CORE_POWER, wingWidth: 3, wingPower: 1.5, wingWeight: 0.005,
  // A normalized Moffat profile's central value, so the exposure applies to total flux.
  peakPerFlux: PSF_EXPOSURE * (PSF_CORE_POWER - 1) / (Math.PI * PSF_CORE_WIDTH ** 2), minPeak: 0.2,
  // A selected star glows at least like a −2 mag star, slightly brighter than Sirius from Earth, at any zoom.
  selectedFlux: 10 ** 0.8,
  // Light beyond −1.5 mag compresses smoothly towards −3 mag, so a companion's glare seen
  // from its neighbor (Rigel A from Rigel Ba is about −22 mag) stays a star, not a clipped disc.
  brightFlux: 10 ** 0.6, brightRangeMagnitudes: 1.5,
  // Overlapping stars converge to 1 / crowdOpacity of full brightness, a glow rather than white.
  crowdOpacity: 1.35,
  spikeWeight: 0.0009, spikeWidth: 0.45, spikeLength: 7, cutoff: 0.004, maxRadius: 64,
}
const glsl = (value: number) => Number.isInteger(value) ? `${value}.0` : String(value)

// Shared by the map and distance card: identical textures, colors and shaders.
export function createStarAppearance(starViewDistance: { value: number }, selectionEnabled = false) {
  const selectionAttribute = selectionEnabled ? 'attribute float selectionEmphasis;' : ''
  const selection = selectionEnabled ? 'selectionEmphasis' : '0.0'
  // Only the map switches to realistic stars; the distance card keeps the defaults.
  const realism = { starRealism: { value: 0 }, starCrowdCoverage: { value: 1 }, starPixelRatio: { value: 1 } }
  // Magnitude already includes the source's distance. Only zooming out of the
  // map adds display restraint; point depth must not attenuate the light again.
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
    Object.assign(shader.uniforms, realism)
    const psfVaryings = 'uniform float starRealism;\nuniform float starCrowdCoverage;\nuniform float starPixelRatio;\nvarying float vPsfPeak;\nvarying float vPsfSpike;\nvarying float vPsfRadius;'
    shader.vertexShader = `${selectionAttribute}\n${psfVaryings}\nuniform float starViewDistance;\nattribute float starFlux;\nattribute float coreDiameter;\nattribute float coreEmphasis;\nattribute float coreWhiteStrength;\nattribute float coreShape;\nvarying float vCoreDiameter;\nvarying float vCoreEmphasis;\nvarying float vCoreWhiteStrength;\nvarying float vCoreShape;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', `float coreOverviewRatio = pow(min(1.0, ${STAR_CORE_FULL_STRENGTH_DISTANCE_PC} / max(starViewDistance, ${STAR_CORE_FULL_STRENGTH_DISTANCE_PC})), ${STAR_CORE_VIEW_DISTANCE_FALLOFF_POWER});
      float coreViewScale = max(${STAR_CORE_MIN_VIEW_SCALE}, sqrt(coreOverviewRatio));
      float displayDiameter = max(max(coreDiameter * coreViewScale, 10.0 * ${selection}), coreShape > 0.5 ? ${STAR_REMNANT_MIN_DIAMETER_PX}.0 : 0.0);
      gl_PointSize = size * max(${STAR_CORE_MIN_DIAMETER_PX}.0, displayDiameter);
      vCoreDiameter = displayDiameter;
      vCoreEmphasis = coreEmphasis;
      vCoreWhiteStrength = coreWhiteStrength;
      vCoreShape = coreShape;
      vPsfRadius = 0.0;
      if (starRealism > 0.5 && coreShape < 0.5) {
        // Zooming the map out dims stars the way the illustrative cores shrink.
        float psfFlux = starFlux * coreViewScale * coreViewScale;
        if (psfFlux > ${glsl(PSF.brightFlux)}) {
          float excessMagnitudes = 1.0857362 * log(psfFlux / ${glsl(PSF.brightFlux)});
          psfFlux = ${glsl(PSF.brightFlux)} * pow(10.0, 0.4 * ${glsl(PSF.brightRangeMagnitudes)} * (1.0 - exp(-excessMagnitudes / ${glsl(PSF.brightRangeMagnitudes)})));
        }
        psfFlux = max(psfFlux, ${glsl(PSF.selectedFlux)} * ${selection});
        vPsfPeak = max(psfFlux * ${glsl(PSF.peakPerFlux)}, ${glsl(PSF.minPeak)});
        vPsfSpike = vPsfPeak * ${glsl(PSF.spikeWeight)};
        // Extent where each term falls below the cutoff, so the sprite holds all visible light.
        float coreReach = ${glsl(PSF.coreWidth)} * sqrt(max(pow(vPsfPeak / ${glsl(PSF.cutoff)}, ${glsl(1 / PSF.corePower)}) - 1.0, 0.0));
        float wingReach = ${glsl(PSF.wingWidth)} * sqrt(max(pow(vPsfPeak * ${glsl(PSF.wingWeight)} / ${glsl(PSF.cutoff)}, ${glsl(1 / PSF.wingPower)}) - 1.0, 0.0));
        float spikeReach = ${glsl(PSF.spikeLength)} * max(sqrt(vPsfSpike / ${glsl(PSF.cutoff)}) - 1.0, 0.0);
        vPsfRadius = starPixelRatio * clamp(max(max(coreReach, wingReach), spikeReach) + 1.0, 1.5, ${glsl(PSF.maxRadius)});
        gl_PointSize = 2.0 * vPsfRadius;
      }`)
    shader.fragmentShader = `${psfVaryings}\nvarying float vCoreDiameter;\nvarying float vCoreEmphasis;\nvarying float vCoreWhiteStrength;\nvarying float vCoreShape;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if (vPsfRadius > 0.0) {
        vec2 offset = (gl_PointCoord - vec2(0.5)) * 2.0 * vPsfRadius / starPixelRatio;
        float distanceSquared = dot(offset, offset);
        float light = vPsfPeak * (pow(1.0 + distanceSquared / ${glsl(PSF.coreWidth ** 2)}, -${glsl(PSF.corePower)})
          + ${glsl(PSF.wingWeight)} * pow(1.0 + distanceSquared / ${glsl(PSF.wingWidth ** 2)}, -${glsl(PSF.wingPower)}));
        vec2 diagonal = vec2(offset.x + offset.y, offset.x - offset.y) * 0.70710678;
        vec2 spikeFalloff = 1.0 / pow(vec2(1.0) + abs(diagonal) / ${glsl(PSF.spikeLength)}, vec2(2.0));
        light += vPsfSpike * (exp(-diagonal.y * diagonal.y / ${glsl(PSF.spikeWidth ** 2)}) * spikeFalloff.x
          + exp(-diagonal.x * diagonal.x / ${glsl(PSF.spikeWidth ** 2)}) * spikeFalloff.y);
        float edge = clamp((sqrt(distanceSquared) * starPixelRatio / vPsfRadius - 0.6) / 0.4, 0.0, 1.0);
        light *= 1.0 - edge * edge;
        vec3 starLight = vec3(1.0) - exp(-light * diffuseColor.rgb);
        // Opacity follows the displayed (sRGB) brightness: alone on dark sky a star looks the same,
        // while a crowd seen from far away levels off at a bounded glow instead of clipping to white.
        float shown = pow(max(max(starLight.r, starLight.g), starLight.b), 1.0 / 2.2);
        diffuseColor = vec4(starLight, min(1.0, shown * ${glsl(PSF.crowdOpacity)}) * starCrowdCoverage);
      } else {
      float coreRadius = length(gl_PointCoord - vec2(0.5)) * 2.0;
      float compactCore = 1.0 - smoothstep(3.0, 4.0, vCoreDiameter);
      float compactEmphasis = compactCore * vCoreEmphasis;
      float hotCenterInner = mix(vCoreDiameter > 3.0 ? 0.28 : 0.06, 0.20, compactEmphasis);
      float hotCenterOuter = mix(vCoreDiameter > 3.0 ? 0.74 : 0.42, 0.68, compactEmphasis);
      float hotCenter = 1.0 - smoothstep(hotCenterInner, hotCenterOuter, coreRadius);
      float whiteStrength = mix(vCoreWhiteStrength, 1.0, 0.55 * vCoreEmphasis);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), hotCenter * whiteStrength);
      if (vCoreShape > 0.5) {
        vec2 corePoint = abs(gl_PointCoord - vec2(0.5)) * 2.0;
        diffuseColor.a = vCoreShape < 1.5 ? step(min(corePoint.x, corePoint.y), 0.24) * step(max(corePoint.x, corePoint.y), 0.95)
          : vCoreShape < 2.5 ? step(corePoint.x + corePoint.y, 0.95)
          : step(0.52, coreRadius) * step(coreRadius, 0.95);
      }
      }`,
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
    shader.vertexShader = `${selectionAttribute}\nuniform float starViewDistance;\nattribute float haloDiameter;\nattribute float haloOpacity;\nvarying float vHaloOpacity;\n${shader.vertexShader}`
      .replace('gl_PointSize = size;', `float overviewRatio = min(1.0, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC} / max(starViewDistance, ${STAR_HALO_FULL_STRENGTH_DISTANCE_PC}));
      float haloViewScale = max(${STAR_HALO_MIN_VIEW_SCALE}, sqrt(sqrt(overviewRatio)));
      float haloViewOpacityScale = max(${STAR_HALO_MIN_OPACITY_SCALE}, sqrt(overviewRatio));
      gl_PointSize = size * max(haloDiameter * haloViewScale, 68.0 * ${selection});
      vHaloOpacity = max(haloOpacity * haloViewOpacityScale, 0.75 * ${selection});`)
    shader.fragmentShader = `varying float vHaloOpacity;\n${shader.fragmentShader}`
      .replace('#include <map_particle_fragment>', '#include <map_particle_fragment>\ndiffuseColor.a *= vHaloOpacity;')
  }
  // Realistic stars composite their premultiplied light over what is behind them; their large,
  // mostly dark sprites must neither hide fainter stars through depth nor be cut by the alpha test.
  starMaterial.blendSrc = OneFactor
  starMaterial.blendDst = OneMinusSrcAlphaFactor
  const setStyle = (style: StarStyle) => {
    const realistic = style === 'realistic'
    realism.starRealism.value = realistic ? 1 : 0
    starMaterial.blending = realistic ? CustomBlending : NoBlending
    starMaterial.depthWrite = !realistic
    starMaterial.alphaTest = realistic ? 0.002 : 0.2
  }
  return { dotTexture, haloTexture, starMaterial, haloMaterial, setStyle, pixelRatio: realism.starPixelRatio, crowdCoverage: realism.starCrowdCoverage }
}
