"""SR by shutter speed (core/src/fw/gr3x/sr-speed.ts, `srSpeed`, T-SR1), in the emulator.

  python3 sr_speed_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

At each of the four calls of the live SR getter (0x5354ae2c), run from the call to the next
instruction with r0 the live values (+0x518 -> [0] -> the live record: SR at +0x7d3, the live
speed's APEX Tv float at +0x4bc; the two mutex calls stubbed): r0 is the SR byte when it is 0 or
the speed is the threshold or slower, else 0; r4..r11 kept, the stack balanced. With `diag`, the
key ring notes each change only (60 Off, 61 On, 62 Off by the speed).
"""
import argparse,hashlib,json,math,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

CALLS=(0x5349786c,0x53497bc4,0x53497c24,0x535785b4);LOCK,UNLOCK=0x536ae71c,0x536ae870
LV=0x6304b000;HOLDER=0x6304b800;REC=0x6304c000;RING=0x558043a8;LAST=0x558043b6;LR=0x5a5a5a5a
def verify(data,manifest):
    sr=manifest.get('srSpeed');assert sr and sr['seconds']>0;diag=bool(sr.get('diag'))
    tv0=round(math.log2(1/sr['seconds'])*3)/3  # the camera's third stops
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def stub(u,a,s,d):u.reg_write(reg.UC_ARM_REG_R0,0);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
    for a in (LOCK,UNLOCK):c.hook_add(UC_HOOK_CODE,stub,begin=a,end=a)
    c.mem_write(LV,bytes(0x600));c.mem_write(LV+0x518,struct.pack('<I',HOLDER));c.mem_write(HOLDER,struct.pack('<I',REC));c.mem_write(REC,bytes(0x1000))
    c.mem_write(RING,bytes(8));c.mem_write(LAST,bytes(1))
    def run(at,srv,tv):
        c.mem_write(REC+0x7d3,bytes([srv]));c.mem_write(REC+0x4bc,struct.pack('<f',tv))
        regs=[0x1000+i for i in range(13)];regs[0]=LV
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        h=c.hook_add(UC_HOOK_CODE,lambda u,a,s,d:u.emu_stop() if a in (at+4,LR) else None)
        c.emu_start(at,LR,count=2000);c.hook_del(h)
        got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
        assert c.reg_read(reg.UC_ARM_REG_PC)==at+4 and c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[4:12]==regs[4:12],(hex(at),[hex(x) for x in got])
        return got[0]
    third=1/3
    tvs=[tv0-2,tv0-third,tv0,tv0+0.16,tv0+0.18,tv0+third,tv0+3,12,-5,0.0,-0.0,0.5]
    notes=[]
    for at in CALLS:
        for srv in (0,1,2):
            for tv in tvs:
                f=struct.unpack('<f',struct.pack('<f',tv))[0]
                want=srv if (srv==0 or f<tv0+1/6) else 0
                got=run(at,srv,tv);assert got==want,(hex(at),srv,tv,got)
                code=60 if srv==0 else (61 if want else 62)
                if not notes or notes[-1]!=code:notes.append(code)
                count('on' if want else ('off by speed' if srv else 'off'))
    if diag:
        ring=list(c.mem_read(RING,8));k=len(notes)%7
        exp=(notes[-7:] if len(notes)>=7 else notes)
        seq=ring[k:7]+ring[:k] if len(notes)>=7 else ring[:len(notes)]
        assert seq==exp and ring[7]==k,(ring,notes);count('ring')
    else:assert list(c.mem_read(RING,8))==[0]*8
    return dict(cases=cases,threshold_tv=tv0,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
