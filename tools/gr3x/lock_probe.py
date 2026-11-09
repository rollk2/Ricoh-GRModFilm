"""Roll lock (core/src/fw/gr3x/film-roll.ts, `rollLock`, T-LOCK1), in the emulator.

  python3 lock_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the lines' visibility hook (`linesHidden`, at the tab builder's call 0x5319a978): the seven
    locked lines (Image Control, Aspect Ratio, Crop, Drive Mode, File Format, JPEG Recorded Pixels,
    Color Space) hidden only while a roll is loaded: a U mode (mode byte 1..6), Film Roll Mode on
    (bit 0 of 0x9b1), a roll started (bit 1) and the counter (0x9b2) not 0; otherwise (P..M, 7, film
    off, not started, counter 0, no mode or record pointer) the camera's own visibility, with its
    arguments; the lines always hidden (Still/Movie...) stay hidden; other lines as the camera's;
  - the menu built natively (its tab builder through `menuRebuild`): Still Image Settings without
    the seven lines while a roll is loaded, with them otherwise; the other tabs unchanged.
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
    return dict(cases=cases,still_lines={k:len(still(k)) for k in got},rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
