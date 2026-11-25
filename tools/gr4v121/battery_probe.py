#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11: the battery percentage hook (core/src/fw/gr4v121/aspect/battery.ts, from GR Mod 0.9.1).

  python3 battery_probe.py --built BUILT.rtos [--cases N] [--seed S]

Runs the hook placed in front of GetBatteryIcon (0x533AA150) in the emulator against a model of its rules:
 - not on battery (r1 != 1): the camera's own code, every register as it came;
 - the power report (service [0x5537EEA0 + 4], index +0xAC with its busy bit, buffer +0x5C + 4 index, report at +4):
   missing holder, service or buffer, a source other than battery, a charge above 100, or a step more than one away from
   the charge's: the camera's own code, registers as they came, the shown step unchanged;
 - else the icon 1099 + step (10..100 %, the shown step moving only 9 or more away from its centre), or the camera's own
   icon below 5 % (step 0); the shown step + 1 kept in 0x55839040; r1..r7, sp kept.
Random reports and long sequences of charges (the hysteresis). No camera function is called by the hook.
"""
import argparse, random, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM
from unicorn import arm_const as R

BASE = 0x53000000
ENTRY, NATIVE = 0x533AA150, 0x533AA154
GUARD, HOLDER, SHOWN = 0x5537EFC4, 0x5537EEA0, 0x55839040
SERVICE, BUF0, BUF1 = 0x55A00000, 0x55A00200, 0x55A00300
STOP, STACK = 0x60000000, 0x61000000 - 0x100
ICON0 = 1100

ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); ap.add_argument('--cases', type=int, default=20000); ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args()
img = open(a.built, 'rb').read()
u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(BASE, (len(img) + 0xFFFF) & ~0xFFFF); u.mem_write(BASE, img)
u.mem_map(0x55000000, 0x1000000); u.mem_map(STOP, 0x1000); u.mem_map(STACK - 0xFF00, 0x10000)
w32 = lambda at, v: u.mem_write(at, struct.pack('<I', v & 0xFFFFFFFF))
r32 = lambda at: struct.unpack('<I', bytes(u.mem_read(at, 4)))[0]
assert r32(ENTRY) >> 24 == 0xEA, 'GetBatteryIcon is not hooked'
REG = [getattr(R, 'UC_ARM_REG_R%d' % i) for i in range(8)]

def setup(rep):
    """rep: dict guard, holder_service, index, busy, buffers present, src, step byte unused, charge."""
    w32(GUARD, rep['guard']); w32(HOLDER + 4, SERVICE if rep['service'] else 0)
    w32(SERVICE + 0xAC, rep['index'] | (0x8000 if rep['busy'] else 0))
    w32(SERVICE + 0x5C, BUF0 if rep['buf'] else 0); w32(SERVICE + 0x60, BUF1 if rep['buf'] else 0)
    for b, (src, charge) in ((BUF0, rep['r0']), (BUF1, rep['r1'])):
        u.mem_write(b + 4, bytes([src, 37, 2, charge]))

def model(regs, rep, shown):
    """(path, icon or None, new shown)."""
    if regs[1] != 1: return 'native', None, shown
    if not (rep['guard'] & 1) or not rep['service'] or not rep['buf']: return 'native', None, shown
    idx = rep['index'] | (0x8000 if rep['busy'] else 0)
    if idx & 0x8000: idx -= 1
    src, charge = (rep['r0'], rep['r1'])[idx & 1]
    if src & 15 != 1 or charge > 100: return 'native', None, shown
    implied = 4 if charge >= 50 else 3 if charge >= 20 else 2 if charge >= 5 else 1
    step = regs[2]
    if step > 4: return 'native', None, shown
    s = max(step, 1)
    if abs(implied - s) > 1: return 'native', None, shown
    k = None
    if charge >= 5 and shown >= 1:
        centre = 10 * (shown - 1)
        if not (charge >= centre + 9) and charge + 9 > centre: k = shown - 1
    if k is None: k = ((charge + 5) * 205) >> 11
    if k == 0: return 'native', None, k + 1
    return 'icon', ICON0 - 1 + k, k + 1

rng = random.Random(a.seed)
counts = {'native': 0, 'icon': 0}
def run(regs, rep, shown):
    setup(rep); u.mem_write(SHOWN, bytes([shown]))
    for i, v in enumerate(regs): u.reg_write(REG[i], v)
    u.reg_write(R.UC_ARM_REG_SP, STACK); u.reg_write(R.UC_ARM_REG_LR, STOP); u.reg_write(R.UC_ARM_REG_CPSR, 0x13)
    u.emu_start(ENTRY, 0, count=400, until=None) if False else None
    # Run until the camera's own code (NATIVE) or the return (STOP).
    pc = ENTRY
    for _ in range(400):
        u.emu_start(pc, 0xFFFFFFFF, count=1)
        pc = u.reg_read(R.UC_ARM_REG_PC)
        if pc in (NATIVE, STOP): break
    else: raise AssertionError('did not end')
    path, icon, new = model(regs, rep, shown)
    got = [u.reg_read(r) for r in REG]
    assert u.reg_read(R.UC_ARM_REG_SP) == STACK, 'stack'
    if path == 'native':
        assert pc == NATIVE, ('expected the camera code', regs, rep, shown)
        assert got == regs, ('registers changed on the native path', regs, got)
        # flags of the replayed cmp r1,#1
        z = (u.reg_read(R.UC_ARM_REG_CPSR) >> 30) & 1
        assert z == (1 if regs[1] == 1 else 0), 'flags'
    else:
        assert pc == STOP, ('expected an icon', regs, rep, shown)
        assert got[0] == icon and got[1:] == regs[1:], ('icon / registers', icon, got, regs)
    assert u.mem_read(SHOWN, 1)[0] == new, ('shown step', regs, rep, shown, u.mem_read(SHOWN, 1)[0], new)
    counts[path] += 1
    return new

def report(charge=None):
    c = rng.randrange(0, 106) if charge is None else charge
    return {'guard': rng.choice([1, 1, 1, 0, 3]), 'service': rng.random() > 0.05, 'index': rng.randrange(0, 4), 'busy': rng.random() < 0.3,
            'buf': rng.random() > 0.05, 'r0': (rng.choice([0x11, 0x01, 0x21, 0x12, 0x02]), c), 'r1': (rng.choice([0x11, 0x01, 0x21, 0x12, 0x02]), c)}

# 1. Random single calls.
for _ in range(a.cases):
    regs = [rng.getrandbits(32) for _ in range(8)]
    regs[1] = rng.choice([1, 1, 1, 0, 2]); regs[2] = rng.choice([0, 1, 2, 3, 4, 4, 5]); regs[3] = rng.randrange(0, 3)
    run(regs, report(), rng.randrange(0, 12))
# 2. A day of shooting: the charge drifting down with jumps of up to 4, the step agreeing; the shown step must never jump back and forth.
for day in range(40):
    shown, charge, seen = 0, 100, []
    while charge >= 0:
        rep = {'guard': 1, 'service': True, 'index': 0, 'busy': False, 'buf': True, 'r0': (1, charge), 'r1': (1, charge)}
        step = 4 if charge >= 50 else 3 if charge >= 20 else 2 if charge >= 5 else 1
        regs = [rng.getrandbits(32) for _ in range(8)]; regs[1] = 1; regs[2] = step; regs[3] = 0
        shown = run(regs, rep, shown); seen.append(shown)
        charge += rng.choice([-1, -1, -2, 0, 1, 2, -4, 3]) if charge > 3 else -1
    flips = sum(1 for i in range(2, len(seen)) if seen[i] == seen[i - 2] != seen[i - 1])
    assert flips <= 3, ('the shown step jitters', day, flips)
print('calls', counts, '| sequences 40 | ok')
