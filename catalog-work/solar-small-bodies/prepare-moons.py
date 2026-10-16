"""Pre-crop the four New Horizons moon portraits; retain observational pixels."""
import subprocess
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
source='/private/tmp/star-view-small-body-media/db44dcd28ba1c14f'
for id,x in [('styx',24),('nix',257),('kerberos',498),('hydra',740)]:
    subprocess.run(['sips','--cropToHeightWidth','236','236','--cropOffset','132',str(x),'--setProperty','format','jpeg',source,'--out',str(ROOT/f'src/assets/small-bodies/{id}-photo.jpg')],check=True,capture_output=True)
subprocess.run(['sips','--resampleHeightWidthMax','344','--setProperty','format','jpeg','/private/tmp/star-view-small-body-media/95b1b1a3e8bacb5c','--out',str(ROOT/'src/assets/small-bodies/charon-photo.jpg')],check=True,capture_output=True)
for id in ['eris','haumea','makemake','gonggong','quaoar','orcus','salacia','chiminigagua','achlys']:
    source=ROOT/f'src/assets/small-bodies/{id}-photo.jpg'
    output=ROOT/f'src/assets/small-bodies/{id}-moons-photo.jpg'
    size=subprocess.check_output(['sips','-g','pixelWidth','-g','pixelHeight',str(source)],text=True)
    dimensions=[int(n) for n in re.findall(r'pixel(?:Width|Height): (\d+)',size)]
    cmd=['sips']
    if max(dimensions)>344:cmd+=['--resampleHeightWidthMax','344']
    subprocess.run(cmd+['--setProperty','format','jpeg',str(source),'--out',str(output)],check=True,capture_output=True)
