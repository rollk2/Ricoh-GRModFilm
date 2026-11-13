# GR Mod Film community collection

Recipe packs (`recipes/*.grfrecipes`) and ratio packs (`ratios/*.grfratios`) shared by GR Mod Film users. The
site lists them on its **Community** page (https://rollk2.github.io/Ricoh-GRModFilm/), where one click imports
a pack; the program shows the same list.

## Share a pack

In GR Mod Film, on the Community page, choose **Share my recipes** or **Share my ratios**. Give the pack a
title, your name (or a nickname) and a short description, and confirm the licence below. The program saves the
pack, then opens GitHub's upload page in this folder: drop the file there and propose the change (GitHub asks
for a free account and makes the pull request for you). An automatic check reads the pack before it is
reviewed; the maintainer then accepts it, asks for a change, or declines it.

## Rules

- **Only your own work.** A recipe's preset or LUT must be made by you. Never share a paid or commercial preset,
  a LUT taken from a film simulation pack, or anything you are not free to give away.
- **Licence: CC0 1.0 (public domain).** By proposing a pack you confirm the above and dedicate the pack to the
  public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): anyone may use, change and
  build firmware with it, without any condition. The pack carries `"license": "CC0-1.0"`; the check refuses it
  otherwise.
- **One pack per file**, with a clear title and description in English. File names: letters, digits, `.`, `_`,
  `-` only (for example `portra-like-set.grfrecipes`).
- **Size**: at most 8 MB per pack.
- The maintainer keeps the collection coherent: packs may be renamed, merged, or removed at any time.

## Removal

If you hold rights to something in this collection and want it removed, open an issue on this repository: it is
removed without discussion.

## For the maintainer

`node --experimental-transform-types tools/community.mjs check` checks every pack as the site reads it (it runs
on each pull request touching `community/`); `build OUTDIR` also writes the site's `index.json`.
