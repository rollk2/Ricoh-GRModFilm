"""Snap Focus Distance among the functions of Fn Button Settings (core/src/fw/gr3x/wb-button.ts,
film-roll.ts, `snapButton`, T-SNAP1), in the emulator.

  python3 snap_button_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the functions table: the camera's 36, then 42, 44, 45 and 46; the text and icon functions give
    46 the camera's "Snap Focus Distance" (0x3c) and Set Snap's icon (0x142); 47 and above read as Off;
  - the step (`snapStep`), its getter and setter of the settings record (+0x130) and the focus mode
    read (+0xc6) executed natively, the app, settings and aux getters, the camera's one-notch step
    (0x53225c74) and its apply (0x532af660) replaced by recorders: in Snap focus (10) a distance
    other than infinity gives one step forward; infinity stores the first distance (30) and applies
    it (aux, 0); any other focus mode nothing; every register kept but ip;
  - GetEventCustomize's entry with function 46 pressed (r3 = 0): the step once, then on as Off
    (r2 = 0); held or released: no step, as Off; GetEventSwitchWlan's switch with 46: the step once,
    then as Off (r6 = 0).
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

APP,SETTINGS,AUX=0x5320ad88,0x5320b31c,0x5320b73c
STEP,APPLY,SET=0x53225c74,0x532af660,0x53242680
TEXT,ICON,CUSTOM,WLAN=0x53292ed0,0x53293e6c,0x5329bcc8,0x5329a0a0
OBJ,REC,AUXOBJ,APPOBJ=0x63050000,0x63051000,0x63054000,0x63055000

def verify(data,manifest):
    assert manifest.get('snapButton')==True
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    u8=lambda a:c.mem_read(a,1)[0]
    # 1. The table, the text and the icon.
    table=e['filmFnTable'];vals=bytes(c.mem_read(table,40))
    assert list(vals[36:40])==[42,44,45,46],list(vals[36:40])
    def call(at,*args):
        for i,v in enumerate(args):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(at,0x5a5a5a5a,count=100000);return c.reg_read(reg.UC_ARM_REG_R0)
    assert call(TEXT,0,46)==0x3c and call(ICON,0,46)==0x142;cases['text and icon']=2
    assert call(TEXT,0,47)==call(TEXT,0,0) and call(ICON,0,47)==call(ICON,0,0);cases['47 as Off']=2
    # 2. The step.
    log=[]
    def hook(cpu,at,size,user):
        ret=None
        if at==APP:ret=APPOBJ
        elif at==SETTINGS:ret=OBJ   # (the roll harness may answer the app getter itself)
        elif at==AUX:ret=AUXOBJ
        elif at==STEP:log.append(('step',cpu.reg_read(reg.UC_ARM_REG_R1)));ret=0
        elif at==APPLY:log.append(('apply',cpu.reg_read(reg.UC_ARM_REG_R0),cpu.reg_read(reg.UC_ARM_REG_R1)));ret=0
        if ret is not None:cpu.reg_write(reg.UC_ARM_REG_R0,ret);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    for at in (APP,SETTINGS,AUX,STEP,APPLY):c.hook_add(UC_HOOK_CODE,hook,begin=at,end=at)
    c.mem_write(OBJ,struct.pack('<2I',0,REC))
    def press(focus,dist):
        c.mem_write(REC,bytes(0xb28));c.mem_write(REC+0xc6,bytes([focus]));c.mem_write(REC+0x130,struct.pack('<i',dist))
        log.clear();regs=[0x1000+i for i in range(13)]
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(e['snapStep'],0x5a5a5a5a,count=100000)
        # every register kept but ip (scratch: the camera's focus mode read uses it; the callers save it)
        assert [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]==regs[:12] and c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return list(log),struct.unpack('<i',bytes(c.mem_read(REC+0x130,4)))[0]
    for d in (30,100,150,200,250,350,500):
        assert press(10,d)==([('step',1)],d);cases['step']=cases.get('step',0)+1
    assert press(10,-1)==([('apply',AUXOBJ,0)],30);cases['wrap']=1
    for f in (0,1,5,9,11,13):
        assert press(f,200)==([],200) and press(f,-1)==([],-1),(f,press(f,200));cases['other focus']=cases.get('other focus',0)+2
    # 3. The buttons' dispatch.
    def custom(fn,phase):
        log.clear();c.mem_write(REC+0xc6,bytes([10]));c.mem_write(REC+0x130,struct.pack('<i',100))
        regs=[0x1000+i for i in range(13)];regs[2]=fn;regs[3]=phase
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(CUSTOM,CUSTOM+4,count=100000)
        assert c.reg_read(reg.UC_ARM_REG_PC)==CUSTOM+4 and c.reg_read(reg.UC_ARM_REG_R2)==0
        return list(log)
    assert custom(46,0)==[('step',1)] and custom(46,1)==[] and custom(46,2)==[];cases['GetEventCustomize']=3
    log.clear();c.mem_write(REC+0x130,struct.pack('<i',100))
    for i in range(13):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),0x1000+i)
    c.reg_write(reg.UC_ARM_REG_R6,46);c.reg_write(reg.UC_ARM_REG_SP,STACK)
    c.emu_start(WLAN,WLAN+4,count=100000)
    assert c.reg_read(reg.UC_ARM_REG_PC)==WLAN+4 and c.reg_read(reg.UC_ARM_REG_R6)==0 and log==[('step',1)],log;cases['GetEventSwitchWlan']=1
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
