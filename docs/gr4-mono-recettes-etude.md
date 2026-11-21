# GR IV Monochrome : recettes (étude P3, 2026-11-21)

Demande : ajouter des **recettes** pour le Ricoh GR IV Monochrome, en tenant compte du fait que son capteur est **exclusivement noir et blanc**.
Statut : **étude, rien n'est codé.** Ce document dit ce qui existe, ce qui bloque, et le plan par étapes.

## 1. Ce qu'une « recette » est dans GR Mod Film (GR IV couleur)

- Un **style d'Image Control ajouté** (« slot », numéros 38 et suivants, jusqu'à vingt) : `core/src/fw/gr4v121/aspect/slots.ts`. Chaque style a sa matrice de couleur,
  ses courbes de tonalité, sa matrice « après courbe » et ses paramètres (saturation, contraste, grain, etc.), copiés d'un style de référence (Cinema Yellow).
- Une recette de l'application = un jeu de valeurs pour ces enregistrements (`matrixQ13`, `curves`, `postQ9`) ajusté à partir d'images de référence, plus un nom et une icône.

## 2. Ce que l'application fait aujourd'hui avec le Monochrome

- La page Image Control n'offre **aucune recette** : elle affiche « The Monochrome model does not have these two colour slots » (`ui/src/pages.tsx`, ligne `mono-ic`).
- Les styles ajoutés sont **explicitement cachés sur le Monochrome** : le test de visibilité des looks (0x533de9ac) renvoie « visible » seulement si le modèle n'est pas le Monochrome
  (`slots.ts`, commentaire « the new styles are colour looks, hidden on the GR IV Monochrome »).
- Le Monochrome a ses **propres looks noir et blanc** (numéros 25 à 30 et 32 : Monochrome Standard, Soft, High Contrast, Grainy, Solid, HDR, Solarized), déjà décrits dans
  `monounlock.ts` (la même table de disponibilité, une colonne par modèle ; la colonne 1 est le Monochrome).
- Les trois « variantes » d'enregistrements de style (une par modèle) partagent le même Cinema Yellow (le code le vérifie) ; les looks noir et blanc utilisent les colonnes 28 à 35.

## 3. Conséquences du capteur noir et blanc

- **Pas de couleur à régler.** La matrice de couleur, la saturation, la teinte et le « grain coloré » n'ont pas de sens : seule la **luminance** compte. Une recette Monochrome
  est donc : une **courbe de tonalité** (contraste global, hautes lumières, ombres), la **netteté**, la **clarté**, l'**ombrage** (vignettage), le **grain** (force, taille) et, si le boîtier
  le propose pour les looks monochromes, un **filtre / virage** (jaune, orange, rouge, vert ou tonalité).
- Une recette Monochrome ne peut donc pas partir d'une copie de Cinema Yellow (look couleur) : il faut partir d'un **look monochrome** (Monochrome Standard, 25), dont les
  enregistrements de courbes et de paramètres sont ceux qu'un look noir et blanc utilise vraiment.
- Les paramètres d'un style ajouté (13 sur les 23 du boîtier, ceux de Cinema Yellow) sont ceux d'un look couleur ; **ceux d'un look monochrome sont à relever** dans le firmware.

## 4. Ce qu'il faut trouver (inconnues)

1. Les **enregistrements** (tonalité, multi-axes, YCbCr, gamma) d'un look monochrome, par variante, et leur taille.
2. La liste des **paramètres** d'un look monochrome (récupérateurs, écrivains, valeurs par défaut) : lesquels existent (contraste, hautes lumières, ombres, netteté, clarté,
   ombrage, grain, virage).
3. Comment le **menu** et la **vue en direct** choisissent les enregistrements pour un style de numéro ≥ 38 quand le modèle est le Monochrome.
4. Ce que **fait la matrice de couleur** sur le Monochrome (neutre ?) et si les courbes de recette s'appliquent bien à la luminance seule.
5. L'**origine des données de recette** : sur le GR IV couleur, les recettes viennent d'images de référence ; pour le Monochrome, il faut un procédé qui donne une courbe de luminance
   (par exemple à partir de photos noir et blanc de référence ou de valeurs saisies à la main).

## 5. Plan par étapes (chacune validée avant la suivante)

- **M1 (statique, sans boîtier)** : relever les enregistrements et paramètres d'un look monochrome ; la correspondance des variantes aux modèles ; un tableau « paramètre, getter, setter,
  défaut ». Sortie : ce document complété et un fichier de faits (`facts.ts`).
- **M2 (émulateur)** : sonde Unicorn : la visibilité et le choix des enregistrements pour un style ≥ 38 en mode Monochrome, sur un faux boîtier.
- **M3 (test sur le boîtier)** : un build d'essai avec **un** style ajouté, visible sur le Monochrome, copié de Monochrome Standard, sans réglage propre. Test : le style est dans le menu,
  s'applique, ne bloque pas l'appareil.
- **M4** : les paramètres propres du style (contraste, netteté, grain) enregistrés avec les réglages, comme pour les styles couleur.
- **M5 (produit)** : la page Image Control du Monochrome (à la place du message), l'import / export de packs de recettes **pour le Monochrome** (aujourd'hui, un pack GR IV couleur est refusé
  avec « autre appareil »), crédits et notes de version.

## 6. Ce qu'il me faut de vous

- Des **exemples de rendus** souhaités (noms de recettes noir et blanc connues, ou quelques photos de référence) pour dimensionner la partie « données de recette ».
- Votre accord sur le **périmètre** de M3 (un seul style, tests sur votre Monochrome).

## 7. Risques

- Le Monochrome et le GR IV couleur partagent le même fichier firmware : toute modification des styles ajoutés doit être **sans effet sur le GR IV couleur** (déjà couvert par les tests actuels
  de non-régression des sorties) et sur les 25 à 30 d'origine.
- Un style qui lit un enregistrement mal copié **arrête l'appareil** (le test 022 du fork l'avait déjà montré sur un GR IV couleur) : la sonde M2 doit tout vérifier avant tout flashage.

## 8. Exemples fournis (2026-11-21) : quatre LUT `.cube`

Quatre LUT 3D de 13 points par axe, produites par G'MIC (« Created by: G'MIC ») : **Fuji Neopan Acros 100**, **Agfa APX 100**, **Polaroid 672**, **Kodak HIE (infrarouge)**.
Analyse : `tools/gr4v121/cube_mono_analysis.py` (lecture seule des fichiers). Les LUT elles-mêmes ne sont pas versionnées : leur licence n'est pas indiquée.

### Ce qu'elles contiennent
- Les quatre donnent une sortie **parfaitement grise** (R = G = B partout) : **aucun virage** (pas de sépia ni de teinte), y compris Polaroid 672.
- Chacune combine deux choses :
  1. un **mélange des couleurs** de l'entrée (la sensibilité spectrale du film) ;
  2. une **courbe de tonalité** (la réponse du film en luminance).

### Ce qui est transposable sur un capteur noir et blanc
- **La courbe de tonalité, oui** : c'est exactement ce que règle l'enregistrement de courbe d'un style. Courbe sur l'axe neutre (entrée → sortie, 13 points de 0 à 1) :

| Entrée | Acros 100 | APX 100 | Polaroid 672 | HIE infra |
| --- | --- | --- | --- | --- |
| 0,000 | 0,019 | 0,065 | 0,010 | 0,067 |
| 0,083 | 0,072 | 0,172 | 0,043 | 0,149 |
| 0,167 | 0,134 | 0,280 | 0,093 | 0,228 |
| 0,250 | 0,204 | 0,394 | 0,163 | 0,318 |
| 0,333 | 0,280 | 0,517 | 0,250 | 0,424 |
| 0,417 | 0,360 | 0,639 | 0,346 | 0,542 |
| 0,500 | 0,442 | 0,744 | 0,444 | 0,662 |
| 0,583 | 0,523 | 0,815 | 0,538 | 0,773 |
| 0,667 | 0,601 | 0,861 | 0,622 | 0,856 |
| 0,750 | 0,678 | 0,894 | 0,699 | 0,915 |
| 0,833 | 0,758 | 0,922 | 0,774 | 0,971 |
| 0,917 | 0,844 | 0,952 | 0,853 | 0,999 |
| 1,000 | 0,940 | 0,985 | 0,941 | 0,999 |

  Lecture : Acros, une courbe presque droite et un peu sombre (noirs à 0,02, blancs à 0,94) ; APX, des noirs levés (0,065) et des hautes lumières très compressées
  (rendu clair, doux en haut) ; Polaroid 672, des ombres profondes et un contraste montant (courbe en S léger, blancs à 0,94) ; HIE, des noirs levés et des hautes lumières
  qui saturent à 0,999 dès 0,92 (blancs brûlés, typiques de l'infrarouge).
- **Le mélange des couleurs, non** : un capteur sans filtre coloré ne voit pas les couleurs, la photo n'a qu'une luminance. Ajustement linéaire approximatif du gris de sortie sur les
  entrées (indicatif, les courbes étant non linéaires) : Acros r 0,13 g 0,73 b 0,08 (très vert) ; APX r 0,14 g 0,55 b 0,25 ; Polaroid r 0,32 g 0,46 b 0,25 (équilibré) ;
  HIE r 0,50 g 0,38 b 0,11 (rouge, l'effet infrarouge).
- **Une exception utile** : le GR IV Monochrome a un **filtre rouge physique** (la fonction Red Filter, ajoutée au levier ADJ dans la 1.2.0). Un rendu « HIE » sur le Monochrome
  serait donc : **Red Filter activé + la courbe HIE**, ce qui rapproche aussi le ciel sombre et la végétation claire de l'infrarouge, sans l'égaler (un filtre rouge n'est pas un film infrarouge).

### Questions ouvertes pour M1
1. Le **domaine** de l'enregistrement de courbe d'un style (linéaire ou gamma, nombre de points, 8 ou 12 bits) : les LUT sont très probablement définies en sRGB encodé (G'MIC),
   il faudra convertir la courbe dans le domaine du boîtier.
2. Si la courbe d'un style ajouté s'applique **après** les réglages Contraste / Hautes lumières / Ombres de l'appareil, ou les remplace.
3. La **licence** des LUT G'MIC, avant de publier des recettes dérivées.

## 9. Résultats de M1 (étude statique, 2026-11-21)

Firmware lu : GR IV 1.21 = GR IV Monochrome 1.11 (`fwdc248b.bin`). Lecture des tables de styles décrites dans `slots.ts` et émulation des 23 « getters » de paramètres.
Niveau de certitude : **lu** pour les adresses et les valeurs ; **déduit** pour le sens des paramètres (marqué « hypothèse »).

### 9.1 Les tables de styles
- Les styles 0 à 24 sont les colonnes 0 à 24 ; les looks noir et blanc 25 à 32 sont les colonnes **28 à 35** (table octet 0x5407bd2c, lue : `0..24, 28..35`).
- Les **trois variantes** (lignes des tables) sont identiques pour tous les looks utiles, sauf la variante 2 pour Grainy et Solid (descripteur de courbe propre). Laquelle est le
  Monochrome n'est pas établi ; les styles ajoutés reçoivent les mêmes enregistrements dans les trois, comme aujourd'hui.

### 9.2 Ce qui distingue un look noir et blanc d'un look couleur (lu)
| Élément | Standard (11) | Cinema Yellow (18) | Monochrome Standard (25) | High Contrast (27) | Solarized (32) |
| --- | --- | --- | --- | --- | --- |
| Matrice de couleur (Q13) | quasi identité | mélange coloré | **identité** | identité | identité |
| Tableau « après courbe » (mot 2) | 0x5501bd34 (couleur) | 0x5501bd34 | **0x5501c0a0 (noir et blanc)** | 0x5501c0a0 | 0x5501c0a0 |
| Enregistrement YCbCr | 0x5501c8c8 (couleur) | 0x5501c8c8 | **0x5501c8a4 (noir et blanc)** | 0x5501c8a4 | 0x5501c8a4 |
| Descripteur de courbes | courbes R, G, B de Standard | idem, drapeau 1 | **courbes de Standard**, drapeau 0 | **courbe propre**, la même pour R, G, B, drapeau 1 | courbe de base et courbe propres |
| Bloc multi-axes | neutre | propre | neutre | neutre | neutre |

- **Format des courbes (lu)** : 256 valeurs de 0 à 16383 (14 bits) par canal, non décroissantes en général (Solarized ne l'est pas, exprès). Standard a un noir à 899 (0,055).
  High Contrast est une courbe en S unique pour les trois canaux. Le code de couleur de GR Mod les décrit ainsi : entrée « i/256 » en domaine affiché, après la courbe de base
  (`core/src/color/camera.ts`).
- Conséquence : un **style ajouté pour le Monochrome** doit copier un look noir et blanc (Monochrome Standard ou High Contrast), pas Cinema Yellow : matrice identité, tableau après
  courbe et YCbCr noir et blanc, et une **courbe propre unique** pour R, G, B, comme High Contrast.

### 9.3 Paramètres réglables (émulation des 23 getters, avec un objet de réglages rempli d'un motif)
Un paramètre « existe » pour un style quand son getter lit un champ propre (valeur du motif) ; sinon il renvoie la valeur neutre (4 = milieu de l'échelle -4..+4).

| Paramètre | Standard | Cinema Yellow | Looks noir et blanc 25 à 29 | Hypothèse |
| --- | --- | --- | --- | --- |
| 0, 1 | oui | oui | **non** | saturation, teinte (couleur) |
| 2 à 6 | oui | oui | oui | contraste, hautes lumières, ombres, netteté, ombrage / clarté |
| 7 | non | non | **oui** (noir et blanc seulement) | filtre ou virage noir et blanc |
| 8 | non | oui | non | virage de Cinema (couleur) |
| 17 | oui | oui | oui | clarté ou ombrage |
| 18 | oui | oui | en partie (25, 27, 29) | à identifier |
| 19 à 21 | non (Standard : 0, 1, 1) | oui | oui | grain : effet, force, taille |

- Un style ajouté pour le Monochrome exposerait donc les paramètres **2 à 7 et 17 à 21**, sans 0, 1 et 8. Aujourd'hui les styles ajoutés reprennent ceux de Cinema Yellow
  (0 à 6, 8, 17 à 21) : à changer pour le Monochrome.
- Les **noms** des paramètres ne sont pas encore reliés aux numéros : à confirmer en M2 (textes de l'écran de paramètres) ou M3 (sur le boîtier).

### 9.4 De la LUT à la courbe du boîtier (procédé proposé)
1. Courbe de la LUT sur l'axe neutre (13 points, sRGB affiché) ; interpolée en 256 points.
2. La LUT s'applique à une image déjà rendue ; sur le boîtier, l'image « déjà rendue » est celle de Monochrome Standard, dont les courbes sont celles de Standard. La courbe du
   style ajouté est donc **la LUT appliquée après la courbe de Standard** : `c[i] = 16383 × LUT(G_standard[i] / 16383)` (canal vert de Standard comme approximation de la luminance).
3. La même courbe pour R, G et B ; matrice identité.
4. À vérifier en M3 : une mire de gris photographiée en Monochrome Standard et avec le style « APX 100 », comparée à la courbe attendue.

### 9.5 Ce que M1 laisse ouvert
- Le modèle qui correspond à chaque variante.
- Le nom de chaque paramètre (2 à 7, 17 à 21).
- Le test de visibilité et le choix des enregistrements par la vue en direct pour un style ≥ 38 sur le Monochrome : c'est l'objet de M2 (émulateur).
