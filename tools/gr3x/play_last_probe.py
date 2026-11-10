"""Playback on the last picture (core/src/fw/gr3x/play-last.ts, `playLast`, T-PLAY2), in the emulator.

  python3 play_last_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the save's two creation calls (0x535a88d8, 0x535a890c; r7 the request; the creation 0x535ba278
    stubbed: it writes the folder and number into the request and returns 0 or 1): its result in r0,
    r4..r11 kept; a folder 100..999 and a number 1..9999 kept (0x558043b8: folder | 0x8000, number),
    others ignored;
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

L=0x558043b8;RING=0x558043a8;REQ=0x6304a400;OBJ=0x6304a500;LR=0x5a5a5a5a
def verify(data,manifest):
    assert manifest.get('playLast') in (True,'diag','files');diag=manifest.get('playLast') in ('diag','files');files=manifest.get('playLast')=='files'
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def run(start,stop,regs):
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        h=c.hook_add(UC_HOOK_CODE,lambda u,a,s,d:u.emu_stop() if a in (stop,LR) else None)
        c.emu_start(start,LR,count=5000);c.hook_del(h)
        assert c.reg_read(reg.UC_ARM_REG_PC)==stop and c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
    def create(u,a_,s_,d):
        u.mem_write(REQ+0x10,struct.pack('<HH',*create.vals));u.reg_write(reg.UC_ARM_REG_R0,create.res);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
    h=c.hook_add(UC_HOOK_CODE,create,begin=0x535ba278,end=0x535ba278)
    for site in (0x535a88d8,0x535a890c):
        for folder,num,ok in ((115,7404,True),(100,1,True),(999,9999,True),(0,0,False),(99,5,False),(1000,5,False),(112,0,False),(112,10000,False)):
            for res in (0,1):
                # The request holds 0 before the creation, which gives the folder and number.
                c.mem_write(L,bytes([0x11]*4));c.mem_write(RING,bytes(8));c.mem_write(REQ+0x10,bytes(4));create.vals=(folder,num);create.res=res
                regs=[0x1000+i for i in range(13)];regs[7]=REQ
                got=run(site,site+4,regs)
                assert got[0]==res and got[4:12]==regs[4:12],(folder,num,[hex(x) for x in got])
                mem=bytes(c.mem_read(L,4))
                assert mem==(struct.pack('<HH',folder|0x8000,num) if ok else bytes([0x11]*4)),(folder,num,mem.hex());count('save kept' if ok else 'save ignored')
                if files:assert list(c.mem_read(RING,4))==([45 if site==0x535a890c else 41,folder%100+100,num%100+100,0] if ok else [44,0,0,0]),(hex(site),folder,num,list(c.mem_read(RING,4)))
                elif diag:assert list(c.mem_read(RING,2))==([41,0] if ok else [44,0])
    c.hook_del(h)
    for flag in (1,0):
        c.mem_write(L,struct.pack('<HH',115|(0x8000 if flag else 0),7404));c.mem_write(RING,bytes(8))
        before=bytes([9,9,7,1,0,0,3,0])+struct.pack('<HH',110,7405)
        c.mem_write(OBJ,before)
        regs=[0x1000+i for i in range(13)];regs[0]=OBJ;regs[1]=0
        got=run(0x534e40c8,0x534e40cc,regs)
        assert got==regs[:12],[hex(x) for x in got]
        o=bytes(c.mem_read(OBJ,12))
        if flag:assert o==bytes([9,9,7,0,0,0,0,0])+struct.pack('<HH',115,7404) and struct.unpack('<H',bytes(c.mem_read(L,2)))[0]==115,o.hex();count('opening moved')
        else:assert o==before,o.hex();count('opening kept')
        if diag:assert list(c.mem_read(RING,2))==[42 if flag else 43,0],list(c.mem_read(RING,2))
    if diag:
        for res,code in ((1,80),(0,81)):
            def stub(u,a,s_,d,res=res):u.reg_write(reg.UC_ARM_REG_R0,res);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
            h=c.hook_add(UC_HOOK_CODE,stub,begin=0x534ea298,end=0x534ea298);c.mem_write(RING,bytes(8))
            regs=[0x1000+i for i in range(13)];got=run(0x534e3ed0,0x534e3ed4,regs);c.hook_del(h)
            assert got[0]==res and got[4:12]==regs[4:12] and list(c.mem_read(RING,2))==[code,0];count('check noted')
        c.mem_write(RING,bytes(8));regs=[0x1000+i for i in range(13)];got=run(0x534e3e04,0x534e3e08,regs)
        assert got==regs[:12] and list(c.mem_read(RING,2))==[77,0];count('last noted')
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
