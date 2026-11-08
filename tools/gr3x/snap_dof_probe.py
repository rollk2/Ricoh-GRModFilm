"""Snap DOF among the functions of Fn Button Settings (core/src/fw/gr3x/wb-button.ts, film-roll.ts,
dial-probe.ts, `snapDof`, T-DOF1), in the emulator.

  python3 snap_dof_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the functions table: the camera's 36, then 42, 44, 45 and 46; the text function gives 46 a text
    reading "Snap DOF" in every row, the icon function Snap Distance Priority's (0x19);
    47 and above read as Off;
  - the rear dial filter (0x53221a1c) keeps every key's model in 0x558043a8 (24 and 25 still
    handled at once, other keys on);
  - the press (`snapStep`), the app and settings getters replaced, the Snap Distance Priority getter
    (+0x110) executed natively, the filter's way around (`rearDialBypass`) replaced by a recorder:
    priority on and a model in RAM: one notch, (model, 25); priority off, or no model: nothing;
    every register kept;
  - GetEventCustomize's entry with 46 pressed (r3 = 0): the press once, then as Off; held or
    released: nothing, as Off; GetEventSwitchWlan's switch with 46: the press once, then as Off.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK

APP,SETTINGS=0x5320ad88,0x5320b31c
TEXT,ICON,CUSTOM,WLAN,KEY=0x53292ed0,0x53293e6c,0x5329bcc8,0x5329a0a0,0x53221a1c
MODEL=0x558043a8
OBJ,REC,APPOBJ,AM=0x63050000,0x63051000,0x63055000,0x63056000

def verify(data,manifest):
    assert manifest.get('snapDof')==True and manifest.get('rearDialOff')==True
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    table=e['filmFnTable'];vals=bytes(c.mem_read(table,40))
    assert list(vals[36:40])==[42,44,45,46],list(vals[36:40])
    def call(at,*args):
        for i,v in enumerate(args):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(at,0x5a5a5a5a,count=100000);return c.reg_read(reg.UC_ARM_REG_R0)
    u=lambda a:struct.unpack('<I',bytes(c.mem_read(a,4)))[0]
    roots=manifest['catalogs']['textRoots']
    def text(row,i):
        d=u(u(roots+row*4)+i*4);n=c.mem_read(d,1)[0];return bytes(c.mem_read(u(d+4),max(0,n-1)*2)).decode('utf-16le')
    t=call(TEXT,0,46)
    assert all(text(row,t)=='Snap DOF' for row in range(21)) and call(ICON,0,46)==0x19,(hex(t),text(1,t));cases['text and icon']=2
    assert call(TEXT,0,47)==call(TEXT,0,0) and call(ICON,0,47)==call(ICON,0,0);cases['47 as Off']=2
    # The filter keeps the model.
    for key,handled in ((24,True),(25,True),(26,False),(50,False)):
        c.mem_write(MODEL,bytes(4))
        for i in range(13):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),0x1000+i)
        c.reg_write(reg.UC_ARM_REG_R0,AM+key);c.reg_write(reg.UC_ARM_REG_R1,key);c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        h=c.hook_add(UC_HOOK_CODE,lambda u,at,size,d:u.emu_stop() if at in (KEY+4,0x5a5a5a5a) else None)
        c.emu_start(KEY,0x5a5a5a5a,count=60);c.hook_del(h)
        assert struct.unpack('<I',bytes(c.mem_read(MODEL,4)))[0]==AM+key
        assert (c.reg_read(reg.UC_ARM_REG_PC)==0x5a5a5a5a)==handled,key
        cases['model kept']=cases.get('model kept',0)+1
    # The press.
    log=[];BY=e['rearDialBypass']
    def hook(cpu,at,size,user):
        ret=None
        if at==APP:ret=APPOBJ
        elif at==SETTINGS:ret=OBJ
        elif at==BY:log.append((cpu.reg_read(reg.UC_ARM_REG_R0),cpu.reg_read(reg.UC_ARM_REG_R1)));ret=1
        if ret is not None:cpu.reg_write(reg.UC_ARM_REG_R0,ret);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    for at in (APP,SETTINGS,BY):c.hook_add(UC_HOOK_CODE,hook,begin=at,end=at)
    c.mem_write(OBJ,struct.pack('<2I',0,REC))
    def press(priority,model):
        c.mem_write(REC,bytes(0xb28));c.mem_write(REC+0x110,bytes([priority]));c.mem_write(MODEL,struct.pack('<I',model))
        log.clear();regs=[0x1000+i for i in range(13)]
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(e['snapStep'],0x5a5a5a5a,count=100000)
        assert [c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%i)) for i in range(12)]==regs[:12] and c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return list(log)
    for pr in (1,2):assert press(pr,AM)==[(AM,25)];cases['notch']=cases.get('notch',0)+1
    for pr,m in ((0,AM),(1,0),(1,0x30000000),(1,AM+2),(0,0)):
        assert press(pr,m)==[],(pr,hex(m));cases['nothing']=cases.get('nothing',0)+1
    def custom(fn,phase):
        c.mem_write(REC+0x110,bytes([1]));c.mem_write(MODEL,struct.pack('<I',AM));log.clear()
        regs=[0x1000+i for i in range(13)];regs[2]=fn;regs[3]=phase
        for i,v in enumerate(regs):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),v)
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
        c.emu_start(CUSTOM,CUSTOM+4,count=100000)
        assert c.reg_read(reg.UC_ARM_REG_PC)==CUSTOM+4 and c.reg_read(reg.UC_ARM_REG_R2)==0
        return list(log)
    assert custom(46,0)==[(AM,25)] and custom(46,1)==[] and custom(46,2)==[];cases['GetEventCustomize']=3
    log.clear()
    for i in range(13):c.reg_write(getattr(reg,'UC_ARM_REG_R%d'%i),0x1000+i)
    c.reg_write(reg.UC_ARM_REG_R6,46);c.reg_write(reg.UC_ARM_REG_SP,STACK)
    c.emu_start(WLAN,WLAN+4,count=100000)
    assert c.reg_read(reg.UC_ARM_REG_PC)==WLAN+4 and c.reg_read(reg.UC_ARM_REG_R6)==0 and log==[(AM,25)],log;cases['GetEventSwitchWlan']=1
    return dict(cases=cases,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
