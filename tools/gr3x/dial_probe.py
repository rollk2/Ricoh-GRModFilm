"""T-DIAL2 (core/src/fw/gr3x/dial-probe.ts), in the emulator.

  python3 dial_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - ActionModel::OnEvent's entry (0x53221a1c): the key in r1 written to the ring of seven at
    0x558043a8 (byte 7 the next slot, a stray slot taken as 0), then the function's own first
    instruction (ip = sp) and +4; every register and the flags kept;
  - the rear dial router (0x53295da0) left alone.
With `rearDialOff` (the build option, T-DIAL3): the rear dial's codes (24, 25) return at once
to the caller with r0 = 1 (handled), every other register as given (ip aside) and nothing else
done; any other key goes on as above; with the probe the ring still notes every key, the
filtered ones included. Without the probe nothing else is written.
The printing of the ring (datestamp.c -DKEY_DIAG) is checked by grain_tag_probe.py.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

TABLE,KEY,ROUTER=0x558043a8,0x53221a1c,0x53295da0
RING=7   # bytes 0..6, byte 7 the next slot (dial-probe.ts)

def verify(data,manifest):
    if manifest.get('rearDialOff'):return verify_off(data,manifest)
    assert manifest.get('dialProbe')==True
    p=RollProbe(data,manifest);c=p.uc;cases=0
    def run(at,r1=0,r3=0,flags=0x60000013):
        regs=[0x1000+i for i in range(13)];regs[1]=r1;regs[3]=r3
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_CPSR,flags)
        c.emu_start(at,at+4,count=200)
        assert c.reg_read(reg.UC_ARM_REG_PC)==at+4 and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_R12)==STACK
        assert [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]==regs[:12] and c.reg_read(reg.UC_ARM_REG_CPSR)==flags
    t=lambda:bytes(c.mem_read(TABLE,RING+1))
    c.mem_write(TABLE,bytes(RING+1))
    seq=[19,25,26,29,32,35,50,58,60,14,9,7,6]
    for k in seq:run(KEY,r1=k,flags=0x80000013 if k&1 else 0x60000013);cases+=1
    want=bytearray(RING+1)
    for n,k in enumerate(seq):want[n%RING]=k
    want[RING]=len(seq)%RING
    assert t()==bytes(want),t().hex()
    c.mem_write(TABLE,bytes(RING)+bytes([200]));run(KEY,r1=33);assert t()==bytes([33]+[0]*(RING-1)+[1]),'a stray slot is taken as 0';cases+=1
    sites={s['address']:s for s in manifest['sites']}
    assert 'dial probe' in sites[KEY]['reason'] and ROUTER not in sites
    return dict(cases=cases,table=hex(TABLE),rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

def verify_off(data,manifest):
    p=RollProbe(data,manifest);c=p.uc;cases=0;probe=manifest.get('dialProbe') in (True,'hold');hold=manifest.get('dialProbe')=='hold'
    LR=0x5a5a5a5a
    def run(key):
        regs=[0x1000+i for i in range(13)];regs[1]=key
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR);c.reg_write(reg.UC_ARM_REG_CPSR,0x13)
        from unicorn import UC_HOOK_CODE
        h=c.hook_add(UC_HOOK_CODE,lambda u,at,size,d:u.emu_stop() if at in (KEY+4,LR) else None)
        c.emu_start(KEY,LR,count=60);c.hook_del(h)
        pc=c.reg_read(reg.UC_ARM_REG_PC);got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
        assert c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[1:12]==regs[1:12],(key,got)
        if pc==LR:assert got[0]==1;return 'handled'
        assert pc==KEY+4 and got[0]==regs[0] and c.reg_read(reg.UC_ARM_REG_R12)==STACK;return 'on'
    c.mem_write(TABLE,bytes(RING+1))
    seq=[24,25,26,29,32,35,50,14,10,11,5,6,7,8,57,23,19]+([27,27,27,28,22,22,8,21,23,33,33,34,7,30] if hold else [])
    for k in seq:
        assert run(k)==('handled' if k in (24,25) else 'on'),k;cases+=1
    ring=bytes(c.mem_read(TABLE,RING+1))
    if probe:
        # T-HOLD0: the shot's codes 5 to 8 and a key equal to the last noted are left out.
        kept=[]
        for k in seq:
            if hold and (5<=k<=8 or (kept and kept[-1]==k)):continue
            kept.append(k)
        want=bytearray(RING+1)
        for n,k in enumerate(kept):want[n%RING]=k
        want[RING]=len(kept)%RING;assert ring==bytes(want),(ring.hex(),bytes(want).hex())
    else:assert ring==bytes(RING+1)
    sites={s['address']:s for s in manifest['sites']}
    assert 'rear dial off' in sites[KEY]['reason'] and ROUTER not in sites
    return dict(cases=cases,filtered=[24,25],probe=manifest.get('dialProbe',False),rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
