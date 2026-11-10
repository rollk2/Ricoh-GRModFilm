"""Formatting the card rewinds every roll (core/src/fw/gr3x/film-format.ts, `formatRewind`, T-FMT1), in the emulator.

  python3 format_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the format's call (0x534e62a0; the format 0x534f0658 stubbed, giving 0 done or 1 failed): its
    result in r0, r4..r11 kept; done: the flag byte 0x558043b6 set, failed: unchanged;
  - the screen counter's hook (0x532aa1f4): run up to the film roll's counter (entries
    filmRollCounter), every register and the flags kept; flag clear: nothing written; flag set: the
    flag cleared, every going roll (started bit 2 of 0x9b1, frame 0x9b2 not 0) of the six BOXes
    (records *(0x55063f38 + 4 n)) gets frame 0 and is saved (0x53826c54(.., n + 2, 0xb26, record)),
    and the record in use (*0x55063f34) too, saved as 1, when the mode in use (**0x55063f30) is
    1..6 and its roll is going; other bytes untouched.
"""
import argparse,hashlib,json,struct,itertools
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

FLAG=0x558043b6;MODEL=0x55063f30;LR=0x5a5a5a5a;CALL=0x534e62a0;FORMAT=0x534f0658;COUNTER=0x532aa1f4
MODEB=0x6304f000;INUSE=0x63050000;BOX=[0x63051000+0x1000*i for i in range(6)]
def r_(u,n):return u.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))
def verify(data,manifest):
    assert manifest.get('formatRewind') in (True,'diag');diag=manifest.get('formatRewind')=='diag';RING=0x558043a8
    e=manifest['entries'];counter=e['filmRollCounter']
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    sites={s['address']:s for s in manifest['sites']}
    w=struct.unpack('<I',bytes.fromhex(sites[COUNTER]['replacement']))[0];d=w&0xffffff;d=d-0x1000000 if d&0x800000 else d
    assert w>>24==0xea and COUNTER+8+4*d==e['formatRewind']
    # The format's call.
    res={'v':0}
    def fmt(u,a,s_,dd):u.reg_write(reg.UC_ARM_REG_R0,res['v']);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
    h=c.hook_add(UC_HOOK_CODE,fmt,begin=FORMAT,end=FORMAT)
    for v,before in itertools.product((0,1,7),(0,1)):
        res['v']=v;c.mem_write(FLAG,bytes([before]))
        regs=[0x1000+i for i in range(13)]
        for i,x in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),x)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        hs=c.hook_add(UC_HOOK_CODE,lambda u,a,s_,dd:u.emu_stop() if a==CALL+4 else None)
        c.emu_start(CALL,LR,count=200);c.hook_del(hs)
        got=[r_(c,i) for i in range(12)]
        assert c.reg_read(reg.UC_ARM_REG_PC)==CALL+4 and c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[0]==v and got[4:12]==regs[4:12]
        assert c.mem_read(FLAG,1)[0]==(1 if v==0 else before),(v,before);count('format done' if v==0 else 'format failed')
        if diag:rg=list(c.mem_read(RING,8));assert rg[(rg[7]-1)%7]==50+min(v,9),rg;count('format noted')
    c.hook_del(h)
    # The counter's hook.
    def setup(mode,states,inuse):
        c.mem_write(MODEB,bytes([mode]));c.mem_write(MODEL,struct.pack('<II',MODEB,INUSE))
        for i,b in enumerate(BOX):
            c.mem_write(b,bytes(0xb28));fl,fr=states[i];c.mem_write(b+0x9b1,bytes([fl,fr,0x55]))
        c.mem_write(MODEL+8,struct.pack('<I',0)+b''.join(struct.pack('<I',b) for b in BOX)+struct.pack('<I',0))
        c.mem_write(INUSE,bytes(0xb28));c.mem_write(INUSE+0x9b1,bytes([inuse[0],inuse[1],0x66]))
    def run():
        p.writes.clear()
        regs=[0x2000+i for i in range(13)]
        for i,x in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),x)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        c.reg_write(reg.UC_ARM_REG_CPSR,(c.reg_read(reg.UC_ARM_REG_CPSR)&~0xf0000000)|0x60000000)
        cp=c.reg_read(reg.UC_ARM_REG_CPSR)
        hs=c.hook_add(UC_HOOK_CODE,lambda u,a,s_,dd:u.emu_stop() if a==counter else None)
        c.emu_start(COUNTER,LR,count=20000);c.hook_del(hs)
        got=[r_(c,i) for i in range(13)]
        assert c.reg_read(reg.UC_ARM_REG_PC)==counter and got==regs and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_LR)==LR
        assert (c.reg_read(reg.UC_ARM_REG_CPSR)&0xf0000000)==(cp&0xf0000000)
        return list(p.writes)
    states_list=[[(2,5),(0,0),(2,0),(3,36),(0,9),(2,1)],[(0,0)]*6,[(2,3)]*6]
    for mode in (0,1,3,6,7):
        for states in states_list:
            for inuse in ((2,4),(0,4),(2,0)):
                for flag in (0,1):
                    setup(mode,states,inuse);c.mem_write(FLAG,bytes([flag]))
                    if diag:c.mem_write(RING,bytes(8))
                    writes=run()
                    exp=[]
                    for i,(fl,fr) in enumerate(states):
                        going=flag and fl&2 and fr
                        assert list(c.mem_read(BOX[i]+0x9b1,3))==[fl,0 if going else fr,0x55]
                        if going:exp.append((i+1+2,0xb26,BOX[i]))
                    goingU=flag and 1<=mode<=6 and inuse[0]&2 and inuse[1]
                    assert list(c.mem_read(INUSE+0x9b1,3))==[inuse[0],0 if goingU else inuse[1],0x66]
                    if goingU:exp.append((1,0xb26,INUSE))
                    assert [(w[1],w[2],w[3]) for w in writes]==exp,(mode,states,inuse,flag,writes,exp)
                    assert c.mem_read(FLAG,1)[0]==0;count('rewound' if exp else ('flag clear' if not flag else 'nothing going'))
                    if diag:
                        rg=list(c.mem_read(RING,8))
                        if flag:assert rg[(rg[7]-1)%7]==60+min(len(exp),9),(rg,exp);count('rewind noted')
                        else:c.mem_write(RING,bytes(8))
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
