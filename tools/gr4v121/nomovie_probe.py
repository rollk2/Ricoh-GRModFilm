#!/usr/bin/env python3
"""GR IV 1.21 / GR IV Monochrome 1.11, `noMovie` (core/src/fw/gr4v121/aspect/nomovie.ts), in the emulator.

  python3 nomovie_probe.py --official OFFICIAL.rtos --built BUILT.rtos [--report out.json]

Both files are the RTOS section (base 0x53000000), the official one and the built one. Runs the three
changed places on both and checks the built one does what nomovie.ts says and the official one does not:

  - the movie tab's visibility method (first word of the descriptor 0x53dc9238) answers 0 in the built
    file, 1 in the official; the other three descriptors' answer 1 in both;
  - the photo / movie getter 0x5329bb60 answers 0 whatever byte the object holds (built); the byte (official);
  - the setter 0x532798fc(object, value) stores 0 (built) / the value (official), then reaches the change
    notice (0x5325eb24 with r1 = 0x162, r2 = 0xf, r3 = 0) once, and returns with fp, sp and r4..r11 as given.
"""
import argparse, json, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

BASE = 0x53000000
TABS = [0x53dc9238, 0x53dc8ea4, 0x53dc81a0, 0x53dc8778]  # movie, playback, customize, setup
GETTER, SETTER, STORE = 0x5329bb60, 0x532798fc, 0x53279908
NOTICE, CALLS = 0x5325eb24, (0x53240cac, 0x53240e20)
BYTE = 0xb76
OBJ, STACK, SENT = 0x60100000, 0x60200000, 0x5a5a5a58


def machine(rtos):
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    size = (len(rtos) + 0xfff) & ~0xfff
    u.mem_map(BASE, size + 0x1000)
    u.mem_write(BASE, rtos)
    u.mem_map(0x60000000, 0x400000)
    u.mem_map(SENT & ~0xfff, 0x1000)
    return u


def call(u, addr, args=(), hooks=None, count=5000):
    for i in range(13):
        u.reg_write(UC_ARM_REG_R0 + i, 0x1000 + i)
    for i, v in enumerate(args):
        u.reg_write(UC_ARM_REG_R0 + i, v)
    u.reg_write(UC_ARM_REG_SP, STACK)
    u.reg_write(UC_ARM_REG_LR, SENT)
    seen = []

    def code(uc, a, s, d):
        if a == SENT:
            uc.emu_stop()
        elif hooks and a in hooks:
            seen.append((a, [uc.reg_read(UC_ARM_REG_R0 + i) for i in range(4)]))
            uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
    h = u.hook_add(UC_HOOK_CODE, code)
    u.emu_start(addr, SENT, count=count)
    u.hook_del(h)
    return u.reg_read(UC_ARM_REG_R0), seen


def verify(official, built, name):
    official_filter = {}
    cases = {}
    n = lambda k: cases.__setitem__(k, cases.get(k, 0) + 1)
    for label, rtos, mod in (('official', official, False), ('built', built, True)):
        u = machine(rtos)
        # the tabs' visibility methods
        for k, d in enumerate(TABS):
            fn = struct.unpack('<I', bytes(u.mem_read(d, 4)))[0]
            r, _ = call(u, fn)
            want = 0 if (mod and k == 0) else 1
            assert r == want, (label, 'tab', k, hex(fn), r)
            n(f'{label} tab {k}')
        # the rows: Still/Movie (still item 18) and Movie Edit (playback item 16); the rows next to them stay
        for menu, item, id_ in ((0x53dc8b18, 18, 0x02000082), (0x53dc8ea4, 16, 0x04000033)):
            assert struct.unpack('<I', bytes(u.mem_read(menu + 0x1bc + 4 * item, 4)))[0] == id_
            for it in (item - 1, item, item + 1):
                fn = struct.unpack('<I', bytes(u.mem_read(menu + 0x254 + 8 * it, 4)))[0]
                if it == item and mod:
                    assert fn != 0 and call(u, fn)[0] == 0, (label, 'row', hex(menu), it)
                else:
                    assert fn == 0, (label, 'row kept', hex(menu), it, hex(fn))
                n(f'{label} row')
        # the Fn lists' filter 0x531d7be0: functions 18 (Framerate) and 19 (Still/Movie) refused, the others as in the official file
        for f in [x for x in range(0, 46) if x not in (25, 30, 44, 45)]:  # those four ask the camera's state: not emulated here
            r, _ = call(u, 0x531d7be0, (f,))
            if label == 'official':
                official_filter[f] = r
            else:
                want = 0 if f in (18, 19) else official_filter[f]
                assert r == want, (label, 'fn filter', f, r, want)
            n(f'{label} fn filter')
        # the getter
        for b in (0, 1, 2, 0xff):
            u.mem_write(OBJ + BYTE, bytes([b]))
            r, _ = call(u, GETTER, (OBJ,))
            want = 0 if mod else b
            assert r == want, (label, 'getter', b, r)
            n(f'{label} getter')
        # the setter
        for v in (0, 1, 2, 0xff):
            for before in (0, 1):
                u.mem_write(OBJ + BYTE, bytes([before]))
                regs = [0x2000 + i for i in range(13)]
                regs[0], regs[1] = OBJ, v
                for i, x in enumerate(regs):
                    u.reg_write(UC_ARM_REG_R0 + i, x)
                u.reg_write(UC_ARM_REG_SP, STACK)
                u.reg_write(UC_ARM_REG_LR, SENT)
                seen = []

                def code(uc, a, s, d):
                    if a == SENT:
                        uc.emu_stop()
                    elif a in CALLS or a == NOTICE:
                        seen.append((a, [uc.reg_read(UC_ARM_REG_R0 + i) for i in range(4)]))
                        uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
                h = u.hook_add(UC_HOOK_CODE, code)
                u.emu_start(SETTER, SENT, count=5000)
                u.hook_del(h)
                got = u.mem_read(OBJ + BYTE, 1)[0]
                want = 0 if mod else v
                assert got == want, (label, 'setter', v, before, got)
                assert [a for a, _ in seen] == [CALLS[0], CALLS[1], NOTICE], (label, 'calls', [hex(a) for a, _ in seen])
                a, r = seen[2]
                assert r[1:4] == [0x162, 0xf, 0], (label, 'notice', r)
                assert u.reg_read(UC_ARM_REG_SP) == STACK
                assert [u.reg_read(UC_ARM_REG_R0 + i) for i in range(4, 12)] == regs[4:12], (label, 'registers')
                n(f'{label} setter')
    return dict(cases=cases, name=name)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--official', required=True)
    p.add_argument('--built', required=True)
    p.add_argument('--report')
    a = p.parse_args()
    off, bt = open(a.official, 'rb').read(), open(a.built, 'rb').read()
    res = verify(off, bt, a.built)
    print(json.dumps(res))
    if a.report:
        json.dump(res, open(a.report, 'w'), indent=1)
