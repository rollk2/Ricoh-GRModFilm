# Mode pellicule pour Ricoh GR III / GR IIIx

Fork de [GR Mod](https://github.com/Maxwooow/Ricoh-GRMod) (GPL-2.0-only).
Cibles : GR III firmware 2.10, GR IIIx firmware 1.60. Selon l'auteur de GR Mod, c'est le même programme avec les mêmes adresses : tout ce qui est développé fonctionne sur les deux boîtiers.

## Objectif

Retrouver la discipline de l'argentique sur un GR : on charge une pellicule (un film et un format), puis on ne peut plus y toucher jusqu'à la fin du rouleau. Chaque vue s'arme en avançant le film. Sans avance, les déclenchements se superposent sur la même vue.

## Principes de conception

- Réutiliser au maximum les fonctions natives du GR plutôt que de créer de nouvelles interfaces.
- Le choix du film et du format se fait avec les menus normaux, puis s'enregistre dans une BOX avec Save Settings (natif).
- **Une BOX = un rouleau.** Une ligne de menu « Film Roll Mode : On / Off » (Customize Settings, sous Save Settings ; nom traduit dans les 21 langues du boîtier) est enregistrée dans la BOX avec les autres réglages.
- Le verrou s'appuie sur celui que le GR applique déjà pendant une multi-exposition.
- Chaque mode U (U1, U2, U3) rappelle sa BOX : si elle a le mode pellicule sur On, c'est un boîtier indépendant avec sa propre pellicule ; sinon, une BOX normale.
- P, Av, Tv, M (et les autres positions de la molette) restent toujours en mode libre : jamais de pellicule, aucun effet du mod sur leurs dossiers.

## Cycle de vie d'un rouleau

1. **Préparer** : régler l'Image Control (le film), le ratio (le format) et le reste avec les menus natifs, mettre « Film Roll Mode » sur On (menu Customize Settings, sous Save Settings), puis faire Save Settings dans une BOX. La ligne n'apparaît pas en P, Av, Tv, M (masquée ; grisée si le mécanisme est trouvé).
2. **Démarrer** : le rouleau démarre à la **première vue** prise dans un mode U dont la BOX a le mode pellicule sur On. Aucune action de menu. Le firmware crée alors le dossier du rouleau, force Save Interim Images à Off et le mode d'entraînement en multi-exposition (au rappel du mode U), et verrouille les réglages.
3. **Photographier** : le GR reste en multi-exposition pendant tout le rouleau.
   - Déclencheur : prend la photo. Si la vue n'a pas été avancée, la photo se superpose à la précédente (équivaut à « Next shot »).
   - Touche réglée sur « Film Advance » (Fn Button Settings, par exemple la touche droite / Drive) : avance le film (équivaut à « Complete »). La vue est enregistrée, le compteur passe à la vue suivante. Sans vue prise, rien. À venir : plus d'écran Next / Retake / Complete après chaque vue, et Retake par un appui long sur cette touche.
4. **Fin du rouleau** : à la dernière vue avancée, le rouleau est terminé. Idéal visé : un **message de fin de rouleau** qui propose de changer de pellicule (réglages de la BOX). À défaut, la vue suivante démarre **automatiquement un nouveau rouleau** (nouveau dossier, compteur à 1), avec les mêmes réglages de BOX.
5. **Suspendre** : mettre « Film Roll Mode » sur Off sans Save Settings suspend le mode pellicule dans ce mode U ; le rouleau est gardé et reprend quand la BOX (toujours sur On) est rappelée (décision du 2026-10-28).
6. **Rembobiner** : Save Settings par-dessus la BOX d'un rouleau entamé termine le rouleau ; si la nouvelle BOX a le mode pellicule sur On, un nouveau rouleau démarre à la première vue. Un moyen de rembobiner à la main reste à définir.

Pour des photos normales, on passe en P, Av, Tv ou M, jamais touchés par le mod.

## Règles

### Compteur
- Il affiche le numéro de la vue à prendre, comme sur un argentique : 1 après le chargement, puis 2, 3...
- Il s'incrémente à chaque avance du film (« Complete »), pas au déclenchement.
- Éteindre l'appareil en cours de surimpression enregistre la vue (comportement natif) : cela compte comme une avance.
- Affichage à l'écran : on réutilise le compteur de vues restantes de la carte (en haut à droite), qui affiche **vue / total** pendant un rouleau (exemple : `12/36`), le total selon le format.
- Rien n'est incrusté sur la photo (décision du 2026-10-28).

### Longueur du rouleau selon le format
| Ratio | Équivalent | Vues |
|---|---|---|
| 3:2 | 35 mm plein format | 36 |
| 3:4 vertical | Demi-format (18 x 24 mm, cadrage environ 40 mm) | 72 |
| 65:24 | XPan | 21 |
| 4:3 | Moyen format 6x4,5 | 15 |
| 1:1 | Moyen format 6x6 | 12 |

La longueur se déduit du ratio mémorisé : aucune donnée supplémentaire à stocker.
Le ratio 3:4 vertical (3000 x 4000, recadrage central) est à ajouter.

### Clôture au lieu du verrou (décision du 2026-10-31)
Pas de verrou des menus. Changer l'Image Control ou le format pendant un rouleau **clôt** le rouleau (validé sur le boîtier avec `T16-CLO4` : contrôle à la sortie du menu et au retour sur le mode U, message « Nouvelle pellicule chargée. ») : la vue suivante démarre un nouveau rouleau, dans un nouveau dossier (nom et longueur suivent les nouveaux réglages). Le reste des réglages reste libre. Le format JPEG n'est pas imposé (décision du 2026-10-31).

### Rembobiner (décision du 2026-10-31)
Une ligne « Rembobiner » sous Save Settings (Customize Settings), avec un écran de confirmation Oui / Non ; Oui clôt le rouleau du mode U actif.

### Verrou pendant un rouleau (abandonné le 2026-10-31, gardé pour mémoire)
Réglages bloqués : Image Control, ratio, recadrage, format de fichier (JPEG seul ; **à étudier** : imposer le JPEG au démarrage du rouleau, comme Save Interim Images, sachant que la multi-exposition native accepte le RAW : superposition finale en DNG constatée le 2026-10-27), taille JPEG, balance des blancs, mode de déclenchement (multi-exposition), Save Interim Images (forcé à Off au chargement).
C'est exactement la liste que le GR bloque nativement pendant une multi-exposition (manuel p. 78). Le verrou consiste à étendre cette condition native : « multi-exposition en cours OU rouleau chargé ». **Constat (2026-10-27) :** ouvrir le MENU pendant une multi-exposition termine la séquence (comme Complete) ; le menu principal n'a donc pas de verrou natif et devra être verrouillé par le mod pendant un rouleau.

### Stockage
- Un dossier par rouleau, créé au démarrage du rouleau (première vue). Méthode testée : nom sur 5 caractères puis demande de nouveau dossier, ou numéro imposé à `SetFilePath` (un dossier imposé qui n'existe pas est créé).
- L'état du rouleau (mode pellicule, rouleau entamé, numéro de vue, numéro de dossier) est rangé dans des octets libres de l'enregistrement des réglages : il suit la BOX (Save Settings, rappel par U1 à U3).
- Nom du dossier (décision du 2026-10-31) : `NNN` (numéro attribué par le boîtier) + code de l'Image Control sur 3 caractères + longueur du rouleau sur 2 chiffres, par exemple `112NEG36`, `113POS12`, `114MON21`. Codes des Image Control d'origine : STD, VIV, MON, SMO (Soft Monotone), HMO (Hard Monotone), HCB (Hi-Contrast B&W), POS, BLB (Bleach Bypass), RET, HDR, CRP (Cross Processing), NEG. Films ajoutés par GR Mod : un code fixé par film, demandé à l'utilisateur dans l'application GR Mod à l'ajout du film. **Validé sur le boîtier (`T14-DIR1`, dossier `137NEG36`).**
- Chaque mode U mémorise le numéro de son dossier. En revenant sur un mode U, ses photos repartent dans son dossier.

### Modes U
- Seuls U1, U2 et U3 peuvent porter un rouleau, quand leur BOX a le mode pellicule sur On. Chacun a sa pellicule, son compteur et son dossier.
- P, Av, Tv, M restent libres : le boîtier y gère ses dossiers comme d'origine.
- Passer d'un mode U à l'autre ne perd rien : chaque rouleau reprend où il en était.

### Cas particuliers
- Carte changée ou dossier supprimé en cours de rouleau : le rouleau est considéré comme perdu (pellicule voilée) ; le compteur repart à 1 dans un nouveau dossier (décision du 2026-10-31).
- Le mod doit rester maintenable avec GR Mod : code organisé comme les autres fonctions de GR Mod, réglable depuis son application, sans les sondes des builds de test, et facile à fusionner avec les évolutions de GR Mod.

## Réglages natifs recommandés
- Multi-exposition, mode de composition **Additif** (accumulation de lumière, comme le film). Comme en argentique, sous-exposer d'environ 1 IL pour une double exposition.
- **Save Interim Images : Off**, imposé par le mod au chargement (décision du 2026-10-27). Seule l'image finale est enregistrée, au moment de « Complete » (vérifié sur le boîtier). Avec On, le boîtier isole nativement la séquence dans un nouveau dossier, avant et après (testé) : avec un dossier de rouleau imposé, la photo suivante dans un mode libre partirait dans un nouveau dossier.

## Briques techniques

Sources : code de GR Mod (`core/src/fw/gr3x`) et réponse de son auteur, Maxwooow, sur l'issue GitHub. Adresses valables pour GR III 2.10 et GR IIIx 1.60.

| Brique | État | Détails |
|---|---|---|
| Hook à chaque image encodée | Connu, testé | Début de `JpegEncodeMacroProcess::Execute` (`0x535047d4`). `jpeg-stage.ts` y enchaîne les modules (halation puis date). |
| Incrustation sur la photo | Connue, testée | `datestamp.ts` (module C de `tools/datestamp/datestamp.c`, compilé pour GR III) |
| Objet des réglages | Connu | `UserDataModel` à `0x55063f30`. Enregistrement en cours à +4 (`*0x55063f34`), enregistrements stockés (modes, U1 à U3) de +8 à +0x20, chacun de `0xb28` octets, sauvegardés et chargés en bloc. |
| Sauvegarde des réglages | Connue, testée | Uniquement à l'extinction (`0x5323f274`, appelée en fin de `0x5322b0a8`). **La veille automatique ne sauvegarde pas**, le retrait de batterie non plus : le mode pellicule devra sauvegarder lui-même. |
| Rappel d'un mode U | Connu | Copie de l'enregistrement stocké vers celui en cours (memcpy à `0x5327a004`, `0xb26` octets) |
| Film du réglage photo n | Connu | Offset `+0x1c2 + 2n`. Fonctions de modification : `0x5327b394`, `0x5327b3b4`, `0x5327b3d4` (vidéo à partir de `0x5327b54c`, voir `films-r10.ts`) |
| Ratio | Connu | Offset `+0x4c2`. Lecture `0x53245260`, modification `0x532525a4` (voir `experimental.ts`) |
| Garde-fou des réglages | Connu | `guard.ts` s'accroche au chargement, à la sauvegarde et au rappel de mode. Bon endroit pour garder un rouleau verrouillé cohérent. |
| Ligne de menu ajoutée | Méthode connue | `datestamp.ts` documente l'ajout de la ligne Date Imprint et de son sous-menu (identifiants de contrôleurs, listes, textes, icônes). « Charger la pellicule » suivra le même modèle. |
| Octet de stockage du rouleau | Testé sur le boîtier | Persistants après extinction, propres à chaque mode (build `T10-FILMPROBE`, 2026-10-27). `0x9b1`, `0x9b2`, `0x9b3` : bourrage après le drapeau `0x9b0`, même situation que `0x9a9` à `0x9ab` (GR Mod, testés). Aucun accès du firmware officiel, mis à 0 par les valeurs d'usine, copiés en bloc (chargement, sauvegarde, modes U). Identique sur GR IIIx. Preuves : `docs/film-mode-notes.md`, sonde `tools/gr3x/settings_layout_probe.py`. Réserve : `0x905` à `0x907`. |
| Carte des champs de l'enregistrement | Connue (émulée) | Fusion avec les valeurs d'usine `0x53246df8` : 1043 champs { valeur ; drapeau }, 253 octets de bourrage. Valeurs d'usine `0x5323f424`. |
| Mode U actif, enregistrer dans un mode U | Connus (statique) | Numéro du mode actif : octet pointé par `*UserDataModel`. Enregistrer dans le mode n : `0x5324b760`. Le rappel (`0x53279fa8`) ne sauvegarde que le mode 0 avant de changer. |
| BOX de réglages (Save Settings, BOX1 à BOX6) | Comprises (testé) | Copies stockées 1 à 6 de l'objet des réglages = BOX1 à BOX6 ; copie 0 = réglages du boîtier. U1, U2, U3 rappellent chacune une BOX (testé : U1 = BOX3, U2 = BOX2, U3 = BOX5). Octet du mode actif = numéro de BOX. Le rappel d'une BOX par le menu la recopie dans les réglages du boîtier, état du rouleau compris. Demande : un rouleau par BOX, et passer à 20 BOX (chantier important : objet, stockage, menus). |
| Détection d'une prise de vue | Testée sur le boîtier | `SetShootingInfoResultBeforeExpose` (`0x534322d8`), appelée par `StartStillExpopsureProcess` uniquement pour une exposition de type 1 (photo) : pas pour la dark frame de la réduction du bruit, ni pour la calibration, ni pour le développement RAW. Déjà accrochée par GR Mod (orientation). Testé (`T10-FILMPROBE2`) : +1 par photo, +3 pour une multi-exposition de 3 vues, +0 au développement RAW, +1 pour une pose longue. Encodeur exclu (testé : développement RAW +1, multi-exposition 2 encodages par vue). Détails : `docs/film-mode-notes.md`. |
| Condition de verrou en multi-exposition | État testé, sites à trier | Octet d'état `+0x6c0` de l'enregistrement de prise de vue en direct (lecture `0x535493ac`, écriture `0x5354700c`). Testé (`T10-FILMPROBE3`) : 2 pendant une multi-exposition, 0 sinon. Le verrou natif teste « état == 2 » (18 sites `cmp r0,#2`, dont la disponibilité des fonctions ADJ `0x531a4d38`). À trier : sites d'interface et de traitement. |
| Dialogue Next shot / Retake shot / Complete et ses touches | En grande partie connu (statique) | Événements d'interface 0xb8 (fin) et 0xb7 (Retake) ; actions `0x532270f4` / `0x532270d4` ; modèle `0x5323a080` / `0x5323a1a4` (si état 2) ; commandes `0x42411c16` / `0x42411817` (`CMD_SHOOTING_MULTI_EXPOSURE_END` / `RETAKE`). Le dialogue est l'aperçu après la vue (`QuickViewController`, table de touches `0x53b41344`). Reste : identifier les touches et les neuf émetteurs de 0xb8. |
| Événement « Complete » | Testé sur le boîtier | `0x5346a910` (message `0x42411c16`) : une fois par fin de séquence, que ce soit Complete, une extinction ou un changement de mode (testé). Après l'encodage de l'image finale pour Complete. Retake : `0x5346a8d8` (message `0x42411817`, testé). |
| Fonction du compteur de vues restantes | Testée sur le boîtier | Getter `0x53239e34` (`+0x3c` du modèle de prise de vue), un seul appelant : texte `0x532aa1d4` → `0x532aa140` (`%d`, tampon de 6 caractères), affiché par `LiveViewController`. Substitution en `0x532aa1f4` testée (`T10-FILMPROBE5` : l'écran affiche le nombre choisi, le déclenchement n'est pas gêné). |
| Fonction de création de dossier et nom sur 5 caractères | Testées sur le boîtier | **Nom natif de 5 caractères** dans les réglages : `+0x936` (setter `0x5326caa0`, global), type de nom `+0x934` (setter `0x53258604`, 1 = nom libre). « Create New Folder » = drapeau : `0x5358515c(0x53584c74(), 1)` ; le dossier `NNNXXXXX` est créé à l'enregistrement suivant, image superposée comprise (testé, `T10-FILMPROBE5`). |
| Variable du dossier en cours et écriture dans un ancien dossier | Lecture et écriture testées (`T10-FILMPROBE6` à `8`) ; effet de bord expliqué (vues intermédiaires, réglé par Save Interim Images Off) | Pas de variable « dossier en cours » : le boîtier vise toujours le plus grand dossier. Mais `SetFilePath` `0x535b2e8c` prend le numéro de dossier fourni dans son argument chemin (demi-mot `+4`) s'il n'est pas 0, sans rien créer si le dossier existe. Base des dossiers `[[service+8]+8]` : table `+0x10`, plus petit `+0x28`, plus grand `+0x2a`. |
| Save Interim Images | Trouvé (statique, libellés relevés) | Octet `+0x482` de l'enregistrement (champ de BOX) : 0 Off, 1 Unblended, 2 Blended, 3 Unblended + Blended. Getter `0x532451d0`, setter `0x53262990(UserDataModel, valeur)`. |
| État du rouleau, compteur, sauvegarde immédiate | Testés sur le boîtier (`T11-ROLL1`) | `film-roll.ts` : démarrage à la première vue en U, avance à chaque fin de séquence, écriture immédiate des fichiers `APData` (`0x53826c54`, index 1 et mode + 2 ; survit au retrait de la batterie), Save Settings rembobine, Save Interim Images à Off au rappel. |
| Dossier du rouleau | Testé sur le boîtier (`T11-ROLL2D`) | Crochet de `SetFilePath` : premier fichier d'un rouleau dans le prochain nouveau dossier (`0x535b742c`), mémorisé dans la BOX, puis retour dans ce dossier ; P ouvre son propre dossier quand le plus grand est celui d'un rouleau. |
| Compteur vue/total à l'écran, multi-exposition imposée | Testés sur le boîtier (`T11-ROLL3`) | Le crochet du compteur écrit `vue/total` par `snprintf` (`0x53141100`, format `"%d/%d"` du firmware `0x53c0ca59`) ; mode d'entraînement `+0x472` mis à 3 (multi-exposition) au rappel d'un mode U. |
| Ligne de menu Film Roll Mode | Testée sur le boîtier (`T12-MENU1`) | Customize Settings, sous Save Settings (menu C recopié, entrée `0x5407d404`) ; masquée hors des modes U (fonction de visibilité, contrôleur reconstruit à chaque ouverture) ; bit 0 de `0x9b1`, suit la BOX ; nom en 21 langues. Griser : mécanisme non trouvé. |
| Avance du film par une touche (Film Advance) | Testée sur le boîtier (`T13-FN1`) | Fonction 42 ajoutée à Fn Button Settings (Fn, ISO, Drive, Movie/Wireless, Hold) : table des fonctions `0x53b4eb7c` recopiée, texte et icône, exécution dans `GetEventCustomize` (`0x5329bcc8`) et `GetEventSwitchWlan` (`0x5329a0a0`) : émetteur `0x531a4d80` si une vue a été prise, sinon rien. Réglage par BOX (champs `0x922` à `0x92a`). |
| Message de nouvelle pellicule | Testé sur le boîtier (`T17-MSG1`) | Écran de message du boîtier (`0x08000007`) avec notre texte, 2 s (0,5 s pendant lesquelles les demandes de fermeture sont ignorées, puis 1,5 s), fermé par OK ou ADJ enfoncé (même événement 0xd8). |
| Carte changée ou dossier supprimé | Testé sur le boîtier (`T19-CARD3`) | Dossier du rouleau absent de tous les supports (services de dossiers de l'objet `0x5535767c`) : rouleau perdu, décidé à l'avance (compteur juste aussitôt), la vue devient la 1 d'un nouveau rouleau dans un nouveau dossier ; contrôle de secours dans SetFilePath. Dossier de même numéro présent : le rouleau continue. |
| Onglet Movie Settings masqué | Testé sur le boîtier (`T20-VID1`) | Visibilité d'onglet (premier mot du descripteur `0x53b37514`) vers une fonction qui renvoie 0 ; le menu saute l'onglet, y compris en mode vidéo. Le mode vidéo lui-même reste accessible. Aucun octet gagné. |
| Mode vidéo bloqué | Testé sur le boîtier (`T20-VID2`) | Setter photo / vidéo unique `0x5327b7cc` : toute demande « vidéo » devient « photo », la touche vidéo ne fait plus rien. Lecture d'une vidéo existante non testée. |
| Lignes vidéo retirées | Testé sur le boîtier (`T20-VID3`) | Masquage par identifiant au constructeur d'onglets (`0x5319a978`, liste `GR3X_HIDDEN_LINES` : Still/Movie `0x0200006e`, Movie Edit `0x04000033`) ; fonction Fn 17 Still/Movie refusée par le filtre des listes `0x531b9410`. |
| Point vidéo clos | Testé sur le boîtier (`T20-VID4`) | Fonction Fn Framerate (16) retirée avec Still/Movie (17) ; touche latérale renommée « Wireless Button » / « Hold Wireless Btn. » (textes 0x1c1 à 0x1c4, 21 langues). Avec T20-VID1 à 3 : plus aucune trace de la vidéo dans les menus. |
| Touches WB et Macro réglables | WB testée sur le boîtier (WB-RC1) ; Macro et nouvel ordre testés sur le boîtier (WB-RC2), publiés en 0.9.2 | `wb-button.ts` : lignes « WB Button » et « Macro Button » sous Drive Button dans Fn Button Setting (octets libres `0xabb`, `0xac5`), fonctions 44 « White Balance » et 45 « Macro Mode » pour toutes les touches ; détails dans `docs/film-mode-notes.md`, « Touche WB ». |
| Intégration à GR Mod | Testée sur le boîtier (`T23b`) ; application vérifiée en développement (à reconstruire sur Mac) | Options `filmMode` (code de 4 caractères par film : fichiers sur 4, dossier sur 3), `noMovie`, et ligne Date Imprint masquée si elle ne sert qu'au mode pellicule (depuis 0.9.2, la date n'est alors plus jamais incrustée, même si elle avait été activée avant), dans `BuildOptions` ; nom chinois 底片模式 affiché correctement ; interrupteurs « Film mode » et « No movie » et champ « Film code » par film dans l'application ; recette du fichier enrichie (l'application reconnaît ses fichiers). |
| Codes de fichiers de 4 lettres, dossier unique pour P | Testé sur le boîtier (`T22-NAME2`) | Fichiers `NEGF6857.JPG` (STND, VIVD, MONO, SMON, HMON, HCBW, POSF, BLBP, RETR, HDRT, XPRO, NEGF ; FILM inconnu) ; photos des modes libres toujours dans un même dossier mémorisé (`0x906`, tous les enregistrements), recréé seulement s'il disparaît. |
| Noms de fichiers du film (NEG_6857.JPG) | Testé sur le boîtier (`T22-NAME1`) | Préfixe DCF de 4 caractères remplacé en tête de la méthode de nommage `0x535b6b28` : code du film + `_` en mode U avec Film Roll Mode sur On ; numérotation continue du boîtier conservée ; lecture normale. |
| Onglet « Mode pellicule » | Testé sur le boîtier (`T21-TAB1`) | Descripteur à nous à la place de Movie Settings (entrée `0x5407d3fc`) : titre « Mode pellicule » / « Film Mode », icônes bande de film (blanche, jaune, grise), visible en mode U seulement ; Film Roll Mode et Rembobiner y déménagent (menu C d'origine) ; 36 lignes encore libres. Icône cartouche 135 pour Film Advance. |
| Masquer des lignes de menu | Testé sur le boîtier (`T18-HIDE1`) | Le menu n'est construit qu'une fois après l'allumage : on rappelle le constructeur d'onglets `0x5319a778` à chaque ouverture (`0x53199f3c`) et on ramène la place de chaque onglet dans ses limites. Pas de mécanisme de grisé trouvé. Brique prévue pour retirer la partie vidéo du menu. |
| Ligne Rembobiner | Testée sur le boîtier (`T17-RWD3`, `T18-HIDE1`) | Réutiliser le dialogue de « Create New Folder » (`FolderCreateController`, écran `0x02000128`, boutons Exécuter / Annuler) par un nouvel identifiant `0x020001b1` et un octet de mode posé par la fabrique : question remplacée, Exécuter clôt le rouleau, texte de fin « Nouvelle pellicule chargée. ». Détails dans les notes. |
| Case « Point AF » dans Mode Memory | Testée sur le boîtier (`T24-AF2`) | Case ajoutée entre Focus et Focus Peaking (table des éléments `0x53b4d550` recopiée à 25 éléments, nom en 21 langues) ; réglage `0x905` de tous les enregistrements. Cochée (défaut) : point AF gardé ; décochée : point AF au centre à chaque allumage là où Mode Memory s'applique (P, Av, Tv, M ; U avec « Appliquer en U ») (copie des 8 octets d'usine de `+0x120` en `0x53240874`), mode de mise au point inchangé. Option `afPoint`. |
| Case « Appliquer en U » dans Mode Memory | Testée sur le boîtier (`V1-RC3`, `V1-RC4`, `V1-RC5`) | Dernière case de Mode Memory, décochée par défaut (comportement d'origine : Mode Memory ne vaut qu'en P, Av, Tv, M). Cochée : en U1 à U3, à l'allumage (aiguillage `0x5324b154`) et au rappel par la molette (crochet du garde-fou), Mode Memory complet s'applique aussi à l'enregistrement de travail ; les BOX enregistrées ne changent jamais. Dans une BOX pellicule, Image Control, Aspect Ratio et Drive sont exclus et la multi-exposition est reforcée. Still/Movie masqué avec No movie. Réglage `0x943`. Option `memoryU`. Liste de Mode Memory portée à 32 lignes possibles (le boîtier ne prépare que 24 types de vue, `0x532067dc`). |
| Grain par film (grain natif du boîtier) | Grain natif testé sur le boîtier (`T-GRAIN8b`) ; version finale `T-GRAIN9` à tester | Ligne « Grain Effect » (Off, 1, 2, 3) de l'écran des paramètres d'un film (Fn dans Image Control), gardée dans la moitié haute de l'octet Toning du film. Le grain est celui du boîtier (granulation de l'étape JPEG, comme les modes monochromes) : rapide, sur la luminance seule, trois niveaux, sans taille. Il est déclenché pour un film par `0x535131c4` (décision de la passe d'effets) et son niveau lu en `0x535031b0`. Chaque photo garde son réglage : le mot du look vient de l'enregistrement de prise de vue de la photo (configuration de l'encodeur `+0x34`, T-GRAIN7), pour la halation et la date. Option `grain`. Builds de test : `grainSoftware` (module `jpeg_grain.c`, avec la ligne Grain Size), `grainTag` (réglage imprimé sur la photo). |

### Points de vigilance (conseils de l'auteur de GR Mod)
- **Compter les captures, pas les encodages.** L'encodeur JPEG tourne aussi pour le développement RAW intégré.
- **Les réglages ne sont sauvegardés qu'à l'extinction.** Retirer la batterie sans éteindre fait perdre l'état depuis l'allumage.
- **Rouleau par mode U.** Le rappel d'un mode U recopie son enregistrement stocké dans l'enregistrement en cours. Il faut donc réécrire le compteur et l'état du rouleau aussi dans l'enregistrement stocké du mode actif, sinon ils repartent à zéro à chaque rappel.

## Plan de développement

1. **Chaîne d'outils** : compiler GR Mod, flasher un firmware maison. **Fait** : firmware maison flashé et validé sur le GR III, démarrage aussi rapide qu'avec le firmware officiel.
2. **Cartographie** : trouver les éléments « À trouver » ci-dessus. **Faite (2026-10-27)** : toutes les briques nécessaires sont trouvées, la plupart testées sur le boîtier. Restent, non bloquants : chemin exact du Complete du dialogue, verrou du menu (étape 5), 20 BOX (évolution).
3. **Cœur du rouleau sans menu** : état et sauvegarde immédiate, compteur `vue/total` à l'écran, dossier du rouleau, multi-exposition et Save Interim Images imposés au rappel. **Fait et testé (2026-10-28, `T11-ROLL1` à `T11-ROLL3`)**.
4. **Ligne de menu « Film Roll Mode » On / Off**, enregistrée dans la BOX ; Off ou Save Settings sur une BOX entamée = rembobiner. État persistant. **Fait et testé (2026-10-28, `T12-MENU1`)**.
5. **Verrou** : extension de la condition native.
6. **Multi-exposition** : déclencheur pour Next shot, touche « Film Advance » pour Complete, compteur sur Complete. **Avance testée (2026-10-30, `T13-FN1`)** ; reste : supprimer l'écran Next / Retake / Complete (**validé sur le boîtier avec `T14-DIR10`** : l'écran prend l'identité d'un aperçu de photo simple, sans boutons ; Affichage immédiat Off vaut 1 ms en mode pellicule (`T14-DIR13`), car une fermeture instantanée fait perdre les indications de la visée ; Garder reste Garder ;  ; `T13-FN2` : écran supprimé mais on reste sur l'aperçu ; `T13-FN3` : sans effet, l'aperçu fait partie de la visée ; `T13-FN4` à tester : l'écran s'ouvre puis Next shot automatique), Retake par une fonction « Reprendre photo » de Fn Button Settings sur une autre touche (décision du 2026-10-30 ; `T13-FN4` : sans effet en visée ; `T13-FN5` : appel direct sans effet ; `T13-RT1` : une vue validée ne se retire plus ; `T13-FN6` : l'image garde les vues validées ; décision : pas de Retake en mode pellicule).
7. **Dossiers** par rouleau et par mode U, compteur à l'écran.

Chaque étape suit le même cycle : test en émulateur, flash, essai sur le boîtier, retour au firmware officiel si besoin.

## Évolutions envisagées

Décisions des 2026-11-10 et 2026-11-11.

### Finitions de la v1
**Release 0.9.7 arrêtée le 2026-11-13** (préparée sous le numéro 0.9.8, publiée en 0.9.7 : décision du 2026-11-13, la 0.9.7 n'ayant jamais été publiée) (dernier correctif T-HIDE3 validé sur le boîtier). Décision du même jour : ce n'est **pas** la v1 ; on n'est pas pressé, la v1 viendra plus tard.
**Périmètre de la 0.9.7 arrêté le 2026-11-13** : rien d'autre n'y entre. Estimations faites ce jour pour plus tard : entrée 19 (ADJ à 8 réglages) moyenne, 4 à 8 builds de test ; entrée 18 (firmwares 2.20 / 1.70) grosse, 15 à 30 builds, demande les firmwares, le dépôt amont et un boîtier en 2.20 ; entrée 15 (image des réglages) très grosse, 25 à 40 builds, ou 8 à 15 en version réduite (export dans le boîtier, réapplication au flash par l'application).
1. ~~Bogue de lecture restant~~ : **abandonné le 2026-11-10** (non reproduit avec T-PLAY4d, scénarios A à N et variantes V1 à V7 justes).
2. ~~Icône SR de l'écran de prise de vue~~ : **validée sur le boîtier (T-SR3, 2026-11-10)** : la main suit la stabilisation selon la vitesse. Choix de l'icône `0x532a9ae0`, appelé en `0x53170e30`. Intégrée aux builds de l'application (option `srIcon` de la recette), pour la prochaine version.
3. ~~Uniformiser les fonctions du levier ADJ et celles des touches~~ : **fermé le 2026-11-10, rien à faire** (décision de l'utilisateur). Inventaire fait : toute fonction ADJ existe déjà sur les touches ; manquent sur l'ADJ Shake Reduction, White Balance et Macro Mode ; une seule fiche ADJ libre garantie (Framerate avec No movie). Détail dans les notes.
- Formatage de la carte : **tous les rouleaux rembobinés** dès la fin du formatage (décision du 2026-11-10 ; avant, le compteur continuait). **Validé sur le boîtier (T-FMT3)**, mis dans les builds avec le mode pellicule, pour la prochaine version.
- **Rewind Film sur un bouton** (demande du 2026-11-10) : fonction 46 de Fn Button Settings ; la question « Rewind the film? », OK rembobine, MENU ou l'attente annule. **Validé sur le boîtier (T-RWB1 à T-RWB3)**, publié en 0.9.6.
- Réorganiser les ratios (Aspect Ratio) comme les recettes d'Image Control : fait (l'application le permet déjà ; **validé sur le boîtier le 2026-11-13** : ordre du menu, cycle Fn, cadrages, ratio gardé au rallumage, verrou du rouleau). Ordre proposé du plus normal au plus excentrique : 3:2, 4:3, 1:1, 5:4, 16:9, 2:1, 3:1, 2.39:1, 65:24. Fermé.

### Mode pellicule
4. Reprendre une surimpression après extinction et rallumage (réinjection de l'image, probablement via le développement RAW intégré).
5. Vues bonus en fin de rouleau (37/36) : en réserve, pas prioritaire.

### Rendu
6. ~~Crop 40 mm~~ : **documenté et fermé le 2026-11-10.** Le crop natif est un flottant (1,25 / 1,7857 / 1,0) comparé à ces valeurs exactes en une dizaine d'endroits (un pointeur nul pour une autre valeur) : une quatrième valeur native est risquée. Voie possible si on rouvre : un format de GR Mod (cadre 3:2 réduit à 70 %, environ 11,8 Mpx). Détail dans les notes.
7. ~~Grain : taille réglable~~ : **fermé le 2026-11-10.** Le grain natif n'a qu'une intensité (aucun paramètre de taille) ; le grain logiciel (avec Taille) reste écarté pour sa lenteur.
8. Filtres argentiques : fuites de lumière et pellicule périmée (l'halation existe déjà).

### V2
9. Développement dans l'appareil : diptyque, date au tirage et planche contact, en portant sur le boîtier le moteur déjà validé sur PC (`tools/develop`). Dépend du décodeur JPEG (décision D3 de `docs/ARCHITECTURE.md`).
10. Dust removal et carte des poussières (décision du 2026-11-10) : **un menu** qui affiche la carte des poussières (point 11), puis lance un dust removal. Le nettoyage manuel natif passe par `0x532ae708(modèle, 1)`, comme le menu du boîtier, sans jamais modifier la fréquence ni l'amplitude de l'ultrason. Le nettoyage à la rentrée de l'objectif existe déjà (option native « à l'extinction »).
11. Carte des poussières, sur le modèle du Dust Alert des reflex Pentax : photographier une surface claire à f/16 et afficher les taches détectées, avant le dust removal du point 10 et pour vérifier son effet. Demande l'analyse d'une image dans le boîtier (avec le décodeur JPEG de la V2).
25. Gain map HDR dans les JPEG (Ultra HDR, norme ISO 21496-1, décision du 2026-11-11). Le JPEG garde l'image normale et embarque une carte de gain : sur un écran HDR (téléphones et Mac récents, Chrome), les hautes lumières brillent au-delà du blanc normal ; ailleurs, le JPEG s'affiche comme d'habitude. Source : Maxwooow, GR Mod 0.8.9 et 0.8.10 (GR IV 1.11 et 1.20 : carte calculée depuis la photo finie, gain plafonné à 1,2 diaphragme). Sur GR III : interrupteur par film ou par BOX, désactivé par défaut. Étudier l'interaction avec l'halation (la lueur pourrait profiter de la marge HDR) et avec le développement dans l'appareil (entrée 9 : la carte devrait être calculée au tirage, après le grain et la date).

### Après la v1 stabilisée (ambitieux, à étudier)
12. Améliorer l'autofocus en basse lumière.
13. Améliorer l'autonomie de la batterie.

### Nouvelles fonctions
Décisions des 2026-11-10 et 2026-11-11.

14. Obturation électronique à 1/8000e de seconde. Objectif : grande ouverture en plein soleil sans filtre ND. L'obturateur mécanique du GR III plafonne à 1/4000e. À étudier d'abord : chercher dans le firmware un mode de lecture rapide du capteur déjà existant (aperçu, vidéo) plutôt que d'écrire un pilote ; mesurer le rolling shutter et les bandes sous éclairage artificiel ; décider entre bascule automatique au-delà de 1/4000e ou mode séparé ; rester cohérent avec la vitesse plancher du SR (0.9.4). Pas de flash en électronique. Chantier ambitieux, réservé à une session Fable.

15. Image des réglages : export, import et flash avec réglages. **Version suivante (0.9.8), dernière itération avant la v1.0 (décisions du 2026-11-13)** : un seul fichier sur la carte (« Save » le remplace, « Load » le relit, pas d'écran de choix) ; au chargement, tout est réappliqué (BOX, P/Av/Tv/M, réglages généraux), les rouleaux rembobinés comme après un formatage ; dans GR Mod Film, le fichier est ouvert, son contenu montré, et il est appliqué une fois au premier allumage après le flash (pas d'édition des valeurs). Le choix des blocs et les exports multiples restent pour plus tard. Plan : recherche, T-SET1 (export), T-SET2 (import dans le boîtier), T-SET3 (application), RC. **Fait** : T-SET1 et T-SET2 validés sur le boîtier ; T-SET3 en voie A (décision du 2026-11-13) : l'application ouvre et contrôle `GRFILM.SET` et le copie à la racine de la carte (seul ou avec le firmware), le chargement se faisant dans le boîtier (Load Settings from Card) ; pas d'application automatique au premier allumage.

    Principe : un fichier « image des réglages » est une copie complète et fidèle de tous les réglages du boîtier à un instant donné. Il peut être réappliqué en tout ou en partie, depuis le boîtier ou depuis l'application au moment de construire le firmware.

    Contenu, découpé en blocs sélectionnables :
    - Une BOX par bloc : U1, U2, U3, chacune avec tout ce qu'elle mémorise (film, format, réglages de prise de vue, seuil SR, Film Roll Mode).
    - Les modes P, Av, Tv, M. À vérifier dans le firmware : ont-ils chacun leurs réglages ou un bloc commun (le seuil SR est « une fois pour P, Av, Tv, M ») ? La granularité proposée suit la structure réelle du firmware, sans en promettre plus.
    - Les réglages généraux : Fn Button Settings (lignes Hold comprises), levier ADJ, Mode Memory, Setup, réglages des Image Controls et des films GR Mod (grain compris).
    - L'état des rouleaux (compteurs) : exporté, jamais réappliqué par défaut (un import rembobine les rouleaux concernés, comme le formatage).

    Format : en-tête (signature, version du format, modèle GR III / IIIx, version de GR Mod Film, empreinte de la recette des films, date), table des blocs présents, somme de contrôle par bloc et globale. Un dossier dédié sur la carte, plusieurs exports horodatés possibles.

    Dans le boîtier :
    - « Export Settings » : écrit une image complète sur la carte.
    - « Import Settings » : choix du fichier, puis des blocs à appliquer (Tout, une ou plusieurs BOX, P / Av / Tv / M, réglages généraux).
    - Sauvegarde immédiate des réglages après import (la veille ne sauvegarde pas).

    Dans l'application :
    - Ouvrir une image des réglages depuis la carte ou le disque, afficher son contenu bloc par bloc, cocher les blocs à appliquer.
    - Construire le firmware avec ces blocs intégrés. Au premier démarrage après le flash (détecté par l'empreinte du build), le firmware applique les blocs choisis une seule fois, puis sauvegarde.
    - Cas d'usage : réinstaller ou mettre à jour GR Mod Film sans tout reconfigurer, passer ses réglages d'un boîtier à un autre, partager une configuration.

    Sécurité :
    - Refus d'un bloc dont la somme de contrôle est fausse ; refus d'un fichier d'un autre modèle, sauf blocs déclarés compatibles entre GR III et GR IIIx (à établir).
    - Avertissement si la version ou la recette des films diffère ; un film absent de la recette ramène le look à Standard.
    - Chaque bloc appliqué passe par le garde-fou de GR Mod (valeurs inconnues ramenées aux valeurs d'usine), dans le boîtier comme au premier démarrage après flash.

    À vérifier pendant l'exploration : fonction native de sauvegarde des réglages réutilisable ; taille, emplacement et découpage des réglages en mémoire (offsets par BOX et par mode) ; écriture de fichier depuis le menu (même brique que les dossiers de rouleau) ; mécanisme de reprise des enregistrements HTData au premier démarrage, déjà utilisé par GR Mod.

16. Flash à nombre guide pour tout flash (demande d'un utilisateur Reddit, 2026-11-10).

    Point de départ : GR Mod a déjà « Direct Flash » pour le GR IV (README, section Direct Flash ; `core/src/fw/aspect/directflash*.ts` ; `tools/directflash`), qui reproduit le comportement du GF-2 Flash Mode natif du GR III : ouverture = NG × √(ISO/100) / distance, flash à puissance fixe, exposition calculée depuis la distance de mise au point. Les versions récentes de Maxwooow l'ont enrichi (priorités d'exposition, vitesse maximale, correction sur le flash, réglages gardés entre les modes).

    Objectif sur GR III / IIIx : étendre le GF-2 Flash Mode natif (`0x02000070`) à n'importe quel flash manuel, en laissant l'utilisateur choisir le nombre guide.
    - Dans le boîtier : une liste de nombres guides (6 à 60, ou une table de flashs courants), réglable dans le menu Flash, avec la puissance du flash (1/1, 1/2, 1/4…) qui ajuste le NG effectif.
    - Fonctionnement en P, Av, Tv, M, avec ISO Auto pris en compte. Étudier aussi le Snap Distance Priority : la distance y est connue d'avance, cas d'usage idéal en street au flash.
    - À établir pendant l'exploration : où le GR III range le NG du GF-2 et comment il calcule l'exposition ; si le module du GR IV peut être porté tel quel ; compatibilité avec un flash qui communique (désactivé dans ce cas).
    - Tests : vérification en émulateur contre une version Python de la règle (comme `tools/directflash/check.py`), puis essais réels avec au moins deux flashs de NG différents.

17. Interdire la suppression d'une photo dans un rouleau non rembobiné. Sur argentique, une vue ratée reste sur la pellicule.
    - Pendant qu'un rouleau est chargé, toute suppression des fichiers de son dossier est bloquée : bouton Delete en lecture, Delete dans le menu de lecture, suppression multiple ou par plage, et toute autre voie de suppression trouvée pendant l'exploration.
    - Message à la tentative : « Roll in progress: rewind to delete », puis retour à la lecture.
    - Les photos hors rouleau (dossier P / Av / Tv / M, rouleaux rembobinés ou clos) restent supprimables normalement.
    - Le formatage reste autorisé (il rembobine tous les rouleaux).
    - À vérifier : la protection native des fichiers (Protect) comme voie de mise en œuvre possible, et son interaction avec Delete All.

27. Réglages masqués choisis dans le boîtier (décision du 2026-11-13 ; **intégré à la 0.9.7, validé sur le boîtier : T-HSET1b, T-HSET2, T-HSET3**) : une ligne « Hide Settings » dans **Setup**, qui ouvre une liste de cases (Face/Eye Detection, AF Assist Light, AF.C Setting, MF Auto Magnification, Flash Mode, GF-2 Flash Mode, Flash Exposure Comp.). La liste « Hidden settings » de l'application est **supprimée** : rien n'est masqué au premier allumage.
    - Un réglage masqué garde la valeur qu'il avait au moment du masquage (régler d'abord, puis masquer) ; réversible sans reflasher, le même pour toutes les BOX.
    - Mise en œuvre : un octet libre (un bit par réglage) écrit dans les 8 enregistrements ; écran de cases copié de Mode Memory (comme AF Point et Apply to U) ; les filtres actuels (lignes du menu, fonctions des touches, Hold, Wireless, cases ADJ lues Off, cases de Mode Memory forcées à « mémorisée ») testent le bit au lieu d'une liste fixe.
    - Point dur : les listes d'ADJ Mode Setting, aujourd'hui raccourcies au build, à recalculer à l'ouverture de l'écran dans une copie en RAM.
    - Estimation : moyenne, 8 à 14 builds de test, 4 à 6 sessions. Réalisé en 4 builds (T-HSET1, 1b, 2, 3), voie A pour les listes d'ADJ (calcul à la volée, sans RAM).

### Reprises des forks de GR Mod
Décisions du 2026-11-11. Tout ce code est sous GPL comme GR Mod : le reprendre est permis, en citant chaque auteur dans le README (section Thanks) et dans les messages de commit.

18. Firmwares GR III 2.20 et GR IIIx 1.70 (priorité, pour les bêta-testeurs dont le boîtier est déjà à jour). Source : Maxwooow, GR Mod 0.9.0 (testé sur boîtiers). Fusionner la base amont, puis reporter toutes les adresses de GR Mod Film sur 2.20 / 1.70. Garder 2.10 / 1.60 en parallèle. Chaque fonction revalidée en émulateur puis sur boîtier.

19. Levier ADJ jusqu'à 8 réglages sur GR III / IIIx. Source : Maxwooow, GR Mod 0.8.9 (adjslots). Porter sur GR III : réglages 6 à 8 dans ADJ Mode Setting, valeurs protégées par le garde-fou. Vérifier la compatibilité avec le verrou du rouleau (cases ADJ lues Off pendant un rouleau).

20. Vrai LUT appliqué au JPEG par le processeur, pour les films GR Mod. Source : orbitsail, branche cpu-lut (expérimental, GR IV). Objectif : rendre fidèlement les LUT très sélectifs en teinte (Aerochrome, infrarouge) que le modèle matrice + courbes approche mal. Critère d'adoption : temps de traitement par vue mesuré sur le boîtier ; option par film, désactivée par défaut, si le coût est sensible.

21. Meilleur ajustement des LUT dans l'application (aucun changement dans le boîtier). Sources : sjclijie (feat/hue-sectors, feat/fitting-ciede2000-refinement : secteurs de teinte, affinage CIEDE2000) et orbitsail (hue-sectors-continuous, white-anchor, neutral-base : préservation du blanc, base neutre apprise sur de vraies paires RAW/JPEG). Comparer l'erreur d'ajustement (ΔE) avant et après sur les 20 films, garder ce qui améliore sans dégrader les neutres.

22. Balance des blancs automatique apprise. Source : orbitsail (awbml ; GR IV). Après la v1, si le portage GR IV vers GR III est réaliste.

23. Correction des ombres apprise. Source : orbitsail (shadowml, modèle entraîné sur FiveK ; GR IV, expérimental). Après la v1, mêmes conditions de portage. Vérifier la licence de la base FiveK.

24. Réduction du bruit de chrominance, seconde passe à partir de 3200 ISO. Source : orbitsail (chroma-nr ; GR IV). Après la v1, mêmes conditions de portage.

    Pour 22 à 24 : étudier d'abord si les structures du GR IV existent sur GR III avant toute estimation.

### Fait ou abandonné
- **Prochain chantier (décidé le 2026-11-09) : rouleau chargé, réglages verrouillés.** En U1 à U3, Film Roll Mode sur On et rouleau entamé (compteur différent de 0, pas rembobiné), ces lignes de Still Image Settings disparaissent du menu (elles reviennent après le rembobinage, et en P, Av, Tv, M) :
  - Image Control (`0x02000012`), Aspect Ratio (`0x02000073`), Crop (`0x02000074`), Drive Mode (`0x0200000e`) ;
  - File Format (`0x02000072`), JPEG Recorded Pixels (`0x02000075`), Color Space (`0x02000076`).
  Film Mode, Customize Settings, Setup et Playback inchangés (Format, Create New Folder et la numérotation gardés). Brique : masquage par identifiant à chaque ouverture du menu (`T18-HIDE1`, `T20-VID3`). Identifiants et titres lus dans le firmware (fonction de dessin de chaque ligne).
  - **Menu validé sur le boîtier (T-LOCK1).** Levier ADJ et touches : File Format, JPEG → RAW, JPEG → RAW+, Aspect Ratio, Crop, JPEG Recorded Pixels, Drive Mode, Drive, Continuous Shooting et Image Control agissent comme Off tant que le rouleau est chargé (Self-timer libre) ; les cases ADJ concernées lisent Off (l'écran ADJ Mode Setting aussi, le choix revient au rembobinage). **Validé sur le boîtier (T-LOCK2).**
- ~~Vue de sécurité sautée après une pellicule « rechargée »~~ : abandonnée (décision du 2026-11-09).
- ~~Liste blanche des entrées du menu principal~~ : retirée (décision du 2026-11-09).
- ~~BOX suivante (fonction Fn, plan T25-BOX1)~~ : abandonnée (décision du 2026-11-09).
- Stabilisation (IBIS) selon la vitesse (demande du 2026-11-09, rappelée le 2026-11-09) : SR activé sous une vitesse d'obturation choisie et coupé au-dessus, réglable dans Shake Reduction ou dans Auto SR Off (renommée « Auto SR On/Off »). En cours : recherche statique faite (valeur SR effective `0x53271dc4`, Tv courant `0x53548930`, voir les notes), Validée sur le boîtier (T-SR1, T-SR2) : la liste de Shake Reduction devient Off, 1/4000 (toujours active) … 30" ; seuil rangé dans l’octet de Shake Reduction (`+0x4f6`), donc par BOX et pour P, Av, Tv, M. Mise dans tout build GR III / IIIx complet, sans case (0.9.4). La main SR de l’écran ne suit pas encore la vitesse : version future.
- Lignes de menu masquables depuis GR Mod Film (demande du 2026-11-09), comme pour la vidéo : une liste au choix dans l'application. Premières lignes demandées : Face/Eye Detection (`0x0200005e`), AF Assist Light (`0x0200005f`), AF.C Setting (`0x02000063`), MF Auto Magnification (`0x02000065`), Flash Mode (`0x020000dd`), GF-2 Flash Mode (`0x02000070`), Macro Mode (`0x02000071`). Même brique que le chantier ci-dessus. Un réglage masqué doit aussi disparaître des fonctions des touches et du levier ADJ (demande du 2026-11-09) : Face/Eye Detection est la fonction Fn 8 ; Flash Mode Fn 20 et ADJ 8 ; GF-2 Flash Mode Fn 41 et ADJ 0x13 ; Macro Mode Fn 45 (GR Mod Film) ; AF Assist Light, AF.C Setting et MF Auto Magnification n'ont ni fonction Fn ni fonction ADJ (à revérifier au moment du chantier, filtre des listes `0x531b9410` et listes ADJ).
- **Correctif** (décision du 2026-11-11) : GF-2 Flash Mode masqué depuis l'application : la ligne reste proposée dans Mode Memory. Quand GF-2 Flash Mode est masqué, il doit aussi disparaître de la liste de Mode Memory. Vérifier au passage tous les réglages masquables : un réglage masqué ne doit apparaître nulle part, Mode Memory compris. À traiter avec le chantier « lignes masquables ». **Validé sur le boîtier (T-HIDE3, 2026-11-13)** : les trois cases absentes de Mode Memory, les autres présentes, aucun réglage masqué visible dans le menu, les touches et le levier ADJ ; la valeur gardée à l'allumage n'a pas pu être vue sur le boîtier (vérifiée en émulation) : les cases Flash Mode, Flash Exposure Comp. et GF-2 Flash Mode quittent Mode Memory quand leur réglage est masqué, et sont tenues « mémorisées » (sinon la valeur d'usine revenait à l'allumage en P, Av, Tv, M). Les quatre autres réglages masquables n'ont pas de case. Audit : menu, touches, Hold, Wireless, levier ADJ et Mode Memory couverts ; restent les icônes de l'écran de prise de vue et les informations de lecture, qui montrent la valeur imposée.
- Ordre décidé le 2026-11-09 : lignes masquables, puis bogue de la lecture, puis publication 0.9.4.
- Lecture de la dernière photo (bogue signalé le 2026-11-09) : après une vue de rouleau, une photo de P (dossier plus ancien) n'était pas annoncée à la lecture, qui restait sur la vue. Correctif : chaque photo créée est retenue (dossier, numéro), et la lecture s'ouvre dessus après une nouvelle photo (`playLast`). **Validé sur le boîtier (T-PLAY3d).**
- Touche WB dans la liste des touches réglables de Fn Button Settings (demande du 2026-11-02) : **validée sur le boîtier (WB-RC1)** ; touche Macro ajoutée (WB-RC2, validée sur le boîtier, 0.9.2) ; White Balance devient aussi une fonction des autres touches.
- **Priorités après la 0.9.4** (décision du 2026-11-10) : les bogues découverts à l'usage, ou le mode lecture (dont le bogue de lecture restant). Puis, plus tard : unifier les fonctions ADJ et boutons, la main SR qui suit la vitesse, l'AF en basse lumière et l'autonomie.
- Désactiver la molette arrière (demande du 2026-11-08) : option « Rear dial off » de l'application (pas un réglage du boîtier). Les codes 24 et 25 sont ignorés à l'entrée de `ActionModel::OnEvent` (`0x53221a1c`), partout ; les quatre touches et OK restent. **Validée sur le boîtier (T-DIAL3, puis T-HOLD3)**, case dans l'application (0.9.3).
- Fn maintenu + molette avant à la place de la molette arrière (demande du 2026-11-09) : avec la molette arrière coupée, le mode M ne règle plus la vitesse. Codes de la molette avant relevés (9, 10). Pendant que Fn est maintenu, la molette avant envoie les codes de la molette arrière (24, 25) ; Fn relâché ensuite ne fait rien. Validé en Snap (T-FN4) ; automatique avec « Rear dial off » (0.9.4) ; Snap DOF retiré.
- Appuis longs (demande du 2026-11-08) : lignes « Hold » sous Fn, ISO, Drive, WB et Macro Button dans Fn Button Settings. Touches du pavé : au premier code de maintien ; Fn (aucun code de maintien) : chronométré par `tk_get_otm`, 600 ms, au relâchement. Réglages dans les octets libres `0x806`, `0x84a`, `0x88e`, `0xacf`, `0xae3`. **Validés sur le boîtier (T-HOLD3)**, 0.9.3.
- Icône photo / vidéo du bouton Wireless au démarrage avec No movie : retirée (purement esthétique, décision du 2026-11-09).
- Fonction « Snap DOF » dans Fn Button Settings (demande du 2026-11-08) : en Snap Distance Priority, chaque appui fait DOF1 → DOF2 → DOF3 → DOF1, la distance (molette avant) n'est jamais touchée. Champ trouvé par T-DOF5 : octet `+0xa3e` des réglages (0, 1, 2) ; écriture par la fonction native du boîtier `0x532720e4`, celle de la molette arrière. Hors Snap Distance Priority, l'appui ne fait rien. Vérifiée en émulateur (`snap_dof_probe.py`), **validée sur le boîtier (T-DOF6, 2026-11-09)**. Les listes Wireless Button et Hold Wireless Btn. proposent désormais les mêmes fonctions que les autres touches (limitation levée, à écrire dans la note de version).

## Accessoires matériels (hors firmware)
Décision du 2026-11-11.

26. Support à imprimer en 3D, tenant à la fois le flash et le viseur sur la griffe unique du GR.
    - Une semelle qui glisse dans la griffe du GR, avec deux sabots au-dessus : un sabot actif pour le flash, un sabot froid pour le viseur.
    - Le contact du flash doit traverser le support : au minimum le contact central et la masse pour un flash manuel ; tous les contacts de la griffe pour conserver le GF-2 Flash Mode et le flash à nombre guide (entrée 16). À vérifier : brochage de la griffe du GR III.
    - Semelle et contacts en métal, achetés tout faits (pied de griffe et sabot du commerce) ; seul le corps est imprimé. Une semelle imprimée s'use et peut abîmer la griffe du boîtier.
    - Disposition : viseur au plus près de l'axe de l'objectif pour limiter la parallaxe ; flash décalé ou en hauteur pour éviter l'ombre de l'objectif en gros plan.
    - Matériau : PETG ou ASA (chaleur en voiture, UV, choc). Profil le plus bas possible pour garder l'appareil compact.
    - Poids : un flash lourd fait levier sur la griffe ; prévoir une butée ou un appui sur le dessus du boîtier, et limiter le flash conseillé à un modèle compact.
    - Compatible avec le projet d'écran sur la griffe (visée par au-dessus) : concevoir le support pour qu'il puisse accueillir l'écran à la place du viseur.

## Licence
GPL-2.0-only, comme GR Mod. Tout firmware partagé s'accompagne de son code source (ce dépôt).
