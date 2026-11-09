"""Hold buttons (core/src/fw/gr3x/hold.ts, `holdButtons`), in the emulator.

  python3 hold_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

Run from ActionModel::OnEvent's entry (0x53221a1c, through the rear dial's filter when it is off),
the app, controllers, state and AF-move getters stubbed, OnEvent after its first instruction
(`holdOrig`) replaced by a recorder (the key, and the key's own setting at that moment):
  - Hold lines Off: every key goes on (pressed, held, released);
  - a pad key with a Hold function: pressed kept back; first held code: its press and release sent
    with its own setting holding the Hold function (Macro and WB: 0 for their own function), then
    the setting back; later held codes and the release kept back;
  - a short press: kept back, then on release the press sent and the release goes on;
  - Fn (no held code): 22 kept back, its time noted (tk_get_otm, stubbed); 23 after 600 ms or more
    (the clock may wrap) runs its Hold (22 then 23 with 0x922 set), sooner the short press;
  - not in the viewfinder (another controller), the AF point moved by the pad, a Hold above the
    highest function, no record: as before (the AF point does not stop Fn);
  - r4..r11 kept (OnEvent takes two arguments: r2, r3 and ip are free), r0 and r1 as given when
    the key goes on, the stack balanced; the rear dial (24, 25) still ignored;
  - Fn's held sub-state in the events' translation: GR3X_FN_HELD to OnEvent's entry, the
    translation's frame undone (r4, r5, fp, sp, lr as its ldm would give them).
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

KEY=0x53221a1c;LR=0x5a5a5a5a
APP,CONTROLLERS,STATE,AF_MOVE=0x5320ad88,0x5320aefc,0x5320b61c,0x532a441c
RECORD_POINTER=0x55063f34;REC=0x63041000;CTRL=0x63042000;THIS=0x63043000
STATE_RAM=0x558043be;TIME_RAM=0x558043a0;OTM=0x53050b7c;HOLD_MS=600
# Fn, Macro (up), WB (down), ISO (left), Drive (right): press, held, release, Hold byte, own byte, own function.
KEYS=((22,None,23,0x806,0x922,0),(26,27,28,0x84a,0xac5,45),(29,30,31,0x88e,0xabb,44),(32,33,34,0xacf,0x924,0),(35,36,37,0xae3,0x926,0))

def r(c,n):return c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))

def verify(data,manifest):
    assert manifest.get('holdButtons')==True
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    MAX=46 if manifest.get('snapDof') else 45
    sites={s['address']:s for s in manifest['sites']}
    assert 0x53223708 not in sites
    orig=e['holdOrig'];calls=[];env={'ctrl':0x08000000,'af':0,'ms':0}
    def hook(cpu,at,size,user):
        ret=None
        if at==APP:ret=0xa0a0
        elif at==CONTROLLERS:cpu.mem_write(CTRL,struct.pack('<I',env['ctrl']));ret=CTRL
        elif at==STATE:ret=0xb61c
        elif at==AF_MOVE:ret=env['af']
        elif at==OTM:cpu.mem_write(r(cpu,0),struct.pack('<iI',7,env['ms']&0xffffffff));ret=0
        elif at==orig:
            k=r(cpu,1);own=[x for x in KEYS if k in (x[0],x[2])]
            calls.append((r(cpu,0),k,cpu.mem_read(REC+own[0][4],1)[0] if own else None));ret=1
        if ret is not None:cpu.reg_write(reg.UC_ARM_REG_R0,ret);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    for at in (APP,CONTROLLERS,STATE,AF_MOVE,OTM,orig):c.hook_add(UC_HOOK_CODE,hook,begin=at,end=at)
    def setup(holds=(0,0,0,0,0),own=None):
        c.mem_write(REC,bytes(0xb28));c.mem_write(RECORD_POINTER,struct.pack('<I',REC))
        for k,h in zip(KEYS,holds):c.mem_write(REC+k[3],bytes([h]))
        for k,v in zip(KEYS,own or (7,8,9,10,11)):c.mem_write(REC+k[4],bytes([v]))
        c.mem_write(STATE_RAM,bytes(2))
    def key(code):
        calls.clear();regs=[0x1000+i for i in range(13)];regs[0]=THIS;regs[1]=code
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,LR)
        h=c.hook_add(UC_HOOK_CODE,lambda u,at,size,d:u.emu_stop() if at in (KEY+4,LR) else None)
        c.emu_start(KEY,LR,count=20000);c.hook_del(h)
        pc=c.reg_read(reg.UC_ARM_REG_PC);got=[r(c,i) for i in range(12)]
        assert c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[4:12]==regs[4:12],(code,[hex(x) for x in got])
        if pc==KEY+4:
            assert got[0]==THIS and got[1]==code and c.reg_read(reg.UC_ARM_REG_R12)==STACK;return ('on',list(calls))
        assert pc==LR;return (got[0],list(calls))
    own=(7,8,9,10,11)
    fnDial=bool(manifest.get('fnDial'))
    # Hold lines Off: as before (with Fn + front dial, Fn's press kept back: a short press on release).
    setup()
    for k in KEYS:
        for code in k[:3]:
            if code is None:continue
            if fnDial and k[0]==22:continue
            assert key(code)==('on',[]),code;count('off')
    if fnDial:
        # Fn with its Hold line Off: kept back too, a short press on release, however long.
        for dt in (0,HOLD_MS+500):
            env['ms']=1000;assert key(22)==(1,[]);env['ms']=1000+dt
            assert key(23)==('on',[(THIS,22,7)]),dt;count('Fn short, Hold Off')
        # Fn held + the front dial: the events' translation (0x532231e4) makes its turns (types 0x22,
        # 0x23) the rear dial's (0x24, 0x25), in r3 and in the event, and sets « hold run ».
        EV=0x63047800
        def xlat(t,state):
            c.mem_write(STATE_RAM,bytes(state));c.mem_write(EV,struct.pack('<H',t))
            regs=[0x4000+j for j in range(13)];regs[1]=EV
            for j,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%j),v)
            c.reg_write(reg.UC_ARM_REG_SP,STACK)
            h=c.hook_add(UC_HOOK_CODE,lambda u,a_,s_,d:u.emu_stop() if a_==0x532231e8 else None)
            c.emu_start(0x532231e4,0x532231e8,count=200);c.hook_del(h)
            got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%j)) for j in range(13)]
            assert c.reg_read(reg.UC_ARM_REG_PC)==0x532231e8 and c.reg_read(reg.UC_ARM_REG_SP)==STACK and got[:3]==regs[:3] and got[4:12]==regs[4:12]
            return got[3],struct.unpack('<H',bytes(c.mem_read(EV,2)))[0],list(c.mem_read(STATE_RAM,2))
        for t in (0x22,0x23):
            assert xlat(t,[22,0])==(t+2,t+2,[22,1]);count('front dial as rear, Fn held')
            for st in ([0,0],[26,0],[23,0]):assert xlat(t,st)==(t,t,st);count('front dial, Fn not held')
        for t in (0x1b,0x21,0x24,0x25,0x26,0x10):assert xlat(t,[22,0])==(t,t,[22,0]);count('other events')
        # The rear dial's codes go on while Fn is held (they are the front dial's), else ignored.
        for holds in ((0,0,0,0,0),(44,0,0,0,0)):
            setup(holds);env['ms']=1000
            assert key(22)==(1,[]) and c.mem_read(STATE_RAM,1)[0]==22
            assert key(24)==('on',[]) and key(25)==('on',[]);count('rear codes, Fn held')
            c.mem_write(STATE_RAM+1,bytes([1]))
            env['ms']=5000;assert key(23)==(1,[]) and c.mem_read(STATE_RAM,1)[0]==0;count('Fn released after the dial')
            assert key(24)==(1,[]) and key(25)==(1,[]);count('rear codes, Fn not held')
            assert key(9)==('on',[]) and key(10)==('on',[]);count('front dial alone')
        if manifest.get('fnDial')=='diag':
            # The viewfinder's cases 24, 25: noted 74, 75, then the case, registers kept.
            for i,(k,target) in enumerate(((24,0x5320d890),(25,0x5320d800))):
                stub=struct.unpack('<I',bytes(c.mem_read(0x5320c874+4*(k-1),4)))[0];assert stub!=target
                c.mem_write(0x558043a8,bytes(8));regs=[0x3000+j for j in range(13)]
                for j,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%j),v)
                c.reg_write(reg.UC_ARM_REG_SP,STACK)
                h=c.hook_add(UC_HOOK_CODE,lambda u,a,s_,d:u.emu_stop() if a==target else None)
                c.emu_start(stub,target,count=200);c.hook_del(h)
                got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%j)) for j in range(13)]
                assert c.reg_read(reg.UC_ARM_REG_PC)==target and got==regs and c.reg_read(reg.UC_ARM_REG_SP)==STACK and list(c.mem_read(0x558043a8,2))==[74+i,0];count('case noted')
            # The dial actions' events counted (80 + n, 19 at most) before the poster, registers kept.
            for at in (0x5320d8c4,0x5320d834,0x5320e3ac,0x5320e31c):
                w=struct.unpack('<I',bytes(c.mem_read(at,4)))[0];d_=w&0xffffff;d_=d_-0x1000000 if d_&0x800000 else d_;stub=at+8+4*d_
                for n,vec in ((0,True),(0,False),(1,True),(3,True),(25,True)):
                    BUF,VEC=0x63047000,0x63047100
                    c.mem_write(BUF,struct.pack('<I',VEC if vec else 0));c.mem_write(VEC,struct.pack('<II',0x63048000,0x63048000+12*n))
                    c.mem_write(0x558043a8,bytes(8));regs=[0x3000+j for j in range(13)];regs[1]=BUF
                    for j,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%j),v)
                    c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
                    h=c.hook_add(UC_HOOK_CODE,lambda u,a,s_,d:u.emu_stop() if a==0x532a0d70 else None)
                    c.emu_start(stub,0x532a0d70,count=500);c.hook_del(h)
                    got=[c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%j)) for j in range(13)]
                    assert c.reg_read(reg.UC_ARM_REG_PC)==0x532a0d70 and got==regs and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_LR)==0x5a5a5a5a
                    assert list(c.mem_read(0x558043a8,2))==[80+min(n,19),0],(hex(at),n,list(c.mem_read(0x558043a8,2)));count('events counted')
        env['ctrl']=0x02000104;setup()
        assert key(22)==('on',[]) and key(9)==('on',[]) and key(23)==('on',[]);count('Fn + dial, not viewfinder');env['ctrl']=0x08000000
    else:
        for code in (9,10):setup();assert key(code)==('on',[]);count('front dial')
    for code in (24,25):assert key(code)==((1,[]) if manifest.get('rearDialOff') else ('on',[]));count('rear dial')
    for code in (50,14,5):assert key(code)==('on',[]);count('other keys')
    for i,k in enumerate(KEYS):
        press,held,release,hb,ob,of=k
        for H in (44,45,42,19,MAX):
            holds=[0]*5;holds[i]=H;setup(holds)
            v=0 if H==of else H
            # Long press: kept back, Hold on the first held code, the rest kept back.
            if held is None:
                # Fn: timed (tk_get_otm at the press, then at the release; the clock may wrap).
                for t0,dt in ((1000,HOLD_MS),(5000,HOLD_MS+900),(0xfffffe00,HOLD_MS+10)):
                    env['ms']=t0;assert key(press)==(1,[]) and c.mem_read(STATE_RAM,2)==bytes([press,0])
                    assert struct.unpack('<I',bytes(c.mem_read(TIME_RAM,4)))[0]==t0
                    env['ms']=t0+dt;assert key(release)==(1,[(THIS,press,v),(THIS,release,v)]),(H,t0,dt,calls)
                    assert c.mem_read(REC+ob,1)[0]==own[i] and c.mem_read(STATE_RAM,1)[0]==0;count('long press')
                for t0,dt in ((1000,0),(1000,HOLD_MS-1),(0xffffff00,300)):
                    env['ms']=t0;assert key(press)==(1,[]);env['ms']=t0+dt
                    assert key(release)==('on',[(THIS,press,own[i])]),(t0,dt);count('short press')
                assert key(release)==('on',[]);count('stray')
                continue
            assert key(press)==(1,[]),(k,H);assert c.mem_read(STATE_RAM,2)==bytes([press,0])
            assert key(held)==(1,[(THIS,press,v),(THIS,release,v)]),(k,H,calls)
            assert c.mem_read(REC+ob,1)[0]==own[i] and c.mem_read(STATE_RAM,2)==bytes([press,1])
            assert key(held)==(1,[]) and key(release)==(1,[]) and c.mem_read(STATE_RAM,1)[0]==0;count('long press')
            # Short press: the press sent at release, the release goes on.
            assert key(press)==(1,[]) and key(release)==('on',[(THIS,press,own[i])]);count('short press')
            # A held or released key whose press was not kept back: as before.
            assert key(held)==('on',[]);assert key(release)==('on',[]);count('stray')
        holds=[0]*5;holds[i]=44
        for ctrl in (0x02000104,0x08000001,0x0800000c):
            setup(holds);env['ctrl']=ctrl
            assert key(press)==('on',[]) and key(release)==('on',[]);count('not viewfinder')
        env['ctrl']=0x08000002;setup(holds);assert key(press)==(1,[]);count('viewfinder 2')
        env['ctrl']=0x08000000
        setup(holds);env['af']=1
        assert key(press)==((1,[]) if i==0 else ('on',[])),k;count('AF point');env['af']=0
        for H in (MAX+1,0xff):
            holds2=[0]*5;holds2[i]=H;setup(holds2);assert key(press)==('on',[]);count('above max')
        setup(holds);c.mem_write(RECORD_POINTER,bytes(4));assert key(press)==('on',[]);count('no record')
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
