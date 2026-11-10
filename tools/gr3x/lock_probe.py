"""Roll lock (core/src/fw/gr3x/film-roll.ts, `rollLock`, T-LOCK1), in the emulator.

  python3 lock_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the lines' visibility hook (`linesHidden`, at the tab builder's call 0x5319a978): the seven
    locked lines (Image Control, Aspect Ratio, Crop, Drive Mode, File Format, JPEG Recorded Pixels,
    Color Space) hidden only while a roll is loaded: a U mode (mode byte 1..6), Film Roll Mode on
    (bit 0 of 0x9b1), a roll started (bit 1) and the counter (0x9b2) not 0; otherwise (P..M, 7, film
    off, not started, counter 0, no mode or record pointer) the camera's own visibility, with its
    arguments; the lines always hidden (Still/Movie...) stay hidden; other lines as the camera's;
  - the menu built natively (its tab builder through `menuRebuild`): Still Image Settings without
    the seven lines while a roll is loaded, with them otherwise; the other tabs unchanged;
  - T-LOCK2: GetEventCustomize's entry (Fn, ISO, Drive: function in r2) and GetEventSwitchWlan's
    switch (Wireless: r6, ip kept): File Format 10, JPEG → RAW 11, JPEG → RAW+ 12, Aspect Ratio 13,
    Crop 14, JPEG Recorded Pixels 15, Drive Mode 23, Drive 24, Continuous Shooting 25, Image Control
    27 become Off (0) while a roll is loaded, unchanged otherwise; other functions unchanged;
  - the ADJ lever's five slot getters: File Format 3, Aspect Ratio 4, JPEG Recorded Pixels 5, Drive
    0x0a, Image Control 0x0c, Crop 0x10 read as Off (0) while a roll is loaded; the others, and every
    function otherwise, as stored (above 0x13 as 0 with the round 10 soft focus).
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK,STOP

LOCKED=(0x02000012,0x02000073,0x02000074,0x0200000e,0x02000072,0x02000075,0x02000076)
ALWAYS=0x0200006e;VISIBLE=0x5319a720;MODEL=0x55063f30
MODEB=0x6304a100;REC=0x63040000;IDW=0x6304a200   # film_roll_check.py's mapped areas (OBJ, CUR)

def verify(data,manifest):
    assert manifest.get('rollLock')==True
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    def state(mode=3,flags=3,frame=5,model=True,record=True):
        c.mem_write(MODEB,bytes([mode]));c.mem_write(REC,bytes(0xb28));c.mem_write(REC+0x9b1,bytes([flags]));c.mem_write(REC+0x9b2,bytes([frame]))
        c.mem_write(MODEL,struct.pack('<II',MODEB if model else 0,REC if record else 0))
    seen=[]
    def vis(cpu,at,size,user):
        seen.append(tuple(cpu.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(3)))
        cpu.reg_write(reg.UC_ARM_REG_R0,0x77);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    h=c.hook_add(UC_HOOK_CODE,vis,begin=VISIBLE,end=VISIBLE)
    def shown(ident):
        seen.clear();c.mem_write(IDW,struct.pack('<I',ident))
        regs={0:0x1110,1:0x2221,2:0x3332,4:0x44,5:0x55,6:0x66,7:0x77,8:0x88,9:0x99,10:IDW,11:0xbb}
        p.run(e['linesHidden'],STOP,regs)
        for k,v in regs.items():
            if k>3:assert c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%k))==v,(hex(ident),k)
        assert c.reg_read(reg.UC_ARM_REG_SP)==STACK
        r0=c.reg_read(reg.UC_ARM_REG_R0)
        if r0==0x77:assert seen==[(0x1110,0x2221,0x3332)],seen;return True
        assert r0==0 and seen==[];return False
    for ident in LOCKED:
        state();assert not shown(ident);count('hidden, roll loaded')
        for mode in (1,2,4,5,6):state(mode=mode);assert not shown(ident);count('hidden, roll loaded')
        for st in (dict(mode=0),dict(mode=7),dict(mode=0xff),dict(flags=1),dict(flags=2),dict(flags=0),dict(frame=0),dict(model=False),dict(record=False)):
            state(**st);assert shown(ident),(hex(ident),st);count('shown')
        state(flags=0xff,frame=36);assert not shown(ident);count('hidden, other bits')
    for st in (dict(),dict(mode=0)):
        state(**st);assert not shown(ALWAYS);count('always hidden')
        for other in (0x02000066,0x0200004e,0x0200007d,0x020000e1):assert shown(other);count('other lines')
    c.hook_del(h)
    # The menu built by the camera's tab builder (as film_roll_check.py's 'hide1' does).
    MENU=0x63053000;p.menu_stubs=True;c.ctl_flush_tb()
    c.mem_write(0x55001eb8,bytes(c.mem_read(0x5407d3f8,20)))
    def tabs():
        m=bytes(c.mem_read(MENU,0x13bc))
        return [[struct.unpack_from('<I',m,0x384*t+0x3e4+4*k)[0] for k in range(m[0x384*t+0x2b3])] for t in range(5)]
    got={}
    for name,st in (('loaded',dict()),('rewound',dict(frame=0)),('P',dict(mode=0))):
        state(**st);c.mem_write(MENU,bytes(0x13bc));c.ctl_flush_tb()
        p.run(e['menuRebuild'],0x53199eb0,{0:MENU});got[name]=tabs();count('menu built')
    still=lambda n:got[n][0]
    assert not any(i in still('loaded') for i in LOCKED) and all(i in still('rewound') for i in LOCKED) and all(i in still('P') for i in LOCKED),[hex(i) for i in still('loaded')]
    assert [i for i in still('rewound') if i not in LOCKED]==still('loaded') and still('rewound')==still('P')
    assert len(still('loaded'))==len(still('rewound'))-7
    for t in range(1,5):assert got['loaded'][t]==got['rewound'][t],t
    p.menu_stubs=False
    # T-LOCK2: the buttons' functions.
    FNS=(10,11,12,13,14,15,23,24,25,27)
    # T-HIDE1: functions of hidden settings are Off always (hidden_probe.py); left out here.
    HID={f for k in (manifest.get('hiddenSettings') or {}) for f in {'faceEye':(8,),'flash':(20,),'gf2':(41,),'flashComp':(21,)}.get(k,())}
    HIDADJ={f for k in (manifest.get('hiddenSettings') or {}) for f in {'flash':(8,),'gf2':(0x13,),'flashComp':(() if 'softFocusSlot0' in manifest['entries'] else (9,))}.get(k,())}
    OTHER=tuple(f for f in (0,1,9,16,19,22,26,28,41) if f not in HID)
    for name,st,loaded in (('loaded',dict(),True),('rewound',dict(frame=0),False),('P',dict(mode=0),False),('film off',dict(flags=2),False)):
        for f in FNS+OTHER:
            state(**st)
            regs={0:0x1110,1:0x2221,2:f,3:0x3333,4:0x44,5:0x55,6:0x66,7:0x77,8:0x88,9:0x99,10:0xaa,11:0xbb}
            p.run(0x5329bcc8,0x5329bccc,regs)
            v0=c.reg_read(reg.UC_ARM_REG_R2);want=0 if (loaded and f in FNS) else f
            assert v0==want,(name,f,v0)
            for k,v in regs.items():
                if k!=2:assert c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%k))==v,(name,f,k)
            count('Fn '+('Off' if want!=f else 'kept'))
            regs={0:0x1110,1:0x2221,2:0x2222,3:0x3333,4:0x44,5:0x55,6:f,7:0x77,8:0x88,9:0x99,10:0xaa,11:0xbb,12:0xcc}
            p.run(0x5329a0a0,0x5329a0a4,regs)
            v0=c.reg_read(reg.UC_ARM_REG_R6)
            assert v0==want,(name,'wlan',f,v0)
            for k,v in regs.items():
                if k!=6:assert c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%k))==v,(name,'wlan',f,k)
            count('Wireless '+('Off' if want!=f else 'kept'))
    # T-LOCK2: the ADJ lever's slots.
    ADJ=(3,4,5,0x0a,0x0c,0x10);soft=manifest.get('adjSoftFocus') or manifest.get('features',{}).get('adjSoftFocus')
    OBJ=0x6304a300
    for i,at in enumerate((0x5324633c,0x53246348,0x53246354,0x53246360,0x5324636c)):
        for name,st,loaded in (('loaded',dict(),True),('rewound',dict(frame=0),False),('P',dict(mode=0),False)):
            for f in range(0,0x16):
                state(**st);c.mem_write(REC+0x918+2*i,bytes([f]));c.mem_write(OBJ,struct.pack('<II',0,REC))
                regs={0:OBJ,4:0x44,5:0x55,6:0x66,7:0x77,8:0x88,9:0x99,10:0xaa,11:0xbb}
                p.run(at,STOP,regs)
                for k,v in regs.items():
                    if k>3:assert c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%k))==v,(i,f,k)
                v0=c.reg_read(reg.UC_ARM_REG_R0)
                base=0 if f>0x13 or f in HIDADJ else f
                if f>0x13 and v0==f:base=f   # without the round 10 soft focus the camera's own getter keeps it
                want=0 if (loaded and base in ADJ) else base
                assert v0==want,(i,name,f,v0)
                count('ADJ '+('Off' if want!=base else 'kept'))
    return dict(cases=cases,still_lines={k:len(still(k)) for k in got},rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
