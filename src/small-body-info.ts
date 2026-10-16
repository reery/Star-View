import type { ObjectInfo } from './object-info-content'
import { smallBodyMedia } from './small-body-media'

type Topic = readonly [title: string, text: string, url: string]
interface Article { introduction: string; topics: readonly Topic[] }
const nasa = 'https://science.nasa.gov/dwarf-planets/'
const cool = 'https://arxiv.org/abs/1204.0697'
const grundy = 'https://www2.lowell.edu/users/grundy/abstracts/preprints/2019.TNB_orbits.pdf'

const articles: Readonly<Record<string, Article>> = {
  ceres: {
    introduction: 'is the largest object in the asteroid belt and its only formally recognized dwarf planet. Dawn revealed a world where rock, ice and salty water have interacted.',
    topics: [
      ['Bright salts and buried brines', 'The bright deposits in Occator crater are salts left behind when briny liquid reached the surface and lost its water. Some deposits are geologically young, evidence that Ceres retained pockets of liquid long after its formation.', `${nasa}ceres/facts/`],
      ['An ice-rich interior', 'A rocky interior lies beneath an ice-rich crust. Ahuna Mons is an isolated mountain interpreted as a cryovolcano, built by the movement of icy, salty material rather than molten silicate rock.', `${nasa}ceres/facts/`],
      ['Dawn’s close view', 'NASA’s Dawn spacecraft orbited Ceres from 2015 to 2018, mapping craters, measuring gravity and examining the bright deposits. It remains the only spacecraft to have orbited two extraterrestrial destinations: Vesta and Ceres.', 'https://science.nasa.gov/mission/dawn/'],
    ],
  },
  vesta: {
    introduction: 'is a surviving differentiated protoplanet: an early world that formed a metallic core, rocky mantle and basaltic crust before planet building was complete.',
    topics: [
      ['Meteorites from another world', 'The howardite, eucrite and diogenite meteorites are linked to Vesta by their mineral spectra and composition. These samples let laboratories study material from a body that no sample-return mission has visited.', 'https://science.nasa.gov/solar-system/asteroids/4-vesta/'],
      ['A battered south pole', 'The enormous Rheasilvia impact basin overlaps an older basin near the south pole. The impacts excavated deep material, reshaped Vesta and launched debris, some of which eventually reached Earth.', 'https://science.nasa.gov/solar-system/asteroids/4-vesta/'],
      ['Dawn’s first destination', 'Dawn orbited Vesta in 2011–2012. Its maps revealed troughs around the equator, striking variations in surface brightness and evidence of a long, complex impact history.', 'https://science.nasa.gov/mission/dawn/'],
    ],
  },
  pallas: {
    introduction: 'is one of the asteroid belt’s largest bodies. Its steeply tilted orbit carries it well above and below the main concentration of asteroids.',
    topics: [
      ['A world of impact scars', 'Very Large Telescope images reveal a heavily cratered surface. Pallas’s inclined orbit can produce high-speed collisions with other belt objects, helping explain its unusually battered appearance.', 'https://www.eso.org/public/images/potw2008a/'],
      ['A dark, altered surface', 'Pallas belongs to the B spectral class. Its reflected-light spectrum is unlike the basaltic spectrum of Vesta, and observations are consistent with a history involving water-altered minerals.', 'https://doi.org/10.1038/s41550-019-1007-5'],
      ['Resolving an asteroid from Earth', 'Adaptive optics correct atmospheric blurring so large telescopes can measure Pallas’s shape and major craters. These are telescope reconstructions, not spacecraft photographs or a complete true-color surface map.', 'https://www.eso.org/public/images/potw2008a/'],
    ],
  },
  hygiea: {
    introduction: 'is a large, dark asteroid whose unexpectedly round shape makes it an interesting dwarf-planet candidate.',
    topics: [
      ['Round after a giant collision', 'Simulations suggest an ancient impact disrupted Hygiea’s parent body. Much of the material then reassembled into a nearly spherical object, while other fragments became the Hygiea asteroid family.', 'https://www.eso.org/public/news/eso1918/'],
      ['The missing giant crater', 'Despite that violent history, high-resolution telescope images do not show the enormous impact basin astronomers expected. Reassembly after disruption can erase a crater that would survive on an intact body.', 'https://www.eso.org/public/news/eso1918/'],
      ['A classification question', 'Being round is an important part of the dwarf-planet definition, but Hygiea has not received the same formal recognition as Ceres. Its image is a processed single-band visible-light observation, so it does not measure true surface color.', 'https://www.eso.org/public/images/eso1918a/'],
    ],
  },
  pluto: {
    introduction: 'is a dwarf planet in a 3:2 orbital resonance with Neptune. New Horizons revealed an active icy landscape during its July 2015 flyby.',
    topics: [
      ['A moving nitrogen glacier', 'Sputnik Planitia, the bright western part of Pluto’s heart, contains nitrogen ice that flows and overturns slowly. Water ice is hard enough at these temperatures to form the surrounding mountain blocks.', `${nasa}pluto/facts/`],
      ['A thin, hazy atmosphere', 'Nitrogen dominates the atmosphere, with methane and carbon monoxide in smaller amounts. Sunlight drives haze chemistry, while seasonal exchange of ice and gas changes the atmosphere over Pluto’s long year.', `${nasa}pluto/facts/`],
      ['A double world and four small moons', 'Pluto and Charon always present the same faces to one another, orbiting a barycenter outside Pluto. Styx, Nix, Kerberos and Hydra orbit the central pair; their orbital distances are therefore referenced to that barycenter.', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html'],
    ],
  },
  eris: {
    introduction: 'is a dwarf planet on a highly inclined, elongated orbit far beyond Neptune. Its discovery helped trigger the 2006 revision of the planet definition.',
    topics: [
      ['A brilliant frozen surface', 'A stellar occultation showed that Eris is slightly smaller than Pluto. Its very reflective surface is consistent with bright frost, and its spectrum shows methane ice. Any atmosphere may vary strongly as the surface warms and cools along its orbit.', 'https://doi.org/10.1038/nature10550'],
      ['A day tied to Dysnomia', 'Long-term photometry supports a rotation period of about 15.79 Earth days, matching the orbital period of Dysnomia. This replaces older suggestions of a much shorter day and provides evidence of strong tidal evolution.', 'https://arxiv.org/abs/2303.13445'],
      ['Weighing a distant system', 'Dysnomia’s motion measures the combined mass of the pair. Separating that total into individual masses requires additional assumptions or observations, so a total system mass is not presented as Eris’s measured mass.', 'https://ntrs.nasa.gov/citations/20210012932'],
    ],
  },
  haumea: {
    introduction: 'is a rapidly rotating dwarf planet with an elongated shape, two moons and a ring.',
    topics: [
      ['A world stretched by rotation', 'Haumea spins in about four hours. Its long axis is much greater than its polar dimension, so a single equivalent diameter hides a strikingly nonspherical shape.', 'https://doi.org/10.1038/nature24051'],
      ['A ring found by starlight', 'During a 2017 stellar occultation, brief secondary dips revealed a ring around Haumea. The ring lies close to its equatorial plane and near a resonance with the body’s rapid rotation.', 'https://doi.org/10.1038/nature24051'],
      ['Moons and a family of icy fragments', 'Hiʻiaka and Namaka accompany Haumea. Several other Kuiper Belt objects share distinctive water-ice spectra and related orbits, forming a collisional family that offers clues to Haumea’s violent early history.', 'https://doi.org/10.1038/nature05619'],
    ],
  },
  makemake: {
    introduction: 'is a bright dwarf planet in the Kuiper Belt, with a methane-rich surface and a faint companion nicknamed MK2.',
    topics: [
      ['Methane ice and seasonal change', 'Frozen methane is prominent in Makemake’s spectrum. A stellar occultation found no substantial global atmosphere at that time, although a localized or changing atmosphere remains possible.', 'https://doi.org/10.1038/nature11597'],
      ['A moon hidden in the glare', 'Hubble images revealed S/2015 (136472) 1, much fainter than Makemake. A preliminary orbit revised in 2026 favors an approximately 18-day period, but this card withholds orbital values until the solution is more secure.', 'https://arxiv.org/abs/2509.05880'],
      ['A world studied from afar', 'No spacecraft has visited Makemake. Its size comes from occultation measurements, while spectroscopy and thermal observations constrain the ice and its reflectivity without resolving a detailed landscape.', `${nasa}makemake/`],
    ],
  },
  gonggong: {
    introduction: 'is a large, reddish dwarf-planet candidate on an elongated orbit in the scattered population beyond Neptune.',
    topics: [
      ['Red color and water ice', 'Spectroscopy reveals water ice on Gonggong’s surface. Its red visible color may involve irradiated organic material; the detailed chemistry and any retained volatile ice remain subjects of research.', 'https://doi.org/10.1088/2041-8205/738/2/L26'],
      ['Xiangliu and tidal evolution', 'Hubble discovered the moon Xiangliu. The mutual orbit constrains the combined system mass and helps test whether tidal interactions contributed to Gonggong’s relatively slow rotation.', 'https://doi.org/10.1016/j.icarus.2019.03.013'],
      ['Size without a surface map', 'Thermal emission and reflected light constrain Gonggong’s diameter, but depend on modeling the surface and the moon’s contribution. Its telescope image does not resolve craters or terrain.', 'https://doi.org/10.1016/j.icarus.2019.03.013'],
    ],
  },
  quaoar: {
    introduction: 'is a large Kuiper Belt world with the moon Weywot and an unusual ring system.',
    topics: [
      ['Rings where a moon might be expected', 'Occultations revealed rings well beyond the classical Roche limit, where particles were expected to assemble into a moon. Their survival challenges simple models of how icy ring particles collide and stick together.', 'https://doi.org/10.1038/s41586-022-05629-6'],
      ['A possible additional companion', 'A secondary occultation in June 2025 revealed a compact opaque feature. A small satellite and a dense ring arc remain competing interpretations; the extra entry in Moons is explicitly marked as a candidate.', 'https://doi.org/10.3847/2041-8213/ae4751'],
      ['An icy world measured by occultations', 'Repeated stellar occultations constrain Quaoar’s shape and place limits on a global atmosphere. Weywot’s orbit adds information about the system’s mass, but does not by itself give separate masses for both bodies.', 'https://arxiv.org/abs/2607.06450'],
    ],
  },
  orcus: {
    introduction: 'is a dwarf-planet candidate in the same 3:2 resonance with Neptune as Pluto, accompanied by the large moon Vanth.',
    topics: [
      ['Resonant protection', 'Orcus completes about two orbits for every three of Neptune. Resonance controls where encounters could occur, allowing an eccentric orbit to remain stable over long intervals.', 'https://doi.org/10.1088/0004-6256/139/6/2700'],
      ['Two very different surfaces', 'Resolved ALMA observations found Vanth to be darker than Orcus. Assuming equal reflectivity for both would give misleading sizes; their thermal emission was measured separately instead.', 'https://doi.org/10.3847/1538-3881/aad9f2'],
      ['A substantial companion', 'Vanth is large relative to Orcus. Measuring the pair’s astrometric wobble can separate their masses, a stronger constraint than simply assigning the total orbital mass to Orcus.', 'https://arxiv.org/abs/2307.04848'],
    ],
  },
  sedna: {
    introduction: 'is a detached dwarf-planet candidate whose enormous orbit keeps it far beyond Neptune even at its closest approach to the Sun.',
    topics: [
      ['A very long year', 'Sedna takes roughly eleven thousand years to orbit the Sun. Its perihelion is around 76 AU, while its farthest distance approaches a thousand AU, so it spends most of each orbit in the distant outer Solar System.', 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=90377'],
      ['A clue to the Sun’s early surroundings', 'Neptune alone does not readily explain Sedna’s detached orbit. Proposed histories include encounters with stars in the Sun’s birth environment and perturbations by an undiscovered planet; no single explanation is established.', 'https://doi.org/10.1086/383470'],
      ['A red point of light', 'Sedna has a very red reflected-light spectrum. Herschel’s thermal measurements constrain its size, but no resolved true-color photograph or surface texture exists.', 'https://doi.org/10.1051/0004-6361/201219935'],
    ],
  },
  salacia: {
    introduction: 'is a large, dark dwarf-planet candidate in a binary system with Actaea.',
    topics: [
      ['Splitting the light of a binary', 'The adopted component sizes combine thermal measurements of the pair with their brightness difference and assume equal albedos. They are model-based individual estimates, rather than two directly resolved diameter measurements.', grundy],
      ['A possible synchronized pair', 'Long-term monitoring reported in 2025 supports Salacia rotating in step with Actaea’s orbit, roughly once every five and a half days. This suggests tidal interactions have reshaped the system over its history.', 'https://arxiv.org/abs/2509.02734'],
      ['Mass belongs to the pair', 'Actaea’s orbit measures the total system mass. The separate masses and densities remain uncertain, so the card leaves them blank rather than transferring a binary measurement to Salacia alone.', grundy],
    ],
  },
  mani: {
    introduction: 'is the large Kuiper Belt object formerly known as 2002 MS4. It is a dwarf-planet candidate named for the Norse personification of the Moon.',
    topics: [
      ['A silhouette traced across Earth', 'Observers at many sites timed a background star disappearing behind Máni in August 2020. Combining their tracks produced a projected equivalent diameter near 800 km without resolving the surface in a photograph.', 'https://arxiv.org/abs/2308.08062'],
      ['Evidence of large relief', 'Departures from a smooth occultation limb indicate substantial topography. A large depression is one interpretation of the measured silhouette; it is evidence from starlight, not a photographed crater.', 'https://arxiv.org/abs/2308.08062'],
      ['A possible hidden companion', 'A 2026 analysis found excess thermal emission relative to the occultation size, consistent with an unresolved companion. This is indirect evidence, so the Moons entry marks it as a candidate and leaves its orbital measurements unknown.', 'https://arxiv.org/abs/2605.22296'],
    ],
  },
  aya: {
    introduction: 'is the dwarf-planet candidate formerly designated 2002 AW197, a large object in the dynamically excited classical Kuiper Belt.',
    topics: [
      ['Measuring warmth in deep cold', 'Herschel measured Aya’s far-infrared thermal radiation. Combining this with reflected sunlight helps distinguish a large dark object from a smaller bright one; the inferred diameter still depends on the thermal model.', cool],
      ['A tilted classical orbit', 'Aya follows a relatively modest-eccentricity orbit beyond Neptune with a substantial inclination to the ecliptic. “Classical” describes its dynamical group, not a perfectly circular or flat orbit.', 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=55565'],
      ['A new name for an old discovery', 'Approved in 2025, Aya refers to the Akkadian goddess of dawn, consort of the Sun god Shamash. The permanent number 55565 keeps the object’s identity consistent with older research under 2002 AW197.', 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=55565'],
    ],
  },
  varda: {
    introduction: 'is a dwarf-planet candidate in a binary with Ilmarë. Stellar occultations give a more direct view of its outline than its tiny telescope image.',
    topics: [
      ['Shape from a disappearing star', 'An occultation in 2018 traced an elliptical projected limb. Its equivalent diameter is an area measurement at that viewing angle, so it should not be mistaken for a complete three-dimensional shape.', 'https://arxiv.org/abs/2008.04818'],
      ['Ilmarë’s orbit', 'Repeated images determine the motion of Ilmarë relative to Varda. Their mutual orbit gives a combined mass; inferring separate densities also requires the individual volumes and a mass ratio.', 'https://doi.org/10.1016/j.icarus.2015.03.036'],
      ['Names from a fictional mythology', 'Varda and Ilmarë take their names from Tolkien’s mythology. The primary is the creator of the stars, while Ilmarë is her attendant. These names distinguish the components without implying a measured surface appearance.', 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=174567'],
    ],
  },
  chiminigagua: {
    introduction: 'is the dwarf-planet candidate formerly called 2013 FY27, a distant binary named for the creator of light in Muisca tradition.',
    topics: [
      ['A faint moon changes the size estimate', 'Hubble revealed a companion about three magnitudes fainter than the primary. Removing its contribution changes the thermal diameter assigned to Chiminigagua; the combined system size is not the primary’s diameter.', 'https://arxiv.org/abs/1809.02184'],
      ['An intermediate surface color', 'Optical measurements show a moderately red surface. Its color lies between the neutral and very red surfaces often seen among other large trans-Neptunian objects, offering a clue to differing ice and irradiation histories.', 'https://arxiv.org/abs/1809.02184'],
      ['A system still being measured', 'The companion is real, but its size estimate assumes equal albedos. No secure mutual-orbit solution is adopted here, so orbital period, distance and individual mass remain unknown.', 'https://baas.aas.org/pub/2022n8i410p06/release/1'],
    ],
  },
  achlys: {
    introduction: 'is the dwarf-planet candidate formerly designated 2003 AZ84, in Neptune’s 3:2 resonance.',
    topics: [
      ['An uneven, elongated silhouette', 'Occultations show that Achlys is nonspherical. A gradual disappearance along one grazing track is consistent with a deep depression or chasm on the limb, although its exact shape is not uniquely determined.', 'https://arxiv.org/abs/1705.10895'],
      ['A reported faint companion', 'A companion was reported from Hubble images, but its orbit and reliable recovery remain uncertain. The Moons entry keeps that uncertainty explicit and does not invent orbital or physical measurements.', 'https://arxiv.org/abs/1705.10895'],
      ['Size estimates need context', 'A projected occultation diameter changes with viewing geometry and rotation. Thermal estimates also need to account for possible companion light; neither should be treated as a complete map of the body.', 'https://arxiv.org/abs/2605.22296'],
    ],
  },
}

export function smallBodyInfo(id: string): ObjectInfo | undefined {
  const article = articles[id]
  if (!article) return undefined
  const media = smallBodyMedia[id]
  return {
    introduction: { label: media?.name ?? id, text: article.introduction },
    image: media ? { src: media.image, width: media.width, height: media.height, alt: media.description,
      caption: media.caption, credit: media.credit, source: { title: `${media.name}: image and credits`, url: media.source },
      license: media.license ? { title: media.license, url: media.licenseUrl! } : undefined } : undefined,
    sections: article.topics.map(([title, text, url], index) => ({ id: `topic-${index}`, title,
      source: { title: `Source: ${title}`, url }, paragraphs: [{ text }] })),
  }
}
