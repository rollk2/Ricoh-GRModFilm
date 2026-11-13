"""Hide Settings' line and screen (core/src/fw/gr3x/hide-menu.ts, `hideMenu`, T-HSET1), in the emulator.

  python3 hide_menu_probe.py --rtos GR3.rtos --manifest patch-manifest.json --report out.json

  - Setup: the menu table's Setup entry points at a copy with our line right after Firmware
    Info/Options, every other line in the official order, one more line, the later pages one later;
  - the menu's key map reads our id as Mode Memory's (0x0200009b), other ids as before;
  - the factory: our id and Mode Memory's go to our wrapper (rows' texts and OK actions set again after a change), another id goes on as before; the wrapper
    asks the factory for Mode Memory's screen (stubbed: a screen whose list holds Mode Memory's items),
    puts our seven items in its list for our id (title ours, the rows set up again), Mode Memory's back
    for Mode Memory's id (its native copy, title 0x208), nothing when the list is already the one asked;
  - our boxes: draw (the tick from the screen's state byte), toggle (state flipped, its row found and
    drawn), write (bit k + 1 of 0x905 in the record in use and the seven stored ones, other bits kept,
    pointers outside RAM skipped); the screen's start reads the bits into the state bytes with our list
    up, and leaves the states alone with Mode Memory's;
  - Mode Memory's AF Point box keeps to bit 0 of 0x905 (read, write, power-on reset).
"""
import argparse,hashlib,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn import arm_const as reg
from film_roll_check import RollProbe
from native_probe import STOP

ID=0x020001d0;MEMORY=0x0200009b;AFTER=0x0200011a;SETTING=0x905
SETUP_ENTRY=0x5407d408;SETUP=0x53b36a54;FACTORY=0x5316f3b8
ROW_TEXTS=0x53206990;ROW_ACTIONS=0x53206860;LIST_ROW=0x53394758;ROW_ICON=0x533a8990;SET_TEXT=0x533a2ba0;MEMORY_COPY=0x53207348;GROW=0x532071fc;MEMORY_FILL=0x53206a30
TEXTS=(0x37,0x3a,0x51,0x5b,0x79,0x49,0x7f)
POINTER=0x55063f34;STORED=0x55063f38
I=0x63044000;VEC=0x63045000;REC=0x63046000;BOXES=0x63048000;ROW=0x6304a000;FACT=0x6304a800
def r(c,n):return c.reg_read(getattr(reg,'UC_ARM_REG_R%d'%n))
def u32(c,a):return struct.unpack('<I',bytes(c.mem_read(a,4)))[0]
def put(c,a,v):c.mem_write(a,struct.pack('<I',v))

def verify(data,manifest):
    assert 'hsItems' in manifest['entries'],'a build with hideMenu'
    e=manifest['entries'];p=RollProbe(data,manifest);c=p.uc;cases={}
    count=lambda k:cases.__setitem__(k,cases.get(k,0)+1)
    B=0x53000000
    # --- Setup.
    copy=u32(c,SETUP_ENTRY);assert copy!=SETUP
    off=lambda base,o:base+o
    official=data[SETUP-B:SETUP-B+0x384];d=bytes(c.mem_read(copy,0x384))
    # T-SET1: « Save Settings to Card » (0x020001d1) may follow ours; it is taken out first (settings_file_probe.py checks it).
    n=d[0x8b];ids=[struct.unpack_from('<I',d,0x1bc+4*i)[0] for i in range(n)]
    if 0x020001d1 in ids:
        sv=ids.index(0x020001d1);dd=bytearray(d)
        for i in range(sv,n-1):
            for base,w in ((0x8c,8),(0x1bc,4),(0x254,8)):dd[base+w*i:base+w*(i+1)]=d[base+w*(i+1):base+w*(i+2)]
        dd[0x8b]=n-1
        for k in range(1,dd[0x68]):
            if dd[0x80+k]>sv:dd[0x80+k]-=1
        d=bytes(dd)
    n0=official[0x8b];n=d[0x8b];assert n==n0+1,(n0,n)
    ids0=[struct.unpack_from('<I',official,0x1bc+4*i)[0] for i in range(n0)];ids=[struct.unpack_from('<I',d,0x1bc+4*i)[0] for i in range(n)]
    at=ids0.index(AFTER)+1;assert ids==ids0[:at]+[ID]+ids0[at:],[hex(x) for x in ids]
    for i in range(n0):
        j=i if i<at else i+1
        assert official[0x8c+8*i:0x94+8*i]==d[0x8c+8*j:0x94+8*j] and official[0x254+8*i:0x25c+8*i]==d[0x254+8*j:0x25c+8*j],i
    assert struct.unpack_from('<II',d,0x8c+8*at)==(e['hideMenuLine'],0) and struct.unpack_from('<II',d,0x254+8*at)==(0,0)
    f0=list(official[0x80:0x80+official[0x68]]);f=list(d[0x80:0x80+d[0x68]]);assert d[0x68]==official[0x68]
    assert f==[x+1 if k and x>=at else x for k,x in enumerate(f0)],(f0,f)
    count('setup line')
    # --- The key map (current id getter's word, r0 the word's address).
    KW=0x6304a900
    for given,want in ((ID,MEMORY),(MEMORY,MEMORY),(0x020001b0,None),(0x0200009c,0x0200009c)):
        put(c,KW,given);p.run(e['dateKeys'],STOP,{0:KW})
        if want is not None:assert r(c,0)==want,(hex(given),hex(r(c,0)))
        count('key map')
    # --- The factory.
    calls=[]
    def stub(cpu,at,size,user):
        name={e['hsFactoryBody']:'body',MEMORY_COPY:'copy',SET_TEXT:'title',e['memoryListSetup']:'rows',GROW:'grow',ROW_TEXTS:'texts',ROW_ACTIONS:'actions'}[at]
        calls.append((name,r(cpu,0),r(cpu,1)))
        if name=='body':cpu.reg_write(reg.UC_ARM_REG_R0,I)
        if name=='copy':
            # Mode Memory's list: its 26 items from the build's table (the native copy, visibility aside).
            T=e['afPointItems'];b=u32(cpu,I+0x168)
            cpu.mem_write(b,bytes(cpu.mem_read(T,26*0x28)));put(cpu,I+0x16c,b+26*0x28)
        cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    hooks=[c.hook_add(UC_HOOK_CODE,stub,begin=a,end=a) for a in (e['hsFactoryBody'],MEMORY_COPY,SET_TEXT,e['memoryListSetup'],GROW,ROW_TEXTS,ROW_ACTIONS)]
    c.mem_write(I,bytes(0x200));c.mem_write(VEC,bytes(0x1000));put(c,I+0x15c,0x7171)
    put(c,I+0x168,VEC);put(c,I+0x16c,VEC);put(c,I+0x170,VEC+32*0x28)
    def factory(ident,regs_extra=None):
        calls.clear();regs={0:FACT,1:ident,2:0x2222,4:0x44,5:0x55,6:0x66,7:0x77};p.run(e['dateFactory'],STOP,regs)
        for k in (4,5,6,7):assert r(c,k)==regs[k],k
        return r(c,0)
    def items():
        b,en=u32(c,I+0x168),u32(c,I+0x16c);return [struct.unpack('<10I',bytes(c.mem_read(a,0x28))) for a in range(b,en,0x28)]
    # The screen as built: Mode Memory's list (the constructor fills it); asked for it, kept.
    c.mem_write(VEC,bytes(c.mem_read(e['afPointItems'],26*0x28)));put(c,I+0x16c,VEC+26*0x28)
    assert factory(MEMORY)==I and [x[0] for x in calls]==['body'] and calls[0][2]==MEMORY,calls;count('list kept')
    ours=[struct.unpack('<10I',bytes(c.mem_read(e['hsItems']+0x28*k,0x28))) for k in range(7)]
    for k,it in enumerate(ours):
        assert it[0]==32+k and it[1]==TEXTS[k] and it[2]==e['hsDraw%d'%k] and it[4]==e['hsToggle%d'%k] and it[6]==e['hsWrite%d'%k] and it[3]==it[5]==it[7]==it[8]==it[9]==0,it
    assert factory(ID)==I and [x[0] for x in calls]==['body','rows','title','texts','actions'] and calls[0][2]==MEMORY and calls[2][2]!=0x208 and calls[3][1]==calls[4][1]==I,calls
    hsTitle=calls[2][2];assert items()==ours;count('our list')
    assert factory(ID)==I and [x[0] for x in calls]==['body'];count('list kept')
    # Mode Memory's back: its native copy, its title.
    assert factory(MEMORY)==I and [x[0] for x in calls]==['body','copy','rows','title','texts','actions'] and calls[3][1:]==(0x7171,0x208) and calls[4][1]==calls[5][1]==I,calls
    assert len(items())==26;count('mode memory list')
    factory(ID);assert items()==ours
    # The grow path: a full vector (capacity = begin) grows through the native insert.
    factory(MEMORY);put(c,I+0x170,VEC)   # no room once cleared: each item through the native insert
    factory(ID);assert [x[0] for x in calls].count('grow')==7,calls;count('grow')
    # (the stubbed insert added nothing: the screen's list put back as built)
    put(c,I+0x170,VEC+32*0x28);c.mem_write(VEC,bytes(c.mem_read(e['afPointItems'],26*0x28)));put(c,I+0x16c,VEC+26*0x28)
    factory(ID);assert items()==ours
    # Another id goes on to the factory's body (its first instruction, then FACTORY + 4).
    seen=[]
    def at4(cpu,a,s,u):seen.append(r(cpu,1));cpu.reg_write(reg.UC_ARM_REG_PC,STOP)
    h=c.hook_add(UC_HOOK_CODE,at4,begin=FACTORY+4,end=FACTORY+4)
    for other in (0x0200009c,0x02000128,0x020001b0):
        seen.clear();calls.clear();p.run(e['dateFactory'],STOP,{0:FACT,1:other})
        assert not any(x[0]=='body' for x in calls) and seen and r(c,3)==0x13b,(hex(other),seen,calls);count('other id')
    c.hook_del(h)
    for x in hooks:c.hook_del(x)
    # --- Our boxes.
    drawn=[]
    def ui(cpu,at,size,user):
        drawn.append((at,r(cpu,0),r(cpu,1)))
        if at==LIST_ROW:cpu.reg_write(reg.UC_ARM_REG_R0,ROW+r(cpu,1))
        cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    hooks=[c.hook_add(UC_HOOK_CODE,ui,begin=a,end=a) for a in (LIST_ROW,ROW_ICON)]
    put(c,I+0x164,0x5151)
    recs=[BOXES+0x1000*k for k in range(7)]
    def records(bad=None):
        c.mem_write(REC,bytes([0xa5])*0xb28);put(c,POINTER,REC)
        ptr=list(recs);
        if bad is not None:ptr[bad]=0x1000
        for a in recs:c.mem_write(a,bytes([0x5a])*0xb28)
        c.mem_write(STORED,b''.join(struct.pack('<I',x) for x in ptr))
    for k in range(7):
        for state in (0,1):
            c.mem_write(I+0x174+k,bytes([state]));drawn.clear();p.run(e['hsDraw%d'%k],STOP,{0:I,1:0x4242})
            assert drawn==[(ROW_ICON,0x4242,0x10f if state else 0x10e)],drawn;count('draw')
        c.mem_write(I+0x174+k,bytes([0]));drawn.clear();p.run(e['hsToggle%d'%k],STOP,{0:I})
        # (the base probe's own hook may change r0 at the list's row getter: its row number only, then that row drawn)
        assert c.mem_read(I+0x174+k,1)[0]==1 and [(x[0],x[2]) for x in drawn]==[(LIST_ROW,k),(ROW_ICON,0x10f)] and drawn[1][1]==ROW+k,drawn;count('toggle')
        for state,bad in ((1,None),(0,3)):
            records(bad);c.mem_write(I+0x174+k,bytes([state]));p.run(e['hsWrite%d'%k],STOP,{0:I})
            bit=1<<(k+1)
            for a,fill in [(REC,0xa5)]+[(x,0x5a) for j,x in enumerate(recs) if j!=bad]:
                b=bytes(c.mem_read(a,0xb28));want=(fill&~bit)|(bit if state else 0)
                # T-HSET2: ticked, Flash Mode, GF-2 and Flash Exposure Comp. also set their Mode Memory box to 1.
                box={4:0xaf8,5:0xb24,6:0xafa}.get(k) if state else None
                assert b[SETTING]==want and all(b[o]==(1 if o==box else fill) for o in range(0xb28) if o!=SETTING),(hex(a),k,b[SETTING])
            if bad is not None:assert bytes(c.mem_read(recs[bad],0xb28))==bytes([0x5a])*0xb28
            count('write')
    for x in hooks:c.hook_del(x)
    # The screen's start: our list up, the bits read; Mode Memory's list, the states left alone.
    stopped=[]
    def fill(cpu,at,size,user):stopped.append(r(cpu,0));cpu.reg_write(reg.UC_ARM_REG_PC,STOP)
    h=c.hook_add(UC_HOOK_CODE,fill,begin=MEMORY_FILL,end=MEMORY_FILL)
    for bits in (0x00,0xfe,0x55,0xaa,0x81):
        c.mem_write(REC,bytes(0xb28));c.mem_write(REC+SETTING,bytes([bits]));put(c,POINTER,REC)
        c.mem_write(I+0x174,bytes([9])*24);stopped.clear();p.run(e['afPointRead'],STOP,{0:I})
        assert stopped==[I] and list(c.mem_read(I+0x174,7))==[(bits>>(k+1))&1 for k in range(7)],(bits,list(c.mem_read(I+0x174,7)))
        count('states read')
    put(c,POINTER,0x1000);c.mem_write(I+0x174,bytes([9])*24);p.run(e['afPointRead'],STOP,{0:I});assert list(c.mem_read(I+0x174,7))==[0]*7;count('states read')
    factory_list=bytes(c.mem_read(e['afPointItems'],26*0x28));c.mem_write(VEC,factory_list);put(c,I+0x16c,VEC+26*0x28)
    c.mem_write(REC+SETTING,bytes([0xfe]));put(c,POINTER,REC);c.mem_write(I+0x174,bytes([9])*24);p.run(e['afPointRead'],STOP,{0:I})
    assert list(c.mem_read(I+0x174,7))==[9]*7;count('mode memory states kept')
    # --- AF Point: bit 0 only (its state byte RAM 0x558043bc, 1 ticked = setting 0).
    AFS=0x558043bc
    for bits in (0x00,0x01,0xfe,0xff):
        c.mem_write(REC+SETTING,bytes([bits]));put(c,POINTER,REC);c.mem_write(AFS,bytes([7]))
        put(c,I+0x16c,VEC+26*0x28);p.run(e['afPointRead'],STOP,{0:I})
        assert c.mem_read(AFS,1)[0]==(0 if bits&1 else 1),bits;count('AF point read')
    c.hook_del(h)
    for state in (0,1):
        records();c.mem_write(REC+SETTING,bytes([0xfe]));c.mem_write(AFS,bytes([state]));p.run(e['afPointWrite'],STOP,{0:I})
        assert c.mem_read(REC+SETTING,1)[0]==(0xfe|(0 if state else 1)) and c.mem_read(recs[0]+SETTING,1)[0]==(0x5a&~1|(0 if state else 1)),state
        count('AF point write')
    # --- T-HSET2: what a ticked box takes out (bit k + 1 of 0x905 of the record in use).
    if 'hsMemoryVisible5' in e:
        thset2(p,c,e,data,count)
    # --- T-HSET3: ADJ Mode Setting's lists without the ticked boxes' functions.
    if 'hsAdjFind' in e:
        thset3(p,c,e,data,count)
    return dict(cases=cases,title=hsTitle,rtos_sha256=hashlib.sha256(data).hexdigest(),hardware_tested=False)

# T-HSET2: each box's setting: its line, button functions, ADJ functions, Mode Memory item and box.
BOXES_HS=(('faceEye',0x0200005e,(8,),(),None),('afAssist',0x0200005f,(),(),None),('afc',0x02000063,(),(),None),('mfMag',0x02000065,(),(),None),
          ('flash',0x020000dd,(20,),(8,),(5,0xaf8)),('gf2',0x02000070,(41,),(0x13,),(10,0xb24)),('flashComp',0,(21,),(9,),(6,0xafa)))
MODEL=0x55063f30;MODEB=0x6304a100;IDW=0x6304a200;VISIBLE=0x5319a720
def thset2(p,c,e,data,count):
    soft='softFocusSlot0' in e
    def state(bits,mode=3):
        c.mem_write(MODEB,bytes([mode]));c.mem_write(REC,bytes(0xb28));c.mem_write(REC+SETTING,bytes([bits]))
        c.mem_write(MODEL,struct.pack('<II',MODEB,REC))
    patterns=[0]+[1<<(k+1) for k in range(7)]+[0xfe,0xaa,0x54]
    # Lines: hidden while their box is ticked, in every mode; the others asked natively.
    seen=[]
    def vis(cpu,at,size,user):
        seen.append(1);cpu.reg_write(reg.UC_ARM_REG_R0,0x77);cpu.reg_write(reg.UC_ARM_REG_PC,cpu.reg_read(reg.UC_ARM_REG_LR))
    h=c.hook_add(UC_HOOK_CODE,vis,begin=VISIBLE,end=VISIBLE)
    for bits in patterns:
        for k,(key,line,fns,adj,mem) in enumerate(BOXES_HS):
            if not line:continue
            for mode in (0,3):
                state(bits,mode);seen.clear();c.mem_write(IDW,struct.pack('<I',line))
                p.run(e['linesHidden'],STOP,{0:1,1:2,2:3,10:IDW})
                ticked=bool(bits&(1<<(k+1)));hidden=r(c,0)==0 and not seen
                assert hidden==ticked and (ticked or (r(c,0)==0x77 and seen)),(key,hex(bits),mode)
                count('line hidden' if hidden else 'line shown')
        for other in (0x02000066,0x0200004e,0x02000071):
            state(bits);seen.clear();c.mem_write(IDW,struct.pack('<I',other));p.run(e['linesHidden'],STOP,{0:1,1:2,2:3,10:IDW})
            assert r(c,0)==0x77 and seen,hex(other);count('other line shown')
    c.hook_del(h)
    # Button lists' filter: a ticked box's functions refused (0), the others as the camera's.
    p.stubs_on=True;p.fn_stubs=True
    native={}
    for f in range(0,47):
        state(0);p.call(0x531b9410,f);native[f]=r(c,0)
    for bits in patterns:
        off={f for k,b in enumerate(BOXES_HS) if bits&(1<<(k+1)) for f in b[2]}
        for f in range(0,47):
            state(bits);p.call(0x531b9410,f);assert r(c,0)==(0 if f in off else native[f]),(f,hex(bits))
        count('filter')
    # A button still holding one: Off while ticked (GetEventCustomize's r2, GetEventSwitchWlan's r6).
    for bits in patterns:
        off={f for k,b in enumerate(BOXES_HS) if bits&(1<<(k+1)) for f in b[2]}
        for f in (0,1,8,9,19,20,21,22,26,41):
            state(bits);regs={0:0x1110,1:0x2221,2:f,3:0x3333,4:0x44,5:0x55}
            p.run(0x5329bcc8,0x5329bccc,regs);assert r(c,2)==(0 if f in off else f) and r(c,0)==0x1110 and r(c,3)==0x3333,(f,hex(bits))
            regs={0:0x1110,1:0x2221,2:0x2222,3:0x3333,4:0x44,5:0x55,6:f,12:0xcc}
            p.run(0x5329a0a0,0x5329a0a4,regs);assert r(c,6)==(0 if f in off else f) and c.reg_read(reg.UC_ARM_REG_R12)==0xcc and r(c,0)==0x1110,(f,hex(bits))
            count('button Off' if f in off else 'button kept')
    p.stubs_on=False;p.fn_stubs=False
    # ADJ slots: a ticked box's ADJ functions read Off (no roll loaded).
    OBJ=0x6304a300
    for bits in patterns:
        off={f for k,b in enumerate(BOXES_HS) if bits&(1<<(k+1)) for f in b[3] if not (soft and f==9)}
        for i,at in enumerate((0x5324633c,0x53246348,0x53246354,0x53246360,0x5324636c)):
            for f in range(0,0x14):
                state(bits);c.mem_write(REC+0x918+2*i,bytes([f]));c.mem_write(OBJ,struct.pack('<II',0,REC))
                p.run(at,STOP,{0:OBJ});assert r(c,0)==(0 if f in off else f),(i,f,hex(bits))
        count('ADJ')
    # Mode Memory: the three boxes' visibility (0 while ticked) in the table the screen copies.
    T=e['afPointItems']
    for k,(key,line,fns,adj,mem) in enumerate(BOXES_HS):
        if not mem:continue
        item,box=mem;row=item+1 if item>=3 else item
        it=struct.unpack('<10I',bytes(c.mem_read(T+row*0x28,0x28)));assert it[0]==item and it[8]==e['hsMemoryVisible%d'%item] and it[9]==0,(key,it)
        for bits in patterns:
            state(bits);p.run(it[8],STOP,{0:0x1234});assert r(c,0)==(0 if bits&(1<<(k+1)) else 1),(key,hex(bits))
            count('memory box visibility')
    # Ticking Flash Mode, GF-2 or Flash Exposure Comp. sets its Mode Memory box « memorized »; unticking leaves it.
    recs=[BOXES+0x1000*j for j in range(7)]
    for k,(key,line,fns,adj,mem) in enumerate(BOXES_HS):
        for st in (1,0):
            c.mem_write(REC,bytes(0xb28));c.mem_write(MODEL,struct.pack('<II',MODEB,REC))
            for a_ in recs:c.mem_write(a_,bytes(0xb28))
            c.mem_write(STORED,b''.join(struct.pack('<I',x) for x in recs))
            c.mem_write(I+0x174+k,bytes([st]));p.run(e['hsWrite%d'%k],STOP,{0:I})
            for a_ in [REC]+recs:
                b=bytes(c.mem_read(a_,0xb28));want={SETTING:(1<<(k+1)) if st else 0}
                if mem and st:want[mem[1]]=1
                assert all(b[o]==want.get(o,0) for o in range(0xb28)),(key,st,hex(a_),[hex(o) for o in range(0xb28) if b[o]!=want.get(o,0)])
            count('box write')

ADJ_LISTS=(0x53b4eba0,0x53b5a430,0x53b5a404,0x53b58fb0,0x53b5a4b4);ADJ_COUNTS=(0x531b3bac,0x531b3bb4,0x531b3bbc,0x531b3bc4,0x531b3bcc)
READS=((0x10,0x28,4,4),(0x18,0x20,1,4),(0x20,0x14,4,1))   # record field, offset of the read, dest register, index register
def thset3(p,c,e,data,count):
    soft='softFocusSlot0' in e
    pairs=[(f,1<<(k+1)) for k,b in enumerate(BOXES_HS) for f in b[3] if not (soft and f==9)]
    def bl(at,to):return (0xeb000000|(((to-at-8)>>2)&0xffffff))&0xffffffff
    for bits in [0]+[1<<(k+1) for k in range(7)]+[0xfe,0x60,0xa0]:
        c.mem_write(REC,bytes(0xb28));c.mem_write(REC+SETTING,bytes([bits]));c.mem_write(MODEL,struct.pack('<II',MODEB,REC))
        hidden={f for f,b in pairs if bits&b}
        for i,(lst,cnt) in enumerate(zip(ADJ_LISTS,ADJ_COUNTS)):
            full=list(c.mem_read(lst,19));want=[f for f in full if f not in hidden]
            p.run(cnt,STOP,{4:0x44,5:0x55,6:0x66});assert r(c,0)==len(want) and (r(c,4),r(c,5),r(c,6))==(0x44,0x55,0x66),(i,hex(bits),r(c,0),want)
            rec=0x53b3c6c0+(65+i)*0x40
            for k,(field,off,dest,index) in enumerate(READS):
                fn=u32(c,rec+field);at=fn+off;stub=e['hsAdjRead%d_%d'%(i,k)]
                assert u32(c,at)==bl(at,stub),(i,k)
                for n in range(len(want)+2):
                    regs={0:0x1010,1:0x1111,2:0x1212,3:lst,4:0x1414,5:0x1515,6:0x1616,12:0x1c1c}
                    regs[index]=n
                    p.run(stub,STOP,regs)
                    for reg_,v in regs.items():
                        if reg_==dest:continue
                        elif reg_==12:assert c.reg_read(reg.UC_ARM_REG_R12)==v,(i,k,'ip')
                        else:assert r(c,reg_)==v,(i,k,n,reg_)
                    assert r(c,dest)==(want[n] if n<len(want) else 0),(i,k,n,hex(bits),r(c,dest),want)
            count('ADJ list')

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    for s in ('rtos','manifest','report'):a.add_argument('--'+s,type=Path,required=True)
    a=a.parse_args();result=verify(a.rtos.read_bytes(),json.loads(a.manifest.read_text()))
    with a.report.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))
