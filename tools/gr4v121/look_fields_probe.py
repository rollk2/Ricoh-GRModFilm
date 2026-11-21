#!/usr/bin/env python3
"""GR IV 1.21 / Monochrome 1.11: where a look keeps its adjustment parameters (M3b of the Monochrome recipes).

  python3 -I look_fields_probe.py STYLE PARAMS        (run from the scratchpad that holds fw/gr4_mono_v111.rtos, or edit the path)

Runs each parameter's getter (slots.ts GETTERS) for the style, photo and movie, custom sets 0..3, with the settings object filled with
two patterns (low byte, high byte of each offset): the value read gives the offset of the field the getter reads. The getters read the
mirrored settings, 0xb44 bytes after the fields the setters write (checked on Cinema Yellow, 18, against slot_params.c's FIELD table).
"-" = the getter reads no field for that style (a constant).
"""
import struct, re, sys
from unicorn import *
from unicorn.arm_const import *
s=open('/home/user/Ricoh-GRMod/core/src/fw/gr4v121/aspect/slots.ts').read()
G=[int(x,16) for x in re.findall(r'0x[0-9a-f]+',re.search(r'const GETTERS = \[([^\]]*)\]',s).group(1))]
d=open('fw/gr4_mono_v111.rtos','rb').read();B=0x53000000
u=Uc(UC_ARCH_ARM,UC_MODE_ARM); u.mem_map(B,(len(d)+0xfff)&~0xfff); u.mem_write(B,d)
u.mem_map(0x55000000,0x1000000); u.mem_map(0x60000000,0x400000); u.mem_map(0x70000000,0x100000)
u.mem_write(0x55000000,d[0x543b4900-B:0x543b4900-B+0x58500])
OBJ=0x60000000; SENT=0x70000100; flag=[]
def code(uc,a,sz,_):
    if a==SENT: uc.emu_stop(); return
    if a==0x53240cac: uc.reg_write(UC_ARM_REG_R0,0x60200000); uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR)); return
    if a==0x53241240: uc.reg_write(UC_ARM_REG_R0,OBJ); uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR)); return
    if a==0x53916230: flag.append(1); uc.reg_write(UC_ARM_REG_PC,uc.reg_read(UC_ARM_REG_LR)); return
u.hook_add(UC_HOOK_CODE,code)
P1=bytes(k&0xff for k in range(0x2000)); P2=bytes((k>>8)&0xff for k in range(0x2000))
def get(f,mode,sset,style,pat):
    u.mem_write(OBJ,pat); flag.clear()
    for r in range(13): u.reg_write(UC_ARM_REG_R0+r,0)
    u.reg_write(UC_ARM_REG_R0,0x60300000); u.reg_write(UC_ARM_REG_R1,mode); u.reg_write(UC_ARM_REG_R2,sset); u.reg_write(UC_ARM_REG_R3,style)
    u.reg_write(UC_ARM_REG_SP,0x70080000); u.reg_write(UC_ARM_REG_LR,SENT)
    u.emu_start(f,SENT,count=20000); return u.reg_read(UC_ARM_REG_R0)&0xff
style=int(sys.argv[1])
for p in [int(x) for x in sys.argv[2].split(',')]:
    row=[]
    for mode in (0,1):
        for sset in range(4):
            a=get(G[p],mode,sset,style,P1); b=get(G[p],mode,sset,style,P2)
            # constant (no field) if both patterns give the same small value and an all-zero pattern gives it too
            c=get(G[p],mode,sset,style,bytes(0x2000))
            row.append('-' if a==b==c else hex((b<<8)|a))
    print(p,row)
