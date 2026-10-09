import { Eye, Target, type IconNode } from 'lucide'

// Keep the outer ring and center circle, omitting the middle ring.
export const OriginIcon: IconNode = Target.filter(([tag, attributes]) => tag !== 'circle' || attributes.r !== '6')

// Pair the observer eye at the top left with the origin mark at the bottom right.
export const ObserverOriginIcon: IconNode = [
  ...Eye.map(([tag, attributes]) => [tag, { ...attributes, transform: 'translate(0 -1.5) scale(0.75)', 'vector-effect': 'non-scaling-stroke' }] as IconNode[number]),
  ...OriginIcon.map(([tag, attributes]) => [tag, { ...attributes, transform: 'translate(10.6 10.6) scale(0.55)', 'vector-effect': 'non-scaling-stroke' }] as IconNode[number]),
]
