"""SR by shutter speed (core/src/fw/gr3x/sr-speed.ts, `srSpeed`, T-SR1), in the emulator.

  python3 sr_speed_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

At each of the four calls of the live SR getter (0x5354ae2c), run from the call to the next
instruction with r0 the live values (+0x518 -> [0] -> the live record: SR at +0x7d3, the live
speed's APEX Tv float at +0x4bc; the two mutex calls stubbed): r0 is the SR byte when it is 0 or
the speed is the threshold or slower, else 0; r4..r11 kept, the stack balanced. With `diag`, the
key ring notes each change only (60 Off, 61 On, 62 Off by the speed).

The menu (T-SR2, no `seconds`): the threshold is Shake Reduction's byte (+0x4f6 of *0x55063f34:
0 Off, 1 1/4000 i.e. always, 1 + k the speed k; no rule above the list or without a record); the
byte's getter (0x53245378) and the live SR value (0x53271dc4, drive mode 0) give 1 for any speed;
record 42's list: 53 values, each drawn (0x5339e8b0 stubbed) with its icon and text, the speeds'
texts in every text row, set through the writer (0x532731d4 stubbed: Off then the value), current
when the byte is the value.
"""
import argparse,hashlib,json,math,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

SPEEDS=[1/4000,1/3200,1/2500,1/2000,1/1600,1/1250,1/1000,1/800,1/640,1/500,1/400,1/320,1/250,1/200,1/160,1/125,1/100,1/80,1/60,1/50,1/40,1/30,1/25,1/20,1/15,1/13,1/10,1/8,1/6,1/5,1/4,1/3,0.4,0.5,0.6,0.8,1,1.3,1.6,2,2.5,3.2,4,5,6,8,10,13,15,20,25,30]
def text(s):return '1/%d'%round(1/s) if s<0.35 else ('%g"'%s)

CALLS=(0x5349786c,0x53497bc4,0x53497c24,0x535785b4);LOCK,UNLOCK=0x536ae71c,0x536ae870
LV=0x6304b000;HOLDER=0x6304b800;REC=0x6304c000;RING=0x558043a8;LAST=0x558043b6;LR=0x5a5a5a5a
def r_(u,n):return u.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))
def verify(data,manifest):
    sr=manifest.get('srSpeed');assert sr is not None;diag=bool(sr.get('diag'));menu='seconds' not in sr
    if not menu:assert sr['seconds']>0
    tv0=round(math.log2(1/sr.get('seconds',SPEEDS[23]))*3)/3  # the camera's third stops
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def stub(u,a,s,d):u.reg_write(reg.UC_ARM_REG_R0,0);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
    for a in (LOCK,UNLOCK):c.hook_add(UC_HOOK_CODE,stub,begin=a,end=a)
    c.mem_write(LV,bytes(0x600));c.mem_write(LV+0x518,struct.pack('<I',HOLDER));c.mem_write(HOLDER,struct.pack('<I',REC));c.mem_write(REC,bytes(0x1000))
    c.mem_write(RING,bytes(8));c.mem_write(LAST,bytes(1))
    SET=0x6304d000
    c.mem_write(SET,bytes(0xb28));c.mem_write(0x55063f34,struct.pack('<I',SET))
    if menu:c.mem_write(SET+0x4f6,bytes([24]))  # 1/20, as T-SR1
    def run(at,srv,tv,raw=None):
        c.mem_write(REC+0x7d3,bytes([srv]));c.mem_write(REC+0x4bc,struct.pack('<f',tv))
        if raw is not None:c.mem_write(SET+0x4f6,bytes([raw]))
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
    if menu:
        c.mem_write(0x55063f34,struct.pack('<I',SET))
        for at in CALLS[:2]:
            for raw in list(range(0,54))+[60,0xff]:
                for srv in (0,1):
                    for k in (raw-2,raw-1,raw) if 1<=raw-1<52 else (0,23,51):
                        for d in (-0.15,0.15):
                            if not 0<=k<52:continue
                            tv=12-k/3+d;f=struct.unpack('<f',struct.pack('<f',tv))[0]
                            rule=2<=raw<=52
                            want=srv if (srv==0 or not rule or f<12-(raw-1)/3+1/6) else 0
                            got=run(at,srv,tv,raw);assert got==want,(hex(at),raw,srv,tv,got);count('menu '+('on' if want else 'off'))
        for bad in (0,0x30000000,0x6304d002):
            c.mem_write(0x55063f34,struct.pack('<I',bad))
            assert run(CALLS[0],1,11.0,9)==1;count('no record')
        c.mem_write(0x55063f34,struct.pack('<I',SET))
        # The byte's getter and the live SR value: On / Off.
        OBJ=0x6304e000;c.mem_write(OBJ,struct.pack('<II',0,SET))
        def call(fn,args,stubs={}):
            hs=[]
            for a,f in stubs.items():
                def h(u,at_,s_,d,f=f):
                    v=f(u);u.reg_write(reg.UC_ARM_REG_R0,v if v is not None else 0);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
                hs.append(c.hook_add(UC_HOOK_CODE,h,begin=a,end=a))
            regs=[0x2000+i for i in range(13)]
            for i,v in enumerate(args):regs[i]=v
            for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
            c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
            c.emu_start(fn,LR,count=5000)
            for h in hs:c.hook_del(h)
            got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]
            assert c.reg_read(reg.UC_ARM_REG_PC)==LR and c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[4:12]==regs[4:12],(hex(fn),[hex(x) for x in got])
            return got[0]
        for raw in (0,1,2,23,52,53):
            c.mem_write(SET+0x4f6,bytes([raw]))
            assert call(0x53245378,[OBJ])==(1 if raw else 0);count('getter')
            for movie in (0,1):
                c.mem_write(SET+0x44,bytes([movie]));c.mem_write(SET+0x472,bytes(1));c.mem_write(SET+0x484,bytes(1))
                assert call(0x53271dc4,[OBJ])==(1 if raw and not movie else 0),(raw,movie);count('live value')
        c.mem_write(SET+0x44,bytes(1))
        # Record 42: count, draw, set, current.
        e=manifest['entries'];st=e['srSpeedText']
        assert call(0x531b3af4,[0])==53;count('count')
        drawn=[];D=e['srSpeedDraw']
        # The arguments at our jump to 0x5339e8b0 (the base probe stubs that function itself).
        def at_jump(u,a,s_,d):
            if u.mem_read(a,4)[3]==0xea and (struct.unpack('<I',bytes(u.mem_read(a,4)))[0]&0xffffff)==((0x5339e8b0-a-8)>>2)&0xffffff:drawn.append((r_(u,0),r_(u,1),r_(u,2)))
        hj=c.hook_add(UC_HOOK_CODE,at_jump,begin=D,end=D+0x40)
        for item in range(53):
            got=call(0x531b5258,[0x7000,0x7100,item],{0x5339e8b0:lambda u:None})
            assert len(drawn)==item+1 and drawn[-1]==((0x7100,0x1ae,2) if item==0 else (0x7100,0x1b0,st+item-1)),(item,drawn[-1:]);count('drawn')
        c.hook_del(hj)
        cat=manifest['catalogs'];roots=cat['textRoots']
        rd=lambda a,n:bytes(c.mem_read(a,n));u32=lambda a:struct.unpack('<I',rd(a,4))[0]
        for row in range(21):
            base=u32(roots+4*row)
            for k,sp in enumerate(SPEEDS):
                rec=u32(base+4*(st+k));n=rd(rec,1)[0]-1;s_=rd(u32(rec+4),2*n).decode('utf-16le')
                assert s_==text(sp),(row,k,s_)
            count('text row')
        writes=[]
        for item in range(53):
            writes.clear()
            call(0x531b6d84,[0x7000,item],{0x5320ad88:lambda u:0xa0a0,0x5320b31c:lambda u:OBJ,0x532731d4:lambda u:writes.append((r_(u,0),r_(u,1)))})
            assert writes==([(OBJ,0)] if item==0 else [(OBJ,0),(OBJ,item)]),(item,writes);count('set')
        for raw in (0,1,7,52,60):
            c.mem_write(SET+0x4f6,bytes([raw]))
            for item in (0,1,7,52):
                assert call(0x531b84dc,[0x7000,item],{0x5320ad88:lambda u:0xa0a0,0x5320b31c:lambda u:OBJ})==(1 if raw==item else 0);count('current')
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
