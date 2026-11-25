#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11, `adjRedFilter` (core/src/fw/gr4v121/aspect/adjredfilter.ts), in the emulator.

  python3 adjredfilter_probe.py --official OFFICIAL.rtos --built BUILT.rtos

Checks ADJ function 18 as Red Filter in the built file: its record's handlers (count, draw, is current, set), the name and icon
lookups (18 changed, every other function as in the official file), ADJ Mode Setting's list (18 last, one longer on the
Monochrome only, registers kept) and that no other record of the table changed.
"""
import argparse, struct
OTHERS = False
from unicorn import *
from unicorn.arm_const import *

B = 0x53000000
TABLE, REC = 0x53dcb494, 0x5c
OBJ, RES, SENT, STACK = 0x70100000, 0x70200000, 0x70000100, 0x70080000
STUBS = {0x53240cac: 'app', 0x53241240: 'object', 0x532415a0: 'resources', 0x533907e0: 'value_text', 0x5359468c: 'list_item',
         0x535a1a60: 'set_text', 0x53346338: 'setter', 0x53242154: 'spec', 0x533f26e4: 'model'}


def machine(rtos):
    d = open(rtos, 'rb').read()
    u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
    u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
    u.mem_map(0x55000000, 0x1000000); u.mem_map(0x70000000, 0x400000)
    return u, d


def call(u, addr, args=(), byte=0, model=0, regs=None):
    log = []
    u.mem_write(OBJ + 0x9b4, bytes([byte]))
    for r in range(13): u.reg_write(UC_ARM_REG_R0 + r, regs[r] if regs else 0x5000 + r)
    for i, a in enumerate(args): u.reg_write(UC_ARM_REG_R0 + i, a)
    u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, SENT)

    def code(uc, a, s, _):
        if a == SENT:
            uc.emu_stop()
        elif a in STUBS:
            n = STUBS[a]
            r = [uc.reg_read(UC_ARM_REG_R0 + i) for i in range(3)]
            log.append((n, r[0], r[1]))
            uc.reg_write(UC_ARM_REG_R0, {'object': OBJ, 'resources': RES, 'model': model}.get(n, 1 if n == 'app' else 1000 + r[1] if n == 'value_text' else 0x7000 + r[1] if n == 'list_item' else 0))
            uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
    h = u.hook_add(UC_HOOK_CODE, code)
    try:
        u.emu_start(addr, SENT, count=3000)
    finally:
        u.hook_del(h)
    return u.reg_read(UC_ARM_REG_R0), log


def imm(w): return ((w >> 4) & 0xf000) | (w & 0xfff)


def table_of(d):
    # the first MOVW / MOVT pair that loads the ADJ function table (0x531bdad0 / 0x531bdae0)
    return (imm(struct.unpack_from('<I', d, 0x531bdae0 - B)[0]) << 16) | imm(struct.unpack_from('<I', d, 0x531bdad0 - B)[0])


def rec(d, f, table=None):
    return struct.unpack_from('<23I', d, (table or TABLE) - B + f * REC)


def verify(official, built):
    uo, do = machine(official)
    ub, db = machine(built)
    n = {}
    ok = lambda k: n.__setitem__(k, n.get(k, 0) + 1)
    # the table: only record 18 changed
    tb = table_of(db)
    to = table_of(do)   # the reference (the official file, or a build with the same features but without the custom buttons)
    for f in range(21):
        same = all(x == y or (x >= 0x54000000 and y >= 0x54000000) for x, y in zip(rec(do, f, to), rec(db, f, tb)))   # code the other additions appended sits at other addresses
        assert same == (f != 18) or (OTHERS and f != 18), ('record', f)
    r = rec(db, 18, tb)
    draw, cur, st, cnt = r[6], r[8], r[10], r[12]
    assert r[4] == rec(do, 19, to)[4] and r[15] == 0, 'record base'
    assert call(ub, cnt)[0] == 2; ok('count')
    for i in (0, 1):
        for byte in (0, 1):
            assert call(ub, cur, (0x70300000, i), byte=byte)[0] == (1 if byte == i else 0), ('current', i, byte); ok('current')
        v, log = call(ub, st, (0x70300000, i)); assert ('setter', OBJ, i) in log, ('set', i, log); ok('set')
        v, log = call(ub, draw, (0x70300000, i))
        assert ('value_text', RES + 4, i) in log and ('set_text', 0x7000 + i, 1000 + i) in log, ('draw', i, log); ok('draw')
    for i in (2, 5, 31):
        v, log = call(ub, draw, (0x70300000, i))
        assert not any(x[0] == 'value_text' for x in log) and ('set_text', 0x7000 + i, 0) in log, ('draw beyond', i, log); ok('draw beyond')
    # name and icon: function 18 changed, every other function as in the official file
    for f in range(0, 22):
        no, _ = call(uo, 0x5338fd34, (0x1000, f)); nb, _ = call(ub, 0x5338fd34, (0x1000, f))
        assert (nb == 155) if f == 18 else (nb == no or OTHERS), ('name', f, no, nb); ok('name')
        for variant in (0, 1):
            io, _ = call(uo, 0x533916f0, (0x1000, f, variant)); ib, _ = call(ub, 0x533916f0, (0x1000, f, variant))
            assert (ib == (1200 if variant == 0 else 0)) if f == 18 else (ib == io or OTHERS), ('icon', f, variant, io, ib); ok('icon')
    # the list's length (stub at 0x531dce68): r4 = list, r6 = r4 + length; registers kept
    w = struct.unpack_from('<I', db, 0x531dce68 - B)[0]; stub = 0x531dce68 + 8 + (((w & 0xffffff) << 8 >> 8) * 4)
    base = next(x & 0xff for x in struct.unpack_from('<12I', db, stub - B) if (x & 0xffffff00) == 0xe2846000)   # add r6, r4, #length
    for model, extra in ((0, 0), (1, 0), (2, 1)):
        regs = [0x11, 0x22, 0x33, 0x44, 0x53de0000, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd]
        for r_ in range(13): ub.reg_write(UC_ARM_REG_R0 + r_, regs[r_])
        log = []
        ub.reg_write(UC_ARM_REG_SP, STACK); ub.reg_write(UC_ARM_REG_LR, 0xcafe)
        def code(uc, a, s, _):
            if a == 0x531dce6c: uc.emu_stop()
            elif a in STUBS:
                nm = STUBS[a]; uc.reg_write(UC_ARM_REG_R0, model if nm == 'model' else 1); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        h = ub.hook_add(UC_HOOK_CODE, code)
        ub.emu_start(0x531dce68, 0x531dce6c, count=200); ub.hook_del(h)
        assert ub.reg_read(UC_ARM_REG_R6) == 0x53de0000 + base + extra, ('length', model, hex(ub.reg_read(UC_ARM_REG_R6)))
        for r_ in (0, 1, 2, 3):
            assert ub.reg_read(UC_ARM_REG_R0 + r_) == regs[r_], ('regs', model, r_)
        assert ub.reg_read(UC_ARM_REG_SP) == STACK and ub.reg_read(UC_ARM_REG_LR) == 0xcafe, ('sp/lr', model); ok('list length')
    # the list itself: 18 last
    lo = struct.unpack_from('<I', db, 0x531dce3c - B)[0]; hi = struct.unpack_from('<I', db, 0x531dce4c - B)[0]
    at = ((hi & 0xfff) | ((hi >> 4) & 0xf000)) << 16 | ((lo & 0xfff) | ((lo >> 4) & 0xf000))
    lst = list(db[at - B:at - B + base + 1])
    lo_ = struct.unpack_from('<I', do, 0x531dce3c - B)[0]; hi_ = struct.unpack_from('<I', do, 0x531dce4c - B)[0]
    at_o = ((hi_ & 0xfff) | ((hi_ >> 4) & 0xf000)) << 16 | ((lo_ & 0xfff) | ((lo_ >> 4) & 0xf000))
    wo = struct.unpack_from('<I', do, 0x531dce68 - B)[0]; n_o = wo & 0xff
    assert lst[base] == 18 and (OTHERS or (lst[:base] == list(do[at_o - B:at_o - B + n_o]) and base == n_o)) and 18 not in lst[:base], lst; ok('list')
    return n


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--official', required=True); ap.add_argument('--built', required=True)
    # --others: the build has other ADJ additions (Direct Flash, exposure preview, Constant Light...): only function 18 is checked.
    ap.add_argument('--others', action='store_true'); a = ap.parse_args()
    OTHERS = a.others
    print('ok', verify(a.official, a.built))
