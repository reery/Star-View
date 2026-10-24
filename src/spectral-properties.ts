import { STELLAR_OBJECT_TYPES, type Star } from './catalog-model'

export function hrCardAvailable(star: Pick<Star, 'type'>): boolean {
  return STELLAR_OBJECT_TYPES.some((type) => type === star.type)
}

export function spectralReference(origin: Star, sun: Star): Star {
  return STELLAR_OBJECT_TYPES.some((type) => type === origin.type) ? origin : sun
}

