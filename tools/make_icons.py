"""Draws the app icon from the same siamese sprite used in the game."""
from pathlib import Path
from PIL import Image

CAT = [
    '................',
    '................',
    '...O........O...',
    '...OPO....OPO...',
    '...OPPOOOOPPO...',
    '...OBBPPPPBBO...',
    '...OBPEPPEPBO...',
    '...OBPPNNPPBO...',
    '....OBPPPPBO....',
    '....OBBBBBBO....',
    '...OBBBBBBBBO...',
    '...OBBBBBBBbO...',
    '...ObBBBBBBbO...',
    '...ObBBBBBBbOPPO',
    '...OPPbBBbPPOPO.',
    '....OOOOOOOOO...',
]
PAL = {'O': '#3b2a2a', 'B': '#f4ebdd', 'b': '#dccbb3', 'P': '#6b4a3a', 'E': '#5fb0ee', 'N': '#e58a9a'}
BG, HEART = '#5b4a8b', '#e0476c'


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def icon(size):
    img = Image.new('RGB', (24, 24), rgb(BG))
    px = img.load()
    for y, row in enumerate(CAT):
        for x, ch in enumerate(row):
            if ch in PAL:
                px[x + 4, y + 5] = rgb(PAL[ch])
    for x, y in [(18, 2), (19, 2), (21, 2), (22, 2), (17, 3), (18, 3), (19, 3), (20, 3), (21, 3), (22, 3), (23, 3),
                 (18, 4), (19, 4), (20, 4), (21, 4), (22, 4), (19, 5), (20, 5), (21, 5), (20, 6)]:
        if x < 24:
            px[x, y] = rgb(HEART)
    return img.resize((size, size), Image.NEAREST)


out = Path(__file__).resolve().parent.parent / 'icons'
for s in (180, 192, 512):
    icon(s).save(out / f'icon-{s}.png')
print('icons written to', out)
