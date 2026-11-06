import { note, number, readouts, slider, type WidgetMount } from './glossary-widget'

type Step = readonly [title: string, term?: string]
interface Fate { below: number; kind: string; ending: string; steps: readonly Step[] }

// Boundaries are approximate and shift with composition and rotation; the highest is the least certain.
const FATES: readonly Fate[] = [
  { below: 0.013, kind: 'Planet-mass object', ending: 'Cools forever', steps: [['Collapsing cloud', 'molecular_cloud'], ['Sub-brown dwarf', 'sub_brown_dwarf'], ['Slow cooling']] },
  { below: 0.08, kind: 'Brown dwarf', ending: 'Cools forever', steps: [['Collapsing cloud', 'molecular_cloud'], ['Brown dwarf', 'brown_dwarf'], ['Slow cooling']] },
  { below: 0.5, kind: 'Red dwarf', ending: 'White dwarf, far in the future', steps: [['Young star', 'subtype-pre-main-sequence'], ['Red dwarf', 'star-m'], ['White dwarf', 'white_dwarf']] },
  { below: 8, kind: 'Sun-like star', ending: 'White dwarf', steps: [['Young star', 'subtype-pre-main-sequence'], ['Main sequence', 'subtype-main-sequence'], ['Red giant', 'subtype-red-giant'], ['Planetary nebula', 'planetary_nebula'], ['White dwarf', 'white_dwarf']] },
  { below: 25, kind: 'Massive star', ending: 'Neutron star', steps: [['Young star', 'subtype-pre-main-sequence'], ['Main sequence', 'subtype-main-sequence'], ['Supergiant', 'subtype-supergiant'], ['Supernova', 'supernova'], ['Neutron star', 'neutron_star']] },
  { below: Infinity, kind: 'Very massive star', ending: 'Black hole', steps: [['Young star', 'subtype-pre-main-sequence'], ['Main sequence', 'subtype-main-sequence'], ['Supergiant', 'subtype-supergiant'], ['Collapse', 'supernova'], ['Black hole', 'black_hole']] },
]

function lifetime(mass: number): string {
  if (mass < 0.08) return 'Never fuses hydrogen'
  const years = 1e10 * mass ** -2.5
  return years >= 1e9 ? `About ${number(years / 1e9, 2)} billion years` : `About ${number(years / 1e6, 2)} million years`
}

export const mount: WidgetMount = (host, signal) => {
  const [kind, life, ending] = readouts(host, ['This is a', 'Hydrogen-burning life', 'Ends as'])
  const path = Object.assign(document.createElement('p'), { className: 'glossary-widget-detail glossary-widget-path' })
  const render = (mass: number) => {
    const fate = FATES.find(({ below }) => mass < below)!
    kind!(fate.kind)
    life!(lifetime(mass))
    ending!(fate.ending)
    path.replaceChildren()
    fate.steps.forEach(([title, term], index) => {
      if (index) path.append(' → ')
      if (!term) return void path.append(title)
      const link = Object.assign(document.createElement('button'), { type: 'button', className: 'constellation-info-link', textContent: title })
      link.dataset.glossaryLink = term
      path.append(link)
    })
  }
  slider(host, { label: 'Birth mass', min: 0.01, max: 60, log: true, value: 1, format: (mass) => `${number(mass, 2)} × the Sun`, signal, onInput: render })
  host.append(path)
  note(host, 'Mass at birth decides almost everything. Lifetimes use a rough rule of thumb, and the boundaries are approximate. Companions, rotation and composition can change the outcome.')
  render(1)
}
