"""Hidden settings (core/src/fw/gr3x/hidden-settings.ts, `hiddenSettings`, T-HIDE1), in the emulator.

  python3 hidden_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - lines: each hidden setting's Still Image Settings line hidden in every mode (the visibility
    hook); the menu built natively has none of them;
  - the buttons' lists' filter (0x531b9410): the hidden settings' functions refused, the others as
    the camera's; GetEventCustomize's entry and GetEventSwitchWlan's switch: a button still holding
    one runs Off;
  - ADJ: the five slot getters read a hidden function as Off; ADJ Mode Setting's five lists hold no
    hidden function and their counts (0x531b3bac + 8 i) give the shorter length;
  - the settings load: after the camera's load (stubbed), each hidden setting's value (and, T-HIDE3,
    its Mode Memory box set to memorized) in the record
    in use and the eight stored records (pointers not in RAM skipped), the other bytes untouched, the
    load's result returned, r4..r11 kept.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK,STOP

HIDEABLE={'faceEye':(0x0200005e,0x12c,(8,),()),'afAssist':(0x0200005f,0x12e,(),()),'afc':(0x02000063,0x13c,(),()),
          'mfMag':(0x02000065,0x140,(),()),'flash':(0x020000dd,0x164,(20,),(8,)),'gf2':(0x02000070,0xb22,(41,),(0x13,)),
          'flashComp':(0,0x168,(21,),(9,))}   # flashComp: no line; a float from 0x53b592e0 (index); its ADJ 9 is the soft focus in round 10
COMP_TABLE=0x53b592e0
MEMORY_BOX={'flash':0xaf8,'flashComp':0xafa,'gf2':0xb24}   # T-HIDE3: Mode Memory's box, set « memorized » with the value
ADJ_LISTS=(0x53b4eba0,0x53b5a430,0x53b5a404,0x53b58fb0,0x53b5a4b4);ADJ_COUNTS=(0x531b3bac,0x531b3bb4,0x531b3bbc,0x531b3bc4,0x531b3bcc)
MODEL=0x55063f30;MODEB=0x6304a100;REC=0x63040000;IDW=0x6304a200;VISIBLE=0x5319a720
def r(c,n):return c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))

def verify(data,manifest):
    hs=manifest.get('hiddenSettings');assert hs
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    soft='softFocusSlot0' in e
    lines=[HIDEABLE[k][0] for k in hs if HIDEABLE[k][0]];fns=[f for k in hs for f in HIDEABLE[k][2]];adj=[f for k in hs for f in HIDEABLE[k][3] if not (soft and f==9)]
    def state(mode=3,flags=0,frame=0):
        c.mem_write(MODEB,bytes([mode]));c.mem_write(REC,bytes(0xb28));c.mem_write(REC+0x9b1,bytes([flags]));c.mem_write(REC+0x9b2,bytes([frame]))
        c.mem_write(MODEL,struct.pack('<II',MODEB,REC))
    seen=[]
    def vis(cpu,at,size,user):
        seen.append(1);cpu.reg_write(reg.UC_ARM_REG_R0,0x77);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    h=c.hook_add(UC_HOOK_CODE,vis,begin=VISIBLE,end=VISIBLE)
    for ident in lines+[0x02000066,0x0200004e,0x02000071,0x0200007b]:
        for mode in (0,3,7):
            state(mode=mode);seen.clear();c.mem_write(IDW,struct.pack('<I',ident))
            p.run(e['linesHidden'],STOP,{0:1,1:2,2:3,10:IDW})
            hidden=r(c,0)==0 and not seen
            assert hidden==(ident in lines),(hex(ident),mode);count('line hidden' if hidden else 'line shown')
    c.hook_del(h)
    # The menu built natively: none of the hidden lines, in P and U.
    MENU=0x63053000;p.menu_stubs=True;c.ctl_flush_tb();c.mem_write(0x55001eb8,bytes(c.mem_read(0x5407d3f8,20)))
    for mode in (0,3):
        state(mode=mode);c.mem_write(MENU,bytes(0x13bc));c.ctl_flush_tb();p.run(e['menuRebuild'],0x53199eb0,{0:MENU})
        m=bytes(c.mem_read(MENU,0x13bc));ids=[struct.unpack_from('<I',m,0x3e4+4*k)[0] for k in range(m[0x2b3])]
        assert not any(i in ids for i in lines) and 0x02000071 in ids and 0x02000066 in ids;count('menu built')
    p.menu_stubs=False
    # The buttons' lists' filter.
    p.stubs_on=True;p.fn_stubs=True
    for f in range(0,42):
        p.call(0x531b9410,f);got=r(c,0)
        if f in fns:assert got==0,f;count('function refused')
    # A button still holding one runs Off (and the others keep theirs).
    for f in fns+[0,1,9,19,22,26,28]:
        state();regs={0:0x1110,1:0x2221,2:f,3:0x3333,4:0x44,5:0x55}
        p.run(0x5329bcc8,0x5329bccc,regs);assert r(c,2)==(0 if f in fns else f),f
        regs={0:0x1110,1:0x2221,2:0x2222,3:0x3333,4:0x44,5:0x55,6:f,12:0xcc}
        p.run(0x5329a0a0,0x5329a0a4,regs);assert r(c,6)==(0 if f in fns else f) and c.reg_read(reg.UC_ARM_REG_R12)==0xcc,f
        count('button Off' if f in fns else 'button kept')
    p.stubs_on=False;p.fn_stubs=False
    # ADJ slots and lists.
    OBJ=0x6304a300
    for i,at in enumerate((0x5324633c,0x53246348,0x53246354,0x53246360,0x5324636c)):
        for f in range(0,0x14):
            state();c.mem_write(REC+0x918+2*i,bytes([f]));c.mem_write(OBJ,struct.pack('<II',0,REC))
            p.run(at,STOP,{0:OBJ});assert r(c,0)==(0 if f in adj else f),(i,f,r(c,0));count('ADJ Off' if f in adj else 'ADJ kept')
    for i,(lst,cnt) in enumerate(zip(ADJ_LISTS,ADJ_COUNTS)):
        p.run(cnt,STOP,{});n=r(c,0)
        got=list(c.mem_read(lst,19));orig=list(data[lst-0x53000000:lst-0x53000000+19])
        assert n==19-sum(1 for f in orig if f in adj) and not any(f in adj for f in got[:n]),(i,n,got)
        count('ADJ list')
    # The settings load.
    prior=e['hiddenValues'];pr=None
    # The camera's load is the base probe's (guard_probe.py: r0 the user data object UD, returns 0x77).
    from guard_probe import UD
    BOX=0x63042000
    for bad in (None,3,7):
        c.mem_write(REC,bytes([0xa5])*0xb28)
        for k in range(8):c.mem_write(BOX+k*0x1000,bytes([0x5a])*0xb28)
        ptrs=[BOX+k*0x1000 for k in range(8)]
        if bad is not None:ptrs[bad]=0x1000
        c.mem_write(0x55063f34,struct.pack('<I',REC));c.mem_write(0x55063f38,b''.join(struct.pack('<I',x) for x in ptrs))
        regs={0:UD,4:0x44,5:0x55,6:0x66,7:0x77,8:0x88,9:0x99,10:0xaa,11:0xbb}
        p.run(prior,STOP,regs);assert r(c,0)==0x77
        for k,v in regs.items():
            if k>3:assert r(c,k)==v,k
        recs=[(REC,0xa5)]+[(BOX+k*0x1000,0x5a) for k in range(8) if k!=bad]
        offs={}
        for k,v in hs.items():
            if k=='flashComp':
                for j,bb in enumerate(data[COMP_TABLE-0x53000000+4*v:COMP_TABLE-0x53000000+4*v+4]):offs[HIDEABLE[k][1]+j]=bb
            else:offs[HIDEABLE[k][1]]=v
            if k in MEMORY_BOX:offs[MEMORY_BOX[k]]=1
        for base,fill in recs:
            b=bytes(c.mem_read(base,0xb28))
            for o in range(0xb28):assert b[o]==offs.get(o,fill),(hex(base),hex(o),b[o])
        if bad is not None:assert bytes(c.mem_read(BOX+bad*0x1000,0xb28))==bytes([0x5a])*0xb28
        count('values written')
    return dict(cases=cases,hidden=hs,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
