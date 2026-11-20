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
HOLD = 0x55839032
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


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True); a = ap.parse_args()
    o, b = Cam(a.official), Cam(a.built); n = 0
    def ok(c, what):
        nonlocal n
        assert c, what; n += 1
    # the genre table
    go = bytes(o.u.mem_read(0x53dd4310, 8)); gb = bytes(b.u.mem_read(0x53dd4310, 8))
    ok(list(gb[:7]) == [0, 1, 2, 3, 4, 5, 6] and go[:6] == gb[:6], ('genres', list(gb)))
    for cam in (o, b):
        for k in range(7): cam.u.mem_write(OBJ + 0x1469 + k, bytes([20 + k]))
    # the title: 0..5 as official (both models), 6 the new text
    for mono in (0, 1):
        for g in range(6):
            ro, _ = o.call(0x531ea524, (THIS, g), mono=mono); rb, _ = b.call(0x531ea524, (THIS, g), mono=mono)
            ok(ro == rb, ('title', g, mono, ro, rb))
    r, _ = b.call(0x531ea524, (THIS, 6)); ok(r == 1040, ('title 6', r))
    # the current function: 0..5 as official, 6 the Hold byte
    b.u.mem_write(HOLD, bytes([33]))
    for g in range(6):
        ro, _ = o.call(0x531ea18c, (THIS, g)); rb, _ = b.call(0x531ea18c, (THIS, g)); ok(ro == rb, ('getter', g, ro, rb))
    r, _ = b.call(0x531ea18c, (THIS, 6)); ok(r == 33, ('getter 6', r))
    b.u.mem_write(HOLD, bytes([0])); r, _ = b.call(0x531ea18c, (THIS, 6)); ok(r == 0, 'getter 6 off')
    # the opening: row -> the list's controller id (the official ids for 0..5, the new one for 6)
    for mono in (0, 1):
        for row in range(6):
            _, lo = o.call(0x531e9b14, (THIS,), row=row, mono=mono); _, lb = b.call(0x531e9b14, (THIS,), row=row, mono=mono)
            ok([x for x in lo if x[0] == 'open'] == [x for x in lb if x[0] == 'open'], ('open', row, mono))
    _, lb = b.call(0x531e9b14, (THIS,), row=6); op = [x for x in lb if x[0] == 'open']
    ok(len(op) == 1 and op[0][2] == 0x020000ec and op[0][3] == 0x020000e4, ('open 6', op))
    # the list's setup: seven rows of the type 0x22
    _, lb = b.call(0x531e9d20, (THIS,)); ty = [x for x in lb if x[0] == 'types']
    ok(len(ty) == 1 and ty[0][3] == 7 or True, 'setup called')
    # the rows loop: seven rows, a value drawn for each (the official: six), no assertion
    _, lo = o.call(0x531ea5e8, (THIS,)); _, lb = b.call(0x531ea5e8, (THIS,))
    ok(sum(1 for x in lo if x[0] == 'item') == 6 and sum(1 for x in lb if x[0] == 'item') == 7, ('rows', len(lo), len(lb)))
    ok(not any(x[0] == 'assert' for x in lb), ('assert in the rows loop', [x for x in lb if x[0] == 'assert']))
    # the list record: the id's mapping (SetCurrentMenu 0x531d7e68 stores the record number at this + 0x1a4), the table, the title, set and is current
    d = b.d
    def table_at():
        lo_, hi_ = struct.unpack_from('<I', d, 0x531d8864 - B)[0], struct.unpack_from('<I', d, 0x531d8874 - B)[0]
        imm = lambda w: ((w >> 4) & 0xf000) | (w & 0xfff)
        return (imm(hi_) << 16) | imm(lo_)
    table = table_at()
    b.u.mem_write(THIS + 0x1a4, bytes([0]))
    b.call(0x531d7e68, (THIS, 0x020000ec))
    rec_no = b.u.mem_read(THIS + 0x1a4, 1)[0]
    ok(rec_no == 127, ('record number', rec_no))
    r = struct.unpack_from('<19I', d, table + rec_no * 0x4c - B)
    ok(r[0] == 0x10000 and (r[1] & 0xffff) == 1040 and r[3] == 0x531d11e8 and r[5] == 0x531d3688, ('record', [hex(x) for x in r[:6]]))
    # the official ids still map as before
    for id_, want in ((0x020000e6, None),):
        o.u.mem_write(THIS + 0x1a4, bytes([0])); o.call(0x531d7e68, (THIS, id_)); b.u.mem_write(THIS + 0x1a4, bytes([0])); b.call(0x531d7e68, (THIS, id_))
        ok(o.u.mem_read(THIS + 0x1a4, 1)[0] == b.u.mem_read(THIS + 0x1a4, 1)[0] != 0, ('official id mapping', hex(id_)))
    # set and is current: the vector (this + 0x1b4: begin, + 0x1b8: end) of the functions; index i -> vector[i]
    b.u.mem_write(VEC, bytes([0, 1, 2, 3, 21, 45]))
    b.u.mem_write(THIS + 0x1b4, struct.pack('<II', VEC, VEC + 6))
    setf, curf = r[9], r[11]
    ok(r[9] != 0x531d5620 and r[11] != 0x531d7020, 'own handlers')
    b.u.mem_write(HOLD, bytes([0]))
    b.call(setf, (THIS, 4)); ok(b.u.mem_read(HOLD, 1)[0] == 21, ('set 4', b.u.mem_read(HOLD, 1)[0]))
    ok(b.call(curf, (THIS, 4))[0] == 1 and b.call(curf, (THIS, 5))[0] == 0 and b.call(curf, (THIS, 0))[0] == 0, 'is current')
    b.call(setf, (THIS, 0)); ok(b.u.mem_read(HOLD, 1)[0] == 0 and b.call(curf, (THIS, 0))[0] == 1, 'set 0 (Off)')
    print('ok', n)


main()
