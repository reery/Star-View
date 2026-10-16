"""Freeze exact-number JPL measurements; never call the API from the application."""
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OBJECTS = {
    'ceres': 1, 'vesta': 4, 'pallas': 2, 'hygiea': 10,
    'pluto': 134340, 'eris': 136199, 'haumea': 136108,
    'makemake': 136472, 'gonggong': 225088, 'quaoar': 50000,
    'orcus': 90482, 'sedna': 90377, 'salacia': 120347,
    'mani': 307261, 'aya': 55565, 'varda': 174567,
    'chiminigagua': 532037, 'achlys': 208996,
}

for object_id, number in OBJECTS.items():
    path = ROOT / f'{object_id}-sbdb.json'
    if not path.exists():
        url = f'https://ssd-api.jpl.nasa.gov/sbdb.api?sstr={number}&phys-par=true&discovery=true&full-prec=true'
        with urllib.request.urlopen(url, timeout=60) as response:
            data = json.load(response)
        assert data['signature']['version'] == '1.3', data['signature']
        assert data['object']['des'] == str(number), data['object']
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')
        time.sleep(0.2)
    data = json.loads(path.read_text())
    print(object_id, data['object']['fullname'], [(p['name'], p['value'], p['sigma']) for p in data.get('phys_par', [])])
