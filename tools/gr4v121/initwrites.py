import struct,sys
from unicorn import *
from unicorn.arm_const import *
B=0x53000000
d=open('fw/gr4_mono_v111.rtos','rb').read()
u=Uc(UC_ARCH_ARM,UC_MODE_ARM)
u.mem_map(B,(len(d)+0xfff)&~0xfff); u.mem_write(B,d)
src=0x543b4900
u.mem_map(0x55000000,0x1000000); u.mem_write(0x55000000,d[src-B:src-B+0x58500])
u.mem_map(0x70000000,0x400000)
# enable VFP
try:
    u.reg_write(UC_ARM_REG_C1_C0_2,0xf00000)
    u.reg_write(UC_ARM_REG_FPEXC,0x40000000)
except Exception as e: print('vfp',e)
writes=set()
BASE=0x5508ba28
def mw(uc,access,addr,size,val,ud):
    if BASE<=addr<BASE+0x3000:
        for k in range(size): writes.add(addr-BASE+k)
u.hook_add(UC_HOOK_MEM_WRITE,mw)
calls=[]
def code(uc,a,s,_):
    if a==0x70000100: uc.emu_stop()
    # stub calls outside the function body: skip bl targets not in same function region
u.hook_add(UC_HOOK_CODE,code)
def unmapped(uc,access,addr,size,val,ud): 
    return False
u.reg_write(UC_ARM_REG_SP,0x70080000); u.reg_write(UC_ARM_REG_LR,0x70000100)
u.reg_write(UC_ARM_REG_R0,BASE)
try:
    u.emu_start(0x5354754c,0x70000100,count=200000)
except UcError as e:
    print('err',e,hex(u.reg_read(UC_ARM_REG_PC)))
print('written offsets',len(writes))
def runs(lo,hi):
    out=[]
    for o in range(lo,hi): out.append(f"{o:#x}:{'W' if o in writes else '.'}")
    print(' '.join(out))
runs(0x920,0x960)
free=[o for o in range(0,0x1500) if o not in writes]
print('unwritten (record offsets):',[hex(o) for o in free])
