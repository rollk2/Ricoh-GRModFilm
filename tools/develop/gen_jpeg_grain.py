# SPDX-License-Identifier: GPL-2.0-only
"""Build the JPEG grain module (tools/develop/jpeg_grain.c with grain.c) and write
core/src/fw/gr3x/grain-module.ts.

  python3 tools/develop/gen_jpeg_grain.py

1. Camera: jpeg_grain.c (-Os) and grain.c (-O2, its loop is the hot one) with the camera modules'
   flags (build.py ARM_FLAGS), linked at two addresses: the bytes must be the same (no relocation),
   no data section of any kind, nothing called outside the blob. The entry `grain_stage` is noted.
2. PC: the four texture recipes (host_recipes) and the two grain profiles, as the camera reads
   them (the structs have no pointer: the same layout on both). T-GRAIN6, the film look: colour
   size 2.0, coarse octave 65 %, chroma 8, most in the mid tones; black and white BW400 at size
   2.2 (-DDIGITAL: T-GRAIN5's NEG400 and BW400).
"""
import base64
import hashlib
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'core' / 'src' / 'fw' / 'gr3x' / 'grain-module.ts'
sys.path.insert(0, str(HERE))
from build import ARM_FLAGS, LIB  # noqa: E402

DUMP = r'''
#include <math.h>
#include <stdio.h>
#include "host.h"
/* host.c's tone curve (a bump at c of width w over a floor fading from `shadow` to `top`). */
static void tone(double out[17], double c, double w, double shadow, double top) {
  int i;
  for (i = 0; i < 17; i++) {
    double l = i == 16 ? 1.0 : i / 16.0, b = exp(-(l - c) * (l - c) / (2 * w * w));
    double f = shadow * (1 - l) + top * l, v = f + (255 - f) * b;
    if (l > 0.94) v = v * (1 - l) / 0.06 + top * (l - 0.94) / 0.06;
    out[i] = v;
  }
}
int main(void) {
  struct dv_tex_recipe r[4]; struct dv_grain_profile p[2]; double t[17];
  host_recipes(r);
#ifdef DIGITAL
  host_profile(&p[0], ARCH_NEG400); host_profile(&p[1], ARCH_BW400);
#else
  /* T-GRAIN6, the film look: bigger grain in clumps (size 2.0, coarse octave 65 %), most in the
   * mid tones, little colour (chroma 8 against NEG400's 25); black and white: BW400, bigger. */
  tone(t, 0.45, 0.25, 110, 10); host_profile_make(&p[0], 45, 2.0, 65, 8, t);
  tone(t, 0.45, 0.22, 170, 30); host_profile_make(&p[1], 70, 2.2, 65, 0, t);
#endif
  if (sizeof r[0] != 44 || sizeof p[0] != 32) return 1;
  fwrite(r, sizeof r, 1, stdout); fwrite(p, sizeof p, 1, stdout);
  return 0;
}
'''


def run(cmd, **kw):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, **kw)
    if r.returncode:
        sys.exit(f'{" ".join(map(str, cmd))}\n{r.stdout!r}\n{r.stderr.decode(errors="replace")}')
    return r.stdout


def camera(tmp):
    objs = []
    for src, opt in (('jpeg_grain.c', '-Os'), ('grain.c', '-O2')):
        obj = tmp / (Path(src).stem + '.o')
        flags = [f for f in ARM_FLAGS if f != '-Os'] + [opt]
        run(['clang'] + flags + ['-I', HERE, '-c', HERE / src, '-o', obj])
        objs.append(obj)
    blobs, entry = [], None
    for origin in (0x60000000, 0x60123450):
        elf = tmp / f'g_{origin:x}.elf'
        run(['ld.lld', f'-Ttext=0x{origin:x}', '--no-undefined', '-e', 'grain_stage', '-o', elf] + objs)
        sections = run(['readelf', '-S', '-W', elf]).decode()
        for name in ('.data', '.bss', '.rodata', '.got'):
            if f' {name} ' in sections or f' {name}.' in sections:
                sys.exit(f'grain module: a {name} section')
        undefined = [l for l in run(['readelf', '-s', '-W', elf]).decode().splitlines() if ' UND ' in l and l.split()[-1] != 'UND']
        if undefined:
            sys.exit('grain module: calls outside it\n' + '\n'.join(undefined))
        out = tmp / f'g_{origin:x}.bin'
        run(['llvm-objcopy', '-O', 'binary', '-j', '.text', elf, out])
        blobs.append(out.read_bytes())
        for line in run(['llvm-nm', elf]).decode().splitlines():
            parts = line.split()
            if len(parts) == 3 and parts[2] == 'grain_stage':
                e = int(parts[0], 16) - origin
                if entry is not None and e != entry:
                    sys.exit('grain module: entry moved')
                entry = e
    if blobs[0] != blobs[1]:
        sys.exit('grain module: the code depends on its address')
    if entry is None or entry % 4:
        sys.exit('grain module: no entry')
    return blobs[0], entry


def host_data(tmp, extra=()):
    (tmp / 'dump.c').write_text(DUMP)
    exe = tmp / 'dump'
    run(['cc', '-O2', *extra, '-I', HERE / 'host', '-o', exe, tmp / 'dump.c', HERE / 'host' / 'host.c'] + [HERE / f for f in LIB] + ['-lm'])
    data = run([exe])
    if len(data) != 4 * 44 + 2 * 32:
        sys.exit('host data size')
    return data[:176], data[176:]


def main():
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        code, entry = camera(tmp)
        recipes, profiles = host_data(tmp)
    sources = b''.join((HERE / f).read_bytes() for f in ('jpeg_grain.c', 'grain.c', 'develop.h', 'host/host.c'))
    version = subprocess.run(['clang', '--version'], capture_output=True, text=True).stdout.splitlines()[0]
    b64 = lambda b: base64.b64encode(b).decode('ascii')
    OUT.write_text('\n'.join([
        '// SPDX-License-Identifier: GPL-2.0-only',
        '// GENERATED by tools/develop/gen_jpeg_grain.py -- do not edit.',
        '//',
        '// The JPEG grain module (tools/develop/jpeg_grain.c with grain.c), position independent.',
        f'// Compiler: {version}.',
        '',
        f"export const GR3X_GRAIN_SOURCE_SHA256 = '{hashlib.sha256(sources).hexdigest()}';",
        f"export const GR3X_GRAIN_CODE = '{b64(code)}';",
        f'export const GR3X_GRAIN_ENTRY = {entry};',
        '/** The four texture recipes (struct dv_tex_recipe, 44 bytes each). */',
        f"export const GR3X_GRAIN_RECIPES = '{b64(recipes)}';",
        '/** The grain profiles (struct dv_grain_profile, 32 bytes each): colour, black and white (T-GRAIN6, the film look). */',
        f"export const GR3X_GRAIN_PROFILES = '{b64(profiles)}';",
        '',
    ]), encoding='utf-8')
    print(f'grain module: {len(code)} bytes, entry +{entry:#x}; wrote {OUT}')


if __name__ == '__main__':
    main()
