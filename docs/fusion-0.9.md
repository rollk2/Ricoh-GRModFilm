# Convergence avec GR Mod 0.9.x (Maxwooow)

Décision du 2026-11-25 : arrêter de porter les fonctions de l'amont à la main et se rapprocher de sa structure, pour
recevoir ses évolutions directement. Deux étapes. Branche de travail : `fusion-0.9` (rien n'est publié avant que tout
soit validé sur les deux boîtiers). Étude préalable : `docs/amont-0.9-etude.md`.

## Étape 1 : fusion de GR Mod 0.9.1, conflits, tout construit et passe les tests (2026-11-25)

Fusion de l'étiquette `v0.9.1` de l'amont (rangée dans `refs/upstream-tags/v0.9.1`, nos propres étiquettes v0.9.x portant
le même nom).

### Ce qui vient de l'amont
- **Structure** : le GR IV 1.21 n'est plus une copie chez lui, mais le programme 1.20 avec une table d'adresses
  (`core/src/fw/gr4v121/addresses.ts`, `target.ts`) ; un dossier de firmware est son programme de base avec ses propres
  fichiers par-dessus (`core/overlays.mjs`, pris en compte par Vite, Vitest et le travailleur web). Même principe pour
  les GR III 2.20 / 2.21 (`fw/gr3x170`, `fw/gr3x171` sur `fw/gr3x`, adresses via `adr()`).
- **Fonctions GR IV** (1.11, 1.20, et 1.21 pour les autres que nous) : zone assombrie hors cadre, Matte Brightness, Shadow
  Correction apprise, grain argentique, Flash TTL, balance des blancs apprise, Constant Light, Sensor Shift, vidéo (AF à
  phase, P / Av / Tv / M, 4K, SR mécanique), grilles dans le menu Grid Style.
- **Application** : `store.ts` et `pages.tsx` découpés en modules (`ui/src/store/*`, `ui/src/pages/*`), page « Additions »
  (`extras`) en capsules, interface en 7 langues (`ui/src/locales/*`), « passerelle » 1.12 supprimée.
- **Outillage** : `npm run check` (listes de firmwares, versions, ports générés), tests de l'interface (`ui/test`),
  workflows `test.yml`, `packages.yml`, `ios.yml`.

### Ce qui est gardé de GR Mod Film
- **GR IV 1.21 / Monochrome 1.11 : notre copie complète** de `core/src/fw/gr4v121` (boutons Hold, listes Fn, Macro, ADJ
  Red Filter, sans vidéo, recettes noir et blanc, ordre réel des looks, tri des ratios, batterie et grilles 1.3.5). Comme
  tous ses fichiers existent, le mécanisme de superposition de l'amont ne la remplace pas : rien ne change pour les
  firmwares 1.21. Le moteur annonce pour le 1.21 nos fonctions seulement (`engine.ts`, `features` de `FirmwareInfo`) ;
  les nouveautés de l'amont s'appliquent aux fichiers 1.11 et 1.20.
- **GR III** : le mode pellicule et ses fonctions dans `fw/gr3x` (conflits résolus en gardant les deux côtés : les adresses
  de l'amont passent par `adr()`, les nôtres restent écrites en dur car propres au 2.10 / 1.60).
- **Application**, reportée dans le découpage de l'amont :
  - `store/film.ts` (nouveau) : mode pellicule, codes de film, sans vidéo, molette arrière, SR par vitesse (bêta), réglages
    masqués, fichier GRFILM.SET ;
  - `store/community.ts` (nouveau) : packs de recettes et de ratios, collection communautaire ;
  - `store/core.ts` : nos états, confirmation à deux choix (`choose`), `monoRecipesOn` ; `families.ts` : enregistrement du
    projet (les projets 1.3.5 qui gardaient la batterie et la grille sous d'autres noms sont relus) ; `settings.ts` :
    zip du site Ricoh, recettes Monochrome au changement de modèle ; `slots.ts`, `looks.ts` : recettes noir et blanc,
    ordre et masquage des looks (Standard du GR III masquable) ; `ratios.ts` : ordre des ratios ; `output.ts` : sortie web,
    options du mode pellicule, GRFILM.SET avec le firmware, lignes de confirmation ; `copies.ts` : ligne de l'ordre ;
  - pages : nos interrupteurs en capsules dans la page « Additions », codes de film et recettes noir et blanc
    (`slot-cards.tsx`, `image-control.tsx`), tri des ratios et packs (`ratio.tsx`), communauté, lien de soutien et sortie
    web (`app.tsx`) ;
  - textes : bloc `filmZh` / `filmEn` dans `i18n.ts` (100 clés) et nos libellés « GR Mod Film » ; les 5 autres langues
    de l'amont affichent nos textes en anglais.
- Doublons supprimés au profit de l'amont : la batterie et l'éditeur de grilles de la 1.3.5 (l'amont a les siens, mêmes
  options du moteur `batteryPercent` / `customGrid`), « passer tous les guides ».

### Contrôles
- Types : cœur et application sans erreur.
- Application : 60 tests (dont `store-gr3.test.mjs` avec notre test GRFILM.SET).
- Shell Go : `internal/platform` passe (les deux corrections du disque système Linux gardées).
- `npm run check` : listes de firmwares (README avec ses balises), textes natifs, versions, table d'adresses : ok. Ports :
  `gr4-120`, `gr4-121`, `gr3-p3` ok ; **`gr3-p2` non** (voir ci-dessous).
- Cœur (suite complète avec les firmwares GR III 2.10, GR IIIx 1.60, GR IV 1.11, 1.20, 1.21) : après la fusion,
  33 échecs dans 11 fichiers, tous expliqués et traités :
  - tests de l'amont pour ses fonctions sur le 1.21 (grain, Flash TTL, Shadow Correction, zone assombrie, AF vidéo,
    balance apprise, Constant Light, Sensor Shift, vidéo) : notre copie 1.21 ne les annonce pas encore. Ils sont filtrés
    par un seul interrupteur, `UPSTREAM_121` de `core/test/fw-helpers/fusion.ts`, à passer à `true` à l'étape 2 ; le
    nouveau test `fusion-121.test.ts` vérifie en attendant que le 1.21 annonce nos fonctions et refuse celles de l'amont ;
  - tests « batterie et grilles refusées sur le 1.20 » : le programme 0.9 les propose sur le 1.20, tests réécrits
    (construit et relu sur le 1.20) ;
  - empreintes de référence (`golden-builds.json`) réenregistrées avec `GRMOD_GOLDEN=record` : GR III 2.10 et
    GR IIIx 1.60 (notre programme : garde du SR, mode pellicule), GR IV 1.21 (notre copie), et pour le 1.11 / 1.20 la
    seule recette « added slots, menu order » (et « everything ») parce que notre moteur lit l'ordre réel des looks
    dans le firmware (`factoryLookOrder`) : la recette masque `looks.factory[9]`, qui n'est pas le même look. Les
    2.20 / 2.21 / 1.70 / 1.71 (sans firmware ici) gardent les empreintes de l'amont.
  - typage : `ui/src/host.ts` référence `env.d.ts` ; `release.test.ts` tolère notre fichier 1.21 réel.
- Relecture d'un firmware GR III construit par le site fusionné (mode pellicule et ratio ajouté) : vérifié, et la
  table de garde du SR contrôlée dans l'image (256 valeurs, aucun écart).

### Écarts connus, à traiter à l'étape 2
- **Port `gr3-p2` (outils GR III 2.20)** : nos ajouts du mode pellicule dans des outils de l'amont (`guard_probe.py`,
  `halation_rows_probe.py`, `gen_films.py`, `films_r10_verify.py`, `compile_diag.py`, `look_layout_probe.py`,
  `native/films.c`) contiennent des adresses 2.10 que sa carte 2.20 ne connaît pas. Nos propres sondes GR III sont exclues
  des ports (`exclude` de `gr3-p2.json` / `gr3-p3.json`). À faire : sortir nos ajouts de ces fichiers (modules à nous) ou
  compléter la carte 2.20 avec le firmware 2.20 (absent ici).
- **Port `gr4-121`** : `tools/gr4v121` est déclaré préservé (`preserve`) tant que notre copie 1.21 existe.
- **Copies 1.20** : nos deux ajouts protégés aux sources 1.11 (instruction `vmov` de l'assembleur, blocs de diagnostic
  `#ifdef` de `datestamp.c`) sont recopiés dans `fw/gr4v120/aspect/arm.ts` et `tools/gr4v120/datestamp/datestamp.c`
  (texte seulement, le code compilé 1.20 de l'amont est inchangé).
- **Workflows de l'amont** : `test.yml` (sur `main` et les PR) lancera `npm run check`, donc le port `gr3-p2` ; `packages.yml`
  se déclenche sur les étiquettes `v*` comme notre `release.yml` ; `ios.yml`. À décider avant la fusion dans `main` :
  garder `test.yml` (utile), désactiver ou adapter `packages.yml` et `ios.yml`.
- **Mobile** (`mobile/`) : l'application Android / iOS de l'amont n'est pas suivie par GR Mod Film.

## Étape 2 : nos ajouts GR IV sur le programme 1.20 de l'amont (à faire)

But : supprimer notre copie `core/src/fw/gr4v121`, pour que le 1.21 reçoive toutes les fonctions de l'amont, et que les
nôtres marchent aussi sur le fichier 1.20 (Monochrome 1.10) là où les adresses existent.

Fichiers 1.21 qui n'existent que chez nous (à écrire dans `fw/gr4v120/aspect` avec `adr()`, chaque adresse 1.21 traduite
en 1.20 et vérifiée dans les deux firmwares, les manquantes ajoutées à `tools/port/gr4-121-map.json`) :
`adjredfilter.ts`, `fnlists.ts`, `holdbuttons.ts`, `holdlines.ts`, `keydiag.ts`, `monocurve.ts`, `nomovie.ts`,
`slotparams-mono-native.ts` (module C compilé, à recompiler pour 1.20 et 1.21).

Fichiers communs que nous avons modifiés (nos ajouts à reporter dans les siens) : `build.ts` (ordre des ratios, boutons,
sans vidéo, recettes, révision 4 des boutons Hold), `package.ts` (3e octet de fonctions : ordre des ratios, batterie,
grilles ; à réconcilier avec l'enregistrement de ses propres fonctions), `slots.ts` (recettes Monochrome, garde du
module), `looks.ts`, `datestamp-menu.ts`, `exposure.ts`, `index.ts`, `patch.ts`.

Mémoire (même famille que le gel de la 1.3.4) : refaire la carte des mots `0x55839014..0x5583907F`. Nos boutons Hold
prennent `0x55839014` / `0x55839018` ; son Flash TTL prend `0x55839018`, Shadow Correction `0x55839014` et
`0x5583903C`. Déplacer nos mots avant d'activer ces fonctions sur le 1.21, puis `hold_gap_probe.py`.

Vérifications : relecture byte pour byte des fichiers 1.3.x existants (révisions 3 et 4), sondes d'émulateur rejouées
(`hold*`, `nomovie`, `mono_recipe`, `boot_checks`, `battery`, `grid`), puis tests sur le Monochrome et non-régression GR III.
