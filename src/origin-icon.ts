import { Target, type IconNode } from 'lucide'

// Keep the outer ring and center circle, omitting the middle ring.
export const OriginIcon: IconNode = Target.filter(([tag, attributes]) => tag !== 'circle' || attributes.r !== '6')
