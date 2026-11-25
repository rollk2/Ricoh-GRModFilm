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

## Étape 2 : nos ajouts GR IV sur le programme 1.20 de l'amont (faite le 2026-11-26, branche `claude/fusion-0.9`)

Le GR IV 1.21 (Monochrome 1.11) est construit par le programme 1.20 de l'amont avec nos fonctions, qui s'appliquent
aussi au fichier 1.20 (Monochrome 1.10) : sans vidéo, boutons (listes Fn, lignes Hold, Macro Button, ADJ Red Filter),
recettes noir et blanc, ordre des ratios. Le 1.21 reçoit en même temps toutes les fonctions de l'amont (grain, Shadow
Correction apprise, Flash TTL, balance des blancs apprise, Constant Light, AF vidéo, vidéo 4K / SR, batterie, grilles du
menu Grid Style, zone assombrie), sauf Sensor Shift (ci-dessous).

### Méthode
- **Adresses** : nos fichiers 1.21 traduits vers le 1.20 avec l'outil de l'amont (`tools/port/addrmap.py`, images
  1.21 -> 1.20) : toutes nos adresses de code sont alignées en mode strict (16 mots identiques, constantes comprises, seuls
  les branchements et littéraux masqués), donc le code autour de chaque accroche est le même dans les deux versions,
  décalages de structures compris. Aller-retour vérifié : chacune des 56 adresses nouvelles redonne par la table 1.20 ->
  1.21 son adresse 1.21 d'origine. 4 exceptions documentées dans `tools/port/gr4-121-overrides.json` (deux dans des
  commentaires, les deux mots Hold en RAM). La table 1.21 (`fw/gr4v121/addresses.ts`) a 61 adresses de plus.
- **Fichiers** : nos 7 fichiers propres (`adjredfilter`, `fnlists`, `holdbuttons`, `holdlines`, `keydiag`, `monocurve`,
  `nomovie`) écrits dans `fw/gr4v120/aspect` avec `adr()` ; nos changements des fichiers communs (`slots`, `datestamp-menu`,
  `exposure`, `index`, `patch`) reportés par fusion à trois voies (base 0.8.15 convertie, la nôtre convertie, celle de
  l'amont) : aucun conflit hors une ligne ; `build.ts` et `package.ts` à la main. Une seule valeur diffère entre 1.20 et
  1.21 hors adresses : l'identifiant de Movie Edit (0x04000032 / 0x04000033 : le 1.21 numérote toutes les lignes 0x040000xx
  du menu de lecture une de plus), passé par `byRelease`.
- **Retouches de la copie 1.20** : `fw/gr4v120` est chez l'amont une copie générée du 1.11 ; nos modifications sont
  enregistrées dans `tools/port/gr4-120.patch` (`generate.py --save-patch`).

### Collisions avec les ajouts de l'amont, et leur solution
- **Mots RAM des boutons Hold** : 0x55839014 / 0x55839018 (révision 4) sont pris par Shadow Correction et Flash TTL.
  Déplacés dans la réserve de 64 octets du `sbrk` (0x55839040..0x55839080, que l'amont utilise déjà) : état en
  0x55839042..43, heure de l'appui sur 16 bits en 0x55839046 (différence calculée modulo 65536 : juste pour tout appui de
  moins de 65 s ; sonde du passage par zéro). La mise à zéro au démarrage est étendue à 0x55839080 dès qu'il y a les boutons.
- **Icônes** : Red Filter 738 et Macro 739 / 740 (image) sont Constant Light, Sensor Shift et Movie SR chez l'amont : 1200,
  1201, 1202. **Textes** : nos lignes Hold 1040..1046 recouvrent Constant Light, Sensor Shift et la vidéo (1040..1051) :
  1056..1062 (1056 s'encode dans l'instruction `add`).
- **Accroches partagées** : le nom et l'icône des fonctions Fn, les listes Fn, le filtre Fn (sans vidéo) et la liste ADJ
  Mode Setting sont aussi modifiés par Constant Light ; les nôtres passent après lui et chaînent sur ce qu'ils trouvent.
- **Fonction Fn 46** : notre Macro Mode et le Sensor Shift de l'amont. Macro garde 46 : les réglages Hold déjà enregistrés
  dans les boîtiers restent justes, alors qu'un ancien 46 envoyé vers une fonction inconnue de l'appareil n'a pas été
  étudié. **Sensor Shift n'est donc pas proposé** (le moteur ne l'annonce plus, la construction le refuse avec les boutons).
  À reprendre si on le veut : donner un autre numéro à l'un des deux, avec une étude de l'exécuteur Fn pour un 46 orphelin.
- **Enregistrement des fonctions** : nos anciens bits (2e octet, bits 5 à 7, et notre 3e octet) sont pris chez l'amont
  par Shadow Correction, le grain et son octet suivant. Les nouveaux fichiers enregistrent nos fonctions dans les bits libres
  du 4e octet de l'amont (16 sans vidéo, 32 boutons, 64 recettes noir et blanc, 128 ordre des ratios suivi de `n` et des
  identités).
- **Module natif des recettes** : il contient des adresses (getters, setters). Notre générateur a une option
  `--release 1.20` (adresses traduites par la table inversée) : `fw/gr4v120/aspect/slotparams-mono-native.ts` est le module
  1.20, `fw/gr4v121/aspect/slotparams-mono-native.ts` le module 1.21, régénéré identique au bit près.

### Fichiers déjà flashés (1.2 à 1.3.5)
Notre copie 1.21 est **gelée dans `fw/gr4v121film`** et ne sert plus qu'à les reconnaître : le moteur essaie le programme
unifié, puis cette copie si le fichier n'est pas reconstruit à l'identique (`engine.ts`, `inspect`). Vérifié sur 14 fichiers
réels (essais boîtier et versions publiées) : même résultat qu'avant le portage (les 4 non vérifiés l'étaient déjà : builds
de diagnostic). Test `fusion-121.test.ts` : fichiers construits par la copie gelée, relus par le moteur.

### Vérifications
- Constructions 1.20 et 1.21 : nos fonctions seules, avec toutes celles de l'amont (Constant Light, grain, Shadow
  Correction, Flash TTL, balance apprise, AF vidéo, batterie, grilles, aperçu d'exposition, ADJ 8 places, date), vidéo :
  contrôles internes et relecture vérifiés.
- Sondes d'émulateur (1.21 telles quelles, 1.20 traduites) : boutons Hold 48 cas, passage par zéro de l'heure 18 cas, mots
  RAM intacts, lignes Hold 260, ADJ Red Filter, sans vidéo, recettes noir et blanc 102 : tout passe sur les deux versions,
  y compris avec toutes les fonctions de l'amont.
- `tools/port/check.py` : gr3-p2, gr3-p3, gr4-120, gr4-121 ok ; tables d'adresses ok.

### Port `gr3-p2` (outils GR III 2.20)
Nos ajouts du mode pellicule dans deux sondes de l'amont nomment 28 adresses 2.10 que la carte 2.20 ne connaît pas (pas de
firmware 2.20 ici) : déclarées non résolues dans `gr3-p2-map.json`, port en mode `lenient`, et `gr3-p2.patch` retire ces
lignes de la copie 2.20 (le mode pellicule n'existe que sur 2.10 / 1.60).

### Workflows
`test.yml` gardé (tests et contrôles sur `main` et les PR). `packages.yml` (paquets de GR Mod) limité au lancement à la
main : nos releases sont faites par `release.yml` sur les étiquettes `v*`. `ios.yml` ne part que d'une branche `ios`.

### Reste avant une release
- Essais sur le Monochrome : non-régression de nos fonctions (boutons Hold, lignes Hold, Macro, Red Filter, sans vidéo,
  recettes, ordre des ratios), puis les fonctions de l'amont une par une ; GR III : non-régression rapide.
- Application : vérifier dans le navigateur l'affichage des nouvelles capsules GR IV (fonctions de l'amont sur le
  Monochrome) et l'absence de Sensor Shift.
