#!/usr/bin/env python3
"""Reads .cube LUTs (3D, R fastest) and prints, for a black-and-white recipe: whether the output is grey, the tone curve on the neutral axis
(R = G = B) and a linear fit of the output grey on the input R, G, B (the colour mix, which a monochrome sensor cannot use).

  python3 -I cube_mono_analysis.py FOLDER_WITH_CUBES
"""
import sys, glob, os
import numpy as np
def load(p):
    n=None; rows=[]
    for line in open(p):
        t=line.strip()
        if t.startswith('LUT_3D_SIZE'): n=int(t.split()[1])
        elif t and (t[0].isdigit() or t[0]=='-'): rows.append([float(x) for x in t.split()])
    a=np.array(rows).reshape(n,n,n,3)  # [b][g][r]
    return n,a
for p in sorted(glob.glob(sys.argv[1]+'/*.cube')):
    n,a=load(p); name=os.path.basename(p).split('-',1)[1]
    diag=np.array([a[i,i,i] for i in range(n)])
    chroma=np.abs(a-a.mean(axis=3,keepdims=True)).max()
    dchroma=np.abs(diag-diag.mean(axis=1,keepdims=True)).max()
    # luminance weights: fit out mean vs input r,g,b over grid (linear)
    g=np.linspace(0,1,n); B,G,R=np.meshgrid(g,g,g,indexing='ij')
    y=a.mean(axis=3).ravel(); X=np.stack([R.ravel(),G.ravel(),B.ravel(),np.ones(y.size)],1)
    w=np.linalg.lstsq(X,y,rcond=None)[0]
    print(f'== {name}  size {n}  max chroma {chroma:.3f}  neutral-axis chroma {dchroma:.3f}')
    print('  neutral axis in -> out (R,G,B):')
    for i in range(n): print(f'   {g[i]:.3f} -> {diag[i,0]:.3f} {diag[i,1]:.3f} {diag[i,2]:.3f}')
    print('  linear fit of output grey on input R,G,B: r %.3f g %.3f b %.3f const %.3f (sum %.3f)'%(w[0],w[1],w[2],w[3],w[:3].sum()))
