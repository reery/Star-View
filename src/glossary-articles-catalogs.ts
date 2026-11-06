import { wiki, type GlossaryArticle } from './glossary-index'

export const glossaryArticles: Readonly<Record<string, GlossaryArticle>> = {
  'measurement-uncertainty': {
    also: ['68–95–99.7_rule'],
    source: wiki('Measurement_uncertainty'),
    details: 'No measurement is perfect. An uncertainty is an honest statement of how far off a value could be. A distance written as 100 ± 5 ly means the true value is probably between 95 and 105. A very big uncertainty warns you not to lean on a value too heavily.',
    sections: [
      { title: 'When sources disagree', text: 'Two careful measurements of the same star can still differ, because they use different methods, instruments or assumptions. Comparing them shows whether they agree within their uncertainties. Star View aims for the most recent accurate value, and keeps some source values for comparison.' },
    ],
    deeper: 'Most published values quote one standard deviation (1σ), which covers about 68% of the expected range when errors follow a normal distribution. 2σ covers about 95%. A statistical error can be small while a hidden systematic error remains, so precise is not the same as accurate.',
    related: ['modelled-value', 'parallax', 'gaia'],
  },
  gaia: {
    also: ['https://www.cosmos.esa.int/web/gaia/dr3'],
    source: wiki('Gaia_(spacecraft)'),
    details: 'Launched by the European Space Agency in 2013, Gaia scanned the sky from a point in space 1.5 million km from Earth until 2025. Its measurements turned stellar astronomy upside down, by giving reliable distances for huge numbers of stars for the first time.',
    sections: [
      { title: 'What it measured', text: 'Its third data release, in 2022, covered about 1.81 billion objects. For most it gives positions, parallaxes and motions, along with colors. Its precision reaches a few dozen millionths of an arcsecond for the best-measured stars, about the apparent width of a coin on the Moon seen from Earth.' },
      { title: 'What it changed', text: 'Gaia revealed that the Milky Way swallowed another galaxy about 10 billion years ago, and found the closest known black hole. It is also a key source for the star positions and distances you see in Star View.' },
    ],
    related: ['parallax', 'proper-motion', 'hipparcos', 'passband', 'star-names'],
  },
  hipparcos: {
    also: ['Sirius'],
    source: wiki('Hipparcos'),
    details: 'Launched by the European Space Agency in 1989, Hipparcos was the first space telescope built to measure star positions. Free of Earth’s blurring air, it produced parallaxes for about 118,000 stars, with a precision of about a thousandth of an arcsecond.',
    sections: [
      { title: 'Those HIP numbers', text: 'A label such as HIP 32349 (which is Sirius) means a star’s entry in the Hipparcos Catalogue. Published in 1997, the catalog is still widely used. Star View matches objects across catalogs using these numbers.' },
    ],
    related: ['gaia', 'parallax', 'star-names'],
  },
  'star-names': {
    also: ['Betelgeuse', 'Rigel', 'Bayer_designation', 'Flamsteed_designation'],
    source: wiki('Stellar_designation'),
    details: 'Betelgeuse, Alpha Orionis, 58 Orionis, HR 2061, HD 39801 and HIP 27989 are all one star. Each name comes from a different era or catalog, so they tell you what kind of source a name comes from.',
    sections: [
      { title: 'Old names', text: 'Only a few hundred stars have traditional proper names, many of them Arabic, Greek or Latin. Rigel means “foot”, and Betelgeuse likely comes from an Arabic phrase, “the hand of the giant”. In 2016 the International Astronomical Union began formally approving these names.' },
      { title: 'Letters and numbers', text: 'In 1603, Johann Bayer named stars with Greek letters plus the constellation, such as Alpha Centauri, usually in rough order of brightness. John Flamsteed later added numbers, such as 61 Cygni. Modern catalogs give stars simple numbers by the billion: HD (Henry Draper), HIP (Hipparcos), Gaia DR3 and others.' },
    ],
    deeper: 'Components of a multiple system are marked with letters: Sirius A and Sirius B, or Alpha Centauri A, B and C (Proxima). Planets get lowercase letters, starting at b. Variable stars have their own system (R Leonis, V838 Monocerotis). Don’t trust websites that sell star names: they carry no official recognition.',
    related: ['constellation', 'hipparcos', 'gaia', 'subtype-variable-star'],
  },
  'modelled-value': {
    source: wiki('Stellar_structure'),
    details: 'Some things about a star cannot be measured directly with today’s tools. Often a value can still be calculated, using its other properties and a physical model. Such a value can be useful, but it depends on the model’s assumptions, so it deserves less trust.',
    sections: [
      { title: 'How Star View shows them', text: 'Where no measurement exists, Star View may show a modelled value in grey with a tooltip saying so. It never mixes these with measured fields. For example, a star’s mass may come from models of how it evolves, rather than from an orbit. A newer measurement replaces it once one appears.' },
    ],
    related: ['measurement-uncertainty', 'mass', 'dispersion-measure'],
  },
}
