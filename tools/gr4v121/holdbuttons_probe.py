#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11, `holdTest` (core/src/fw/gr4v121/aspect/holdbuttons.ts), in the emulator.

  python3 holdbuttons_probe.py --built BUILT.rtos --functions 5,45,0,0,0

Drives ActionModel::OnEvent's entry (0x53258098) with key code sequences (the camera's: Fn 24/25, up 26/22/28, down 29/30/31, left
32/33/34, right 35/36/37) and logs what reaches the real function (0x5325809c): the code and the value of Fn's function field.
"""
import argparse, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
ENTRY, AFTER = 0x53258098, 0x5325809c
APP, CONTROLLERS, SETTINGS, TK = 0x53240cac, 0x53240e20, 0x53241240, 0x53067d94
OBJ, CTRL, SENT, STACK = 0x55100000, 0x70200000, 0x70000100, 0x70080000
FN = OBJ + 0x1469
LIVE = [0, 0, 0, 0, 0]


class Cam:
    def __init__(self, rtos):
        d = open(rtos, 'rb').read()
        self.u = u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_map(0x70000000, 0x400000)
        self.now = 1000; self.ctrl = 0x08000000; self.log = []
        u.mem_write(FN, bytes([7]))   # Fn's own function, 7 (AE Lock)
        for k, f in enumerate(LIVE): u.mem_write(0x550832ac + (0xf9, 0xfa, 0xfb, 0xe6, 0xe7)[k], bytes([f]))   # the Hold lines' bytes (builds with `holdLines`)

        def code(uc, a, s, _):
            if a == SENT:
                uc.emu_stop()
            elif a == APP:
                uc.reg_write(UC_ARM_REG_R0, 1); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
            elif a == SETTINGS:
                uc.reg_write(UC_ARM_REG_R0, OBJ); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
            elif a == CONTROLLERS:
                uc.mem_write(CTRL, struct.pack('<I', self.ctrl)); uc.reg_write(UC_ARM_REG_R0, CTRL); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
            elif a == TK:
                r0 = uc.reg_read(UC_ARM_REG_R0); uc.mem_write(r0, struct.pack('<II', 0, self.now & 0xffffffff)); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
            elif a == AFTER:
                self.log.append((uc.reg_read(UC_ARM_REG_R1), uc.mem_read(FN, 1)[0]))
                uc.reg_write(UC_ARM_REG_R0, 0); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        u.hook_add(UC_HOOK_CODE, code)

    def key(self, code, dt=0, this=0x1234):
        self.now += dt; u = self.u; self.log = []; fn0 = u.mem_read(FN, 1)[0]
        for r in range(13): u.reg_write(UC_ARM_REG_R0 + r, 0x5000 + r)
        u.reg_write(UC_ARM_REG_R0, this); u.reg_write(UC_ARM_REG_R1, code)
        u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, SENT)
        u.emu_start(ENTRY, SENT, count=20000)
        assert u.reg_read(UC_ARM_REG_SP) == STACK, 'sp'
        assert u.mem_read(FN, 1)[0] == fn0, 'Fn field restored'
        return list(self.log), u.reg_read(UC_ARM_REG_R0)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); ap.add_argument('--functions', default='5,45,0,0,0'); a = ap.parse_args()
    fns = [int(x) for x in a.functions.split(',')]
    global LIVE
    LIVE = fns
    c = Cam(a.built); n = 0
    def ok(cond, what):
        nonlocal n
        assert cond, what; n += 1
    pad = [(26, 22, 28), (29, 30, 31), (32, 33, 34), (35, 36, 37)]
    # a key without a Hold function: everything passes, in order, untouched
    for i, keys in enumerate(pad):
        if not fns[i + 1]:
            for k in keys:
                log, r = c.key(k); ok(log == [(k, 7)], ('pass', k, log))
    log, r = c.key(50); ok(log == [(50, 7)], 'OK key')
    c.ctrl = 0x0200000f
    for k in (24, 25, 26, 22, 28, 29, 30, 31):
        log, r = c.key(k); ok(log == [(k, 7)], ('not live view', k, log))
    c.ctrl = 0x08000002
    for i, (press, held, release) in enumerate(pad):
        f = fns[i + 1]
        if not f: continue
        # a short press replays the press then the release
        log, r = c.key(press); ok(log == [] and r == 1, ('pressed kept back', press, log, r))
        log, r = c.key(release); ok(log == [(press, 7), (release, 7)], ('short', press, log))
        # a long press: the held code runs the function as Fn's press and release, the release is swallowed
        c.key(press); log, r = c.key(held); ok(log == [(24, f), (25, f)] and r == 1, ('held', press, log, r))
        log, r = c.key(held); ok(log == [] and r == 1, ('held again', press, log))
        log, r = c.key(release); ok(log == [] and r == 1, ('released after hold', press, log))
        # a press released after the threshold, no held code: runs too; just before: a short press
        c.key(press); log, r = c.key(release, dt=900); ok(log == [(24, f), (25, f)] and r == 1, ('long by time', press, log, r))
        c.key(press); log, r = c.key(release, dt=599); ok(log == [(press, 7), (release, 7)], ('short by time', press, log))
        # a stray held code with no press: passes
        log, r = c.key(held); ok(log == [(held, 7)], ('stray held', held, log))
    if fns[0]:
        c.key(24); log, r = c.key(25, dt=100); ok(log == [(24, 7), (25, 7)], ('Fn short', log))
        c.key(24); log, r = c.key(25, dt=900); ok(log == [(24, fns[0]), (25, fns[0])] and r == 1, ('Fn long', log, r))
        c.key(24); log, r = c.key(25, dt=599); ok(len(log) == 2 and log[0][1] == 7, ('Fn just short', log))
        c.key(24); log, r = c.key(25, dt=600); ok(log[0][1] == fns[0], ('Fn just long', log))
    # Macro semantics (builds with `holdLines`): the up key's own function (byte 0x7A: 0 Macro Mode, 255 Off, else the function) and function 46
    def own(key_i, f):   # the key's own function: Fn / down / left / right live bytes 0x469 / 0x46c / 0x46a / 0x46b
        return OBJ + 0x1000 + (0x469, 0, 0x46c, 0x46a, 0x46b)[key_i]
    def reset(hold=(0, 0, 0, 0, 0), macro=0, fnval=7):
        for k, f in enumerate(hold): c.u.mem_write(0x550832ac + (0xf9, 0xfa, 0xfb, 0xe6, 0xe7)[k], bytes([f]))
        c.u.mem_write(0x550832ac + 0x7a, bytes([macro])); c.u.mem_write(FN, bytes([fnval]))
        for off in (0x46a, 0x46b, 0x46c): c.u.mem_write(OBJ + 0x1000 + off, bytes([3]))
    c.ctrl = 0x08000002
    reset(macro=0)   # default: Macro Mode, up passes natively
    for k in (26, 28, 22): log, r = c.key(k); ok(log == [(k, 7)] and r == 0, ('macro default passes', k, log, r))
    reset(macro=21)   # up key given function 21
    log, r = c.key(26); ok(log == [] and r == 1, ('up fn pressed', log))
    log, r = c.key(28); ok(log == [(24, 21), (25, 21)] and r == 1, ('up fn short', log))
    c.key(26); log, r = c.key(22); ok(log == [] and r == 1, ('up fn: held code without Hold is swallowed', log))
    log, r = c.key(28); ok(log == [(24, 21), (25, 21)] and r == 1, ('up fn: the release runs it', log))
    reset(macro=255)   # Off
    log, r = c.key(26); ok(log == [] and r == 1, ('up off pressed', log))
    log, r = c.key(28); ok(log == [] and r == 1, ('up off release', log))
    reset(macro=46)   # explicit Macro Mode = default
    for k in (26, 28): log, r = c.key(k); ok(log == [(k, 7)], ('up 46 native', k, log))
    reset(macro=0, fnval=46)   # Fn given Macro Mode: its short press is the up key's native press and release
    c.u.mem_write(FN, bytes([46]))
    c.key(24); log, r = c.key(25, dt=100); ok([x[0] for x in log] == [26, 28] and r == 1, ('Fn = Macro Mode', log, r))
    for key_i, (press, held, release) in zip((2, 3, 4), pad[1:]):   # down / left / right set to 46 through the live byte
        reset(macro=0); c.u.mem_write(OBJ + 0x1000 + (0, 0, 0x46c, 0x46a, 0x46b)[key_i], bytes([46]))
        c.key(press); log, r = c.key(release, dt=100); ok([x[0] for x in log] == [26, 28] and r == 1, ('own 46', press, log, r))
    reset(hold=(0, 46, 0, 0, 0), macro=0)   # Hold on up = Macro Mode: long press on up runs the native press and release; short press native
    c.key(26); log, r = c.key(22); ok([x[0] for x in log] == [26, 28], ('hold 46 on up', log))
    reset(hold=(0, 0, 0, 0, 46), macro=0)   # Hold on right = Macro Mode
    c.key(35); log, r = c.key(36); ok([x[0] for x in log] == [26, 28], ('hold 46 on right', log))
    c.key(35); log, r = c.key(37, dt=100); ok(log == [(35, 3), (37, 3)] or [x[0] for x in log] == [35, 37], ('right short with hold 46', log))
    print('ok', n)

main()
