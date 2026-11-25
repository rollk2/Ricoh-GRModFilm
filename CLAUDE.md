# CLAUDE.md

Fork de GR Mod pour développer un « mode pellicule » sur Ricoh GR III, firmware 2.10
(le GR IIIx 1.60 partage les mêmes adresses).

**Lire d'abord `CAHIER_DES_CHARGES.md` à la racine** : projet, règles décidées, briques techniques
(dont les adresses fournies par Maxwooow), plan par phases. Les découvertes sont consignées dans
`docs/film-mode-notes.md`.

Code de référence : `core/src/fw/gr3x`, en particulier `jpeg-stage.ts`, `datestamp.ts`, `guard.ts`,
`adj-softfocus.ts`, `experimental.ts`, `films-r10.ts`. Les sondes d'émulation (Unicorn) sont dans
`tools/gr3x/*_probe.py`.

## Profil de l'utilisateur

Architecte data, à l'aise avec la technique, débutant en reverse engineering et en embarqué ARM.
Expliquer la démarche, les termes nouveaux et ce qui est fait, sans noyer.

## Règles de travail

1. Ce fichier reprend les règles et pointe vers le cahier des charges ; le tenir à jour.
2. Travailler sur une branche dédiée au mode pellicule, jamais directement sur `main`.
   Ne pousser sur GitHub qu'après accord explicite de l'utilisateur.
3. Avancer étape par étape : proposer un plan, attendre le feu vert avant chaque étape importante.
4. Consigner chaque découverte (adresse, fonction, preuve, niveau de certitude) dans
   `docs/film-mode-notes.md`, et mettre à jour le tableau des briques du cahier des charges.
5. Tout changement doit être vérifié par les tests et l'émulateur avant que l'utilisateur flashe.
   Dire clairement quand un build est prêt à être testé sur le boîtier, et ce qu'il faut vérifier.
6. Répondre en français. Ne jamais utiliser de tiret cadratin ni de tiret demi-cadratin.

## Environnement

- Firmwares officiels : `core/testdata/private`, variables `GRMOD_GR3_FIRMWARE` (fwdc239b.bin, 2.10)
  et `GRMOD_GR3X_FIRMWARE` (fwdc243b.bin, 1.60). Ils ne sont pas dans le dépôt : les tests qui en
  dépendent sont sautés sans eux.
- Tests : `npm test`. Application : `shell/build.sh mac`.
- Depuis la 1.1 (fusion de GR Mod 0.8.15) : variables `GRMOD_GR4_120_FIRMWARE` et `GRMOD_GR4_121_FIRMWARE`
  (GR IV 1.20 / 1.21 = GR IV Monochrome 1.10 / 1.11, `fwdc248b.bin`), `GRMOD_GR3_221_FIRMWARE`,
  `GRMOD_GR3X_171_FIRMWARE`, etc. Le mode pellicule reste sur les programmes 2.10 / 1.60 (`core/src/fw/gr3x`) ;
  les portages de l'amont sont dans `core/src/fw/gr3x170`, `gr3x171`, `gr4v120`, `gr4v121`.
- Depuis la convergence avec GR Mod 0.9.1 (`docs/fusion-0.9.md`, branche `fusion-0.9`) : un dossier de firmware est son
  programme de base avec ses propres fichiers par-dessus (`core/overlays.mjs`), donc les scripts hors Vitest passent par
  `npx vite-node` (esbuild ne résout pas la superposition). L'application est découpée : `ui/src/store/*.ts` (nos parties
  dans `store/film.ts` et `store/community.ts`), `ui/src/pages/*.tsx`, textes dans `ui/src/locales/*` plus notre bloc
  `filmZh` / `filmEn` de `ui/src/i18n.ts`. Contrôles de l'amont : `npm run check`. Notre copie 1.21 (`fw/gr4v121`) est
  gardée entière jusqu'à l'étape 2.
- Bogues de la campagne V1 : `docs/V1-TESTS.md` (protocole) et `docs/V1-BUGS.md` (bogues collectés, tests de
  vérification faits à la fin, décision du 2026-11-15).
- Site web (sans le programme) : `cd ui && npx vite build --mode web` ; accès aux fichiers du navigateur dans
  `ui/src/webhost.ts` (dossier choisi sous Chrome et Edge, téléchargement ailleurs), zip Ricoh lu par `ui/src/zip.ts`.
