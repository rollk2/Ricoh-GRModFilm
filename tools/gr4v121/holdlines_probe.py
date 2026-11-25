#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11, `holdLines` (core/src/fw/gr4v121/aspect/holdlines.ts), in the emulator.

  python3 holdlines_probe.py --official OFFICIAL.rtos --built BUILT.rtos

Fn Button Setting's functions with the new genre 6 (row 6, « Hold Fn »): the list's setup (7 rows of type 0x22), the title, the current function,
the opening (list controller id), the rows loop (7 rows, a value drawn for each, no assertion), and the list record (the id's mapping, the
title, « set » and « is current » on the Hold byte); every other genre as in the official file.
"""
import argparse, struct
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
OBJ, THIS, VEC, SENT, STACK = 0x55100000, 0x70300000, 0x70310000, 0x70000100, 0x70080000
SETTINGS_OBJ_CALLS = {0x53240cac: 'app', 0x53241240: 'settings', 0x532415a0: 'resources', 0x5340171c: 'mono', 0x5359475c: 'row', 0x5318408c: 'open',
                      0x53916230: 'assert', 0x5359453c: 'types', 0x5359468c: 'item', 0x531ea2d8: 'value', 0x5359aa2c: 'text', 0x535a6ba8: 'w1',
                      0x535a6c38: 'w2', 0x535a6c08: 'w3', 0x531ea524: None}


class Cam:
    def __init__(self, rtos):
        d = open(rtos, 'rb').read(); self.d = d
        u = self.u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_map(0x70000000, 0x400000)
        self.row = 0; self.mono = 0; self.log = []
        self.stub = {a: n for a, n in SETTINGS_OBJ_CALLS.items() if n}

        def code(uc, a, s, _):
            if a == SENT: uc.emu_stop(); return
            n = self.stub.get(a)
            if n is None: return
            r = [uc.reg_read(UC_ARM_REG_R0 + i) for i in range(4)]
            self.log.append((n, *r))
            ret = {'app': 1, 'settings': OBJ, 'resources': 0x70200000, 'mono': self.mono, 'row': self.row, 'item': 0x70350000 + 4 * r[1]}.get(n, 0)
            if n == 'open':   # a tail call: the function is over
                uc.reg_write(UC_ARM_REG_R0, 0); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR)); return
            uc.reg_write(UC_ARM_REG_R0, ret); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        u.hook_add(UC_HOOK_CODE, code)
        u.mem_write(THIS + 0x170, struct.pack('<I', 0x70360000))   # the list widget

    def call(self, addr, args=(), row=0, mono=0, stub=None):
        u = self.u; self.row = row; self.mono = mono; self.log = []
        saved = dict(self.stub)
        if stub is not None: self.stub = {a: n for a, n in self.stub.items() if a not in stub}
        for r in range(13): u.reg_write(UC_ARM_REG_R0 + r, 0x5000 + r)
        for i, a in enumerate(args): u.reg_write(UC_ARM_REG_R0 + i, a)
        u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, SENT)
        try: u.emu_start(addr, SENT, count=20000)
        finally: self.stub = saved
        return u.reg_read(UC_ARM_REG_R0), list(self.log)


ROW_GENRES = [0, 6, 1, 7, 2, 8, 3, 9, 11, 10, 4, 5]
MACRO_BYTE = 0x550832a8 + 4 + 0x7a
MACRO_ID = 0x020001e5
RECORD = 0x550832a8 + 4
BYTES = [RECORD + o for o in (0xf9, 0xfa, 0xfb, 0xe6, 0xe7)]      # Fn, up, down, left, right
KEY_OF_GENRE = {6: 0, 7: 3, 8: 4, 9: 2, 10: 1}
IDS = [0x020001e0 + k for k in range(5)]


def imm(w): return ((w >> 4) & 0xf000) | (w & 0xfff)


def pointer_at(d, lo, hi): return (imm(struct.unpack_from('<I', d, hi - B)[0]) << 16) | imm(struct.unpack_from('<I', d, lo - B)[0])


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True); a = ap.parse_args()
    o, b = Cam(a.official), Cam(a.built); n = 0
    def ok(c, what):
        nonlocal n
        assert c, what; n += 1
    # the genre table: the rows' order, read by all five readers
    for lo_, hi_ in ((0x531e9b30, 0x531e9b34), (0x531ea0d4, 0x531ea0d8), (0x531ea284, 0x531ea288), (0x531ea348, 0x531ea34c), (0x531ea5fc, 0x531ea604)):
        t = pointer_at(b.d, lo_, hi_)
        ok(list(b.u.mem_read(t, 12)) == ROW_GENRES, ('genre table', hex(lo_), list(b.u.mem_read(t, 12))))
    for cam in (o, b):
        for k in range(7): cam.u.mem_write(OBJ + 0x1469 + k, bytes([20 + k]))
    # the title: genres 0..5 as official (both models); the Hold genres: their texts (the fourth by the model)
    for mono in (0, 1):
        for g in range(6):
            ro, _ = o.call(0x531ea524, (THIS, g), mono=mono); rb, _ = b.call(0x531ea524, (THIS, g), mono=mono)
            ok(ro == rb, ('title', g, mono, ro, rb))
        for g, want in ((6, 1056), (7, 1057), (8, 1058), (10, 1061), (11, 1062)):  # texts 1056.. (convergence step 2; 1040.. before)
            r, _ = b.call(0x531ea524, (THIS, g), mono=mono); ok(r == want, ('title', g, r))
        r, _ = b.call(0x531ea524, (THIS, 9), mono=mono); ok(r == (1059 if mono else 1060), ('title 9', mono, r))
    # the current function: 0..5 as official, the Hold genres the bytes (0..45, else Off)
    for g in range(6):
        ro, _ = o.call(0x531ea18c, (THIS, g)); rb, _ = b.call(0x531ea18c, (THIS, g)); ok(ro == rb, ('getter', g, ro, rb))
    for g, key in KEY_OF_GENRE.items():
        for v, want in ((0, 0), (33, 33), (45, 45), (46, 46), (47, 0), (200, 0)):
            for k in range(5): b.u.mem_write(BYTES[k], bytes([0]))
            b.u.mem_write(BYTES[key], bytes([v]))
            r, _ = b.call(0x531ea18c, (THIS, g)); ok(r == want, ('getter hold', g, v, r))
            for other in range(5):
                if other != key and v: ok(b.call(0x531ea18c, (THIS, [gg for gg, kk in KEY_OF_GENRE.items() if kk == other][0]))[0] == 0, ('getter hold isolated', g, other))
    for k in range(5): b.u.mem_write(BYTES[k], bytes([0]))
    # genre 11, Macro Button: the byte 0 shows Macro Mode (46), 255 Off, the function as is, a stranger Off
    for v, want in ((0, 46), (255, 0), (21, 21), (45, 45), (46, 46), (100, 0)):
        b.u.mem_write(MACRO_BYTE, bytes([v])); r, _ = b.call(0x531ea18c, (THIS, 11)); ok(r == want, ('getter macro', v, r))
    b.u.mem_write(MACRO_BYTE, bytes([0]))
    # the opening, row by row (the official ids for the official genres, the Hold ids for the Hold genres)
    for mono in (0, 1):
        for row in range(12):
            g = ROW_GENRES[row]
            _, lb = b.call(0x531e9b14, (THIS,), row=row, mono=mono); op = [x for x in lb if x[0] == 'open']
            if g <= 5:
                _, lo = o.call(0x531e9b14, (THIS,), row=g, mono=mono); oo = [x for x in lo if x[0] == 'open']
                ok(op == oo, ('open', row, g, mono, op, oo))
            elif g == 11:
                ok(len(op) == 1 and op[0][2] == MACRO_ID and op[0][3] == 0x020000e4, ('open macro', row, op))
            else:
                ok(len(op) == 1 and op[0][2] == IDS[g - 6] and op[0][3] == 0x020000e4, ('open hold', row, g, op))
    # the list's setup: the rows of the type 0x22
    w_ = struct.unpack_from('<I', b.d, 0x531ea084 - B)[0]; off_ = w_ & 0xffffff; off_ = off_ - (1 << 24) if off_ & 0x800000 else off_
    setup = 0x531ea084 + 8 + off_ * 4
    ok((w_ >> 24) == 0xeb and setup != 0x531e9d20, 'the constructor calls our setup')
    _, lb = b.call(setup, (THIS,)); ty = [x for x in lb if x[0] == 'types']
    ok(len(ty) == 1 and ty[0][3] == 12, ('setup', ty))
    # the rows loop: all rows, a value drawn for each (the official: six), no assertion
    _, lo = o.call(0x531ea5e8, (THIS,)); _, lb = b.call(0x531ea5e8, (THIS,))
    ok(sum(1 for x in lo if x[0] == 'item') == 6 and sum(1 for x in lb if x[0] == 'item') == 12, ('rows', len(lo), len(lb)))
    ok(sum(1 for x in lb if x[0] == 'value') == 12 and not any(x[0] == 'assert' for x in lb), ('assert / values in the rows loop', [x[0] for x in lb]))
    # the description under the list: the Hold rows read as genre 0
    # the picture of the button's place (the first call of 0x5359aa2c, 340 x 160): the key's own for its Hold line, a picture of its own for Macro
    PICTURE = {0: 622, 1: 695, 2: 696, 3: 697, 6: 622, 7: 695, 8: 696, 9: 697, 10: 1202, 11: 1202}  # Macro picture 1202 (740 before step 2)
    for row in range(12):
        g = ROW_GENRES[row]
        if g in (4, 5): continue
        _, lg = b.call(0x531ea0b8, (THIS,), row=row); texts = [x for x in lg if x[0] == 'text']
        ok(len(texts) == 2 and texts[0][2] == PICTURE[g] and texts[1][2] == 0x58, ('description picture', row, g, texts))
        if g <= 3:
            _, lo_ = o.call(0x531ea0b8, (THIS,), row=g); ok([x for x in lo_ if x[0] == 'text'] == texts, ('description as official', g))
    # the list records: the ids' mapping (SetCurrentMenu stores the record number at this + 0x1a4), the table, the title, set and is current
    d = b.d
    table = pointer_at(d, 0x531d8864, 0x531d8874)
    b.u.mem_write(THIS + 0x1b4, struct.pack('<II', VEC, VEC + 6)); b.u.mem_write(VEC, bytes([0, 1, 2, 3, 21, 45]))
    for i, id_ in enumerate(IDS):
        b.u.mem_write(THIS + 0x1a4, bytes([0])); b.call(0x531d7e68, (THIS, id_))
        rec_no = b.u.mem_read(THIS + 0x1a4, 1)[0]
        ok(rec_no >= 127, ('record number', i, rec_no))
        r = struct.unpack_from('<19I', d, table + rec_no * 0x4c - B)
        want_title = {6: 1056, 7: 1057, 8: 1058, 9: 1059, 10: 1061}[6 + i]
        ok(r[0] == 0x10000 and (r[1] & 0xffff) == want_title and r[3] == 0x531d11e8 and r[5] == 0x531d3688, ('record', i, [hex(x) for x in r[:6]]))
        key = KEY_OF_GENRE[6 + i]; setf, curf = r[9], r[11]
        for k in range(5): b.u.mem_write(BYTES[k], bytes([0]))
        b.call(setf, (THIS, 4))
        ok(b.u.mem_read(BYTES[key], 1)[0] == 21 and all(b.u.mem_read(BYTES[k], 1)[0] == 0 for k in range(5) if k != key), ('set', i))
        ok(b.call(curf, (THIS, 4))[0] == 1 and b.call(curf, (THIS, 5))[0] == 0 and b.call(curf, (THIS, 0))[0] == 0, ('current', i))
        b.call(setf, (THIS, 0)); ok(b.u.mem_read(BYTES[key], 1)[0] == 0 and b.call(curf, (THIS, 0))[0] == 1, ('set Off', i))
    # Macro Button's list: record 132, set / is current through the 0 <-> 46 and 255 <-> 0 mapping
    b.u.mem_write(THIS + 0x1a4, bytes([0])); b.call(0x531d7e68, (THIS, MACRO_ID))
    rn = b.u.mem_read(THIS + 0x1a4, 1)[0]; ok(rn >= 132, ('macro record number', rn))
    r = struct.unpack_from('<19I', d, table + rn * 0x4c - B)
    ok(r[0] == 0x10000 and (r[1] & 0xffff) == 1062 and r[3] == 0x531d11e8 and r[5] == 0x531d3688, ('macro record', [hex(x) for x in r[:6]]))
    setf, curf = r[9], r[11]
    b.u.mem_write(VEC, bytes([0, 1, 2, 3, 46, 45]))   # row 4 = Macro Mode (46), row 0 = Off
    for row, want_byte in ((4, 0), (0, 255), (5, 45), (2, 2)):
        b.call(setf, (THIS, row)); got = b.u.mem_read(MACRO_BYTE, 1)[0]; ok(got == want_byte, ('macro set', row, got))
        ok(b.call(curf, (THIS, row))[0] == 1 and b.call(curf, (THIS, (row + 1) % 6))[0] == 0, ('macro current', row))
    # the official ids still map as before
    for id_ in (0x020000e5, 0x020000e6, 0x020000eb):
        o.u.mem_write(THIS + 0x1a4, bytes([0])); o.call(0x531d7e68, (THIS, id_)); b.u.mem_write(THIS + 0x1a4, bytes([0])); b.call(0x531d7e68, (THIS, id_))
        ok(o.u.mem_read(THIS + 0x1a4, 1)[0] == b.u.mem_read(THIS + 0x1a4, 1)[0] != 0, ('official id mapping', hex(id_)))
    # the controller factory: the Hold ids are changed to an id of the Fn lists' bucket, the others untouched
    for id_, want in [(i, 0x020000ec) for i in IDS + [MACRO_ID]] + [(0x020000e6, 0x020000e6), (0x02000012, 0x02000012), (0x020000ec, 0x020000ec)]:
        u = b.u; seen = {}
        def code(uc, a_, s_, _):
            if a_ == 0x531871c0: seen['r1'] = uc.reg_read(UC_ARM_REG_R1); uc.emu_stop()
        h = u.hook_add(UC_HOOK_CODE, code)
        for r_ in range(13): u.reg_write(UC_ARM_REG_R0 + r_, 0x5000 + r_)
        u.reg_write(UC_ARM_REG_R0, THIS); u.reg_write(UC_ARM_REG_R1, id_); u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, SENT)
        try: u.emu_start(0x531871bc, SENT, count=200)
        except UcError: pass
        u.hook_del(h)
        ok(seen.get('r1') == want, ('factory', hex(id_), hex(seen.get('r1', 0))))
    print('ok', n)


main()
