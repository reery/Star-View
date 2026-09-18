import type { Star } from './catalog-model'

export function catalogSelection(stars: readonly Star[], selectedId: string | null, observerId: string) {
  return {
    selectedId: stars.some((star) => star.id === selectedId) ? selectedId : null,
    observerId: stars.some((star) => star.id === observerId) ? observerId : 'sun',
  }
}
