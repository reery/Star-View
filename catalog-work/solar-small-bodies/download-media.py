"""Download credited observational images and record original reuse metadata."""
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE=Path(__file__).resolve().parent
CACHE=Path('/private/tmp/star-view-small-body-media')
manifest=json.loads((HERE/'media-review.json').read_text())
manifest['pluto']={'file':'Pluto_in_True_Color_-_High-Res.jpg','commons':'https://commons.wikimedia.org/wiki/File:Pluto_in_True_Color_-_High-Res.jpg'}

def fetch(url):
    target=CACHE/hashlib.sha256(url.encode()).hexdigest()[:16]
    if not target.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'StarViewCatalogResearch/1.0 (educational astronomy app)'})
        with urllib.request.urlopen(req,timeout=60) as response:target.write_bytes(response.read())
    return target

for id,item in manifest.items():
    try:
        if 'original' not in item:
            query=urllib.parse.urlencode(dict(action='query',titles='File:'+item['file'],prop='imageinfo',iiprop='url|extmetadata',format='json'))
            data=json.loads(fetch('https://commons.wikimedia.org/w/api.php?'+query).read_text())
            info=next(iter(data['query']['pages'].values()))['imageinfo'][0]
            item['original']=info['url']
            item['metadata']=info['extmetadata']
        item['original']=item['original'].split('?')[0]
        path=fetch(item['original'])
        item['cachedOriginal']=str(path)
        print(id,path,path.stat().st_size,flush=True)
        (HERE/'media-review.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
        time.sleep(1.2)
    except Exception as error:
        print(id,type(error).__name__,str(error),flush=True)

for id,url in {'pallas':'https://www.eso.org/public/archives/images/large/potw2008a.jpg','hygiea':'https://www.eso.org/public/archives/images/large/eso1918a.jpg'}.items():
    path=fetch(url)
    manifest[id]=dict(original=url,cachedOriginal=str(path),source='https://www.eso.org/public/images/'+('potw2008a/' if id=='pallas' else 'eso1918a/'),credit='ESO/P. Vernazza et al./MISTRAL algorithm (ONERA/CNRS)',license='CC BY 4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/')
    print(id,path,path.stat().st_size,flush=True)
(HERE/'media-review.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
