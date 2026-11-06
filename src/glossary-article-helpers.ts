import type { ObjectType } from './catalog-model'
import type { GlossaryArticle, GlossaryFigure } from './glossary-index'
import { objectTypeIntroduction } from './object-type-info'

/** The photo and credit that the object type card shows for this kind of object. */
export function objectFigure(type: ObjectType, spectral_type: string | null = null): GlossaryFigure {
  const { image, caption, imagePosition, imageCredit, imageSource } = objectTypeIntroduction({ type, spectral_type })
  return { image, caption, position: imagePosition, credit: imageCredit, creditUrl: imageSource }
}

type Reference = NonNullable<GlossaryArticle['reference']>
export const simbad = (code: string): Reference => ({ label: 'Class definition: SIMBAD', url: `https://simbad.cds.unistra.fr/simbad/otypes#${encodeURIComponent(code)}` })
export const AAVSO: Reference = { label: 'Class definition: AAVSO', url: 'https://vsx.aavso.org/index.php?view=about.vartypes' }
export const NASA_STAR_TYPES: Reference = { label: 'Star types: NASA', url: 'https://science.nasa.gov/universe/stars/types/' }
export const IPAC_DWARFS: Reference = { label: 'L and T dwarfs: IPAC', url: 'https://www.ipac.caltech.edu/2mass/overview/dwarfs.html' }
export const STSCI_CLASSES: Reference = { label: 'Spectral classes: STScI', url: 'https://archive.stsci.edu/spec_class/spec_class_tables.html' }
