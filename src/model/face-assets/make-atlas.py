"""Rebuild the fitted face paint (not a photograph of the head).

Run in the project root: python src/model/face-assets/make-atlas.py
The canvas is registered in reference pixels. The nose accent is lifted from
the original art, not the hair or its shadow. The mouth joins the original
corner accents with a fine, tapered parting rather than three disconnected dots.
The open eye was redrawn in curves, so its outline stays clean on close-ups;
the hidden corner of her other eye is reconstructed by reflection.
"""
from pathlib import Path
import base64
import io

import cairosvg
import numpy as np
from PIL import Image


out = Path(__file__).parent
ref = Image.open(next(Path('四视图').glob('*正*'))).convert('RGB')
# Square projection from artwork coordinates [274,402] x [54,182].
sz = 1024
crop = ref.resize((sz, sz), Image.Resampling.BICUBIC,
                  box=(274*1.5, 54*1.5, 402*1.5, 182*1.5))
py, px = np.mgrid[0:sz, 0:sz]
px = (px + .5) / 8 + 274
py = (py + .5) / 8 + 54
rgb = np.array(crop, dtype=float)
skin = np.empty_like(rgb)
skin[:] = (253, 230, 216)

def soft_disc(x, y, w, h, feather=.22):
    d = np.sqrt(((px-x)/w)**2 + ((py-y)/h)**2)
    v = np.clip((1-d)/feather, 0, 1)
    return v * v * (3-2*v)

# Restrict sampling to known clean areas. No cutout border, flyaway, clip or
# collar ever reaches a temple, the side of the skull or the under-chin.
mask = .56*soft_disc(337.5, 134, 5.9, 9)
skin += (rgb - skin) * mask[:,:,None]

eye = '''
  <path fill="#a77578" d="M347.4 105.68 Q347.48 101.32 351.73 100.43 Q355.65 98.74 359.85 100.47 Q361.34 100.72 364.12 101.29 Q356.47 100.8 353.8 102.62 Q351.13 104.49 347.4 105.68Z"/>
  <path fill="#d3a5a0" d="M347.4 105.68 Q347.48 102.49 350.05 101.37 Q352.33 100.03 355.05 99.93 Q352.07 101.11 351.31 102.62 Q350.49 104.67 347.4 105.68Z"/>
  <path fill="#37415a" d="M346.41 99.98 Q347.05 98.01 350.82 96.62 Q355.18 95.25 359.72 93.97 Q364.82 92.38 372.63 93.49 Q366.86 93.3 361.4 95.02 Q355.13 97.51 348.25 100.09 Q347.07 100.58 346.41 99.98Z"/>
  <path fill="#627399" d="M346.93 99.75 Q347.17 98.63 351.13 97 Q357.43 94.77 361.24 94.21 Q356.34 96.31 349.98 98.94 Q347.4 100.04 346.93 99.75Z"/>
  <!-- Cast shadow just below the upper lid; lower scleral edge is uninked. -->
  <path fill="url(#white)" d="M349.1 112.18 C350.8 107.05 356.5 103.35 362.1 104.18 C369.1 103.45 374.45 107.48 374.2 111.83 C373.78 117.77 369.09 123.59 363.87 124.75 C359.59 126.09 354.12 124.91 351.55 121.96 C349.56 119.28 349.2 116.35 349.1 112.18Z"/>
  <path fill="#b2b7c2" d="M349.26 113.32 Q351.04 107.39 356.34 105.42 Q367.19 100.11 374.37 109.09 L373.36 113.07 Q369.2 109.01 363.63 107.64 Q355.02 105.11 349.26 113.32Z"/>
  <!-- Dark limbus, offset pupil, reflected light pooled in the lower iris. -->
  <path fill="#0d262b" d="M357.95 104.93 C361.24 103.63 365.57 104.63 366.97 108.18 C368.09 111.75 367.87 117.08 366.66 119.87 C365.41 123.39 362.89 125.01 360.31 124.98 C356.67 125.04 353.7 121.94 353.56 118.26 C353.08 114.69 352.94 109.86 354.15 107.64 Q355.03 106.04 357.95 104.93Z"/>
  <path fill="url(#iris)" d="M358.19 105.56 C361.75 104.19 364.99 105.32 365.98 108.65 C367.07 111.86 366.73 117.22 365.62 119.62 C364.31 122.51 362.32 123.9 360.3 123.89 C357.17 123.95 354.92 121.49 354.62 117.91 C354.06 114.26 354.23 110.1 355.04 108.12 Q356 106.19 358.19 105.56Z"/>
  <path fill="#087776" d="M355.86 108.24 Q359.57 104.3 365.11 107.48 Q365.96 108.99 365.89 111.88 Q364.15 110.17 361.98 110.19 Q358.14 108.29 355.86 108.24Z"/>
  <path fill="#0b6567" d="M359 110.97 C360.16 109.3 362.02 109.52 362.6 111.83 C363.18 114.05 362.49 117.49 360.98 118.54 C359.4 119.31 358.06 117.73 357.98 115.56 Q357.83 112.9 359 110.97Z"/>
  <ellipse cx="360.62" cy="114.45" rx="1.52" ry="3.21" fill="#092b35"/>
  <path fill="#6deedf" d="M354.98 119.04 Q356.09 117.34 356.78 117.35 Q357.61 118.89 359.31 119.01 Q361.42 120.38 363.96 118.11 Q365.17 117.17 365.91 117.79 Q365.6 120.47 363.64 122.24 Q360.76 125.07 357.09 122.17Z"/>
  <path fill="#9ff8ec" d="M356.81 121.27 Q358.49 120.09 360.53 120.78 Q362.84 120.9 364.36 119.93 Q363.38 122.99 360.76 123.43 Q358.3 123.72 356.81 121.27Z"/>
  <g transform="GLINT">
  <ellipse cx="356.71" cy="109.83" rx="1.83" ry="2.46" transform="rotate(13 356.71 109.83)" fill="#fbffff"/>
  <ellipse cx="364.2" cy="109.65" rx="1.05" ry="1.28" fill="#d9ffff"/>
  <ellipse cx="356.44" cy="118.89" rx=".65" ry=".9" fill="#c1fffa"/>
  </g>
  <path fill="#2a2126" d="M349.1 112.46 Q349.32 110.88 350.81 109.38 Q349.07 109.99 348.69 110.35 Q349.99 107.74 352.68 106.19 Q356.93 102.23 363.15 102.77 Q368.34 102.51 371.35 104.67 Q373.68 105.85 375.04 103.02 Q375.25 102.46 375.52 103.25 Q376.04 104.97 374.11 106.62 Q376.24 109.56 380.94 108.92 Q381.39 109.47 379.33 110.73 Q377.21 111.9 376.39 113.62 Q374.51 117.76 371.47 120.63 Q373.19 118.04 373.44 114.2 Q374.08 111.09 372.45 109.46 Q368.62 105.33 362.4 105.88 Q355.51 104.9 349.1 112.46Z"/>
  <path fill="#111416" d="M349.58 112.03 Q352.06 105.49 359.79 104.02 Q367.54 102.3 372.52 106.02 Q375.21 107.89 377.35 109.99 L375.48 113.29 L373.53 116.29 Q374.6 110.61 370.48 108.25 Q365.54 105.12 359.15 106.15 Q353.73 106.82 349.58 112.03Z"/>
'''

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{sz}" height="{sz}" viewBox="274 54 128 128">
 <defs>
  <linearGradient id="white" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#e6e4e4"/><stop offset=".49" stop-color="#fffdfb"/><stop offset="1" stop-color="#fffcfa"/></linearGradient>
  <linearGradient id="iris" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#124c53"/><stop offset=".55" stop-color="#099b95"/><stop offset=".82" stop-color="#2ecfc1"/><stop offset="1" stop-color="#83f7e5"/></linearGradient>
 </defs>
 <g>{eye.replace('GLINT','translate(0 0)')}</g><g transform="translate(674 0) scale(-1 1)">{eye.replace('GLINT','translate(721.1 0) scale(-1 1)')}</g>
 <!-- Tiny neutral mouth. Local colour suggests the lip roll without outlining it. -->
 <path fill="#e2b0a2" opacity=".27" d="M330.94 151.55 Q333.76 150.37 336.01 150.37 Q337.2 150.57 337.64 150.78 Q338.51 150.31 339.47 150.39 Q341.63 150.78 344.28 151.55 Q341.36 153.22 337.75 153.21 Q334.37 153.16 330.94 151.55Z"/>
 <path fill="#9b7574" d="M330.66 151.65 C332.76 150.67 335.24 150.82 337.56 151.01 C339.58 150.78 342.16 150.92 344.53 151.63 C342.08 151.43 339.51 151.32 337.56 151.51 C334.65 151.26 332.7 151.36 330.66 151.65Z"/>
 <path fill="#f9d9cb" d="M333.14 152.42 Q336.69 153.39 341.94 152.49 Q340.12 154.07 337.68 154.08 Q335.01 154.08 333.14 152.42Z"/>
 <path fill="#fff0e2" opacity=".76" d="M335.41 153.06 Q337.12 153.4 339.21 153.13 Q337.82 153.88 335.41 153.06Z"/>
</svg>'''
png = cairosvg.svg2png(bytestring=svg.encode())
if png is None:
    raise RuntimeError('CairoSVG did not return the rasterized eye and lip artwork')
ink = Image.open(io.BytesIO(png)).convert('RGBA')
canvas = Image.fromarray(np.rint(skin).clip(0,255).astype('uint8')).convert('RGBA')
canvas.alpha_composite(ink)
# Use nearest palette colours without error diffusion (preserve clean cel fills).
pal = canvas.convert('RGB').quantize(colors=256, dither=Image.Dither.NONE)
idx = np.asarray(pal).reshape(-1)
colors = pal.getpalette()
if colors is None:
    raise RuntimeError('Quantized facial atlas is missing its palette')
palette = bytes(colors)
# PackBits-style repeated or literal bytes. This keeps the synchronous atlas
# small without requiring a browser, image decoder, or an async inflate step.
rle = bytearray()
i = 0
while i < len(idx):
    run = 1
    while run < 128 and i+run < len(idx) and idx[i+run] == idx[i]:
        run += 1
    if run >= 3:
        rle.extend((127+run, idx[i]))
        i += run
        continue
    j = i + run
    while j < min(i+128, len(idx)):
        if j+2 < len(idx) and idx[j] == idx[j+1] == idx[j+2]:
            break
        j += 1
    rle.append(j-i-1)
    rle.extend(idx[i:j].tobytes())
    i = j
def js_string(buf):
    s = base64.b64encode(buf).decode('ascii')
    return '\n  + '.join(repr(s[i:i+112]) for i in range(0, len(s), 112))
(out/'atlas.js').write_text('// Generated by make-atlas.py. Upper-left origin.\n'
    + f'export const size = {sz};\nexport const palette = '+js_string(palette)+';\n'
    + 'export const indices = '+js_string(rle)+';\n')
