"""Author the constellation Info schematics from the bundled chart positions.

Run: python3 scripts/author-constellation-diagrams.py
"""
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'src/assets/constellations'
OUT.mkdir(exist_ok=True)
BG, INK, MUTED, LINE, ACCENT, BLUE, RED = '#101112', '#ded8ce', '#a5a29e', '#77736e', '#ffba68', '#8da9d6', '#e0805c'

charts = {}
def chart(slug):
    if slug not in charts: charts[slug] = json.loads((ROOT / f'src/data/constellations/{slug}.json').read_text())
    return charts[slug]
def star(slug, name):
    s = next(s for s in chart(slug)['stars'] if s['name'] == name)
    return s
def pos(slug, name):
    s = star(slug, name); return (s['ra_deg'], s['dec_deg'])

def project(p, c):
    r = math.pi / 180
    d = (p[0] - c[0]) * r; dec, dec0 = p[1] * r, c[1] * r
    den = math.sin(dec0) * math.sin(dec) + math.cos(dec0) * math.cos(dec) * math.cos(d)
    return (-math.cos(dec) * math.sin(d) / den, -(math.cos(dec0) * math.sin(dec) - math.sin(dec0) * math.cos(dec) * math.cos(d)) / den)

class Sky:
    """Fits projected sky positions into an SVG frame; north up, east left."""
    def __init__(self, center, points, w=840, h=480, pad=56, top=0):
        self.c, self.w, self.h = center, w, h
        xy = [project(p, center) for p in points]
        xs, ys = [p[0] for p in xy], [p[1] for p in xy]
        self.s = min((w - 2 * pad) / (max(xs) - min(xs)), (h - top - 2 * pad) / (max(ys) - min(ys)))
        self.ox = w / 2 - self.s * (max(xs) + min(xs)) / 2
        self.oy = top + (h - top) / 2 - self.s * (max(ys) + min(ys)) / 2
    def __call__(self, p):
        x, y = project(p, self.c); return (round(self.ox + self.s * x, 1), round(self.oy + self.s * y, 1))

def r_mag(m): return round(max(2.6, 9.5 - 1.7 * m), 1)
def dot(p, m, color=INK): return f'<circle cx="{p[0]}" cy="{p[1]}" r="{r_mag(m)}" fill="{color}"/>'
def label(p, text, dx=12, dy=-10, anchor='start', color=INK, size=24):
    return f'<text x="{round(p[0] + dx, 1)}" y="{round(p[1] + dy, 1)}" text-anchor="{anchor}" fill="{color}" font-size="{size}">{text}</text>'
def line(a, b, color=LINE, width=2, dash=None, arrow=False):
    d = f' stroke-dasharray="{dash}"' if dash else ''
    m = ' marker-end="url(#arrow)"' if arrow else ''
    return f'<path d="M{a[0]} {a[1]}L{b[0]} {b[1]}" stroke="{color}" stroke-width="{width}"{d}{m} fill="none"/>'
def extend(a, b, t): return (round(a[0] + (b[0] - a[0]) * t, 1), round(a[1] + (b[1] - a[1]) * t, 1))
def figure(sky, slug, names=None, color=LINE, width=2):
    stars = {s['hip']: s for s in chart(slug)['stars']}
    out = []
    for a, b in chart(slug)['lines']:
        if names and not (stars[a]['name'] in names and stars[b]['name'] in names): continue
        out.append(line(sky((stars[a]['ra_deg'], stars[a]['dec_deg'])), sky((stars[b]['ra_deg'], stars[b]['dec_deg'])), color, width))
    return out
def stars_of(sky, slug, names=None, color=INK):
    return [dot(sky((s['ra_deg'], s['dec_deg'])), s['magnitude_v'], color) for s in chart(slug)['stars'] if not names or s['name'] in names]

def write(name, title, desc, body, w=840, h=480):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">{desc}</desc>
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{ACCENT}"/></marker></defs>
  <rect width="{w}" height="{h}" fill="{BG}"/>
  <g font-family="system-ui, sans-serif">
    {chr(10).join('    ' + part for part in body).strip()}
  </g>
</svg>
'''
    (OUT / f'{name}.svg').write_text(svg)

# Orion as a signpost: the belt points to Sirius one way and Aldebaran and the Pleiades the other.
pleiades = (56.75, 24.12)
pts = [pos('orion', n) for n in ['Betelgeuse', 'Rigel', 'Bellatrix', 'Saiph', 'Heka']] + [pos('taurus', 'Aldebaran'), pleiades, pos('canis-major', 'Sirius')]
sky = Sky((80, 4), pts)
belt = [sky(pos('orion', n)) for n in ['Alnitak', 'Alnilam', 'Mintaka']]
ald, ple, sir = sky(pos('taurus', 'Aldebaran')), sky(pleiades), sky(pos('canis-major', 'Sirius'))
body = figure(sky, 'orion', ['Betelgeuse', 'Bellatrix', 'Rigel', 'Saiph', 'Alnitak', 'Alnilam', 'Mintaka', 'Heka'])
body += [line(belt[2], extend(belt[2], ald, 0.93), ACCENT, 2.5, '9 8', True), line(ald, extend(ald, ple, 0.9), ACCENT, 2.5, '9 8', True),
         line(belt[0], extend(belt[0], sir, 0.95), ACCENT, 2.5, '9 8', True)]
body += stars_of(sky, 'orion', ['Betelgeuse', 'Bellatrix', 'Rigel', 'Saiph', 'Alnitak', 'Alnilam', 'Mintaka', 'Heka'])
body += [dot(sky(pos('orion', 'Betelgeuse')), 0.5, RED), dot(sky(pos('orion', 'Rigel')), 0.2, BLUE), dot(ald, 0.9, '#f0a868'), dot(sir, -1.4, '#dfe8ff')]
body += [f'<circle cx="{ple[0] + dx}" cy="{ple[1] + dy}" r="3" fill="{BLUE}"/>' for dx, dy in [(0, 0), (-9, -5), (8, -7), (-4, 8), (10, 6), (-13, 4)]]
body += [label(sky(pos('orion', 'Betelgeuse')), 'Betelgeuse', -16, 8, 'end'), label(sky(pos('orion', 'Rigel')), 'Rigel', 16, 10),
         label(belt[1], 'Belt', -22, 22, 'end', MUTED), label(ald, 'Aldebaran', -16, 6, 'end'), label(ple, 'Pleiades', 0, -22, 'middle'),
         label(sir, 'Sirius', 0, 36, 'middle')]
write('orion-signpost', 'Orion’s Belt as a signpost',
      'Orion’s three belt stars point southeast to Sirius and northwest to Aldebaran and the Pleiades. Positions are projected from catalogue coordinates, north up and east left.', body)

# Big Dipper pointers to Polaris and the arc of the handle to Arcturus.
dip = ['Dubhe', 'Merak', 'Phecda', 'Megrez', 'Alioth', 'Mizar', 'Alcaid']
arcturus = (213.915, 19.182)
pts = [pos('ursa-major', n) for n in dip] + [pos('ursa-minor', 'Polaris'), arcturus]
sky = Sky((170, 62), pts)
dub, mer, pol, arc = sky(pos('ursa-major', 'Dubhe')), sky(pos('ursa-major', 'Merak')), sky(pos('ursa-minor', 'Polaris')), sky(arcturus)
body = figure(sky, 'ursa-major', dip) + figure(sky, 'ursa-minor')
body += [line(dub, extend(dub, pol, 0.94), ACCENT, 2.5, '9 8', True)]
mz, al = sky(pos('ursa-major', 'Mizar')), sky(pos('ursa-major', 'Alcaid'))
ctrl = extend(mz, al, 4.2)
body += [f'<path d="M{al[0] + 6} {al[1] + 8}Q{ctrl[0]} {ctrl[1]} {arc[0] + 10} {arc[1] - 16}" stroke="{ACCENT}" stroke-width="2.5" stroke-dasharray="9 8" fill="none" marker-end="url(#arrow)"/>']
body += stars_of(sky, 'ursa-major', dip) + stars_of(sky, 'ursa-minor') + [dot(arc, -0.05, '#f0a868')]
body += [label(dub, 'Dubhe', 0, -18, 'middle'), label(mer, 'Merak', 12, 30), label(pol, 'Polaris', 14, -12),
         label(al, 'Alkaid', -6, -16, 'end'), label(arc, 'Arcturus', -16, 8, 'end'), label(mz, 'Mizar', -2, -14, 'middle', MUTED, 20),
         label(sky(pos('ursa-major', 'Megrez')), 'Big Dipper', -10, 76, 'middle', MUTED), label(sky(pos('ursa-minor', 'Kochab')), 'Little Dipper', 0, 34, 'middle', MUTED)]
write('big-dipper-pointers', 'Following the Big Dipper', 'A line from Merak through Dubhe leads to Polaris; the curve of the handle arcs to Arcturus. Positions are projected from catalogue coordinates, north up and east left.', body)

# Precession: the north celestial pole circles the ecliptic pole every 25,800 years.
nep = (270.0, 66.5607)
sky = Sky(nep, [(270 + 23.44 * math.sin(a / 8 * math.pi * 2) / math.cos(math.radians(66.56)), 66.56 + 23.44 * math.cos(a / 8 * math.pi * 2)) for a in range(8)]
          + [pos('lyra', 'Vega'), pos('draco', 'Thuban')], w=840, pad=70)
c = sky(nep)
# The pole circle is a small circle; sample it in true angle from the ecliptic pole.
def offset(center, dist, bearing):
    la, lo, d, b = math.radians(center[1]), math.radians(center[0]), math.radians(dist), math.radians(bearing)
    lat = math.asin(math.sin(la) * math.cos(d) + math.cos(la) * math.sin(d) * math.cos(b))
    lon = lo + math.atan2(math.sin(b) * math.sin(d) * math.cos(la), math.cos(d) - math.sin(la) * math.sin(lat))
    return (math.degrees(lon), math.degrees(lat))
ring = [sky(offset(nep, 23.44, a)) for a in range(0, 361, 4)]
body = [f'<path d="M{" L".join(f"{x} {y}" for x, y in ring)}" fill="none" stroke="{LINE}" stroke-width="2" stroke-dasharray="6 8"/>']
body += figure(sky, 'ursa-minor')
ncp = sky((0, 90))
pol, thu, vega, deneb, errai = sky(pos('ursa-minor', 'Polaris')), sky(pos('draco', 'Thuban')), sky(pos('lyra', 'Vega')), sky(pos('cygnus', 'Deneb')), sky(pos('cepheus', 'Gamma Cephei A'))
body += stars_of(sky, 'ursa-minor') + [dot(thu, 3.7), dot(vega, 0.0, '#dfe8ff'), dot(deneb, 1.25), dot(errai, 3.2)]
body += [f'<circle cx="{ncp[0]}" cy="{ncp[1]}" r="12" fill="none" stroke="{ACCENT}" stroke-width="2.5"/>',
         f'<path d="M{c[0] - 7} {c[1]}h14M{c[0]} {c[1] - 7}v14" stroke="{MUTED}" stroke-width="2"/>']
body += [label(pol, 'Polaris · today', 30, 2), label(thu, 'Thuban · 2700 BC', 0, 32, 'middle'), label(errai, 'Errai · AD 4000', -14, 6, 'end'),
         label(deneb, 'Deneb · AD 10,000', 0, -18, 'middle', MUTED), label(vega, 'Vega · AD 14,000', 0, 34, 'middle'),
         label(c, 'Ecliptic pole', 0, 30, 'middle', MUTED, 20)]
# Arrow shows the pole drifting from Polaris toward Cepheus.
arc_pts = [sky(offset(nep, 23.44, a)) for a in range(20, 52, 4)]
body += [f'<path d="M{" L".join(f"{x} {y}" for x, y in arc_pts)}" fill="none" stroke="{ACCENT}" stroke-width="3" marker-end="url(#arrow)"/>']
write('pole-precession', 'The wandering north celestial pole',
      'Over about 26,000 years, Earth’s axis traces a circle around the ecliptic pole. The pole lay near Thuban when the pyramids were built, is near Polaris today, and will pass Errai, Deneb and Vega. Positions are projected from catalogue coordinates; stars do not lie exactly on the circle.', body)

# Crux and the Pointers locate the south celestial pole.
acr, gac = pos('crux', 'Acrux'), pos('crux', 'Gacrux')
alc, bec = pos('centaurus', 'Rigel Kentaurus'), pos('centaurus', 'Agena')
scp = (0, -90)
sky = Sky((200, -74), [acr, gac, alc, bec, scp, pos('crux', 'Mimosa'), pos('crux', 'Imai')], pad=60)
A, G, P1, P2, S = sky(acr), sky(gac), sky(alc), sky(bec), sky(scp)
mid = ((P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2)
body = figure(sky, 'crux')
body += [line(A, extend(G, A, 0.97 * math.dist(G, S) / math.dist(G, A)), ACCENT, 2.5, '9 8', True),
         line(P1, P2, LINE, 2), line((round(mid[0], 1), round(mid[1], 1)), extend(mid, S, 0.96), ACCENT, 2.5, '9 8', True)]
body += [f'<ellipse cx="{sky((191.0, -62.8))[0]}" cy="{sky((191.0, -62.8))[1]}" rx="30" ry="22" fill="#000" stroke="{LINE}" stroke-dasharray="3 5"/>']
body += stars_of(sky, 'crux') + [dot(P1, -0.1, '#f6e8b8'), dot(P2, 0.6, BLUE)]
body += [f'<circle cx="{S[0]}" cy="{S[1]}" r="12" fill="none" stroke="{ACCENT}" stroke-width="2.5"/>']
coal = sky((191.0, -62.8))
body += [label(A, 'Acrux', 14, 14), label(G, 'Gacrux', 14, -6), label(P1, 'Alpha Centauri', 0, 38, 'middle'), label(P2, 'Hadar', 0, -20, 'middle'),
         label(S, 'South celestial pole', 0, 40, 'middle'), label(coal, 'Coalsack', 0, 46, 'middle', MUTED, 20)]
write('southern-pole', 'Finding the south celestial pole',
      'Extending the long bar of the Southern Cross, and the perpendicular through the middle of the Pointers Alpha Centauri and Hadar, leads to the south celestial pole. The dark Coalsack lies beside the Cross. Positions are projected from catalogue coordinates, north up and east left.', body)

# The Summer Triangle: similar-looking stars at very different distances.
vega, deneb, altair = pos('lyra', 'Vega'), pos('cygnus', 'Deneb'), (297.6958, 8.8683)
sky = Sky((296, 28), [vega, altair] + [(s['ra_deg'], s['dec_deg']) for s in chart('cygnus')['stars']], pad=40)
V, D, Al = sky(vega), sky(deneb), sky(altair)
body = [f'<path d="M{V[0]} {V[1]}L{D[0]} {D[1]}L{Al[0]} {Al[1]}Z" fill="{ACCENT}" fill-opacity="0.06" stroke="{ACCENT}" stroke-width="2" stroke-dasharray="9 8"/>']
body += figure(sky, 'cygnus') + figure(sky, 'lyra')
body += stars_of(sky, 'cygnus') + stars_of(sky, 'lyra') + [dot(Al, 0.76), dot(V, 0.0, '#dfe8ff'), dot(D, 1.25, '#f3f3ff')]
body += [label(V, 'Vega · 25 ly', 18, -10), label(D, 'Deneb · 1,400 ly', 16, -14), label(Al, 'Altair · 17 ly', 16, 8),
         label(sky(pos('cygnus', 'Albereo')), 'Albireo', 14, 22, color=MUTED, size=20)]
write('summer-triangle', 'The Summer Triangle',
      'Vega in Lyra, Deneb in Cygnus and Altair in Aquila form the Summer Triangle. Vega and Altair are nearby, while Deneb is about 1,400 light-years away. Positions are projected from catalogue coordinates, north up and east left.', body)

# Antares at the Sun's position, compared with the planets' orbits.
AU = 215.032
radius = star('scorpius', 'Antares')['object']['radius_solar'] / AU
cx, cy, k = 60, 420, 72
R = radius * k
body = [f'<defs><radialGradient id="antares" cx="0" cy="1" r="1"><stop stop-color="#ff9a62"/><stop offset="0.75" stop-color="#c8462c"/><stop offset="1" stop-color="#7a2418"/></radialGradient></defs>',
        f'<path d="M{cx} {cy}V{cy - R:.1f}A{R:.1f} {R:.1f} 0 0 1 {cx + R:.1f} {cy}Z" fill="url(#antares)"/>',
        f'<path d="M{cx} {cy}H{800}" stroke="{LINE}" stroke-width="1.5"/>']
for name, a in [('Mercury', 0.387), ('Venus', 0.723), ('Earth', 1.0), ('Mars', 1.524), ('Jupiter', 5.203)]:
    rr = a * k
    body.append(f'<path d="M{cx} {cy - rr:.1f}A{rr:.1f} {rr:.1f} 0 0 1 {cx + rr:.1f} {cy}" fill="none" stroke="{INK}" stroke-width="1.6" stroke-dasharray="6 6" stroke-opacity="0.8"/>')
    if name in ('Mars', 'Jupiter'): body.append(label((cx + rr, cy), name, 0, 30, 'middle', INK, 20))
body += [f'<circle cx="{cx}" cy="{cy}" r="4" fill="#fff3c4"/>', label((cx, cy), 'Sun', 0, 30, 'middle', '#fff3c4', 20),
         label((cx, cy - R), f'Antares · {radius:.1f} AU radius', 10, -16, 'start', INK, 22),
         f'<text x="800" y="{cy - 20}" text-anchor="end" fill="{MUTED}" font-size="18">1 AU = Earth–Sun distance</text>']
write('antares-scale', 'Antares in place of the Sun',
      f'A quarter of Antares, drawn at the Sun’s position with its catalogue radius of about {radius:.1f} astronomical units, would extend past the orbit of Mars. Planet orbits are drawn as circles to the same scale.', body)

# Sagittarius: the Teapot points to the Galactic Centre.
tea = ['Kaus Australis', 'Kaus Media', 'Kaus Borealis', 'Alnasl', 'Phi Sgr', 'Nunki', 'Tau Sgr', 'Ascella']
gc = (266.4168, -29.0078)
sky = Sky((276, -29), [pos('sagittarius', n) for n in tea] + [gc])
body = figure(sky, 'sagittarius', tea, ACCENT, 2.2) + stars_of(sky, 'sagittarius', tea)
G = sky(gc)
spout = sky(pos('sagittarius', 'Alnasl'))
body += [line(spout, extend(spout, G, 0.9), MUTED, 2, '7 7', True)]
body += [f'<circle cx="{G[0]}" cy="{G[1]}" r="{r}" fill="#ffd9a0" fill-opacity="{o}"/>' for r, o in [(34, 0.08), (20, 0.14), (9, 0.4)]]
body += [f'<circle cx="{G[0]}" cy="{G[1]}" r="3.5" fill="#fff"/>']
body += [label(G, 'Galactic Centre · Sgr A*', 40, -44, 'end'), label(G, '~26,000 ly', 0, 54, 'middle', MUTED, 20),
         label(sky(pos('sagittarius', 'Kaus Borealis')), 'Lid', 0, -18, 'middle', MUTED, 20), label(spout, 'Spout', 0, 34, 'middle', MUTED, 20),
         label(sky(pos('sagittarius', 'Nunki')), 'Handle', 14, -10, 'start', MUTED, 20), label(sky(pos('sagittarius', 'Kaus Australis')), 'Kaus Australis', 0, 32, 'middle')]
write('sagittarius-teapot', 'The Teapot and the Galactic Centre',
      'The brightest stars of Sagittarius form a teapot whose spout points toward the centre of the Milky Way and its black hole Sagittarius A*, about 26,000 light-years away. Positions are projected from catalogue coordinates, north up and east left.', body)

# Taurus in depth: Aldebaran is a foreground star in front of the Hyades.
items = [('Aldebaran', pos('taurus', 'Aldebaran'), 67, '#f0a868', (-16, 8, 'end')), ('Hyades', (66.75, 15.87), 153, '#ffd9a0', (16, 8, 'start')), ('Pleiades', pleiades, 444, BLUE, (0, -18, 'middle'))]
# Uniform sky scale that fits the three objects inside the upper strip.
xy = {name: project(p, (62, 18)) for name, p, _, _, _ in items}
k = min(520 / (max(x for x, _ in xy.values()) - min(x for x, _ in xy.values())), 130 / (max(y for _, y in xy.values()) - min(y for _, y in xy.values())))
mx, my = sum(x for x, _ in xy.values()) / 3, sum(y for _, y in xy.values()) / 3
sky = lambda p: (round(420 + k * (project(p, (62, 18))[0] - mx), 1), round(140 + k * (project(p, (62, 18))[1] - my), 1))
body = [f'<text x="24" y="40" fill="{MUTED}" font-size="20">As seen from Earth</text>', f'<text x="24" y="290" fill="{MUTED}" font-size="20">Distance from Earth</text>',
        f'<path d="M60 370H800" stroke="{LINE}" stroke-width="2"/>']
for ly in range(0, 501, 100):
    x = 60 + ly / 500 * 740
    body += [f'<path d="M{x:.1f} 364v12" stroke="{LINE}" stroke-width="2"/>', f'<text x="{x:.1f}" y="402" text-anchor="middle" fill="{MUTED}" font-size="18">{ly} ly</text>']
for name, p, ly, color, dy in items:
    sx, sy = sky(p)
    x = 60 + ly / 500 * 740
    body += [line((sx, sy), (round(x, 1), 356), LINE, 1.4, '4 6'), f'<circle cx="{sx}" cy="{sy}" r="7" fill="{color}"/>', f'<circle cx="{x:.1f}" cy="370" r="8" fill="{color}"/>',
             label((sx, sy), name, *dy), label((x, 370), f'{ly} ly', 0, -16, 'middle', INK, 20)]
body.append(f'<text x="60" y="344" text-anchor="middle" fill="{MUTED}" font-size="18">Earth</text>')
write('taurus-depth', 'Taurus in depth',
      'Aldebaran appears to sit in the V-shaped Hyades cluster, but it is less than half as far away. The Pleiades are nearly three times more distant than the Hyades. Sky positions are projected from catalogue coordinates; distances are drawn to scale.', body)

# Andromeda: star-hop from Mirach to the Andromeda Galaxy.
m31 = (10.6847, 41.2690)
sky = Sky((8, 35), [pos('andromeda', n) for n in ['Sirrah', 'Mirach', 'Almach', 'Delta And', 'Nu And']] + [m31], h=480)
M = sky(m31)
body = figure(sky, 'andromeda')
mir, mu, nu = sky(pos('andromeda', 'Mirach')), sky(pos('andromeda', 'Mu And')), sky(pos('andromeda', 'Nu And'))
body += [line(mir, mu, ACCENT, 2.5, '9 8'), line(mu, extend(mu, M, 0.9), ACCENT, 2.5, '9 8', True)]
# M31 spans about 3 x 1 degrees at position angle 35 degrees east of north.
deg = sky.s * math.radians(1)
body += [f'<ellipse cx="{M[0]}" cy="{M[1]}" rx="{1.5 * deg:.1f}" ry="{0.5 * deg:.1f}" transform="rotate({90 - 35} {M[0]} {M[1]})" fill="#e8dcc6" fill-opacity="0.22" stroke="#e8dcc6" stroke-opacity="0.5"/>',
         f'<ellipse cx="{M[0]}" cy="{M[1]}" rx="{0.45 * deg:.1f}" ry="{0.16 * deg:.1f}" transform="rotate({90 - 35} {M[0]} {M[1]})" fill="#f3e8d4" fill-opacity="0.6"/>']
body += stars_of(sky, 'andromeda')
body += [label(sky(pos('andromeda', 'Sirrah')), 'Alpheratz', 0, 32, 'middle'), label(mir, 'Mirach', 0, 32, 'middle'), label(sky(pos('andromeda', 'Almach')), 'Almach', 0, 32, 'middle'),
         label(mu, 'Mu', 14, 6, 'start', MUTED, 20), label(nu, 'Nu', -14, 6, 'end', MUTED, 20), label(M, 'Andromeda Galaxy (M31)', 0, -44, 'middle')]
write('andromeda-galaxy', 'Finding the Andromeda Galaxy',
      'From Mirach, hop north through Mu and Nu Andromedae to the elongated glow of the Andromeda Galaxy. The galaxy outline shows its approximate 3 × 1 degree extent. Positions are projected from catalogue coordinates, north up and east left.', body)

