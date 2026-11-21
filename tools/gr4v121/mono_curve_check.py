#!/usr/bin/env python3
"""GR IV Monochrome recipes, test M3a (`monoCurve`, core/src/fw/gr4v121/aspect/monocurve.ts): the curve table as the built file starts with it.

  python3 -I mono_curve_check.py --official OFFICIAL.rtos --built BUILT.rtos --style 26 --curve curve.json

Reads the curve table (0x55054158, 3 variants x 38 columns) from both files' start-up image: only the given look's column changes, in the three
variants, to a descriptor like High Contrast's (own curve, flag 1) whose R, G, B pointers all lead to the expected 256 values.
"""
import argparse, json, struct
B, TABLE, TONES = 0x53000000, 0x55054158, 38
img = lambda a: (0x543b4900 + a - 0x55000000 if a >= 0x55000000 else a) - B
ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True)
ap.add_argument('--style', type=int, required=True); ap.add_argument('--curve', required=True); ap.add_argument('--path', default='own', choices=['own', 'standard', 'linear']); a = ap.parse_args()
o, b = open(a.official, 'rb').read(), open(a.built, 'rb').read()
w = lambda d, x: struct.unpack_from('<I', d, img(x))[0]
want = json.load(open(a.curve))['curve']; col = a.style + 3; n = 0
hc = w(o, TABLE + 4 * (28 if a.path == 'standard' else 30)); flag = 0 if a.path == 'standard' else 1
for v in range(3):
    for c in range(TONES):
        at = TABLE + 4 * (v * TONES + c)
        if c != col: assert w(o, at) == w(b, at), (v, c); n += 1; continue
        d = w(b, at); assert d != w(o, at)
        desc, hcd = b[img(d):img(d) + 20], o[img(hc):img(hc) + 20]
        assert desc[4] == flag and (a.path == 'standard' or desc[5] == 0), desc.hex()
        if a.path == 'linear':
            base = struct.unpack_from('<I', desc, 0)[0]; bt = struct.unpack_from('<261H', b, img(base))
            assert bt[:4] == (257, 257, 1, 0) and list(bt[4:]) == [min(16383, i * 64) for i in range(257)], 'linear base'
        else:
            assert desc[:4] == hcd[:4]
        ptrs = struct.unpack_from('<3I', desc, 8); assert len(set(ptrs)) == 1
        assert list(struct.unpack_from('<256H', b, img(ptrs[0]))) == want; n += 1
print('ok', n)
