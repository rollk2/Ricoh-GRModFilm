"""Rewind Film as a button function (core/src/fw/gr3x/film-roll.ts, `rewindButton`, T-RWB1), in the emulator.

  python3 rewind_button_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the press (entries rewindPress), every register kept: in a U mode (**0x55063f30 1..6) with Film
    Roll Mode on (bit 0 of 0x9b1 of the record in use) and a going roll (bit 2, frame 0x9b2 not 0):
    the film message byte 0x55804397 = 2, its stage 0x5580439d = 0, and the screen switch
    0x5316c9d8(manager, 0x08000007, current) (manager 0x53228a90, current 0x53228c4c, both of the queue
    0x5320aefc, stubbed); otherwise nothing at all;
  - the message's text (0x531ce174 → entries filmMessageText, then 0x531ce128 stubbed): byte 2 gives
    the question (Rewind Film's, filmText + 4: the text after the Rewind line's), 1 « New roll loaded. »,
    0 the camera's own 0x2be;
  - the message screen's way back (the switch hook, entries filmMessageSwitch, from the message screen,
    its vtable 0x53b41ca8, to the live view 0x08000000, stage 2): with byte 2 and OK (lr 0x531cddc0) the
    rewind (filmRollRewind, stubbed) is called; it rewound: byte 1, stage 0, the switch goes to the
    message screen; it did not: byte 0, the live view; the timer's return (0x531cdd80): byte 0, no
    rewind, the live view.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

MSG=0x55804397;STAGE=0x5580439d;MODEL=0x55063f30;LR=0x5a5a5a5a
SWITCH=0x5316c9d8;MANAGER=0x53228a90;CURRENT=0x53228c4c;QUEUE=0x5320aefc;APP=0x5320ad88
TEXT_AT=0x531ce174;TEXT_SET=0x531ce128;VT=0x53b41ca8;OK=0x531cddc0;TIMER=0x531cdd80
MODEB=0x6304f000;INUSE=0x63050000;BOX=0x63051000;OBJ=0x63052000
def r_(u,n):return u.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))
def verify(data,manifest):
    assert manifest.get('rewindButton')==True
    e=manifest['entries'];press=e['rewindPress'];rewind=e['filmRollRewind']
    p=RollProbe(data,manifest);c=p.uc;cases={};p.stubs_on=False  # its own stubs of APP and the like
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    calls=[]
    def stub(ret,name):
        def h(u,a,s,d):
            calls.append((name,r_(u,0),r_(u,1),r_(u,2)));u.reg_write(reg.UC_ARM_REG_R0,ret() if callable(ret) else ret);u.reg_write(reg.UC_ARM_REG_PC,u.reg_read(reg.UC_ARM_REG_LR))
        return h
    hooks=[c.hook_add(UC_HOOK_CODE,stub(0xa0a0,'app'),begin=APP,end=APP),c.hook_add(UC_HOOK_CODE,stub(0xb0b0,'queue'),begin=QUEUE,end=QUEUE),
        c.hook_add(UC_HOOK_CODE,stub(0xc0c0,'manager'),begin=MANAGER,end=MANAGER),c.hook_add(UC_HOOK_CODE,stub(0xd0d0,'current'),begin=CURRENT,end=CURRENT)]
    def run(start,stop,regs,lr=LR):
        for i,x in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),x)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,lr)
        h=c.hook_add(UC_HOOK_CODE,lambda u,a,s,d:u.emu_stop() if a==stop else None)
        c.emu_start(start,stop,count=5000);c.hook_del(h)
        assert c.reg_read(reg.UC_ARM_REG_PC)==stop and c.reg_read(reg.UC_ARM_REG_SP)==STACK,hex(c.reg_read(reg.UC_ARM_REG_PC))
        return [r_(c,i) for i in range(13)]
    # The press.
    hs=c.hook_add(UC_HOOK_CODE,stub(1,'switch'),begin=SWITCH,end=SWITCH)
    for mode in (0,1,3,6,7):
        for flags,frame in ((3,5),(1,5),(2,5),(3,0),(0,0)):
            c.mem_write(MODEB,bytes([mode]));c.mem_write(MODEL,struct.pack('<II',MODEB,INUSE))
            c.mem_write(MODEL+8,struct.pack('<I',0)+struct.pack('<I',BOX)*6+struct.pack('<I',0))
            c.mem_write(INUSE,bytes(0xb28));c.mem_write(INUSE+0x9b1,bytes([flags,frame]));c.mem_write(BOX,bytes(0xb28))
            c.mem_write(MSG,bytes([9]));c.mem_write(STAGE,bytes([9]));calls.clear()
            regs=[0x1000+i for i in range(13)]
            got=run(press,LR,regs)
            assert got==regs,[hex(x) for x in got]
            go=1<=mode<=6 and flags&1 and flags&2 and frame
            if go:
                assert c.mem_read(MSG,1)[0]==2 and c.mem_read(STAGE,1)[0]==0
                # The base probe's own hooks answer some of these calls: the chain and the switch's id and current are checked.
                assert [x[0] for x in calls]==['app','queue','manager','current','switch'] and calls[-1][2:]==(0x08000007,0xd0d0),calls;count('press: question')
            else:
                assert c.mem_read(MSG,1)[0]==9 and c.mem_read(STAGE,1)[0]==9 and not calls,calls;count('press: nothing')
    c.hook_del(hs)
    # The text.
    hs=c.hook_add(UC_HOOK_CODE,stub(0,'text'),begin=TEXT_SET,end=TEXT_SET)
    sites={x['address']:x for x in manifest['sites']}
    for b in (0,1,2):
        c.mem_write(MSG,bytes([b]));calls.clear()
        run(TEXT_AT,LR,[0x2000+i for i in range(13)])
        assert len(calls)==1;texts=calls[0][2];texts_by=texts
        if b==0:assert texts==0x2be
        else:count('text %d'%b)
        if b==1:new_roll=texts
        if b==2:question=texts
    assert question==new_roll+2,(hex(question),hex(new_roll));count('texts')
    c.hook_del(hs)
    # The way back from the message screen.
    rewound={'v':1}
    hr=c.hook_add(UC_HOOK_CODE,stub(lambda:rewound['v'],'rewind'),begin=rewind,end=rewind)
    c.mem_write(OBJ,struct.pack('<I',VT))
    for b,lr,rv in ((2,OK,1),(2,OK,0),(2,TIMER,1),(1,OK,1),(1,TIMER,1),(0,OK,1)):
        c.mem_write(MSG,bytes([b]));c.mem_write(STAGE,bytes([2]));calls.clear();rewound['v']=rv
        # From the hook itself (the base probe stubs the switch's address).
        sites={x['address']:x for x in manifest['sites']};w=struct.unpack('<I',bytes.fromhex(sites[SWITCH]['replacement']))[0];dd=w&0xffffff;dd=dd-0x1000000 if dd&0x800000 else dd
        assert SWITCH+8+4*dd==e['filmMessageSwitch']
        try:got=run(e['filmMessageSwitch'],SWITCH+4,[OBJ,0x08000000]+[0x3000+i for i in range(2,13)],lr=lr)
        except Exception as ex:raise AssertionError((b,hex(lr),rv,hex(c.reg_read(reg.UC_ARM_REG_PC)),calls)) from ex
        rw=[x for x in calls if x[0]=='rewind']
        if b==2 and lr==OK:
            assert len(rw)==1
            if rv:assert c.mem_read(MSG,1)[0]==1 and c.mem_read(STAGE,1)[0]==0 and got[1]==0x08000007,(got[1]);count('OK: rewound, message')
            else:assert c.mem_read(MSG,1)[0]==0 and got[1]==0x08000000;count('OK: nothing to rewind')
        else:
            assert not rw and c.mem_read(MSG,1)[0]==0 and got[1]==0x08000000,(b,hex(lr),hex(got[1]),list(c.mem_read(MSG,1)));count('back: cleared')
        assert got[0]==OBJ
    c.hook_del(hr)
    for h in hooks:c.hook_del(h)
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
