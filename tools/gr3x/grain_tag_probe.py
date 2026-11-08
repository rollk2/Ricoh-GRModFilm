"""The grain's tag of the date imprint (GR Mod Film test builds, features.grainTag; core/src/fw/gr3x/datestamp.ts,
tools/datestamp/datestamp.c -DGRAIN_TAG), in the emulator.

  python3 grain_tag_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - the context: the round 10 words then the tag table, 16 runs of glyphs by Grain / Size nibble of the
    look word (bits 20..23): "G", the grain 0..3, a space, the size M / S / L (code 0 / 1 / 2);
  - the module through its stage stub, the date off (dateHidden or a setting of 0): for a film of the
    look word (32 + k, valid) the tag alone, drawn bottom right of the main picture and the
    screennail, the thumbnail untouched; a different picture for every Grain / Size; nothing for a
    camera look, a look word without its valid bit, a look beyond 63; every register kept;
  - a build that offers the date: the date with its tag draws more than without it (a camera look);
  - diagnostic builds (grainTag 'diag', T-GRAIN6D): the exposure hook queues the look word's Grain /
    Size nibble (| 0x80 valid) at 0x55804398 + 4 + (count & 7), counts the exposures in byte 0 and
    keeps every register; each encode takes the oldest (byte 1 + 1), none when the queue is empty;
    the picture depends on the queued setting.
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STACK,STOP
import datestamp_probe as dp
import datestamp8_probe as d8

def verify(data,manifest):
    assert manifest.get('grainTag') in (True,'diag') and manifest.get('round10')
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc
    mapped=lambda a:any(s<=a<=e for s,e,_ in c.mem_regions())
    for at in range(0x63000000,0x63100000,0x1000):
        if not mapped(at):c.mem_map(at,0x1000)
    for base,size in ((0x63100000,0xf00000),(dp.LOW,0x800000)):
        if not mapped(base):c.mem_map(base,size)
    diag=manifest.get('grainTag')=='diag'
    ctx=e['dateContext'];words=struct.unpack('<16I',bytes(c.mem_read(ctx,64)))
    if diag:assert words[15]==QUEUE
    hidden=words[6]==0xffff
    assert words[5]==dp.PTR and words[6] in (dp.OFFSET,0xffff) and words[7]==d8.STASH and words[10:12]==(d8.ORIENT_WORD,d8.FRAME_WORD)
    # 1. The tag table.
    runs=[]
    for n in range(16):
        at=d8.u32(c,words[13]+4*n);k=struct.unpack('<H',bytes(c.mem_read(at,2)))[0]
        runs.append(list(struct.unpack('<%dH'%k,bytes(c.mem_read(at+2,2*k)))))
    G=runs[0][0];assert G&0x4000
    letters={}
    for n,r in enumerate(runs):
        assert len(r)==4 and r[0]==G and r[1]==(n&3) and r[2]==17 and r[3]&0x4000,(n,r)
        letters.setdefault((n>>2)&3,set()).add(r[3])
    assert all(len(v)==1 for v in letters.values()) and len({next(iter(v)) for v in letters.values()})==4
    # 2. The pictures.
    pics=dp.pictures();base=[b for _,b in pics['memory']]
    f=d8.FastDate(p,dp.CLOCK);f.plat=dp.PLAT;u=f.uc
    def run(stash,setting=0):
        for a,b in pics['memory']:u.mem_write(a,b)
        for i,d in enumerate(pics['descriptors']):u.mem_write(dp.DESC+i*0x20,d)
        cfg=bytearray(0x60);struct.pack_into('<4I',cfg,0x3c,*(dp.DESC+i*0x20 for i in range(4)));u.mem_write(dp.CFG,bytes(cfg))
        u.mem_write(dp.ARG,struct.pack('<3I',0,0,dp.CFG));u.mem_write(dp.PLAT,struct.pack('<2I',0,dp.PLAT+0x80))
        u.mem_write(dp.REC,bytes(0xb28));u.mem_write(dp.REC+dp.OFFSET,bytes([setting]));u.mem_write(dp.PTR,struct.pack('<I',dp.REC))
        u.mem_write(d8.STASH,struct.pack('<I',stash));u.mem_write(d8.MODE,b'\x01\xa5\xa5\xa5');u.mem_write(d8.ORIENT_WORD,struct.pack('<2I',0,0))
        regs=[0x62e00000+i*0x100 for i in range(13)];regs[1]=dp.ARG
        for i,v in enumerate(regs):u.reg_write(getattr(reg,'UC_ARM_REG_R'+str(i)),v)
        u.reg_write(reg.UC_ARM_REG_SP,STACK);u.reg_write(reg.UC_ARM_REG_LR,STOP);u.reg_write(reg.UC_ARM_REG_CPSR,0x13)
        u.emu_start(e['dateStage'],d8.EXECUTE+4,count=2_000_000_000)
        assert u.reg_read(reg.UC_ARM_REG_PC)==d8.EXECUTE+4 and [u.reg_read(getattr(reg,'UC_ARM_REG_R'+str(i))) for i in range(12)]==regs[:12]
        assert u.reg_read(reg.UC_ARM_REG_SP)==STACK
        return [bytes(u.mem_read(a,len(b))) for a,b in pics['memory']]
    def changed(got):return [sum(x!=y for x,y in zip(g,b)) for g,b in zip(got,base)]
    seen={};cases={}
    for nib in range(12):
        for look in (32,33,32+19):
            got=run(0x10000|look|nib<<20|0x0300);ch=changed(got)
            assert ch[0]>0 and ch[2]>0 and ch[4]==0 and ch[5]==0,(nib,look,ch)
            # Bottom right of the main picture (1920 x 1280 window of a 2048-wide buffer).
            y=got[0];rows=[r for r in range(dp.SH) if y[r*dp.SW:(r+1)*dp.SW]!=base[0][r*dp.SW:(r+1)*dp.SW]]
            cols=[x for r in rows for x in range(dp.SW) if y[r*dp.SW+x]!=base[0][r*dp.SW+x]]
            assert min(rows)>dp.MH*3//4 and max(rows)<dp.MH and min(cols)>dp.MW//2 and max(cols)<dp.MW,(nib,min(rows),max(rows),min(cols),max(cols))
            if look==32:seen[nib]=got[0]
            cases['film']=cases.get('film',0)+1
    for a in range(12):
        for b in range(a+1,12):
            if (a>>2)<3 and (b>>2)<3:assert seen[a]!=seen[b],(a,b)
    for stash in (0x10000|11|3<<20,0x10000|22|3<<20|1<<22,32|3<<20,0x10000|64|3<<20,0x10000|200|3<<20,0):
        assert changed(run(stash))==[0]*6,hex(stash);cases['nothing']=cases.get('nothing',0)+1
    if not hidden:
        a=changed(run(0x10000|32|3<<20|1<<22,setting=1));b=changed(run(0x10000|11|3<<20|1<<22,setting=1))
        assert a[0]>b[0]>0 and a[2]>b[2]>0,(a,b);cases['with the date']=2
    return dict(cases=cases,date_offered=not hidden,tags=['G%d %s'%(n&3,'MSLX'[n>>2]) for n in range(12)],
        **({'queue':queue(p,e,u,run,changed)} if diag else {}),rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

QUEUE=0x55804398
def queue(p,e,u,run,changed):
    def expose(stash):
        u.mem_write(d8.STASH,struct.pack('<I',stash))
        regs=[0x62e00000+i*0x100 for i in range(13)]
        for i,v in enumerate(regs):u.reg_write(getattr(reg,'UC_ARM_REG_R'+str(i)),v)
        u.reg_write(reg.UC_ARM_REG_SP,STACK);u.reg_write(reg.UC_ARM_REG_LR,STOP);u.reg_write(reg.UC_ARM_REG_CPSR,0x13)
        u.emu_start(e['exposureOrientation'],d8.BEFORE+4,count=100000)
        assert [u.reg_read(getattr(reg,'UC_ARM_REG_R'+str(i))) for i in range(11)]==regs[:11] and u.reg_read(reg.UC_ARM_REG_SP)==STACK
    q=lambda:bytes(u.mem_read(QUEUE,12))
    u.mem_write(QUEUE,bytes(12))
    film=lambda n:0x10000|32|n<<20
    for k in range(10):expose(film(k%12) if k!=3 else (k%12)<<20|32)
    b=q();assert b[0]==10 and b[1]==0,b.hex()
    want=[(k%12)|(0 if k==3 else 0x80) for k in range(10)]
    assert all(b[4+(k&7)]==want[k] for k in range(2,10)),b.hex()
    # Encodes: the live word says G0 M; each takes the oldest of the last eight (counts as bytes).
    u.mem_write(QUEUE,bytes([3,0,0,0])+bytes([0x87,0x8b,0x80,0,0,0,0,0]))
    pics=[]
    for k in range(3):pics.append(run(film(0)));assert q()[1]==k+1
    assert len({x[0] for x in pics})==3,'the picture follows the queued setting'
    empty=run(film(0));assert q()[:2]==bytes([3,3])
    return {'exposures':10,'encodes':4,'registers_kept':True}

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
