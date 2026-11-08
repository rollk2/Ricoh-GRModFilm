"""T-DIAL2 (core/src/fw/gr3x/dial-probe.ts), in the emulator.

  python3 dial_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - ActionModel::OnEvent's entry (0x53221a1c): the key in r1 written to the ring of eleven at
    0x55804398 (byte 11 the next slot, a stray slot taken as 0), then the function's own first
    instruction (ip = sp) and +4; every register and the flags kept;
  - the rear dial router (0x53295da0) left alone.
The printing of the ring (datestamp.c -DKEY_DIAG) is checked by grain_tag_probe.py.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

TABLE,KEY,ROUTER=0x55804398,0x53221a1c,0x53295da0

def verify(data,manifest):
    assert manifest.get('dialProbe')==True
    p=RollProbe(data,manifest);c=p.uc;cases=0
    def run(at,r1=0,r3=0,flags=0x60000013):
        regs=[0x1000+i for i in range(13)];regs[1]=r1;regs[3]=r3
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_CPSR,flags)
        c.emu_start(at,at+4,count=200)
        assert c.reg_read(reg.UC_ARM_REG_PC)==at+4 and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_R12)==STACK
        assert [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]==regs[:12] and c.reg_read(reg.UC_ARM_REG_CPSR)==flags
    t=lambda:bytes(c.mem_read(TABLE,12))
    c.mem_write(TABLE,bytes(12))
    seq=[19,25,26,29,32,35,50,58,60,14,9,7,6]
    for k in seq:run(KEY,r1=k,flags=0x80000013 if k&1 else 0x60000013);cases+=1
    want=bytearray(12)
    for n,k in enumerate(seq):want[n%11]=k
    want[11]=len(seq)%11
    assert t()==bytes(want),t().hex()
    c.mem_write(TABLE,bytes(11)+bytes([200]));run(KEY,r1=33);assert t()==bytes([33]+[0]*10+[1]),'a stray slot is taken as 0';cases+=1
    sites={s['address']:s for s in manifest['sites']}
    assert 'dial probe' in sites[KEY]['reason'] and ROUTER not in sites
    return dict(cases=cases,table=hex(TABLE),rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
