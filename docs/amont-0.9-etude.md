# GR Mod 0.9.0 / 0.9.1 (amont, Maxwooow) : ce qui est arrivé et ce que cela implique (2026-11-24)

Lecture seule du dépôt amont (étiquettes rangées dans `refs/upstream-tags/*`, car nos propres étiquettes v0.9.x portent le
même nom). 74 commits depuis la 0.8.15 (notre fusion de la 1.1). Licence inchangée (GPL-2.0-only).

## Nouveautés, toutes pour le GR IV
| Fonction | Firmwares | Notes |
| --- | --- | --- |
| Batterie en pourcentage (pas de 10 %) | 1.11, 1.20, 1.21 | lit l'octet de charge que le sous-processeur fournit déjà ; un octet de RAM à 0x55839040 (début de la zone sbrk) |
| Grilles personnalisées (3x3, 4x4, lignes une à une) | 1.11, 1.20, 1.21 | sur 1.20 / 1.21 : valeurs en plus dans Grid Style |
| Assombrissement hors cadre des ratios ajoutés (Matte Brightness) | 1.11, 1.20, 1.21 | réglage dans le menu de l'appareil sur 1.20 / 1.21 |
| Shadow Correction, Auto appris | 1.11, 1.20, 1.21 | 100 arbres de décision (MIT-Adobe FiveK), l'Auto d'origine calcule 0 (sommes de blocs qui débordent) |
| Grain argentique à la place de Grain Effect | 1.20, 1.21 | grain luminance de plusieurs tailles, ajouté à l'encodage JPEG ; Strength / Size ne servent plus |
| Flash TTL pour le GF-2 | 1.20, 1.21 | pré-éclair des modes anti-yeux rouges mesuré dans la visée ; mot de RAM 0x55839018 |
| Balance des blancs Auto apprise | 1.20, 1.21 | état à 0x55839078 |
| Constant Light (lampe d'assistance AF allumée) | 1.20, 1.21 | mot 0x55839074 |
| Sensor Shift (décaler / tourner le capteur à la main) | 1.20, 1.21 | |
| Vidéo : AF à détection de phase, P / Av / Tv / M, 4K 30p / 24p, SR mécanique | 1.20, 1.21 | sans objet pour nous sur le Monochrome sans vidéo |

Rien de nouveau pour le GR III / IIIx, hormis un programme unique pour 2.10 / 1.60, 2.20 / 1.70 et 2.21 / 1.71.
L'amont ne trie pas non plus les ratios d'usine du GR IV (`FACTORY_ORDER` fixe).

## Conséquences pour GR Mod Film
- **Réorganisation du code** : le GR IV 1.21 n'est plus une copie mais le programme 1.20 avec une table d'adresses (1733
  adresses, `fw/gr4v121/addresses.ts`). Nos ajouts vivent dans la copie 1.21 (`holdbuttons.ts`, `slots.ts`, recettes
  Monochrome, `nomovie.ts`...). Une fusion demandera de les porter sur le programme 1.20 avec la table : chantier réel.
- **Conflit de RAM à éviter** (même famille que le gel corrigé en 1.3.4) : nos boutons Hold utilisent 0x55839014 et
  0x55839018. Le Flash TTL de l'amont prend 0x55839018. Les deux ensemble écraseraient le même mot. L'amont étend aussi la
  remise à zéro du démarrage jusqu'à 0x55839080 et place la batterie à 0x55839040. Avant toute fusion : refaire la carte
  des mots 0x55839014..0x5583907F et déplacer les nôtres si besoin, avec la sonde `hold_gap_probe.py`.
- Vérifié en passant : dans nos builds 1.3.4, 0x55839014 sert aussi aux compteurs HDR, mais seulement dans les builds de
  diagnostic (`hdrDiag`) ; aucun conflit dans les firmwares livrés.
- Intérêt pour le Monochrome : batterie, grilles, Matte Brightness, Shadow Correction apprise, grain, Flash TTL. Sans objet :
  balance des blancs apprise (pas de couleur), fonctions vidéo (vidéo retirée).

## Batterie en pourcentage, portée dans GR Mod Film 1.3.5 (2026-11-25)
- Source : `core/src/fw/gr4v120/aspect/battery.ts` de GR Mod 0.9.1 (Maxwooow ; l'original 1.11 de dgmaia, PR #37 de
  l'amont), recopié dans `core/src/fw/gr4v121/aspect/battery.ts` avec les adresses 1.21 de la table de l'amont, chacune
  vérifiée dans l'image officielle 1.21 : GetBatteryIcon 0x533AA150 (commence par `cmp r1,#1 ; mov ip,sp`), service lu
  par 0x537A4118 (garde 0x5537EFC4, objet 0x5537EEA0), copie du rapport 0x537A7938 (+0xAC, +0x5C, rapport en +4).
  Le reste est le code de l'amont, inchangé. Icônes 1100..1111 (libres chez nous).
- Mémoire : un octet à 0x55839040 (début de la zone sbrk, inutilisée par le firmware) ; la remise à zéro du démarrage est
  étendue jusqu'à 0x55839080, en tout dernier (notre module des images d'extinction attend la fin de remise à zéro à
  0x55839014 ou 0x55839040). Aucun recouvrement avec nos mots (Hold 0x55839014 / 18, HDR 0x5583901C, look 0x55839024 / 34 /
  38, halation 0x55839028 / 2C). `hold_gap_probe.py` sur un build avec batterie : mots intacts.
- Option `batteryPercent` (programme, moteur, enregistrement : bit 1 du 3e octet de fonctions), interrupteur « Battery
  percentage » sur la page Features (GR IV 1.21 / Monochrome 1.11 seulement), coupé par défaut.
- Tests : `core/test/gr4-battery.test.ts` (3, dont la relecture avec le tri des ratios). Émulateur :
  `tools/gr4v121/battery_probe.py` (écrit pour GR Mod Film, modèle des règles) : 20 000 appels au hasard plus 40 journées
  simulées (charge qui baisse par à-coups), 36 147 appels conformes (icône, ou code de l'appareil avec registres et drapeaux
  intacts, palier affiché retenu), pas d'oscillation du chiffre. Navigateur : interrupteur, firmware téléchargé relu, vérifié.
- Reste : test sur le boîtier (avec les grilles, un seul flash).
