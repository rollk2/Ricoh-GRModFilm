#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11: the looks seen by each model, in the emulator (M2 of the Monochrome recipes, docs/gr4-mono-recettes-etude.md).

  python3 -I mono_looks_probe.py --official OFFICIAL.rtos [--built BUILT.rtos]

Official file: the look-visibility check 0x533de9ac (r1 the style, r2 « the camera is the Monochrome »; the Monochrome branch reads the availability
table 0x53deb35c through the model's column) gives the colour looks 11..24 to the colour models only and the black-and-white looks 25..30 and 32 to the
Monochrome only (31 Pictorialist to none); the style -> RAW development number map (0x53382ed8) gives 25..32 the numbers 15..22.
Built file (with one added slot, style 38, as GR Mod builds it today): style 38 visible on the colour models, hidden on the Monochrome.
"""
import argparse, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
VIS, RAW = 0x533de9ac, 0x53382ed8
APP, SPEC_MODEL, SETTINGS2, ASSERT = 0x53240cac, 0x53242154, 0x53241b54, 0x53916230
SENT, SPEC, OBJ = 0x70000100, 0x60100000, 0x60000000


class Cam:
    def __init__(self, path):
        d = open(path, 'rb').read()
        u = self.u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_map(0x60000000, 0x400000); u.mem_map(0x70000000, 0x100000)
        u.mem_write(0x55000000, d[0x543b4900 - B:0x543b4900 - B + 0x58500])   # the initialised data, as the start-up copy leaves it
        self.model = 0

        def code(uc, a, s, _):
            if a == SENT: uc.emu_stop(); return
            ret = None
            if a in (APP, SETTINGS2): ret = OBJ
            elif a == SPEC_MODEL: uc.mem_write(SPEC, struct.pack('<II', SPEC + 4, self.model)); ret = SPEC   # [[spec]] = the model's column
            elif a == ASSERT: ret = 0
            if ret is not None: uc.reg_write(UC_ARM_REG_R0, ret); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        u.hook_add(UC_HOOK_CODE, code)

    def call(self, f, *args):
        u = self.u
        for r in range(13): u.reg_write(UC_ARM_REG_R0 + r, 0)
        u.reg_write(UC_ARM_REG_R0, OBJ)
        for i, a in enumerate(args): u.reg_write(UC_ARM_REG_R0 + i, a)
        u.reg_write(UC_ARM_REG_SP, 0x70080000); u.reg_write(UC_ARM_REG_LR, SENT)
        u.emu_start(f, SENT, count=5000)
        return u.reg_read(UC_ARM_REG_R0)

    def visible(self, style, mono):
        self.model = 1 if mono else 0
        return self.call(VIS, OBJ, style, 1 if mono else 0)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built'); a = ap.parse_args()
    o = Cam(a.official); n = 0
    for s in range(11, 25):
        assert o.visible(s, False) == 1 and o.visible(s, True) == 0, ('colour look', s); n += 1
    for s in (25, 26, 27, 28, 29, 30, 32):
        assert o.visible(s, False) == 0 and o.visible(s, True) == 1, ('black-and-white look', s); n += 1
    assert o.visible(31, False) == 0 and o.visible(31, True) == 0; n += 1
    raw = {s: o.call(RAW, OBJ, s) for s in range(25, 33)}
    assert raw == {25: 15, 26: 16, 27: 17, 28: 18, 29: 19, 30: 22, 31: 20, 32: 21}, raw; n += 1
    assert o.call(RAW, OBJ, 18) == 9; n += 1
    if a.built:
        b = Cam(a.built)
        assert b.visible(38, False) == 1 and b.visible(38, True) == 0, 'added style 38 as built today'; n += 1
        for s in (11, 18, 25, 27):
            assert b.visible(s, False) == o.visible(s, False) and b.visible(s, True) == o.visible(s, True); n += 1
    print('ok', n)


main()
