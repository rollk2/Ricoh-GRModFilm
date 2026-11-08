"""The JPEG grain in a film mode build with `grain` (core/src/fw/gr3x/jpeg-stage.ts), in the emulator.

  python3 grain_stage_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the chain: JpegEncodeMacroProcess::Execute's entry branches to the picture look word's stub
    (T-GRAIN7), then the halation's, the grain's and the date imprint's;
  - the picture look word (image-control.ts GR3X_PHOTO_WORD): from the shooting record at the
    configuration's + 0x34 (year at +0x944, look +0x77c, Toning +0x786) as the stash adapter makes
    it (films 64 + k as 32 + k with Grain / Size at bits 20..23 and the Halation level, the camera's
    looks as they are), else the stash copied (no record, a pointer outside RAM, a year outside
    2000..2099); every register and the flags kept; the halation, the grain and the date read it;
  - the grain's stub, run from its first word with the module replaced by a recorder: the module
    gets the context and the configuration ([r1 + 8]), r0..r3, ip, lr and the stack come back as
    they were, and it goes on into the date imprint's stub;
  - the context (jpeg_grain.c, struct gctx): the camera's cache functions and heap, the stash word,
    the recipes and profiles as grain-module.ts has them, the look map (the films the build marks
    black and white at 32 + k), the magic; the module's bytes are grain-module.ts's.
The module itself is checked against the PC by tools/develop/jpeg_grain_probe.py.
"""
import argparse,base64,hashlib,json,re,struct
from pathlib import Path
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STOP,STACK

EXECUTE=0x535047d4
CACHE,FLUSH,CLEAN,ALLOC,FREE,STASH=0x536bbc30,0x536bbcc0,0x536bbcac,0x536af2a8,0x536af2e4,0x55804378
TS=(Path(__file__).resolve().parents[2]/'core/src/fw/gr3x/grain-module.ts').read_text()
get=lambda n:base64.b64decode(re.search(n+r" = '([^']*)'",TS).group(1))

def branch_target(word,at):
    assert word>>24==0xea,hex(word)
    off=word&0xffffff
    if off&0x800000:off-=1<<24
    return at+8+off*4

def verify(data,manifest):
    assert manifest.get('grain')==True
    j=manifest['lookEntries']['jpeg'];e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc
    u32=lambda a:struct.unpack('<I',bytes(c.mem_read(a,4)))[0]
    # 1. The chain.
    assert branch_target(u32(EXECUTE),EXECUTE)==j['photoLook']
    def last_branch(stub):
        for a in range(stub,stub+0x200,4):
            w=u32(a)
            if w>>24==0xea and not stub<=branch_target(w,a)<stub+0x200:return branch_target(w,a)   # the tail, not a branch inside
    assert last_branch(j['photoLook'])==j['halation'],'picture look then halation'
    assert last_branch(j['halation'])==j['grain'],'halation then grain'
    assert last_branch(j['grain'])==e['dateStage'],'grain then the date'
    # 2. The stub, the module replaced by a recorder.
    module=j['grainModule'];seen=[]
    def rec(cpu):
        seen.append((cpu.reg_read(reg.UC_ARM_REG_R0),cpu.reg_read(reg.UC_ARM_REG_R1)))
        cpu.reg_write(reg.UC_ARM_REG_R0,0xdead);cpu.reg_write(reg.UC_ARM_REG_R1,0xbeef);cpu.reg_write(reg.UC_ARM_REG_R2,0x1);cpu.reg_write(reg.UC_ARM_REG_R3,0x2)
        cpu.reg_write(reg.UC_ARM_REG_IP,0x3);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    orig=p._hook
    def hook(cpu,at,size,user):
        if at==module:rec(cpu);return
        orig(cpu,at,size,user)
    p._hook=hook
    from unicorn import UC_HOOK_CODE
    c.hook_add(UC_HOOK_CODE,lambda cpu,at,size,user:hook(cpu,at,size,user) if at==module else None,begin=module,end=module)
    PROC=0x63050000;CONF=0x63051000
    c.mem_write(PROC,struct.pack('<3I',0,0,CONF))
    regs={0:0x1111,1:PROC,2:0x2222,3:0x3333,12:0x4444}
    for i in range(13):c.reg_write(getattr(reg,'UC_ARM_REG_R'+str(i)),regs.get(i,0x1230+i))
    c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a)
    c.emu_start(j['grain'],e['dateStage'],count=200)
    assert c.reg_read(reg.UC_ARM_REG_PC)==e['dateStage'] and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_LR)==0x5a5a5a5a
    for k,v in regs.items():assert c.reg_read(getattr(reg,'UC_ARM_REG_R'+str(k)))==v,k
    assert seen==[(j['grainContext'],CONF)],seen
    # 3. The context and the module's bytes.
    ctx=struct.unpack('<10I',bytes(c.mem_read(j['grainContext'],40)))
    PHOTO=j['photoWord']
    assert ctx[:6]==(CACHE,FLUSH,CLEAN,ALLOC,FREE,PHOTO) and ctx[9]==0x314e5247
    assert struct.unpack('<6I',bytes(c.mem_read(j['halationContext'],24)))[5]==PHOTO
    assert struct.unpack('<8I',bytes(c.mem_read(e['dateContext'],32)))[7]==PHOTO
    # 4. The picture look word.
    REC=0x63052000;cases=0
    def look(rec_ptr,year,lk,toning,stash):
        c.mem_write(PROC,struct.pack('<3I',0,0,CONF));c.mem_write(CONF,bytes(0x34)+struct.pack('<I',rec_ptr))
        b=bytearray(0x950);struct.pack_into('<H',b,0x944,year);b[0x77c]=lk;b[0x786]=toning;c.mem_write(REC,bytes(b))
        c.mem_write(STASH,struct.pack('<I',stash));c.mem_write(PHOTO,struct.pack('<I',0xdeadbeef))
        regs={0:0x1111,1:PROC,2:0x2222,3:0x3333,4:0x4444,5:0x5555,12:0x6666}
        for i in range(13):c.reg_write(getattr(reg,'UC_ARM_REG_R'+str(i)),regs.get(i,0x1230+i))
        c.reg_write(reg.UC_ARM_REG_SP,STACK);c.reg_write(reg.UC_ARM_REG_LR,0x5a5a5a5a);c.reg_write(reg.UC_ARM_REG_CPSR,0x60000013)
        c.emu_start(j['photoLook'],j['halation'],count=200)
        assert c.reg_read(reg.UC_ARM_REG_PC)==j['halation'] and c.reg_read(reg.UC_ARM_REG_SP)==STACK and c.reg_read(reg.UC_ARM_REG_CPSR)==0x60000013
        for k,v in regs.items():assert c.reg_read(getattr(reg,'UC_ARM_REG_R'+str(k)))==v,k
        return struct.unpack('<I',bytes(c.mem_read(PHOTO,4)))[0]
    def want(lk,toning):
        films=manifest['filmCount']
        if 64<=lk<64+films:
            h=toning&15;h=0 if h>=7 else h;w=0
            if h>=4:h-=3;w=0x20000
            elif h in (2,3):h=5-h
            return (lk-32)|0x10000|(toning&0xf0)<<16|h<<8|w
        return (lk-32 if lk>=64 else lk)|0x10000
    for lk in (11,13,22,64,65,66,64+manifest['filmCount']):
        for toning in (0,0x30,0x71,0xb2,0x45,0x16,0xfb):
            assert look(REC,2026,lk,toning,0x12345678)==want(lk,toning),(lk,hex(toning));cases+=1
    for ptr,year in ((0,2026),(0x30000000,2026),(REC+2,2026),(REC,1999),(REC,2100)):
        assert look(ptr,year,64,0x30,0x10021)==0x10021,(hex(ptr),year);cases+=1
    recipes,profiles=get('GR3X_GRAIN_RECIPES'),get('GR3X_GRAIN_PROFILES')
    assert bytes(c.mem_read(ctx[6],len(recipes)))==recipes and bytes(c.mem_read(ctx[7],len(profiles)))==profiles
    mono=bytes(c.mem_read(ctx[8],64));films=manifest['filmCount'];monofilms=manifest.get('monoFilms',[False]*films)
    for k in range(films):assert mono[32+k]==int(bool(monofilms[k])),(k,mono[32+k])
    code=get('GR3X_GRAIN_CODE');assert bytes(c.mem_read(module,len(code)))==code
    return dict(chain=['execute','picture look','halation','grain','date'],picture_look_cases=cases,films=films,mono=[int(bool(m)) for m in monofilms],
        rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
