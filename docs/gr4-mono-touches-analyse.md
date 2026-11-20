# GR IV Monochrome 1.11 : fonctions et touches, analyse (2026-11-20)

Source : firmware officiel 1.11 (`fwdc248b.bin`, SHA-256 `bf4d6c35f6da1c16...`), lecture statique et émulation. Les textes viennent de
la fonction de texte des fonctions Fn `0x5339045c` et de la ligne anglaise du tableau de textes (RAM `0x55003cf4`).

## 1. Les listes de fonctions des touches (certitude forte)

Trois listes d'octets, filtrées par `0x531d7be0` (voir `film-mode-notes.md`) :
- **A** (`0x53de6764`, 39 numéros) : Fn, gauche, droite, bas, Wireless court (à confirmer par émulation du dessin) ;
- **B** (`0x53de67fc`, 35) : Wireless long (probable) ;
- **C** (`0x53de695c`, 37) : Focus (probable).

| N° | Fonction | A | B | C |
|---|---|---|---|---|
| 0 | Off | x | x | x |
| 1-4 | Focus, Set MF, Set Snap, Set Tracking AF | x | x | x |
| 5, 6, 7 | Enable AF, AF+AE Lock, AE Lock | x | | |
| 8-12 | Face/Eye Detection, Focus Limiter, Snap Focus Distance, Switch Record Memory, File Format | x | x | x |
| 13-17 | JPEG → RAW, JPEG → RAW+, Aspect Ratio, Crop, JPEG Recorded Pixels | x | x | x |
| 18, 19 | Framerate, Still/Movie (retirées par « No movie ») | x | x | x |
| 20-22 | AE Metering, ISO Setting, Flash Mode | x | x | x |
| **23** | **Flash Exposure Comp.** | | | |
| 24-32 | Flash Output, ND Filter, Drive Mode, Drive, Continuous Shooting, Self-timer, White Balance, Image Control, Shake Reduction | x | x | x |
| 33 | One Push AE in M Mode | x | | |
| 34-36 | 4-way Controller Action, Outdoor View Setting, Enable Sleep Mode | x | x | x |
| 37 | Airplane Mode | | | x |
| 38 | (texte absent, filtre propre à la touche Focus ?) | | | x |
| 43-45 | Touch AF, HDF, Red Filter | x | x | x |
| 39-42 | numéros sans texte : inutilisés | | | |

**Correction (2026-11-20, remarque de l'utilisateur)** : `fwdc248b.bin` est le firmware commun au GR IV, au GR IV HDF et au GR IV
Monochrome ; le tableau ci-dessus est donc la liste **statique** de tout le fichier, pas ce que le Mono affiche. Le filtre
`0x531d7be0` retire à l'exécution les fonctions d'un autre modèle : **25 ND Filter**, **30 White Balance** (test explicite « Mono »
`0x5340171c` : cachée sur le Mono), **44 HDF** et **45 Red Filter** (test d'une classe de modèle, `0x533f26e4` valant 0, 1, 2).
Le schéma (ND, HDF, Red Filter, une classe chacun) va dans le sens de la remarque : ND et HDF n'existent pas sur le Mono, Red Filter
y remplace le ND. Non vérifié par émulation (la classe lue dépend de l'état du boîtier) : la liste réellement affichée sera relevée sur le boîtier.
Les analyses des sections 2 et 3 sont à relire avec la même réserve (ND Filter, HDF, White Balance ne concernent pas le Mono).

Constats :
- **Flash Exposure Comp. (23) n'est dans aucune liste de touche** alors que la fonction existe (elle est dans la liste ADJ).
- **Enable AF, AF+AE Lock, AE Lock, One Push AE (5, 6, 7, 33)** ne sont proposées qu'aux listes A : pas au Wireless long ni à Focus
  (sur le GR III, ces quatre étaient aussi exclues des listes Wireless : le gestionnaire de ces touches ne sait pas les exécuter,
  à ne pas ouvrir sans le lire).
- **Airplane Mode (37)** n'est proposée que sur la liste C.
- Aucune touche n'a de ligne **appui long** (Hold), sauf le Wireless (court + long) ; AE Lock Hold et One Push AE ont leurs propres réglages.

## 2. Le levier ADJ (certitude moyenne, fonction de texte émulée)

Fonctions ADJ 0 à 20 : Off, Focus, Focus Limiter, Snap Focus Distance, File Format, Aspect Ratio, JPEG Recorded Pixels, AE Metering,
ISO Setting, Flash Mode, Flash Exposure Comp., Flash Output, Drive, Self-timer, White Balance, Image Control, One Push AE in M Mode,
Outdoor View Setting, Framerate, Crop, Touch AF (GR Mod ajoute 0x15 Exposure Preview et le flou).

Fonctions des touches **absentes de l'ADJ** : Set MF, Set Snap, Set Tracking AF, Enable AF, AF+AE Lock, AE Lock, Face/Eye Detection,
Switch Record Memory, JPEG → RAW, JPEG → RAW+, ND Filter, Drive Mode, Continuous Shooting, Shake Reduction, 4-way Controller Action,
Enable Sleep Mode, Airplane Mode, HDF, Red Filter, (Still/Movie).
Fonctions de l'ADJ **absentes des touches** : Flash Exposure Comp. (23).
**Framerate** est dans l'ADJ (inutile sans vidéo : à retirer comme les autres).

## 3. Réglages de l'appareil sans aucune affectation (probable)

D'après les cases de Mode Memory et la liste des réglages (`CustomModeMemory*`) : **Low Pass Selector** (filtre anti-moiré), **Focus Assist**
(aide à la mise au point), **Capture Disp Info / Playback Disp Info** (affichages), **Program Auto Ex** (décalage du programme),
**Macro Mode**, ainsi que D-Range Correction, Peripheral Illumination Correction, Noise Reduction / High ISO NR, Slow Shutter NR,
Grille, niveau électronique, histogramme, Interval Shooting. À vérifier un par un : leur numéro de fonction n'existe pas dans la table
des touches, il faudrait en créer (texte, icône, exécution).

## 4. Touches matérielles (certitude moyenne)

Réglables : Fn, gauche, droite, bas, Wireless (court, long), Focus, AE Lock (maintien), One Push AE (M). **Haut = Macro** : pas de
réglage `CustomSwitchUp` (touche non réglable). Pas de molette arrière sur le Mono. Pas d'appui long sauf Wireless.

## 5. Ce que « tout à toutes les touches » demande

1. Unifier A, B, C (ajouter 23, 37, 5/6/7/33 là où le gestionnaire le permet) : peu de code (listes), mais chaque ajout doit être exécuté
   par le gestionnaire de la touche (table de sauts de l'équivalent de `GetEventCustomize` / `GetEventSwitchWlan`, assertion hors table) : à lire.
2. Étendre l'ADJ : chaque fonction ajoutée demande son texte, son icône, sa branche dans `SlotFunction` et dans l'exécution (le travail
   d'`adjslots` et d'`exposure` de GR Mod) ; faisable fonction par fonction.
3. Nouvelles fonctions (section 3) : texte, icône, exécution (ce que le mode pellicule a fait pour Film Advance sur GR III).
4. Touche haut et appuis longs : codes de touches (build de diagnostic), puis lignes Hold.
