"""T-PLAY0 (core/src/fw/gr3x/play-probe.ts, `playProbe`), in the emulator.

  python3 play_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

The playback opening's entry (0x534e40c8), MoveToCreationFile's (0x534e4030), its search's call
(0x534e407c) and MoveToLastFile's (0x534e3e04): each run from the patched site to the camera's own
next instruction (the search stubbed, returning 0 or 1); the ring (0x558043a8: seven bytes and the
next slot) gets 10 + this[2], 20 + this[3], 30 + (this[6] & 7) / 50 / 60 or 61 / 77, every register
kept but ip (the search: its result in r0).
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

RING=0x558043a8;OBJ=0x6304a400;LR=0x5a5a5a5a
def verify(data,manifest):
    assert manifest.get('playProbe') in (True,'ref');ref=manifest.get('playProbe')=='ref'
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def run(start,stop,r0=OBJ):
        regs=[0x1000+i for i in range(13)];regs[0]=r0
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        h=c.hook_add(UC_HOOK_CODE,lambda u,a,s,d:u.emu_stop() if a in (stop,LR) else None)
        c.emu_start(start,LR,count=20000);c.hook_del(h)
        got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
        assert c.reg_read(reg.UC_ARM_REG_PC)==stop and c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return got,regs
    def ring():return list(c.mem_read(RING,8))
    if ref:
        # T-PLAY0b: the reference (kind, halfwords + 8 and + 0xa) as 2-digit groups plus 100.
        for kind,h8,ha in ((0,112,6857),(4,0,1),(1,999,9999),(2,65535,10)):
            c.mem_write(RING,bytes(8));c.mem_write(OBJ,bytes(6)+bytes([kind,0])+struct.pack('<HH',h8,ha))
            got,regs=run(0x534e40c8,0x534e40cc);assert got[:12]==regs[:12],got
            want=[100+kind,100+(h8//100)%100,100+h8%100,100+(ha//100)%100,100+ha%100]
            assert ring()==want+[0,0,5],(ring(),want);count('reference')
        c.mem_write(RING,bytes(8));got,regs=run(0x534e3e04,0x534e3e08);assert got==regs[:12] and ring()[:2]==[77,0];count('last')
        return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)
    for b2,b3,b6 in ((0,0,0),(0,1,4),(1,1,2),(12,200,0x0d)):
        c.mem_write(RING,bytes(8));c.mem_write(OBJ,bytes([0,0,b2,b3,0,0,b6,0]))
        got,regs=run(0x534e40c8,0x534e40cc);assert got[:12]==regs[:12],got
        assert ring()==[10+min(b2,9),20+min(b3,9),30+(b6&7),0,0,0,0,3],ring();count('opening')
    c.mem_write(RING,bytes(8));got,regs=run(0x534e4030,0x534e4034);assert got==regs[:12] and ring()[:2]==[50,0];count('creation')
    c.mem_write(RING,bytes(8));got,regs=run(0x534e3e04,0x534e3e08);assert got==regs[:12] and ring()[:2]==[77,0];count('last')
    for res,code in ((0,60),(1,61),(0x55,61)):
        def stub(u,a,s,d,res=res):u.reg_write(reg.UC_ARM_REG_R0,res);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
        h=c.hook_add(UC_HOOK_CODE,stub,begin=0x534e91c4,end=0x534e91c4)
        c.mem_write(RING,bytes(8));got,regs=run(0x534e407c,0x534e4080)
        c.hook_del(h)
        assert got[0]==res and got[4:12]==regs[4:12] and ring()[:2]==[code,0],(res,ring());count('search')
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
