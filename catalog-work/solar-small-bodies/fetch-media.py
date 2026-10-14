"""Cache archive pages/assets for review; downloaded originals stay outside src."""
import hashlib
import re
import sys
import urllib.request
from pathlib import Path

CACHE = Path('/private/tmp/star-view-small-body-media')
CACHE.mkdir(exist_ok=True)
for url in sys.argv[1:]:
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    target = CACHE / key
    if not target.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'StarViewCatalogResearch/1.0 (astronomy educational app)'})
        with urllib.request.urlopen(request, timeout=60) as response:
            target.write_bytes(response.read())
    print(url, str(target), target.stat().st_size, flush=True)
    if target.read_bytes()[:100].lstrip().startswith(b'<'):
        html = target.read_text(errors='replace')
        links = re.findall(r'(?:href|src|data-src)=[\"\x27]([^\"\x27]+)', html)
        for link in dict.fromkeys(links):
            if re.search(r'\.(?:jpg|jpeg|png|glb|gltf|zip)(?:[?&]|$)', link, re.I):
                print(' ', link, flush=True)
