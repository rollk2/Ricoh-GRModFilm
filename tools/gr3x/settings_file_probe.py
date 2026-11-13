"""The settings file (core/src/fw/gr3x/settings-file.ts, `settingsFile`, T-SET1), in the emulator.

  python3 settings_file_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json [--file out.set]

  - Setup: « Save Settings to Card » right after Hide Settings (or Firmware Info/Options), the later
    lines as before; the key map reads its id as Create New Folder's dialog; the factory sets the
    dialog's mode byte to 2 for it (1 for Rewind Film, 0 for the menu) and hands out the dialog;
  - the dialog: card and storage checks kept for the save (skipped for the rewind), the question and
    end texts by mode (0 the camera's, 1 rewind, 2 save, 3 failed save), Execute: the save for mode 2;
  - the save, with a file system of our own (the camera's method table): card check « C: », open
    C:\\GRFILM.SET in mode 0, the header then the nine records (in use, stored 0..7) each with the 32-bit
    sum of its bytes, close; the bytes written read back as the program reads them; r4..r11 and sp kept;
    failures (no card, open refused, a write refused, a record outside RAM) set the mode byte to 3 and
    close an opened file.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STOP,STACK

SAVE_ID=0x020001d1;HSET_ID=0x020001d0;AFTER=0x0200011a;DIALOG=0x02000128;REWIND_ID=0x020001b1
SETUP_ENTRY=0x5407d408;SETUP=0x53b36a54;FACTORY=0x5316f3b8
FS_SINGLETON=0x53594d74;POINTER=0x55063f34;STORED=0x55063f38;SIZE=0xb28;COUNT=9;HEADER=0x20
DIALOG_CARD_FN=0x53237460;DIALOG_STORAGE_FN=0x531e64a8;DIALOG_ACTION_FN=0x5358515c
DIALOG_QUESTION=0x531e5ee8;DIALOG_DONE=0x531e5f40;DIALOG_ACTION=0x531e65c8;DIALOG_CARD=0x531e6558;DIALOG_STORAGE=0x531e6568
OBJ=0x63050000;FS=0x63050100;VT=0x63050200;RECS=0x63060000;FAKE=(0x63058000,0x63058010,0x63058020,0x63058030,0x63058040)
def r(c,n):return c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))
def u32(c,a):return struct.unpack('<I',bytes(c.mem_read(a,4)))[0]
def put(c,a,v):c.mem_write(a,struct.pack('<I',v))
def cstr(c,a):
    b=bytes(c.mem_read(a,64));return b[:b.index(0)].decode()
def bl_target(w,at):return at+8+((((w&0xffffff)^0x800000)-0x800000)<<2)

def read_file(data):
    """As core/src/fw/gr3x/settings-file.ts readGr3xSettingsFile."""
    assert data[:4]==b'GRFS',data[:4]
    fmt,size,count,model=struct.unpack_from('<HHHH',data,4);assert (fmt,size,count)==(1,SIZE,COUNT) and model in (1,2)
    assert len(data)==HEADER+count*(size+4),len(data)
    recs=[]
    for k in range(count):
        at=HEADER+k*(size+4);rec=data[at:at+size];assert sum(rec)&0xffffffff==struct.unpack_from('<I',data,at+size)[0],k;recs.append(rec)
    return model,data[12:20].rstrip(b'\0').decode(),recs

def verify(data,manifest,file_out=None):
    e=manifest['entries'];assert 'settingsSave' in e,'a build with settingsFile'
    p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    MODE=manifest.get('rewindMode') or 0x55804390+14
    B=0x53000000
    # --- Setup.
    copy=u32(c,SETUP_ENTRY);d=bytes(c.mem_read(copy,0x384));n=d[0x8b]
    ids=[struct.unpack_from('<I',d,0x1bc+4*i)[0] for i in range(n)]
    after=HSET_ID if HSET_ID in ids else AFTER
    assert ids[ids.index(after)+1]==SAVE_ID,[hex(x) for x in ids]
    official=data[SETUP-B:SETUP-B+0x384];n0=official[0x8b];ids0=[struct.unpack_from('<I',official,0x1bc+4*i)[0] for i in range(n0)]
    assert [x for x in ids if x not in (SAVE_ID,HSET_ID)]==ids0
    at=ids.index(SAVE_ID);assert struct.unpack_from('<II',d,0x8c+8*at)==(e['settingsSaveLine'],0)
    count('setup line')
    # --- The key map and the factory.
    KW=0x6304a900
    for given,want in ((SAVE_ID,DIALOG),(REWIND_ID,DIALOG),(0x0200009c,0x0200009c)):
        put(c,KW,given);p.run(e['dateKeys'],STOP,{0:KW});assert r(c,0)==want,(hex(given),hex(r(c,0)));count('key map')
    seen=[]
    def at4(cpu,a,s,u):seen.append(r(cpu,1));cpu.reg_write(reg.UC_ARM_REG_PC,STOP)
    h=c.hook_add(UC_HOOK_CODE,at4,begin=FACTORY+4,end=FACTORY+4)
    for given,mode,want in ((SAVE_ID,2,DIALOG),(REWIND_ID,1,DIALOG),(0x0200004a,0,0x0200004a),(DIALOG,None,DIALOG)):
        c.mem_write(MODE,b'\x07');seen.clear();p.run(e['dateFactory'],STOP,{0:0x6304a000,1:given})
        assert seen==[want] and c.mem_read(MODE,1)[0]==(7 if mode is None else mode),(hex(given),seen,c.mem_read(MODE,1)[0]);count('factory')
    c.hook_del(h)
    # --- The dialog: checks, texts, action.
    for at,fn,skip in ((DIALOG_CARD,DIALOG_CARD_FN,1),(DIALOG_STORAGE,DIALOG_STORAGE_FN,0)):
        stub=bl_target(u32(c,at),at)
        for mode in (0,1,2,3):
            c.mem_write(MODE,bytes([mode]));got=[]
            def native(cpu,a,s,u):got.append(1);cpu.reg_write(reg.UC_ARM_REG_R0,0x55);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
            h=c.hook_add(UC_HOOK_CODE,native,begin=fn,end=fn);p.run(stub,STOP,{0:0x1234});c.hook_del(h)
            assert (r(c,0),got)==((skip,[]) if mode==1 else (0x55,[1])),(hex(at),mode,r(c,0),got);count('dialog check')
    texts={}
    for site,native in ((DIALOG_QUESTION,0x2ab),(DIALOG_DONE,0x2bb)):
        stub=bl_target(u32(c,site),site) if (u32(c,site)>>24)&0xf==0xa else None
        stub=site+8+((((u32(c,site)&0xffffff)^0x800000)-0x800000)<<2)
        got=[]
        for mode in (0,1,2,3):
            c.mem_write(MODE,bytes([mode]))
            hh=[]
            def back(cpu,a,s,u):hh.append(r(cpu,1));cpu.reg_write(reg.UC_ARM_REG_PC,STOP)
            h=c.hook_add(UC_HOOK_CODE,back,begin=site+4,end=site+4);p.run(stub,STOP,{1:0x9999});c.hook_del(h)
            got.append(hh[0])
        assert got[0]==native and len(set(got[1:]))==(3 if site==DIALOG_DONE else 2) and got[2] not in (native,got[1]),(hex(site),got)
        if site==DIALOG_QUESTION:assert got[3]==got[2]
        texts[hex(site)]=got;count('dialog text')
    stub=bl_target(u32(c,DIALOG_ACTION),DIALOG_ACTION)
    for mode,want in ((0,DIALOG_ACTION_FN),(1,e['filmRollRewind']),(2,e['settingsSave'])):
        c.mem_write(MODE,bytes([mode]));went=[]
        def reach(cpu,a,s,u):went.append(a);cpu.reg_write(reg.UC_ARM_REG_PC,STOP)
        hs=[c.hook_add(UC_HOOK_CODE,reach,begin=x,end=x) for x in (DIALOG_ACTION_FN,e['filmRollRewind'],e['settingsSave'])]
        p.run(stub,STOP,{0:0x1234,1:1})
        for x in hs:c.hook_del(x)
        assert went==[want],(mode,went);count('dialog action')
    # --- The save, with a file system of our own.
    log=[];out=bytearray();plan={}
    def fs_call(cpu,a,s,u):
        name=FAKE.index(a);args=[r(cpu,i) for i in range(4)]+[u32(cpu,cpu.reg_read(reg.UC_ARM_REG_SP))]
        assert args[0]==FS
        if name==0:log.append(('card',cstr(cpu,args[1]),args[2]));ret=plan.get('card',1)
        elif name==1:
            log.append(('open',cstr(cpu,args[1]),args[2],args[4]));ret=plan.get('open',1)
            if ret:put(cpu,args[3],0x4848)
        elif name==2:log.append(('close',args[1],args[2]));ret=1
        else:
            k=sum(1 for x in log if x[0]=='write');log.append(('write',args[1],args[3],args[4]))
            ret=0 if plan.get('fail_write')==k else 1
            if ret:out.extend(bytes(cpu.mem_read(args[2],args[3])))
        cpu.reg_write(reg.UC_ARM_REG_R0,ret);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    def single(cpu,a,s,u):cpu.reg_write(reg.UC_ARM_REG_R0,OBJ);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    try:c.mem_map(0x63060000,0x10000)
    except Exception:pass
    for x in FAKE:c.mem_write(x,struct.pack('<I',0xe12fff1e))
    hooks=[c.hook_add(UC_HOOK_CODE,fs_call,begin=x,end=x) for x in FAKE]+[c.hook_add(UC_HOOK_CODE,single,begin=FS_SINGLETON,end=FS_SINGLETON)]
    put(c,OBJ+0x14,FS);put(c,FS,VT)
    for off,x in zip((0x14,0x1c,0x20,0x28),FAKE[:4]):put(c,VT+off,x)
    import random;rng=random.Random(9)
    recs=[bytes(rng.randrange(256) for _ in range(SIZE)) for _ in range(COUNT)]
    for k,rec in enumerate(recs):c.mem_write(RECS+k*0x1000,rec)
    def pointers(bad=None):
        ptr=[RECS+k*0x1000 for k in range(COUNT)]
        if bad is not None:ptr[bad]=0x1000
        put(c,POINTER,ptr[0]);c.mem_write(STORED,b''.join(struct.pack('<I',x) for x in ptr[1:]))
    def save(**kw):
        plan.clear();plan.update(kw);log.clear();out.clear();c.mem_write(MODE,b'\x02')
        regs={4:0x44,5:0x55,6:0x66,7:0x77,8:0x88,9:0x99,10:0xaa,11:0xbb}
        p.run(e['settingsSave'],STOP,{0:0x1234,1:1,**regs})
        for k,v in regs.items():assert r(c,k)==v,('register',k)
        assert c.reg_read(reg.UC_ARM_REG_SP)==STACK
        return c.mem_read(MODE,1)[0]
    pointers()
    assert save()==2,log
    opened=[x for x in log if x[0]=='open'];assert log[0]==('card','C:',0) and opened==[('open','C:\\GRFILM.SET',0,0)],log
    assert log[-1]==('close',0x4848,0) and all(x[1]==0x4848 and x[3]==0 for x in log if x[0]=='write'),log
    model,version,got=read_file(bytes(out))
    assert got==recs and model==(2 if manifest.get('profile','').startswith('gr3x') else 1) and version=='0.9.8',(model,version)
    if file_out:Path(file_out).write_bytes(bytes(out))
    count('saved')
    # Failures: no card, open refused, each kind of write refused, a record outside RAM.
    assert save(card=0)==3 and [x[0] for x in log]==['card'];count('no card')
    assert save(open=0)==3 and [x[0] for x in log]==['card','open'];count('open refused')
    for k in (0,1,2,5,18):
        assert save(fail_write=k)==3 and log[-1][0]=='close' and sum(1 for x in log if x[0]=='write')==k+1,(k,log[-3:]);count('write refused')
    for bad in (0,3,8):
        pointers(bad);assert save()==3 and log[-1][0]=='close',bad;count('record outside RAM')
    pointers()
    for x in hooks:c.hook_del(x)
    return dict(cases=cases,texts=texts,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a.add_argument('--file',type=Path)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()),a.file)
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
