import { smallBodyMedia } from './small-body-media'
import charon from './assets/small-bodies/charon-photo.jpg'
import styx from './assets/small-bodies/styx-photo.jpg'
import nix from './assets/small-bodies/nix-photo.jpg'
import kerberos from './assets/small-bodies/kerberos-photo.jpg'
import hydra from './assets/small-bodies/hydra-photo.jpg'
import eris from './assets/small-bodies/eris-moons-photo.jpg'
import haumea from './assets/small-bodies/haumea-moons-photo.jpg'
import makemake from './assets/small-bodies/makemake-moons-photo.jpg'
import gonggong from './assets/small-bodies/gonggong-moons-photo.jpg'
import quaoar from './assets/small-bodies/quaoar-moons-photo.jpg'
import orcus from './assets/small-bodies/orcus-moons-photo.jpg'
import salacia from './assets/small-bodies/salacia-moons-photo.jpg'
import chiminigagua from './assets/small-bodies/chiminigagua-moons-photo.jpg'
import achlys from './assets/small-bodies/achlys-moons-photo.jpg'

interface Photograph { readonly image: string; readonly description: string; readonly credit: string }
const newHorizonsCredit = 'NASA / JHUAPL / SwRI · New Horizons, July 2015. Individual crop from “Charon and the Small Moons of Pluto” (October 22, 2015), https://www.nasa.gov/image-article/charon-small-moons-of-pluto/ . Monochrome spacecraft image; no added color or terrain.'
const systems: Readonly<Record<string, string>> = { eris, haumea, makemake, gonggong, quaoar, orcus, salacia, chiminigagua, achlys }
export const smallBodyMoonPhotographs: Readonly<Record<string, Photograph>> = {
  charon: { image: charon, description: 'Charon in approximate natural color, showing its dark reddish north polar region and pale fractured surface.',
    credit: 'NASA / JHUAPL / SwRI / Alex Parker. New Horizons MVIC, July 14, 2015; refined natural-color calibration released in 2018. https://science.nasa.gov/resource/true-colors-of-charon/ . Public domain; reduced to 344 px.' },
  ...Object.fromEntries(Object.entries({ styx, nix, kerberos, hydra }).map(([id, image]) => [id, {
    image, description: `New Horizons monochrome observation of ${id[0]!.toUpperCase()}${id.slice(1)}; its irregular outline is shown at the spacecraft’s available resolution.`, credit: newHorizonsCredit,
  }])),
  ...Object.fromEntries([
    ['dysnomia', 'eris', 'Dysnomia with the much brighter Eris in a Hubble telescope observation. Neither surface is resolved.'],
    ['namaka', 'haumea', 'Haumea and its satellites in a Hubble observation. Namaka is a faint companion; no surface is resolved.'],
    ['hiiaka', 'haumea', 'Haumea and its satellites in a Hubble observation. Hiʻiaka is a faint companion; no surface is resolved.'],
    ['mk2', 'makemake', 'Makemake and its faint moon MK2 in a Hubble observation. The moon appears close above the bright primary; the surfaces are unresolved.'],
    ['xiangliu', 'gonggong', 'Hubble observation of Gonggong and its faint companion Xiangliu. Neither surface is resolved.'],
    ['weywot', 'quaoar', 'Hubble observation of Quaoar and its faint moon Weywot. Neither surface is resolved.'],
    ['vanth', 'orcus', 'Hubble observation of Orcus and its companion Vanth. Neither surface is resolved.'],
    ['actaea', 'salacia', 'Keck/NIRC2 infrared observation of Salacia and Actaea, shown in monochrome. Neither surface is resolved.'],
    ['chiminigagua-companion', 'chiminigagua', 'Hubble observation of Chiminigagua and its unnamed faint companion at upper right. Neither surface is resolved.'],
    ['achlys-companion', 'achlys', 'Hubble image of Achlys and the reported faint companion. Companion status and orbit remain uncertain.'],
  ].map(([id, host, description]) => [id!, { image: systems[host!]!, description: description!, credit: smallBodyMedia[host!]!.credit }])),
}
