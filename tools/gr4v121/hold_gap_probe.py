#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11: the custom buttons' Hold words must not touch the other features' words before the heap.

  python3 holdbuttons_probe.py's emulator; run: python3 hold_gap_probe.py --built BUILT.rtos [--expect-overwrite]

Plants markers in the added slots' state pointer (0x55839020) and the power-off pictures' word (0x55839030), gives Fn a Hold
function, drives a long then a short Fn press, and checks the markers. Revision-3 builds (GR Mod Film 1.2.0 .. 1.3.3) overwrite them
(the sleep freeze, docs/gr4-mono-recettes-etude.md 14.7); from revision 4 the Hold words are 0x55839014 / 0x55839018.
"""
import argparse, struct, os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'holdbuttons_probe.py')).read()
g = {}; exec(compile(src[:src.index('\ndef main')], 'holdbuttons_probe', 'exec'), g)
ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); ap.add_argument('--expect-overwrite', action='store_true'); a = ap.parse_args()
c = g['Cam'](a.built); u = c.u; OBJ, FN = g['OBJ'], g['FN']
for k, f in enumerate((5, 0, 0, 0, 0)): u.mem_write(0x550832ac + (0xf9, 0xfa, 0xfb, 0xe6, 0xe7)[k], bytes([f]))
u.mem_write(0x550832ac + 0x7a, bytes([0])); u.mem_write(FN, bytes([7]))
for off in (0x46a, 0x46b, 0x46c): u.mem_write(OBJ + 0x1000 + off, bytes([3]))
c.ctrl = 0x08000002
u.mem_write(0x55839020, struct.pack('<I', 0xCAFEF00D)); u.mem_write(0x55839030, struct.pack('<I', 0x0BADBEEF))
c.key(24); c.key(25, dt=900); c.key(24); c.key(25, dt=100)
w20 = struct.unpack('<I', bytes(u.mem_read(0x55839020, 4)))[0]; w30 = struct.unpack('<I', bytes(u.mem_read(0x55839030, 4)))[0]
intact = w20 == 0xCAFEF00D and w30 == 0x0BADBEEF
print('slot state', hex(w20), '| pictures', hex(w30), '|', 'intact' if intact else 'overwritten')
assert intact != a.expect_overwrite, 'unexpected result'
print('ok')
