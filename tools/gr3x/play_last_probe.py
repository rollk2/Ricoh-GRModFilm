"""Playback on the last picture (core/src/fw/gr3x/play-last.ts, `playLast`, T-PLAY2), in the emulator.

  python3 play_last_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the save (0x535a88ac, r7 the request): a folder 100..999 and a number 1..9999 kept with the flag
    (0x558043a8: folder, number, flag), others ignored; r2 then the request's word + 0x10 as the
    camera's instruction gives it, every other register kept; on to 0x535a88b0;
  - the opening (0x534e40c8, r0 this, r1 the kind): with the flag, this + 6 = the kind, + 8 the
    folder, + 0xa the number, this[3] = 0, the flag cleared; without it, this untouched; every
    register kept but ip; on to 0x534e40cc.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

L=0x558043a8;REQ=0x6304a400;OBJ=0x6304a500;LR=0x5a5a5a5a
def verify(data,manifest):
    assert manifest.get('playLast')==True
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def run(start,stop,regs):
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        h=c.hook_add(UC_HOOK_CODE,lambda u,a,s,d:u.emu_stop() if a in (stop,LR) else None)
        c.emu_start(start,LR,count=500);c.hook_del(h)
        assert c.reg_read(reg.UC_ARM_REG_PC)==stop and c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
    for folder,num,ok in ((115,7404,True),(100,1,True),(999,9999,True),(0,0,False),(99,5,False),(1000,5,False),(112,0,False),(112,10000,False)):
        c.mem_write(L,bytes([0x11]*5));c.mem_write(REQ+0x10,struct.pack('<HH',folder,num))
        regs=[0x1000+i for i in range(13)];regs[7]=REQ
        got=run(0x535a88ac,0x535a88b0,regs)
        want=list(regs[:12]);want[2]=folder|num<<16
        assert got==want,(folder,num,[hex(x) for x in got])
        mem=bytes(c.mem_read(L,5))
        assert mem==(struct.pack('<HHB',folder,num,1) if ok else bytes([0x11]*5)),(folder,num,mem.hex());count('save kept' if ok else 'save ignored')
    for flag in (1,0):
        c.mem_write(L,struct.pack('<HHB',115,7404,flag))
        before=bytes([9,9,7,1,0,0,3,0])+struct.pack('<HH',110,7405)
        c.mem_write(OBJ,before)
        regs=[0x1000+i for i in range(13)];regs[0]=OBJ;regs[1]=0
        got=run(0x534e40c8,0x534e40cc,regs)
        assert got==regs[:12],[hex(x) for x in got]
        o=bytes(c.mem_read(OBJ,12))
        if flag:assert o==bytes([9,9,7,0,0,0,0,0])+struct.pack('<HH',115,7404) and c.mem_read(L+4,1)[0]==0,o.hex();count('opening moved')
        else:assert o==before,o.hex();count('opening kept')
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
