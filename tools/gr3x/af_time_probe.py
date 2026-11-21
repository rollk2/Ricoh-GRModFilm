#!/usr/bin/env python3
"""GR III 2.10 / IIIx 1.60, T-AFT1 `afTime` (core/src/fw/gr3x/af-time.ts), in the emulator.

  python3 af_time_probe.py --official OFFICIAL.rtos --built BUILT.rtos

Runs the hook placed at CafProcess's dispatcher exit (0x5340a354) with a fake object and a fake clock (tk_get_otm answers the time given):
  - the official store is `strh r4, [r6, r1]` and the built file branches away from it;
  - an unchanged code: nothing noted, the store done, registers kept (r0 to r3, ip, r4 to r6, sp);
  - a changed code: the new code stored, one byte noted in the ring (0x558043a8, index at +7): tens = the OLD code's duration in 50 ms steps
    (cap 9), ones = the old code's bit position + 1; the stamp word (0x55804388) takes the time; registers kept.
"""
import argparse, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
STORE, AFTER, OTM = 0x5340a354, 0x5340a358, 0x53050b7c
RING, STAMP = 0x558043a8, 0x55804388
OBJ, STACK, SENT = 0x70100000, 0x70080000, 0x70000100
R6 = OBJ + 0xc000


class Cam:
    def __init__(self, rtos):
        d = open(rtos, 'rb').read(); self.d = d
        u = self.u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_map(0x70000000, 0x400000)
        self.now = 0

        def code(uc, a, s, _):
            if a == OTM:   # tk_get_otm(r0 = SYSTIM*): the low word of the milliseconds at +4
                r0 = uc.reg_read(UC_ARM_REG_R0); uc.mem_write(r0, struct.pack('<II', 0, self.now & 0xffffffff))
                uc.reg_write(UC_ARM_REG_R0, 0); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
            elif a == AFTER:
                uc.emu_stop()
        u.hook_add(UC_HOOK_CODE, code)

    def run(self, old, new, now):
        u = self.u; self.now = now
        u.mem_write(R6 + 0x44c, struct.pack('<H', old))
        regs = {UC_ARM_REG_R0: 1, UC_ARM_REG_R1: 0x44c, UC_ARM_REG_R2: 0x2222, UC_ARM_REG_R3: 0x3333, UC_ARM_REG_R4: new, UC_ARM_REG_R5: 0x5555,
                UC_ARM_REG_R6: R6, UC_ARM_REG_R7: 0x7777, UC_ARM_REG_R12: 0xcccc, UC_ARM_REG_LR: 0xdddd, UC_ARM_REG_SP: STACK}
        for r, v in regs.items(): u.reg_write(r, v)
        u.emu_start(STORE, AFTER, count=2000)
        for r, v in regs.items():
            if r in (UC_ARM_REG_R4, UC_ARM_REG_R6, UC_ARM_REG_SP, UC_ARM_REG_R5, UC_ARM_REG_R7, UC_ARM_REG_R12, UC_ARM_REG_LR, UC_ARM_REG_R0, UC_ARM_REG_R1, UC_ARM_REG_R2, UC_ARM_REG_R3):
                assert u.reg_read(r) == v, ('register', r, hex(u.reg_read(r)), hex(v))
        return struct.unpack('<H', bytes(u.mem_read(R6 + 0x44c, 2)))[0]


def ring(cam): return list(cam.u.mem_read(RING, 8))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True); a = ap.parse_args()
    o = open(a.official, 'rb').read(); n = 0
    assert struct.unpack_from('<I', o, STORE - B)[0] == 0xe18640b1
    c = Cam(a.built)
    assert struct.unpack_from('<I', c.d, STORE - B)[0] != 0xe18640b1 and (struct.unpack_from('<I', c.d, STORE - B)[0] >> 24) == 0xea
    # an unchanged code: nothing noted
    assert c.run(4, 4, 1000) == 4 and ring(c) == [0] * 8; n += 1
    # the first change after a long rest: old 0, a long time since the (zero) stamp -> tens 9, ones 0; the stamp takes the time
    assert c.run(0, 2, 5000) == 2
    assert ring(c)[0] == 90 and ring(c)[7] == 1 and struct.unpack('<I', bytes(c.u.mem_read(STAMP, 4)))[0] == 5000, ring(c); n += 1
    # code 2 lasted 210 ms (4 steps of 50), then 4 lasted 335 ms (6 steps), then 8 lasted 70 ms (1 step), 0x80 lasted 20 ms (0 step)
    for old, new, dt, want in ((2, 4, 210, 42), (4, 8, 335, 63), (8, 0x80, 70, 14), (0x80, 0, 20, 8 + 0), (0, 1, 60000, 90), (1, 2, 12, 1)):
        now = struct.unpack('<I', bytes(c.u.mem_read(STAMP, 4)))[0] + dt
        before = ring(c)[7]
        assert c.run(old, new, now) == new
        assert ring(c)[before] == want, (old, new, dt, want, ring(c)); n += 1
    # the ring wraps at seven bytes
    for i in range(10): c.run(2, 4, 100000 + i * 100)
    assert ring(c)[7] < 7; n += 1
    # a change at the cap: 450 ms or more
    now = struct.unpack('<I', bytes(c.u.mem_read(STAMP, 4)))[0] + 449; b = ring(c)[7]; c.run(4, 8, now); assert ring(c)[b] == 83, ring(c)[b]; n += 1
    now += 450; b = ring(c)[7]; c.run(8, 0x80, now); assert ring(c)[b] == 94, ring(c)[b]; n += 1
    print('ok', n)


main()
