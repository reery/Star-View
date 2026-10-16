"""Prepare local photographic assets, without synthesizing color or terrain."""
import html
import json
import re
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
manifest=json.loads((HERE/'media-review.json').read_text())
bodies={b['id']:b for b in json.loads((ROOT/'src/data/solar-small-bodies.json').read_text())['objects']}
NOTES={
 'ceres': ('Dawn · approximate natural color', 'Dawn’s approximate true-color portrait of Ceres, with Haulani crater at right.', 'NASA / JPL-Caltech / UCLA / MPS / DLR / IDA / Justin Cowart. Dawn, May 4, 2015; visible-filter color projected onto a clear-filter photograph.'),
 'vesta': ('Dawn · natural color', 'Vesta’s irregular, cratered shape in approximate natural color from Dawn.', 'NASA / JPL / MPS / DLR / IDA / Björn Jónsson. Dawn, July 24, 2011; approximate natural-color processing.'),
 'pluto': ('New Horizons · natural color', 'Pluto’s bright icy heart and tan surface in the recalibrated natural-color New Horizons portrait.', 'NASA / JHUAPL / SwRI / Alex Parker. July 14, 2015 data, recalibrated and released in 2018 to approximate human-visible color.'),
 'pallas': ('VLT / SPHERE · monochrome', 'A processed VLT/SPHERE observation showing Pallas’s heavily cratered, irregular shape.', 'ESO / P. Vernazza et al. / MISTRAL algorithm (ONERA/CNRS). 2020 release. Left observation cropped from the published pair; single-band processed telescope image, not true-color photography.'),
 'hygiea': ('VLT / SPHERE · monochrome', 'A processed single-band VLT/SPHERE observation of Hygiea’s rounded disk.', 'ESO / P. Vernazza et al. / MISTRAL algorithm (ONERA/CNRS). 2019 release; 645-nm R-band image. Cropped to the body and surrounding black space; no surface color added.'),
 'salacia': ('Keck / NIRC2 · infrared, monochrome', 'Keck/NIRC2 infrared observation of Salacia and the fainter companion Actaea; the surfaces are unresolved.', 'William Grundy / Keck Observatory Archive / W. M. Keck Observatory / NExScI (JPL-Caltech). Infrared observation shown in grayscale; not a true-color portrait.'),
}
FALLBACK_CREDITS={
 'aya':'Michael E. Brown / STScI / NASA; processing by Nrco0e.',
 'mani':'Michael E. Brown / STScI / NASA.',
 'chiminigagua':'Scott S. Sheppard / NASA / ESA / STScI; processing by Nrco0e.',
 'quaoar':'NASA / ESA / Hubble / Michael E. Brown; archival processing by Nrco0e.',
}
def plain(value):return html.unescape(re.sub('<[^>]+>','',value)).strip()
imports=[]
entries={}
readme=['# Small-body imagery', '', 'All assets are observational. No generated terrain, invented surface color or stretched partial photographs. Main photographs are capped at 836 px on the longest side, without upscaling; moon-only crops are capped at 418 × 344 px. Low-resolution telescope detections remain unresolved.', '']
for id,body in bodies.items():
    item=manifest[id]
    source=Path(item['cachedOriginal'])
    image=ROOT/f'src/assets/small-bodies/{id}-photo.jpg'
    cmd=['sips']
    if id=='pallas':cmd+=['--cropToHeightWidth','768','768','--cropOffset','0','0']
    if id=='hygiea':cmd+=['--cropToHeightWidth','1400','1400','--cropOffset','101','545']
    cmd+=['--setProperty','format','jpeg','--setProperty','formatOptions','88',str(source),'--out',str(image)]
    subprocess.run(cmd,check=True,capture_output=True)
    originalSize=subprocess.check_output(['sips','-g','pixelWidth','-g','pixelHeight',str(image)],text=True)
    dimensions=[int(n) for n in re.findall(r'pixel(?:Width|Height): (\d+)',originalSize)]
    if max(dimensions)>836:
        subprocess.run(['sips','--resampleHeightWidthMax','836',str(image)],check=True,capture_output=True)
    output=subprocess.check_output(['sips','-g','pixelWidth','-g','pixelHeight',str(image)],text=True)
    width=int(re.search(r'pixelWidth: (\d+)',output)[1]);height=int(re.search(r'pixelHeight: (\d+)',output)[1])
    meta=item.get('metadata',{})
    caption,description,credit=NOTES.get(id,('Hubble · unresolved telescope image', f'Hubble observation of {body["name"]}; the body’s surface is unresolved. Monochrome observation, not a true-color surface image.', plain(meta.get('Artist',{}).get('value','')) or FALLBACK_CREDITS.get(id,'NASA / ESA / STScI.')))
    if id in ['aya','mani']:credit+=' Published archival image enlarged from its original detector pixels; no additional detail or color is inferred.'
    if id=='gonggong':description='Hubble image of Gonggong and its faint moon Xiangliu. Monochrome telescope observation; neither surface is resolved.'
    if id=='chiminigagua':description='Hubble observation of Chiminigagua and its faint companion at upper right, January 15, 2018. Monochrome; the surfaces are unresolved.'
    license=item.get('license') or meta.get('LicenseShortName',{}).get('value','Public domain')
    licenseUrl=item.get('licenseUrl') or meta.get('LicenseUrl',{}).get('value','https://www.nasa.gov/nasa-brand-center/images-and-media/')
    entry=dict(name=body['name'],width=width,height=height,caption=caption,description=description,credit=credit,source=item.get('source') or item['commons'],license=license,licenseUrl=licenseUrl)
    entries[id]=entry
    imports.append(f"import {id}Photo from './assets/small-bodies/{id}-photo.jpg'")
    readme += [f'## {body["name"]}', '', f'- `{id}-photo.jpg`: {width} × {height}; {caption}.', f'- {credit}', f'- Source: {entry["source"]}', f'- Original: {item["original"]}', f'- Reuse: {license} ({licenseUrl}).', '']
lines=imports+['', 'export interface SmallBodyMedia {', '  readonly image: string', '  readonly name: string', '  readonly width: number', '  readonly height: number', '  readonly caption: string', '  readonly description: string', '  readonly credit: string', '  readonly source: string', '  readonly license?: string', '  readonly licenseUrl?: string', '}', '', 'export const smallBodyMedia: Readonly<Record<string, SmallBodyMedia>> = {']
for id,entry in entries.items():
    fields=json.dumps(entry,ensure_ascii=False)[1:-1]
    lines.append(f'  {id}: {{ image: {id}Photo, {fields} }},')
lines+=['}', '']
(ROOT/'src/small-body-media.ts').write_text('\n'.join(lines))
readme+=['## Pluto globe', '', '`pluto-map.jpg` (2048 × 1024): NASA/VTAD Pluto model texture, extracted from `Pluto_1_2374.glb`. Approximate visible color from New Horizons observations; non-encounter hemisphere is much less resolved. The unobserved southern cap is masked to plain gray in the renderer rather than presenting the model’s interpolation as measured terrain. Lighting and orientation are illustrative. Model: https://science.nasa.gov/resource/pluto-3d-model/ . NASA image use: https://www.nasa.gov/nasa-brand-center/images-and-media/ .', '']
(ROOT/'src/assets/small-bodies/README.md').write_text('\n'.join(readme))
print(f'Prepared {len(entries)} credited photographs.')
