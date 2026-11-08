"""T-DIAL1 (core/src/fw/gr3x/dial-probe.ts), in the emulator.

  python3 dial_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - ActionModel::OnEvent's entry (0x53221a1c): the key in r1 counted in the table of four
    { key, count } (count at most 99, a fifth different key not counted), then the function's own
    first instruction (ip = sp) and +4; every register and the flags kept;
  - the rear dial router's entry (0x53295da0): byte + 8 counts direction 0 (r3), + 9 the others,
    at most 99; the same continuation.
The printing of the table (datestamp.c -DKEY_DIAG) is checked by grain_tag_probe.py.
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
    t=lambda:bytes(c.mem_read(TABLE,10))
    c.mem_write(TABLE,bytes(10))
    for k in (10,10,35,10,57,50,61,35):run(KEY,r1=k);cases+=1
    assert t()==bytes([10,3,35,2,57,1,50,1,0,0]),t().hex()
    run(KEY,r1=62);assert t()==bytes([10,3,35,2,57,1,50,1,0,0]),'a fifth key is not counted'
    for d in (0,1,1,5,0,1):run(ROUTER,r3=d,flags=0x80000013);cases+=1
    assert t()[8:]==bytes([2,4]),t().hex()
    c.mem_write(TABLE,bytes([10,98,0,0,0,0,0,0,99,98]))
    run(KEY,r1=10);run(KEY,r1=10);run(ROUTER,r3=0);run(ROUTER,r3=1);run(ROUTER,r3=1);cases+=5
    assert t()==bytes([10,99,0,0,0,0,0,0,99,99]),t().hex()
    sites={s['address']:s for s in manifest['sites']}
    assert 'dial probe' in sites[KEY]['reason'] and 'dial probe' in sites[ROUTER]['reason']
    return dict(cases=cases,table=hex(TABLE),rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
