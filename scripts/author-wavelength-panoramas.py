#!/usr/bin/env python3
"""Author the all-sky panoramas Wavelength vision shows behind the map outside visible light.

Each band's panorama holds two survey maps in Galactic plate carrée, laid out like the visible Milky Way panorama
(Galactic center in the middle, north up, longitude increasing to the left): red is the band's longer-wavelength
map, green its shorter one. The app tints them with the band's false colors. NASA SkyView resamples the surveys;
FITS downloads are cached in catalog-work/downloads/wavelength-panoramas. Encoding to AVIF uses macOS `sips`.

Usage: author-wavelength-panoramas.py [--refresh]
"""

import struct
import subprocess
import sys
import urllib.parse
import urllib.request
import zlib
from pathlib import Path

import numpy as np
from astropy.convolution import Box2DKernel, Gaussian2DKernel, convolve_fft
from astropy.io import fits

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'catalog-work/downloads/wavelength-panoramas'
OUTPUT = ROOT / 'src/assets/wavelength'
SKYVIEW = 'https://skyview.gsfc.nasa.gov/current/cgi/runquery.pl'
WIDTH, HEIGHT = 2048, 1024
AVIF_QUALITY = 55
GAP_MARGIN_PIXELS = 9
POLE_ROWS = 8

# Band: (longer-wavelength survey, shorter-wavelength survey), each as (SkyView name, sampler, smoothing σ in pixels,
# whether exact zeros are scan gaps, noise floor subtracted in the survey's units). Count maps are averaged over each pixel (Clip); smooth maps are interpolated (LI).
# Smoothing removes photon noise finer than the survey's resolution, which also keeps the files small. Blank (NaN)
# pixels, such as the two strips IRAS never observed, are always filled.
BANDS = {
    'gamma': (('Fermi 3', 'Clip', 1.5, False, 0), ('Fermi 5', 'Clip', 1.5, False, 0)),
    'x-ray': (('RASS Background 1', 'LI', 2.5, True, 0), ('RASS Background 6', 'LI', 2.5, True, 0)),
    'far-infrared': (('IRIS 100', 'LI', 0, False, 0), ('IRIS 60', 'LI', 0, False, 0)),
    # CO noise is about 1 K km/s; without a floor, the survey's irregular footprint shows as blocks.
    'radio': (('408MHz', 'LI', 0, False, 0), ('CO', 'LI', 2, False, 3)),
}


def survey_map(survey: str, sampler: str, sigma: float, gaps: bool, noise: float, refresh: bool) -> np.ndarray:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{survey.replace(' ', '-').lower()}.fits"
    if refresh or not path.exists():
        query = urllib.parse.urlencode({
            'Survey': survey, 'Coordinates': 'Galactic', 'Projection': 'Car', 'Position': '0,0',
            'Size': '360,180', 'Pixels': f'{WIDTH},{HEIGHT}', 'Sampler': sampler, 'Return': 'FITS',
        })
        with urllib.request.urlopen(f'{SKYVIEW}?{query}', timeout=600) as response:
            path.write_bytes(response.read())
    with fits.open(path) as hdul:
        header, data = hdul[0].header, hdul[0].data.astype(np.float64)
    if header.get('CTYPE1') != 'GLON-CAR' or not header['CDELT1'] < 0 < header['CDELT2']:
        raise SystemExit(f'{survey}: unexpected projection or orientation')
    # FITS rows run from south to north; images run from the top.
    data = np.flipud(data)
    # The survey's large negative sentinel marks sky it did not cover, which stays empty.
    data[data <= -1e3] = 0
    if noise:
        data = np.maximum(data - noise, 0)
    # Scan gaps, with their noisy low-exposure edges, are filled from the surrounding sky rather than drawn as arcs.
    if gaps:
        data[convolve_fft((data == 0).astype(np.float64), Box2DKernel(GAP_MARGIN_PIXELS), boundary='wrap') > 0.01] = np.nan
    if sigma:
        data = smooth(data, sigma)
    width = max(sigma, 2)
    while np.isnan(data).any():
        data = np.where(np.isnan(data), smooth(data, width), data)
        width *= 2
    # Every pixel of the polar rows samples one point of the sky; resampling leaves them streaked.
    data[:POLE_ROWS] = data[POLE_ROWS].mean()
    data[-POLE_ROWS:] = data[-POLE_ROWS - 1].mean()
    return data


def smooth(data: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussian smoothing over the measured pixels only; pixels with too little data nearby stay blank. Longitude wraps."""
    measured = np.isfinite(data)
    convolved = lambda values: convolve_fft(values, Gaussian2DKernel(sigma), boundary='wrap', normalize_kernel=True)
    weight = convolved(measured.astype(np.float64))
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(weight > 0.05, convolved(np.where(measured, data, 0.0)) / weight, np.nan)


def tone_map(values: np.ndarray, noise: float) -> np.ndarray:
    """
    Logarithmic stretch from the faint background to the brightest regions, like a processed survey image. A map with a
    noise floor covers only part of the sky, so its stretch starts at zero and follows its significant emission.
    """
    positive = values[values > noise]
    knee = np.percentile(positive, 50)
    floor, peak = 0 if noise else np.percentile(positive, 15), np.percentile(positive, 99.8)
    stretch = lambda value: np.log1p(np.maximum(value, 0) / knee)
    scaled = (stretch(values) - stretch(floor)) / (stretch(peak) - stretch(floor))
    # The exponent darkens a sky-wide background toward black; a map starting at zero has none to darken.
    return np.clip(scaled, 0, 1) ** (1 if noise else 1.8)


def write_png(path: Path, red: np.ndarray, green: np.ndarray) -> None:
    pixels = np.stack([red, green, np.zeros_like(red)], axis=-1)
    pixels = np.round(pixels * 255).astype(np.uint8)
    rows = b''.join(b'\x00' + row.tobytes() for row in pixels)
    chunk = lambda kind, body: struct.pack('>I', len(body)) + kind + body + struct.pack('>I', zlib.crc32(kind + body) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', WIDTH, HEIGHT, 8, 2, 0, 0, 0))
                     + chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b''))


def main() -> None:
    refresh = '--refresh' in sys.argv
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for band, (long_survey, short_survey) in BANDS.items():
        png = CACHE / f'{band}.png'
        write_png(png, *(tone_map(survey_map(*survey, refresh), survey[-1]) for survey in (long_survey, short_survey)))
        avif = OUTPUT / f'{band}.avif'
        subprocess.run(['sips', '-s', 'format', 'avif', '-s', 'formatOptions', str(AVIF_QUALITY), str(png), '--out', str(avif)],
                       check=True, capture_output=True)
        print(f'{avif.relative_to(ROOT)}: {avif.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
