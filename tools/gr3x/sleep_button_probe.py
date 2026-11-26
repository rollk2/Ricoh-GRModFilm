#!/usr/bin/env python3
"""GR III 2.10 / IIIx 1.60, `sleepButton` (core/src/fw/gr3x/sleep-button.ts, T-SLP1), in the emulator.

  python3 -I sleep_button_probe.py --built BUILT.rtos

  - the function 47 through the buttons' real paths: GetEventCustomize's patched entry (0x5329bcc8; Fn, ISO, Drive, WB,
    Macro) and GetEventSwitchWlan's switch (0x5329a0a0; Movie, Hold): pressed (r3 = 0) it calls the model's sleep entry
    0x5322a89c with the model 0x5320afbc(0x5320ad88()), once, and raises the flag (0x5580438b; the format rewind's flag
    0x558043b6 untouched); released, nothing; the function then
    runs as Off (r2 / r6 = 0), every other register kept;
  - the model's conditions, each alone: already asleep (+ 0x40), sleep not allowed (+ 9), the event queue, the lock, the
    live state 2 and 3, the busy model, the three shooting states, the live busy state: no sleep, no flag;
  - other functions (0, 42, 45, 46): no sleep;
  - the activity test (0x5322aed4 in the model's event handler, r0 the kind, r7 the event): flag down, the camera's
    (kinds 1 .. 0x2d activity); flag up, a release (state 1) is no activity and takes the flag down, a held repeat
    (state 2, sub-state not 0) is none and keeps it, a press (state 2, sub-state 0) is activity and takes it down, an event
    without a payload in RAM is the camera's; r4 .. r11 and sp kept.
"""
import argparse, struct
from unicorn import Uc, UC_ARCH_ARM, UC_MODE_ARM, UC_HOOK_CODE
from unicorn.arm_const import *

B = 0x53000000
APP, MODEL, ENTER = 0x5320ad88, 0x5320afbc, 0x5322a89c
STUBS = {0x5320aefc: 'queue', 0x53228a90: 'queueReady', 0x5320b19c: 'capture', 0x5320b13c: 'lockModel', 0x53233874: 'locked',
         0x53525d5c: 'live', 0x53548638: 'liveState', 0x5320b1fc: 'busyModel', 0x5323c1f0: 'busy', 0x532372f0: 's1', 0x53236f30: 's2',
         0x532374e0: 's3', 0x53548f50: 'liveBusy'}
OK = {'queue': 0x61000000, 'queueReady': 1, 'capture': 0x61001000, 'lockModel': 0x61002000, 'locked': 0, 'live': 0x61003000,
      'liveState': 0, 'busyModel': 0x61004000, 'busy': 0, 's1': 0, 's2': 0, 's3': 0, 'liveBusy': 0}
CUSTOM, CUSTOM_NATIVE = 0x5329bcc8, 0x5329bccc
WLAN, WLAN_NEXT = 0x5329a0a0, 0x5329a0a4
ACTIVITY_CALL, ACTIVITY_RET = 0x5322aed4, 0x5322aed8
FLAG = 0x5580438b
FORMAT_FLAG = 0x558043b6   # the format rewind's flag (film-format.ts): never touched
PM, APPOBJ, EV, PAY, STACK, SENT = 0x62000000, 0x62001000, 0x62002000, 0x62003000, 0x70080000, 0x70000100


class Cam:
    def __init__(self, path):
        d = open(path, 'rb').read()
        src, base, ln = struct.unpack_from('<III', d, 0x450)
        self.u = u = Uc(UC_ARCH_ARM, UC_MODE_ARM)
        u.mem_map(B, (len(d) + 0xfff) & ~0xfff); u.mem_write(B, d)
        u.mem_map(0x55000000, 0x1000000); u.mem_write(base, d[src - B:src - B + ln])
        u.mem_map(0x61000000, 0x2000000); u.mem_map(0x70000000, 0x100000)
        self.values = dict(OK); self.calls = []

        def code(uc, a, s, _):
            ret = None
            if a == APP: ret = APPOBJ
            elif a == MODEL: ret = PM
            elif a == ENTER:
                self.calls.append(uc.reg_read(UC_ARM_REG_R0)); uc.mem_write(PM + 0x40, b'\x01'); ret = 0
            elif a in STUBS:
                name = STUBS[a]; self.calls.append(name); ret = self.values[name]
                if name == 'live': uc.mem_write(ret, struct.pack('<I', 0x61005000));
            if ret is not None:
                uc.reg_write(UC_ARM_REG_R0, ret); uc.reg_write(UC_ARM_REG_PC, uc.reg_read(UC_ARM_REG_LR))
        u.hook_add(UC_HOOK_CODE, code)

    def r(self, n): return self.u.reg_read(UC_ARM_REG_R0 + n) if n < 13 else None

    def run(self, start, stop, regs):
        u = self.u
        for k in range(13): u.reg_write(UC_ARM_REG_R0 + k, 0x1000 + k)
        for k, v in regs.items(): u.reg_write(UC_ARM_REG_R0 + k, v)
        u.reg_write(UC_ARM_REG_SP, STACK); u.reg_write(UC_ARM_REG_LR, SENT)
        u.emu_start(start, stop, count=20000)
        return {k: u.reg_read(UC_ARM_REG_R0 + k) for k in range(13)}

    def model(self, asleep=0, allowed=1):
        self.u.mem_write(PM, bytes(0x100)); self.u.mem_write(PM + 0x40, bytes([asleep])); self.u.mem_write(PM + 9, bytes([allowed]))

    def flag(self, v=None):
        if v is not None: self.u.mem_write(FLAG, bytes([v]))
        return self.u.mem_read(FLAG, 1)[0]


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--built', required=True); a = ap.parse_args()
    c = Cam(a.built); n = {}
    def ok(cond, what, tag):
        assert cond, what; n[tag] = n.get(tag, 0) + 1

    def sleeps(path, f, press=0):
        c.calls.clear()
        if path == 'custom':
            regs = c.run(CUSTOM, CUSTOM_NATIVE, {0: 0x2220, 1: 0x2221, 2: f, 3: press})
            return [x for x in c.calls if not isinstance(x, str)], regs, 2
        regs = c.run(WLAN, WLAN_NEXT, {6: f, 8: 0x2228, 10: 0x222a})
        return [x for x in c.calls if not isinstance(x, str)], regs, 6

    for path in ('custom', 'wlan'):
        # Pressed: the entry once, with the model; the flag up; the function as Off; the other registers kept.
        c.model(); c.flag(0); c.u.mem_write(FORMAT_FLAG, b'\x00')
        got, regs, fr = sleeps(path, 47)
        ok(got == [PM] and c.flag() == 1 and regs[fr] == 0, (path, 'press', got, c.flag(), hex(regs[fr])), 'sleep')
        ok(c.u.mem_read(FORMAT_FLAG, 1)[0] == 0, (path, 'format flag'), 'format flag kept')
        kept = [k for k in range(13) if k not in (fr, 12)]
        want = {0: 0x2220, 1: 0x2221, 3: 0} if path == 'custom' else {8: 0x2228, 10: 0x222a}
        ok(all(regs[k] == v for k, v in want.items()) and all(regs[k] == 0x1000 + k for k in kept if k not in want) and c.u.reg_read(UC_ARM_REG_SP) == STACK,
           (path, 'registers', {k: hex(v) for k, v in regs.items()}), 'registers')
        # Already asleep: nothing.
        c.flag(0); got, regs, fr = sleeps(path, 47)
        ok(got == [] and c.flag() == 0 and regs[fr] == 0, (path, 'asleep'), 'asleep')
        # Not allowed (+ 9 = 0): nothing.
        c.model(allowed=0); c.flag(0); got, regs, fr = sleeps(path, 47)
        ok(got == [] and c.flag() == 0, (path, 'not allowed'), 'not allowed')
        # Each condition alone.
        for name, bad in (('queueReady', 0), ('locked', 1), ('liveState', 2), ('liveState', 3), ('busy', 1), ('s1', 1), ('s2', 1), ('s3', 1), ('liveBusy', 1)):
            c.model(); c.flag(0); c.values = dict(OK); c.values[name] = bad
            got, regs, fr = sleeps(path, 47)
            ok(got == [] and c.flag() == 0 and regs[fr] == 0, (path, name, bad, got), 'condition')
        c.values = dict(OK)
        for state in (1, 4, 5):   # other live states: allowed
            c.model(); c.flag(0); c.values['liveState'] = state; got, regs, fr = sleeps(path, 47)
            ok(got == [PM], (path, 'live state', state), 'live state ok')
        c.values = dict(OK)
        # Other functions: no sleep.
        for f in (0, 42, 45, 46):
            c.model(); c.flag(0); c.calls.clear()
            try: sleeps(path, f)
            except Exception: pass   # the camera's own code for them is not stubbed: only the sleep matters here
            ok(PM not in c.calls and c.flag() == 0, (path, 'function', f), 'other function')
    # Released (GetEventCustomize, r3 not 0): nothing, as Off.
    c.model(); c.flag(0); got, regs, fr = sleeps('custom', 47, press=1)
    ok(got == [] and c.flag() == 0 and regs[2] == 0, 'released', 'released')

    # The activity test.
    def activity(kind, flag, state=None, sub=0, payload=PAY):
        c.flag(flag); c.u.mem_write(EV, struct.pack('<HHI', kind, 0, payload))
        if state is not None: c.u.mem_write(PAY, struct.pack('<BBHI', state, 0, 0, sub))
        regs = c.run(ACTIVITY_CALL, ACTIVITY_RET, {0: kind, 4: PM, 7: EV})
        ok(all(regs[k] == (PM if k == 4 else EV if k == 7 else 0x1000 + k) for k in range(4, 12)) and c.u.reg_read(UC_ARM_REG_SP) == STACK, ('activity registers', kind), 'activity registers')
        return regs[0], c.flag()
    for kind in (1, 0x1b, 0x2d, 0x2e, 0x30, 0x50):
        got = activity(kind, 0, 1)
        ok(got == (1 if 1 <= kind <= 0x2d else 0, 0), ('flag down', kind, got), 'camera')
    ok(activity(0x1b, 1, 1) == (0, 0), 'release', 'release')
    ok(activity(0x20, 1, 2, 3) == (0, 1), 'held', 'held')
    ok(activity(0x1b, 1, 2, 0) == (1, 0), 'press', 'press')
    ok(activity(0x1b, 1, 1, payload=0) == (1, 1), 'no payload', 'no payload')
    ok(activity(0x50, 1, 1) == (0, 1), 'not activity', 'not activity')
    print('ok', sum(n.values()), n)


if __name__ == '__main__':
    main()
