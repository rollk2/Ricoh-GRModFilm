#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11: custom grid lines (core/src/fw/gr4v121/aspect/grid.ts, from GR Mod 0.9.1).

  python3 grid_probe.py --built BUILT.rtos --g3 BITS --g4 BITS

BITS: 8 characters 0/1, lines in grid.ts order (horizontal top, centre, bottom; vertical left, centre, right; diagonal from
the top left, from the bottom left). Runs both hooks of the built image in the emulator, for both styles and several frames:
 - GridView::Draw's straight lines (hook 0x5359C510 .. 0x5359C5A0): the frame getters and the line drawer are stubbed and
   record what is drawn; the division is the camera's own (0x53154A70). Each line that is on is drawn once, at
   k * (length / divisions) - 1 from the frame's edge, 2 pixels wide, across the frame; nothing else; r4, r5, fp, sp kept.
 - the layout's diagonals (hook 0x5359C2EC .. 0x5359C314): the point setter, the colour setter and SetVisible are stubbed;
   each diagonal that is on gets its two corners, thickness 2, the grid's colour (+0xF5) and is shown; the others are hidden.
"""
import argparse, random, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn import arm_const as R

BASE = 0x53000000
HORIZONTAL, LINES_DONE = 0x5359C510, 0x5359C5A0
FRAME_WIDTH, FRAME_HEIGHT, DRAW_LINE = 0x53912484, 0x53912494, 0x5359C13C
DIAGONALS, LAYOUT_DONE = 0x5359C2EC, 0x5359C314
DIAGONAL_CALLS = (0x5359C364, 0x5359C3A4)
SET_COLOUR, SET_VISIBLE = 0x5359239C, 0x535AD6AC
VIEW, CTX, FRAME, CHILD = 0x55A00000, 0x55A01000, 0x55A02000, (0x55A03000, 0x55A04000)
STACK, FP = 0x56000000 - 0x800, 0x56000000 - 0x100

ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); ap.add_argument('--g3', required=True); ap.add_argument('--g4', required=True)
a = ap.parse_args()
grid = {'g3': [c == '1' for c in a.g3], 'g4': [c == '1' for c in a.g4]}
assert all(len(v) == 8 for v in grid.values())
img = open(a.built, 'rb').read()
u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
u.mem_map(BASE, (len(img) + 0xFFFF) & ~0xFFFF); u.mem_write(BASE, img)
u.mem_map(0x55000000, 0x1100000)
r32 = lambda at: struct.unpack('<I', bytes(u.mem_read(at, 4)))[0]
w32 = lambda at, v: u.mem_write(at, struct.pack('<I', v & 0xFFFFFFFF))
reg = lambda n: u.reg_read(getattr(R, 'UC_ARM_REG_' + n))
for at in (HORIZONTAL, DIAGONALS): assert r32(at) >> 24 == 0xEA, 'not hooked: %x' % at
calls = [r32(c) for c in DIAGONAL_CALLS]
assert all(c >> 24 == 0xEB for c in calls)
set_points = {(c + 8 + ((((w & 0xFFFFFF) ^ 0x800000) - 0x800000) << 2)) & 0xFFFFFFFF for c, w in zip(DIAGONAL_CALLS, calls)}
assert len(set_points) == 1; SET_POINTS = set_points.pop()

log = []; state = {}
def ret(value=None):
    if value is not None: u.reg_write(R.UC_ARM_REG_R0, value)
    u.reg_write(R.UC_ARM_REG_PC, reg('LR'))
def hook(uc, at, size, _):
    if at == FRAME_WIDTH: ret(state['w'])
    elif at == FRAME_HEIGHT: ret(state['h'])
    elif at == DRAW_LINE:
        x, y, w, h = struct.unpack('<4i', bytes(u.mem_read(reg('R2'), 16)))
        assert reg('R0') == VIEW and reg('R1') == CTX
        log.append(('line', x, y, w, h)); ret()
    elif at == SET_POINTS:
        p = struct.unpack('<2i', bytes(u.mem_read(reg('R1'), 8))) + struct.unpack('<2i', bytes(u.mem_read(reg('R2'), 8)))
        log.append(('points', reg('R0'), p, reg('R3'))); ret()
    elif at == SET_COLOUR: log.append(('colour', reg('R0'), reg('R1') & 0xFF)); ret()
    elif at == SET_VISIBLE: log.append(('visible', reg('R0'), reg('R1') & 0xFF)); ret()
u.hook_add(UC_HOOK_CODE, hook, begin=FRAME_WIDTH, end=FRAME_WIDTH)
for at in (FRAME_HEIGHT, DRAW_LINE, SET_POINTS, SET_COLOUR, SET_VISIBLE): u.hook_add(UC_HOOK_CODE, hook, begin=at, end=at)

STRAIGHT = {'g3': [(False, 1, 3), (False, 1, 2), (False, 2, 3), (True, 1, 3), (True, 1, 2), (True, 2, 3)],
            'g4': [(False, 1, 4), (False, 2, 4), (False, 3, 4), (True, 1, 4), (True, 2, 4), (True, 3, 4)]}

def run(start, stop, regs):
    for k, v in regs.items(): u.reg_write(getattr(R, 'UC_ARM_REG_' + k), v)
    u.emu_start(start, stop, count=20000)
    assert reg('PC') == stop

rng = random.Random(3); cases = 0
for style in ('g3', 'g4'):
    for w, h, left, top in ((720, 480, 0, 0), (720, 404, 0, 38), (640, 480, 40, 0), (480, 480, 120, 0), (rng.randrange(100, 720), rng.randrange(100, 480), rng.randrange(0, 50), rng.randrange(0, 50))):
        # Straight lines.
        log.clear(); state.update(w=w, h=h)
        u.mem_write(VIEW + 0xF4, bytes([0 if style == 'g3' else rng.choice([1, 2, 3])])); u.mem_write(VIEW + 0xF5, bytes([16]))
        w32(FP - 0x48, FRAME); w32(FP - 0x50, left); w32(FP - 0x54, top)
        regs = dict(R4=VIEW, R5=CTX, R7=0x1111, R10=0x2222, FP=FP, SP=STACK)
        run(HORIZONTAL, LINES_DONE, regs)
        assert reg('R4') == VIEW and reg('R5') == CTX and reg('FP') == FP and reg('SP') == STACK, 'registers'
        want = []
        for i, (vertical, k, n) in enumerate(STRAIGHT[style]):
            if not grid[style][i]: continue
            want.append(('line', left + k * (w // n) - 1, top, 2, h) if vertical else ('line', left, top + k * (h // n) - 1, w, 2))
        assert log == want, (style, w, h, log, want)
        # Diagonals.
        log.clear()
        w32(VIEW + 0xEC, CHILD[0]); w32(VIEW + 0xF0, CHILD[1]); u.mem_write(VIEW + 0xF5, bytes([rng.choice([16, 19, 1])]))
        colour = u.mem_read(VIEW + 0xF5, 1)[0]
        run(DIAGONALS, LAYOUT_DONE, dict(R4=VIEW, R7=w, R8=h, R6=0x3333, FP=FP, SP=STACK))
        assert reg('R4') == VIEW and reg('R6') == 0x3333 and reg('SP') == STACK, 'registers (layout)'
        want = []
        for d in range(2):
            if not grid[style][6 + d]: want.append(('visible', CHILD[d], 0)); continue
            want += [('points', CHILD[d], (0, 0, w, h) if d == 0 else (0, h, w, 0), 2), ('colour', CHILD[d], colour), ('visible', CHILD[d], 1)]
        assert log == want, (style, log, want)
        cases += 1
print('frames', cases, 'per hook | straight lines and diagonals as chosen | ok')
