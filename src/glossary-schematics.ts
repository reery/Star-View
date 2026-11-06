import type { GlossaryFigure } from './glossary-index'
import fusionImage from './assets/glossary/stellar-fusion.svg?no-inline'
import eclipseImage from './assets/glossary/eclipsing-binary.svg?no-inline'
import ellipsoidalImage from './assets/glossary/ellipsoidal-variable.svg?no-inline'
import accretionImage from './assets/glossary/accreting-binary.svg?no-inline'
import pulsationImage from './assets/glossary/pulsating-star.svg?no-inline'
import rotationImage from './assets/glossary/rotating-star.svg?no-inline'
import youngStarImage from './assets/glossary/young-star.svg?no-inline'
import spectrumImage from './assets/glossary/emission-lines.svg?no-inline'
import rocheLobeImage from './assets/glossary/roche-lobe.svg?no-inline'
import transitImage from './assets/glossary/transit.svg?no-inline'
import barycenterImage from './assets/glossary/barycenter.svg?no-inline'
import tidalLockingImage from './assets/glossary/tidal-locking.svg?no-inline'
import dustReddeningImage from './assets/glossary/dust-reddening.svg?no-inline'
import galacticCoordinatesImage from './assets/glossary/galactic-coordinates.svg?no-inline'
import stellarBalanceImage from './assets/glossary/stellar-balance.svg?no-inline'

const schematic = (image: string, caption: string, alt: string): GlossaryFigure => ({ image, caption, alt, fit: 'contain', credit: 'Star View · original schematic' })

export const fusion = schematic(fusionImage, 'Core and shell fusion in three stellar stages · schematic, not to scale',
  'Cross-sections show hydrogen fusion in a main-sequence core; helium core fusion with a hydrogen shell on the horizontal branch; and hydrogen and helium shells around a carbon–oxygen core on the asymptotic giant branch.')
export const eclipse = schematic(eclipseImage, 'An eclipse blocks part of the pair’s combined light · schematic',
  'A smaller star crosses in front of a larger star. The combined brightness falls during the overlap and recovers after the eclipse.')
export const ellipsoidal = schematic(ellipsoidalImage, 'A tidally stretched star presents a changing area as it orbits · schematic',
  'A stretched star seen broadside presents a larger area and is brighter; seen end-on it presents a smaller area and is fainter. No star passes in front of the other.')
export const accretion = schematic(accretionImage, 'Gas can flow from a companion into a disk around a compact object · schematic, not to scale',
  'Gas leaves a companion star and streams into an accretion disk around a compact object. The compact object can be a white dwarf, neutron star or black hole, depending on the binary class.')
export const pulsation = schematic(pulsationImage, 'Radial pulsation changes a star’s radius and temperature · schematic',
  'A star alternately contracts and expands. A separate curve shows repeating changes in brightness; the drawing does not assign brightness maxima to a particular radius.')
export const rotation = schematic(rotationImage, 'Rotation carries uneven surface patches into and out of view · schematic',
  'Three views of a rotating star show a darker surface patch appearing, crossing the visible face, and disappearing, changing the observed brightness.')
export const youngStar = schematic(youngStarImage, 'A young star can gather gas from a surrounding disk · schematic, not to scale',
  'A young star sits at the center of a gas-and-dust disk. Arrows show material moving inward toward the star.')
export const spectrum = schematic(spectrumImage, 'Emission lines rise above the surrounding spectrum · schematic',
  'An absorption spectrum has downward dips at selected wavelengths; an emission spectrum has upward peaks. Neither curve is a measured stellar spectrum.')
export const rocheLobe = schematic(rocheLobeImage, 'Each star’s gravity rules a teardrop-shaped lobe; gas crosses where they touch · schematic, not to scale',
  'A figure-eight outline surrounds two stars. The larger star fills its lobe, and gas crosses the narrow point between the lobes toward the companion.')
export const transit = schematic(transitImage, 'A crossing planet blocks a sliver of starlight · schematic, dip exaggerated',
  'A dark planet crosses the face of a star. A brightness curve stays level, dips during the crossing, and recovers.')
export const barycenter = schematic(barycenterImage, 'Two stars circle a shared balance point, nearer the heavier star · schematic',
  'A heavy star on a small orbit and a light star on a large orbit circle one shared point, closer to the heavier star.')
export const tidalLocking = schematic(tidalLockingImage, 'A locked moon spins once per orbit, always showing the same face · schematic',
  'At four points around its orbit, a moon keeps the same marked side facing the body it orbits.')
export const dustReddening = schematic(dustReddeningImage, 'Dust scatters blue light more than red · schematic',
  'White starlight enters a dust cloud. Blue light scatters aside while redder light carries on, so the star looks fainter and redder.')
export const galacticCoordinates = schematic(galacticCoordinatesImage, 'Galactic longitude starts at the galactic center; latitude measures height above the plane · schematic, not to scale',
  'The Milky Way edge-on with the Sun offset from the center. Longitude zero points at the center, and latitude measures angle above the plane.')
export const stellarBalance = schematic(stellarBalanceImage, 'Gravity pulls in, hot gas pushes out, and the star holds steady · schematic',
  'Cross-section of a star with gravity arrows pointing inward and pressure arrows pointing outward, balanced around a fusing core.')
