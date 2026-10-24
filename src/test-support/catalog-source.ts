/** Source CSV of a catalog; retired catalogs remain archived as authoring inputs. */
export function catalogSourceUrl(catalog: string): URL {
  return new URL(catalog === 'bright-stars' ? '../../catalog-work/bright-stars/retired-catalog/stars.csv' : `../data/catalogs/${catalog}/stars.csv`, import.meta.url)
}
