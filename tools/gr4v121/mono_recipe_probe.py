#!/usr/bin/env python3
"""GR IV Monochrome recipes, test M3b (`monoRecipes`: slots.ts with `mono`), in the emulator.

  python3 -I mono_recipe_probe.py --official OFFICIAL.rtos --built BUILT.rtos --curve curve.json

The built file has one added slot (style 38) as a black-and-white recipe. Checks:
  - visibility (0x533de9ac): style 38 on the Monochrome only; the factory looks as in the official file;
  - the style tables (tone, multi-axis, YCbCr, gamma: 3 variants x 39 columns): column 38's tone record is Monochrome Standard's with an identity
    matrix and its black-and-white post-curve array, its YCbCr and multi-axis records are Monochrome Standard's, its curve descriptor is High
    Contrast's (flag 1) with a neutral base curve (257, 257, 1, 0, then i x 64) and the three curve pointers on the recipe's curve;
  - the parameter getters for style 38 read Monochrome Standard's fields (module not yet loaded: the firmware's own getter for style 25);
  - the parameter screen's list (0x531c86b8) gives style 38 Monochrome Standard's list.
"""
import argparse, json, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
TONE, MA, YCC, GAMMA = 0x55054800, 0x55054554, 0x55053ce4, 0x55054158
ACCESSORS = {'tone': 0x5394f578, 'ma': 0x5394f5a4, 'ycc': 0x5394f5d0, 'gamma': 0x5394f5fc}
GETTERS = [0x533c8028, 0x533c8710, 0x533c8df8, 0x533c9910, 0x533ca388, 0x533cae00, 0x533cb878, 0x533cc390, 0x533ccb10, 0x533ccd70, 0x533ccf30, 0x533cd0e8,
           0x533cd260, 0x533cd400, 0x533cd6f0, 0x533cda10, 0x533cdd30, 0x533ce070, 0x533ceae8, 0x533cf058, 0x533cf580, 0x533cfaa8, 0x533cffd0]
OBJ, SENT, SPEC = 0x60000000, 0x70000100, 0x60100000


class Cam:
    def __init__(self, path):
        d = self.d = open(path, 'rb').read()
        u = self.u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_map(0x60000000, 0x400000); u.mem_map(0x70000000, 0x100000)
        u.mem_write(0x55000000, d[0x543b4900 - B:0x543b4900 - B + 0x58500])
        self.model = 1

        def code(uc, a, s, _):
            if a == SENT: uc.emu_stop(); return
            ret = None
            if a == 0x53240cac: ret = 0x60200000
            elif a in (0x53241240, 0x53241b54): ret = OBJ
            elif a == 0x53242154: uc.mem_write(SPEC, struct.pack('<II', SPEC + 4, self.model)); ret = SPEC
            elif a == 0x53916230: ret = 0
            if ret is not None: uc.reg_write(UC_ARM_REG_R0, ret); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        u.hook_add(UC_HOOK_CODE, code)

    def call(self, f, *args):
        u = self.u
        for r in range(13): u.reg_write(UC_ARM_REG_R0 + r, 0)
        u.reg_write(UC_ARM_REG_R0, 0x60300000)
        for i, a in enumerate(args): u.reg_write(UC_ARM_REG_R0 + i, a)
        u.reg_write(UC_ARM_REG_SP, 0x70080000); u.reg_write(UC_ARM_REG_LR, SENT)
        u.emu_start(f, SENT, count=50000)
        return u.reg_read(UC_ARM_REG_R0)

    def word(self, a):
        return struct.unpack('<I', bytes(self.u.mem_read(a, 4)))[0]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True); ap.add_argument('--curve', required=True)
    a = ap.parse_args(); curve = json.load(open(a.curve))['curve']
    o, b = Cam(a.official), Cam(a.built); n = 0
    # visibility
    for mono in (0, 1):
        b.model = o.model = mono
        assert b.call(0x533de9ac, 0x60300000, 38, mono) == (1 if mono else 0), ('style 38 visibility', mono); n += 1
        for s in (11, 18, 25, 27, 32):
            assert b.call(0x533de9ac, 0x60300000, s, mono) == o.call(0x533de9ac, 0x60300000, s, mono), ('factory look', s, mono); n += 1
    rec = {}
    # read the relocated tables via the accessors' movw/movt
    def table_of(cam, at):
        lo, hi = cam.word(at + 4), cam.word(at + 0xc)
        imm = lambda w: ((w >> 4) & 0xf000) | (w & 0xfff)
        return (imm(hi) << 16) | imm(lo)
    for name, acc in ACCESSORS.items():
        tb, to = table_of(b, acc), table_of(o, acc)
        stride = (b.word(acc) & 0xff)
        assert stride == 39, (name, stride)
        for v in range(3):
            for c in range(38): assert b.word(tb + 4 * (v * 39 + c)) == o.word(to + 4 * (v * 38 + c)), (name, v, c)
            rec[(name, v)] = b.word(tb + 4 * (v * 39 + 38))
        assert rec[(name, 0)] == rec[(name, 1)] == rec[(name, 2)]; n += 1
    tt = table_of(o, ACCESSORS['tone']); yt = table_of(o, ACCESSORS['ycc']); mt = table_of(o, ACCESSORS['ma']); gt = table_of(o, ACCESSORS['gamma'])
    t25, y25, m25, g30 = o.word(tt + 4 * 28), o.word(yt + 4 * 28), o.word(mt + 4 * 28), o.word(gt + 4 * 30)
    tr = rec[('tone', 0)]
    assert b.word(tr + 8) == o.word(t25 + 8), 'black-and-white post-curve array'; n += 1
    assert [b.word(tr + 4 * i) for i in range(21) if i not in (1, 2)] == [o.word(t25 + 4 * i) for i in range(21) if i not in (1, 2)], 'tone record as 25'; n += 1
    m = struct.unpack('<9h', bytes(b.u.mem_read(b.word(tr + 4), 18))); assert m == (8192, 0, 0, 0, 8192, 0, 0, 0, 8192), m; n += 1
    assert rec[('ycc', 0)] == y25, 'YCbCr record of 25'; n += 1
    ma = rec[('ma', 0)]; assert [b.word(ma + 4 * i) for i in (0, 1, 3, 4, 5)] == [o.word(m25 + 4 * i) for i in (0, 1, 3, 4, 5)], 'multi-axis record'; n += 1
    g = rec[('gamma', 0)]; desc = bytes(b.u.mem_read(g, 20)); hc = bytes(o.u.mem_read(g30, 20))
    assert desc[4] == 1 and desc[5] == 0 and desc[6:8] == hc[6:8], desc.hex(); n += 1
    base = struct.unpack_from('<I', desc, 0)[0]; bt = struct.unpack('<261H', bytes(b.u.mem_read(base, 522)))
    assert bt[:4] == (257, 257, 1, 0) and list(bt[4:]) == [min(16383, i * 64) for i in range(257)], 'neutral base'; n += 1
    for i in range(3):
        ptr = struct.unpack_from('<I', desc, 8 + 4 * i)[0]
        assert list(struct.unpack('<256H', bytes(b.u.mem_read(ptr, 512)))) == curve, ('curve', i); n += 1
    # getters of style 38 read Monochrome Standard's fields (patterns: low byte, high byte of the offset)
    P1 = bytes(k & 0xff for k in range(0x2000)); P2 = bytes((k >> 8) & 0xff for k in range(0x2000))
    def field(cam, g, style, mode, sset):
        cam.u.mem_write(OBJ, P1); lo = cam.call(g, 0x60300000, mode, sset, style) & 0xff
        cam.u.mem_write(OBJ, P2); hi = cam.call(g, 0x60300000, mode, sset, style) & 0xff
        return hi << 8 | lo
    for p in (2, 3, 4, 5, 6, 7, 17, 18, 19, 20, 21):
        for mode, sset in ((0, 0), (0, 2), (1, 1)):
            if p >= 18 and mode == 1: continue
            assert field(b, GETTERS[p], 38, mode, sset) == field(o, GETTERS[p], 25, mode, sset), ('getter', p, mode, sset); n += 1
    # parameter list
    assert b.call(0x531c86b8, 0x60300000, 38) == o.call(0x531c86b8, 0x60300000, 25), 'parameter list'; n += 1
    print('ok', n)


main()
