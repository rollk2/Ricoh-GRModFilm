#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11, `keyDiag` (core/src/fw/gr4v121/aspect/keydiag.ts), in the emulator.

  python3 keydiag_probe.py --built BUILT.rtos

Calls the key event entry 0x53258098 with a sequence of key codes: the ring (8 bytes at 0x55839038) must hold the codes
(the shot's 5..8 and an immediate repeat left out, 7 slots, byte 7 the next slot), and the function's own code must be
reached (at 0x5325809c) with r0, r1 and sp as they were.
"""
import argparse, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
ENTRY, AFTER, RING = 0x53258098, 0x5325809c, 0x55839038


def run(rtos, codes):
    d = open(rtos, 'rb').read()
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
    u.mem_map(0x55000000, 0x1000000); u.mem_map(0x70000000, 0x100000)
    out = []
    for c in codes:
        u.reg_write(UC_ARM_REG_R0, 0x1234); u.reg_write(UC_ARM_REG_R1, c)
        u.reg_write(UC_ARM_REG_R2, 0x99); u.reg_write(UC_ARM_REG_SP, 0x70080000); u.reg_write(UC_ARM_REG_LR, 0x70000100)
        u.emu_start(ENTRY, AFTER, count=200)
        assert u.reg_read(UC_ARM_REG_PC) == AFTER
        assert u.reg_read(UC_ARM_REG_R0) == 0x1234 and u.reg_read(UC_ARM_REG_R1) == c and u.reg_read(UC_ARM_REG_R2) == 0x99, 'registers'
        assert u.reg_read(UC_ARM_REG_SP) == 0x70080000, 'sp'
        assert u.reg_read(UC_ARM_REG_R12) == 0x70080000, 'ip = sp (the first instruction)'
        out.append(bytes(u.mem_read(RING, 8)))
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); a = ap.parse_args()
    r = run(a.built, [22, 23, 5, 6, 26, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36])
    # 22,23 | 5,6 skipped | 26 | 26 repeat skipped | 27 28 29 30 31 -> 7 slots full after 22 23 26 27 28 29 30; then 31 32 ... wrap
    assert list(r[1][:2]) == [22, 23] and r[1][7] == 2
    assert r[3] == r[1], 'the shot codes change nothing'
    assert r[4][2] == 26 and r[4][7] == 3
    assert r[5] == r[4], 'a repeat changes nothing'
    assert list(r[9][:7]) == [22, 23, 26, 27, 28, 29, 30] and r[9][7] == 0, r[9]
    assert list(r[10][:7]) == [31, 23, 26, 27, 28, 29, 30] and r[10][7] == 1, r[10]
    print('ok', [list(x) for x in r[-2:]])
