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

## 10. Résultats de M2 (émulateur, 2026-11-21)

Sonde : `tools/gr4v121/mono_looks_probe.py` (29 contrôles, firmware officiel 1.11 et un build GR Mod avec un style ajouté de test). Certitude : **lu et exécuté** en émulation.

### 10.1 Visibilité des looks par modèle (fonction 0x533de9ac)
- GR IV couleur : looks couleur 11 à 24 visibles, looks noir et blanc 25 à 32 cachés.
- Monochrome : looks couleur cachés, **looks 25 à 30 et 32 visibles**, 31 (Pictorialist) caché partout.
- Style ajouté 38, tel que GR Mod le construit aujourd'hui : **visible sur le GR IV couleur, caché sur le Monochrome** (le crochet de `slots.ts` le traite en look couleur).

### 10.2 Numéros de développement RAW (fonction 0x53382ed8)
- Looks noir et blanc : 25 → 15, 26 → 16, 27 → 17, 28 → 18, 29 → 19, 30 → 22, 31 → 20, 32 → 21. Cinema Yellow : 18 → 9.
- Aujourd'hui les styles ajoutés se développent en RAW comme Cinema Yellow (9) ; pour le Monochrome ce sera **15 (Monochrome Standard)**.

### 10.3 Inventaire : ce qui traite un style ajouté « comme Cinema Yellow » et doit le traiter « comme un look noir et blanc »
Tout est dans `core/src/fw/gr4v121/aspect/slots.ts` ; pour une recette Monochrome, le look de référence proposé est **Monochrome Standard (25)** pour les paramètres et
le développement, et **High Contrast (27)** pour le gabarit du descripteur de courbe (drapeau « courbe propre » à 1).

| Où (slots.ts) | Rôle | Aujourd'hui | Pour le Monochrome |
| --- | --- | --- | --- |
| gabarits d'enregistrements (`installExtraSlots`) | tonalité, multi-axes, YCbCr, courbes | Cinema Yellow | 25 (tonalité, YCbCr noir et blanc), 27 (descripteur à courbe propre) |
| crochet de visibilité 0x533de9ac | menu | visible si modèle couleur | visible si Monochrome |
| 0x5393a710 | champs d'entrée communs (grain) | 18 | 25 |
| getters / setters des paramètres (`installOwnParameters`) | valeurs propres de chaque style | 13 paramètres de Cinema Yellow (0 à 6, 8, 17 à 21) | 11 paramètres d'un look noir et blanc (2 à 7, 17 à 21) |
| foncteurs de changement (0x53279e34…) | copie des champs | champs de 18 | champs de 25 |
| 0x531c86b8, 0x531a6ef4 | liste des paramètres de l'écran (et du développement RAW) | liste de 18 | liste de 25 |
| 0x5373a4ac | étape de filtre numérique (grain) | 18 | 25 |
| paramètres de la vue en direct (`installPreviewMapping`) | aperçu | 18 | 25 |
| développement RAW (`installRawDevelopment`) | numéro RAW | 9 | 15 |
| listes de paramètres des « maker notes », informations de lecture | métadonnées | 18 | 25 |

### 10.4 Décision de conception proposée
- Une option de build « styles ajoutés noir et blanc » (pour le Monochrome) qui change **le look de référence** de tous ces crochets (18 → 25, RAW 9 → 15, gabarits 25 / 27),
  la **visibilité** (Monochrome au lieu des modèles couleur) et la **liste des paramètres** (2 à 7, 17 à 21). Les styles couleur actuels restent inchangés pour les GR IV couleur.
- Un même firmware ne mélange pas les deux : l'application construit des styles noir et blanc quand le modèle choisi est le Monochrome.

### 10.5 Ce que M2 laisse pour M3
- Que la courbe propre est bien appliquée à la luminance (mire de gris sur le boîtier).
- Les noms des paramètres 2 à 7 et 17 à 21 sur l'écran de paramètres.
- Le comportement réel du paramètre 7 (filtre ou virage) sur un style ajouté.

## 11. M3 : choix d'un premier test plus sûr, M3a (2026-11-21)

- Un style **ajouté** noir et blanc demande d'adapter une dizaine de crochets dont les constantes sont propres à Cinema Yellow (champs des paramètres, foncteurs de
  changement, champs de la vue en direct, module des paramètres propres, listes des « maker notes ») : les constantes équivalentes de Monochrome Standard doivent
  d'abord être relevées. Un premier test sur le boîtier avec tout cela serait risqué (un champ mal mappé peut arrêter l'appareil).
- **M3a** répond d'abord à la question centrale, sans aucun de ces crochets : le look existant **Soft** (26) reçoit une **courbe propre** (APX 100). Option de test
  `monoCurve` (`core/src/fw/gr4v121/aspect/monocurve.ts`) : un descripteur copié de High Contrast (drapeau 1), ses trois pointeurs vers une seule courbe, écrit dans
  les trois variantes de la table des courbes. Vérification : `tools/gr4v121/mono_curve_check.py`. Protocole : `docs/protocole-M3a-mono.md`.
- Courbe APX calculée comme proposé en 9.4 : `c[i] = 16383 × LUT(G_standard[i] / 16383)`, LUT interpolée linéairement entre ses 13 points.
- **M3b** (ensuite) : le style ajouté noir et blanc, une fois M3a validé et les constantes de Monochrome Standard relevées.

### 11.1 Premier résultat M3a (2026-11-21)
- Reçu : trois photos d'un écran d'ordinateur (dégradés), sans EXIF (copies redimensionnées à 2000 × 1333), annoncées « Standard, Soft, Soft + Red Filter ».
- Mesures (niveaux 0 à 255 au centre des mêmes cases, fond blanc, bord noir de l'écran) : la 2e photo est nettement plus sombre partout (fond 214 → 166, bord 38 → 0) ;
  la 1re et la 3e sont **presque identiques** (fond 214 et 217, bord 38 et 33, tons moyens à quelques niveaux près, l'écart restant venant du cadrage).
- Lecture la plus probable : la photo sombre est celle **avec le filtre rouge** (le blanc d'un écran est fait de rouge, vert et bleu ; le filtre en retire la majeure partie,
  en exposition manuelle l'image s'assombrit) ; alors **Standard et Soft (APX) donnent le même rendu** : la courbe APX attendue (tons moyens 0,50 → 0,74, noirs 0,06 → 0,14)
  **n'apparaît pas**. À confirmer par l'utilisateur (ordre des photos).
- Causes possibles, non tranchées : la courbe d'un look noir et blanc n'est pas lue dans la table de courbes 0x55054158 au moment de la prise de vue (autre table, ou
  enregistrement noir et blanc qui ignore les courbes R, G, B) ; ou la table en RAM est reconstruite au démarrage depuis une autre source que l'image d'initialisation.
- Test de diagnostic M3a-2 : la même modification avec une courbe **seuil** (noir sous la moitié, blanc au-dessus) sur Soft : impossible à manquer à l'écran de l'appareil.
  Si Soft ne devient pas tout noir et blanc pur, la table n'est pas celle qui sert ; sinon, c'est la conversion de la courbe APX qu'il faut revoir.

### 11.2 Ordre confirmé par l'utilisateur (2026-11-21)
- R0000152 = Monochrome Standard, R0000153 = Soft (courbe APX), R0000154 = Soft + Red Filter.
- Donc : **Soft (APX) est plus sombre que Standard partout** (fond 214 → 166, tons moyens 128 → 75, noir du bord 38 → 0), alors que la courbe APX devait **éclaircir**
  (0,50 → 0,74, noirs 0,06 → 0,14) ; et Soft + Red Filter est **aussi clair que Standard**.
- Aucune des hypothèses de domaine de courbe (courbe appliquée après Standard, deux fois, ou en linéaire avant la courbe de base) ne donne un assombrissement : la différence
  Standard / Soft ne s'explique pas par la courbe APX. Si l'exposition était automatique, le filtre rouge a été compensé (photo 154) et les trois expositions ne sont pas
  comparables. **Inconnue à lever : le mode d'exposition des trois photos** (les copies reçues n'ont pas d'EXIF).
- Le test M3a-2 (courbe seuil) reste le test décisif.

### 11.3 Deuxième série M3a, en exposition manuelle (2026-11-21)
- Trépied, mode M, 1/13 s, f/2.8, ISO 160, mesure multizone (EXIF lu par l'utilisateur) ; photos : Standard, Soft (courbe APX), Soft + Red Filter ; copies 2000 × 1333.
- **La courbe est appliquée** : Soft est beaucoup plus clair que Standard sur toute l'échelle, et le filtre rouge assombrit Soft d'environ un diaphragme. Le bord noir de l'écran
  ne change presque pas (34 → 35).
- **Mais l'effet est bien plus fort que prévu** (niveaux 0 à 1, Standard → Soft mesuré, Soft attendu) : 0,18 → 0,65 (attendu 0,30) ; 0,25 → 0,83 (0,39) ;
  0,50 → 0,93 (0,75) ; 0,71 → 0,98 (0,88).
- Lecture : en inversant les deux courbes, l'entrée de notre courbe vaut environ **deux fois** celle de la courbe de Standard dans les ombres et les tons moyens (rapport 1,9 à 2,1,
  puis 1,5 vers les hautes lumières et la saturation). Soit le look Soft ajoute son propre traitement de tonalité, soit une courbe propre (drapeau 1) est indexée dans un
  autre domaine que les courbes de Standard. Ce n'est pas encore tranché.
- Test suivant, **M3a-3** : Soft avec une courbe **linéaire** (sortie = entrée). Comparé à Standard à exposition identique, il donne directement la relation entre l'entrée
  d'une courbe propre et le rendu de Standard, donc la correction à appliquer pour toutes les recettes.

### 11.4 Résultat M3a-3, courbe linéaire (2026-11-21)
- Mêmes conditions (trépied, M). Photos : Standard, Soft (courbe linéaire), Soft + Red Filter.
- **Soft avec une courbe neutre est aussi clair que Soft avec la courbe APX** (Standard 0,19 → 0,71 ; 0,25 → 0,84 ; 0,50 → 0,93 ; 0,78 → 0,99). L'éclaircissement ne vient donc
  **pas de la forme de notre courbe** : il vient du **chemin « courbe propre »** (drapeau 1) lui-même.
- Modèle qui colle le mieux dans les tons moyens et clairs : avec le drapeau 1, la courbe propre reçoit un signal **déjà passé par la courbe de base** (table 0x540b6590,
  très raide dans les ombres) : sortie = courbe_propre(S(u)), alors que Standard donne courbe_Standard(u). Écart au modèle : 0,01 à 0,06. Il ne colle pas dans le noir
  profond (le bord noir de l'écran reste à 0,13 dans les deux), où la mire n'a pas de points : à mesurer.
- Conséquence pour les recettes : la courbe propre doit être **calculée pour ce domaine**, `propre(v) = cible(Standard(S⁻¹(v)))`, ou mieux, à partir d'une **calibration mesurée**
  (rendu de Soft linéaire en fonction de Standard) sur toute l'échelle.
- Étape suivante : une **mire de gris complète** (`docs/assets/mire-gris-m3a.png` : 21 paliers de 0 à 255, puis 21 paliers de 0 à 64 pour les ombres) photographiée en Standard
  et en Soft (courbe linéaire, firmware M3a-3 toujours en place), pour mesurer la relation sur toute l'échelle et calculer une vraie courbe APX.

### 11.5 Mire de gris, première série (2026-11-21) : à réattribuer
- Reçu : trois photos de la mire (copies 2000 × 1333, sans EXIF), sans indication de quel look et quelle exposition pour chacune.
- Mesures (rangée des 21 paliers) : photo 1 = très sombre, plancher **34**, maximum 91 ; photo 2 = très claire, plancher **34**, maximum 229 ; photo 3 = intermédiaire,
  plancher **3**, maximum 189 (rangée des ombres : 3 → 23, bien détaillée).
- Constat qui remet en cause l'attribution des séries précédentes : dans **chaque** série (APX, linéaire, mire), deux photos ont un noir plancher à 34 (0,133) et une à environ 3.
  Or la courbe APX commence à 0,135 (34) et la courbe linéaire à 0 : le plancher identifie la courbe utilisée, et l'ordre « Standard, Soft, Soft + filtre » supposé jusqu'ici
  ne colle pas partout. **Les conclusions 11.3 et 11.4 sont suspendues** tant que chaque photo n'est pas attribuée avec certitude (look et exposition).

### 11.6 Mire attribuée (2026-11-21) : 11.3 et 11.4 confirmés, nouvelle piste M3a-4
- Attribution donnée par l'utilisateur : photo 1 Standard, photo 2 Soft (courbe linéaire, M3a-3), photo 3 Soft + Red Filter, toutes à 1/13 s, f/2.8, ISO 160.
- Le « plancher » n'identifiait pas la courbe : c'est le noir de l'écran (qui émet un peu de lumière) ; le filtre rouge l'assombrit, d'où 3 au lieu de 34. **Les
  conclusions 11.3 et 11.4 tiennent.**
- La mire confirme la relation : Standard 0,14 → Soft 0,49 ; 0,18 → 0,77 ; 0,26 → 0,86 ; 0,36 → 0,90 (mêmes valeurs que les dégradés de 11.4).
- Problème que cela révèle : par le chemin « courbe propre » (drapeau 1), le signal **sature vers 0,99 dès que Standard dépasse environ 0,7** ; une recette construite
  sur ce chemin perdrait le détail des hautes lumières, quelle que soit sa courbe.
- Rapprochement avec le modèle de couleur de GR Mod (`core/src/color/camera.ts`) : sur le GR IV couleur, une courbe propre reçoit S(linéaire), qui **égale** le rendu de
  Standard ; sur le Monochrome, Standard rend nettement plus sombre que S(linéaire). Le drapeau 1 n'est donc pas le bon chemin pour le Monochrome.
- **M3a-4** : Soft reçoit le descripteur de **Monochrome Standard** (drapeau 0) dont seuls les trois pointeurs de courbe sont remplacés par la courbe APX calculée
  comme en 9.4 (`APX(G_standard)`). Si le drapeau 0 lit bien ces pointeurs, la courbe reçoit exactement ce que reçoivent les courbes de Standard, et Soft doit rendre
  l'APX attendu (0,50 → 0,74, noirs relevés, hautes lumières douces), sans saturation. Option `monoCurve.path = 'standard'` ; vérification :
  `mono_curve_check.py --path standard` (114 contrôles).

### 11.7 Résultat M3a-4 (descripteur de Monochrome Standard, drapeau 0) (2026-11-21)
- Mire, mêmes conditions (1/13 s, f/2.8, ISO 160), photo 1 Standard, photo 2 Soft.
- Soft est **presque identique à Standard** : identique dans les hautes lumières (204 → 204, 221 → 223, 239 → 241), un peu plus sombre dans les ombres et les tons moyens
  (54 → 39, 81 → 64, 105 → 91). Rien de l'APX attendu (54 → 87, 81 → 126, 105 → 162).
- Lecture : avec le drapeau 0, **les pointeurs de courbe du descripteur ne semblent pas utilisés** (le léger écart serait le rendu propre de Soft, jamais photographié
  avec le firmware d'origine). Le descripteur n'est lu qu'à un endroit (0x5393c568, accesseur 0x5394f5e8), qui range son adresse dans un bloc de paramètres du
  traitement (+0x14) ; son consommateur reste à trouver.
- Test décisif **M3a-5** : le même chemin (drapeau 0) avec la courbe **seuil**. Si Soft reste normal, le drapeau 0 ignore les pointeurs ; il faudra alors
  comprendre le chemin du drapeau 1 (courbe de base en mot 0, que Solarized remplace aussi) et y construire la recette.

### 11.8 Résultat M3a-5 et piste M3a-6 (2026-11-21)
- M3a-5 (drapeau 0, courbe seuil) : Soft reste **normal** (paliers 3, 5, 11, 21, 37, 62, 88, 116 … 242), exactement comme en M3a-4. **Certitude : le drapeau 0 ignore les
  pointeurs de courbe du descripteur.** Ces deux photos donnent au passage le rendu natif de Soft : identique à Standard dans les hautes lumières, un peu plus sombre dans
  les ombres et les tons moyens (52 → 37, 79 → 62, 104 → 88).
- Ce qui reste valable : le **drapeau 1** applique bien notre courbe, mais après la **courbe de base** du mot 0 du descripteur. Les mesures 11.3 et 11.4 collent à
  `base(u)` avec u l'indice des courbes de Standard (0,235 → 0,72 mesuré 0,715 ; 0,506 → 0,91 mesuré 0,93) : la courbe de base est celle qui éclaircit et sature.
- Format des courbes de base (lu) : celle de Standard commence par un en-tête paramétrique (1, 257, 1, 0, puis des paramètres de coude) ; celle de **Solarized** est une
  table simple : en-tête **257, 257, 1, 0** puis 257 valeurs de 0 à 16383.
- **M3a-6** : drapeau 1 (gabarit High Contrast) **et une courbe de base neutre** à nous (format de Solarized, valeurs `i × 64`), avec la courbe APX calculée comme en 9.4.
  Si l'hypothèse tient, la courbe reçoit ce que reçoivent les courbes de Standard, sans éclaircissement ni saturation, et Soft rend l'APX attendu. Option
  `monoCurve.path = 'linear'` ; vérification `mono_curve_check.py --path linear` (114 contrôles).

### 11.9 Résultat M3a-6 : la courbe APX est rendue (2026-11-21)
- Mire, 1/13 s, f/2.8, ISO 160. L'utilisateur a indiqué « 1 Standard, 2 Soft » ; les valeurs montrent l'inverse (la photo 1 a le plancher 34 = début de la courbe APX
  0,135, la photo 2 retrouve les paliers de Standard des séries précédentes) : **photo 1 = Soft (M3a-6), photo 2 = Standard**, à confirmer.
- Comparaison palier par palier (Standard mesuré, Soft mesuré, Soft attendu = APX appliquée au rendu de Standard) :

| Standard | Soft (M3a-6) | Attendu (APX) |
| --- | --- | --- |

### 11.9 Résultat M3a-6 : la courbe APX est rendue (2026-11-21)
- Mire, 1/13 s, f/2.8, ISO 160. L'utilisateur a indiqué « 1 Standard, 2 Soft » ; les valeurs montrent l'inverse (la photo 1 a le plancher 34 = début de la courbe APX
  0,135, la photo 2 retrouve les paliers de Standard des séries précédentes) : **photo 1 = Soft (M3a-6), photo 2 = Standard**, à confirmer.
- Comparaison palier par palier (Standard mesuré, Soft mesuré, Soft attendu = APX appliquée au rendu de Standard) :

| Standard | Soft (M3a-6) | Attendu (APX) |
| --- | --- | --- |
| 5 | 34 | 23 |
| 6 | 35 | 24 |
| 10 | 36 | 29 |
| 21 | 46 | 44 |
| 39 | 72 | 67 |
| 64 | 115 | 101 |
| 92 | 157 | 142 |
| 119 | 191 | 179 |
| 142 | 210 | 202 |
| 163 | 220 | 216 |
| 182 | 227 | 224 |
| 196 | 231 | 230 |
| 209 | 235 | 234 |
| 220 | 238 | 238 |
| 228 | 241 | 241 |
| 235 | 243 | 243 |
| 240 | 245 | 245 |
| 244 | 247 | 247 |
| 246 | 248 | 248 |
| 246 | 248 | 248 |

- **L'APX est obtenu** : écart nul dans les hautes lumières, de 0 à 14 niveaux (sur 255) dans les tons moyens (le rendu est un peu plus clair que prévu), noirs relevés à
  34 comme le veut la courbe (début à 0,135, car la LUT relève aussi le noir de Standard).
- **Conclusion de M3a** : une recette noir et blanc sur le Monochrome = descripteur **drapeau 1** (gabarit High Contrast), **courbe de base neutre** à nous (format de
  Solarized), et la courbe de la recette calculée sur le rendu de Standard : `c[i] = 16383 × LUT(G_standard[i] / 16383)`. Le petit écart des tons moyens pourra être
  corrigé par une calibration sur cette mire.
- Suite : **M3b**, une vraie recette ajoutée au menu (look « APX 100 » à côté des looks d'origine), avec ce chemin de courbe et les adaptations de l'inventaire 10.3.

## 12. M3b : une recette ajoutée au menu (2026-11-21, en cours)

Ordre confirmé par l'utilisateur pour M3a-6 : R0000170 = Standard, R0000171 = Soft. Les mesures de 11.9 mettent le plancher 34 (début de la courbe APX) sur la photo
Soft, ce qui est cohérent avec cet ordre (les pièces jointes étaient arrivées dans l'ordre inverse).

### 12.1 Ce que M3b demande (d'après l'inventaire 10.3 et le module des paramètres propres)
Les styles ajoutés reposent sur un module natif (`tools/gr4v121/slotparams/slot_params.c`) écrit pour Cinema Yellow : champs de ses 13 paramètres par jeu (FIELD), valeurs
d'usine (FACTORY), lignes du développement RAW (look 9), foncteurs de changement, champs de la vue en direct. Pour une recette noir et blanc, tout cela doit être refait pour
**Monochrome Standard (25)** : 11 paramètres (2 à 7, 17 à 21), look RAW 15. clang (cible armv7) est disponible ici pour recompiler le module.

### 12.2 M3b-1 fait : les champs des paramètres de Monochrome Standard (lu par émulation)
Outil : `tools/gr4v121/look_fields_probe.py` (getters lancés avec deux motifs ; vérifié d'abord sur Cinema Yellow, qui retrouve exactement la table FIELD du module,
à 0xb44 près : les getters lisent la copie miroir).

| Paramètre | photo, jeux 0 à 3 | vidéo, jeux 0 à 3 |
| --- | --- | --- |
| 2 | 0x9b7, 0x9ef, 0xa27, 0xa5f | 0xa97, 0xaac, 0xac1, 0xad6 |
| 3 | 0x9bc, 0x9f4, 0xa2c, 0xa64 | 0xa9a, 0xaaf, 0xac4, 0xad9 |
| 4 | 0x9c1, 0x9f9, 0xa31, 0xa69 | 0xa9d, 0xab2, 0xac7, 0xadc |
| 5 | 0x9c6, 0x9fe, 0xa36, 0xa6e | 0xaa0, 0xab5, 0xaca, 0xadf |
| 6 | 0x9cb, 0xa03, 0xa3b, 0xa73 | 0xaa3, 0xab8, 0xacd, 0xae2 |
| 7 | 0x9d0, 0xa08, 0xa40, 0xa78 | 0xaa6, 0xabb, 0xad0, 0xae5 |
| 17 | 0x9d6, 0xa0e, 0xa46, 0xa7e | 0xaa9, 0xabe, 0xad3, 0xae8 |
| 18 | 0x9db, 0xa13, 0xa4b, 0xa83 | aucun |
| 19 | 0x9df, 0xa17, 0xa4f, 0xa87 | aucun |
| 20 | 0x9e0, 0xa18, 0xa50, 0xa88 | aucun |
| 21 | 0x9e1, 0xa19, 0xa51, 0xa89 | aucun |

Les paramètres 0, 1 et 8 n'ont pas de champ pour Monochrome Standard (confirmé).

### 12.3 Reste à faire pour M3b
1. Valeurs d'usine de ces champs (UserDataInitValue) ; valeurs neutres.
2. Foncteurs de changement de Monochrome Standard (équivalent de FUNCTOR_FIELDS) et champs de la vue en direct.
3. Lignes du développement RAW du look 15 ; listes de paramètres des « maker notes » qui contiennent 25.
4. Module natif paramétré par le look de référence (18 ou 25) et recompilé ; variante noir et blanc de `installExtraSlots` (gabarits 25 / 27, base neutre, visibilité
   Monochrome, liste des paramètres) ; sondes d'émulation ; build de test avec une recette « APX 100 ».

### 12.4 M3b-2 fait : foncteurs, listes des métadonnées, valeurs de départ (2026-11-21)
- **Foncteurs de changement** de Monochrome Standard : les 72 champs (7 paramètres × 8 jeux + 4 paramètres photo × 4 jeux) ont chacun exactement un foncteur dans la zone
  0x53270850..0x532a0850, de la même forme que ceux de Cinema Yellow (chargement du look puis comparaison avec **25**, `cmp r3,#0x19` / `#0xc19`). Le mécanisme de
  `installChangeFunctors` s'applique tel quel avec 25.
- **Listes « looks qui ont ce paramètre »** des métadonnées : 21 listes, 8 contiennent 18, **10 contiennent 25**.
- **Valeurs d'usine** : `UserDataInitValue` n'écrit pas ces champs dans l'objet émulé (il initialise un autre objet) ; dans le module, ces valeurs ne servent qu'à une
  réparation (jeu entièrement à zéro, cas du test 027 sur GR IV couleur), qui ne concerne pas le Monochrome. Valeurs de départ retenues pour une recette (comme pour les
  styles couleur, « 0 » de l'écran) : paramètres 2 à 6 et 17, 18 au milieu de l'échelle (4) ; 7 à 0 (désactivé, hypothèse) ; grain 19 à 0, 20 et 21 à 1.

### 12.5 M3b-3 fait : la recette ajoutée, prête à tester (2026-11-21)
- `slot_params.c` : variante `MONO_LOOK` (look de référence 25, 11 paramètres, champs de 12.2, développement RAW sur le look 15, positions RAW 2..7, 14, 15, 16 et grain,
  enregistrement « GRM1 » distinct). `gen_slotparams.py --mono` écrit `slotparams-mono-native.ts` ; le module couleur régénéré est **identique octet pour octet**.
- `slots.ts` : option `mono` (look de référence par une structure `LookRef` : colonne 28, gabarits de 25, descripteur de High Contrast avec base neutre, post-courbe noir
  et blanc, matrice identité imposée, visibilité Monochrome seulement, 72 foncteurs, 10 listes de métadonnées, RAW 15, paramètres neutres). Un firmware couleur avec un style
  ajouté est **identique octet pour octet** avant et après la modification.
- Option de test `monoRecipes` (moteur et `build.ts`). Build : 1.2.0 + recette « APX 100 ». Sonde `mono_recipe_probe.py` : 56 contrôles ; autres sondes et tests GR IV passent.
- Protocole : `docs/protocole-M3b-mono.md`.

### 12.6 Résultat M3b (2026-11-21) : la recette ajoutée fonctionne
- Retour de l'utilisateur : recette « APX 100 » utilisable, **développement RAW dans l'appareil sans souci**. Limite constatée (connue de GR Mod, pas propre aux recettes) :
  le développement RAW ne propose pas les **ratios ajoutés**, seulement ceux de l'appareil.
- Mire (Standard → APX 100, mêmes conditions) : hautes lumières et tons moyens conformes à la courbe attendue (108 → 159 pour 165 attendu, 134 → 196 pour 195, 157 → 215
  pour 212, 197 → 231 pour 230) ; ombres un peu plus sombres que prévu (27 → 43 pour 51, 50 → 67 pour 81) ; noirs relevés à 34 comme le veut la LUT.
- **M3 est validé** : une recette noir et blanc ajoutée au menu du Monochrome, avec le rendu de la LUT, ses réglages propres et le développement RAW.
- Reste (M4 / M5) : nommer les paramètres 2 à 7, 17 à 21 d'après l'écran ; recettes depuis une LUT `.cube` dans l'application (courbe neutre de la LUT, avertissement
  si la LUT colore ou mélange les canaux) ; plusieurs recettes ; icônes ; packs de recettes Monochrome ; calibration éventuelle des ombres ; passage de l'option de test
  `monoRecipes` en fonction du produit.
- Confirmé par l'utilisateur (2026-11-21) : les réglages propres de la recette fonctionnent (indépendants de Monochrome Standard, conservés à l'extinction) ; l'écran
  de réglages d'APX 100 présente **les mêmes réglages que les autres looks d'Image Control** (ceux de Monochrome Standard). Les numéros 2 à 7 et 17 à 21 n'ont pas besoin
  d'être nommés dans l'application : elle ne règle que la courbe ; les valeurs se règlent dans l'appareil.

## 13. M4 : recettes noir et blanc depuis une LUT dans GR Mod Film (2026-11-21)

### 13.1 Ce que fait l'application
- Avec le firmware du **GR IV Monochrome 1.11** ouvert, la page Image Control ne montre plus le message « no colour slots » mais la section **recettes noir et blanc** :
  on ajoute des places (comme pour les recettes couleur) et on charge un fichier `.cube` sur chacune. Le nom tapé devient le nom du look dans l'appareil (sinon
  `GR Mod <place>`, comme en couleur).
- Seuls les fichiers `.cube` sont acceptés (erreur `mono-cube-only` pour un autre format). Pas de halation ni de réglage de couleur sur ces places.
- Conversion (`core/src/color/mono.ts`) :
  - `monoLutFromCube` lit la LUT sur l'**axe neutre** (R = G = B = i / 255, 256 points, moyenne des trois canaux) ;
  - elle mesure aussi la **coloration** (écart d'un canal à la moyenne, seuil 2 / 255) et le **mélange des canaux** (gris donné par une couleur comparé au gris de sa
    luminance, seuil 8 / 255, sur une grille de 9 × 9 × 9 couleurs). Au dessus d'un seuil, l'application affiche un avertissement : le capteur n'a pas de couleur,
    ce que la LUT fait aux couleurs (virage, filtre, réponse spectrale d'une pellicule) ne peut pas être reproduit, seule la courbe des gris l'est ;
  - `monoRecipeCurve` calcule la courbe de la place : `c[i] = 16383 × LUT(S[i] / 16383)` avec `S` la courbe (verte) de Monochrome Standard lue dans le firmware,
    gardée croissante. C'est la méthode de M3a-6 et M3b.
- Moteur (`core/src/app/engine.ts`) : option `monoRecipes`, fonction `monoRecipes` annoncée pour le programme 1.21 ; `convertPreset(..., mono)` ; la construction pose
  le drapeau `FEATURE2_MONO_RECIPES` (128) dans le paquet, relu ensuite. Les places sont construites par `installExtraSlots(..., { mono: true })` (section 12).
- Interface : `ui/src/store.ts` (`monoRecipesOn`, conversion en mode mono, reconversion au changement de modèle), `ui/src/pages.tsx` (section, avertissement),
  `ui/src/app.tsx` (bouton de téléchargement actif pour le Monochrome avec des recettes), `ui/src/i18n.ts` (textes zh et en).

### 13.2 Vérifications
- Les 4 LUT fournies (dont Agfa APX 100) se construisent par le moteur, fichiers vérifiés ; toutes déclenchent l'avertissement de mélange des canaux (ce sont des
  émulations de pellicule qui tiennent compte des couleurs).
- Site construit (`npx vite build --mode web`) et piloté par Playwright : firmware Mono 1.11 chargé, modèle « GR IV Monochrome », une place, LUT APX 100, téléchargement.
  Le fichier obtenu est reconnu et vérifié par le moteur (`verified: true`).
- Sonde `tools/gr4v121/mono_recipe_probe.py` sur ce fichier : **56 contrôles sur 56** (visibilité Monochrome seulement, tables, enregistrements copiés de Monochrome
  Standard, base neutre, courbe identique sur R, G, B, champs des réglages, liste des paramètres).
- Écart avec la courbe de M3b : au plus 47 sur 16383 (moins d'un niveau sur 255). M3b avait relevé 13 points de la LUT à la main ; l'application lit la LUT entière,
  elle est donc plus fidèle.
- Test unitaire `core/test/mono-recipe.test.ts` (LUT grise sans avertissement, virage et filtre rouge détectés, courbe croissante et bornée) ; tests GR IV passent.

### 13.3 Reste à faire (M5)
- Plusieurs recettes et icônes sur le boîtier ; packs de recettes propres au Monochrome ; calibration éventuelle des ombres (M3b : un peu plus sombres que prévu) ;
  tests du produit complet (build avec suppression de la vidéo et boutons).

### 13.4 Build de test M4 (2026-11-21)
- L'utilisateur ne peut pas construire l'application sur son Mac : firmware de test construit par le moteur de la branche (même code que l'application),
  Monochrome 1.11, suppression de la vidéo, boutons standard, **deux recettes** : « agfa apx 100 » (styles 38) et « fuji neopan » (Acros 100, style 39).
- Moteur : fichier vérifié. Sondes : `mono_recipe_probe.py`, généralisée à plusieurs recettes (`curves` dans curve.json), **102 contrôles** ; `nomovie_probe.py` passe.
- À vérifier sur le boîtier : les deux noms dans Image Control (Monochrome seulement), deux rendus distincts, réglages propres à chaque recette après extinction,
  développement RAW avec chacune.

### 13.5 Résultat du build de test M4 (2026-11-21)
- Retour de l'utilisateur : **tous les points au vert** (deux recettes dans Image Control, rendus distincts sur la mire, réglages propres conservés, développement RAW,
  vidéo absente, boutons).
- **Incident** : une extinction inopinée de l'appareil pendant le changement du contraste d'une recette ; redémarrage sans souci, non reproduit pour l'instant.
  Cause inconnue. À étudier en premier dans M5 (piste : le module des réglages propres, qui écrit les valeurs de la place ajoutée, ou une recette autre que la
  première, que la sonde ne couvrait pas avant le build M4).

## 14. M5 (2026-11-21)

### 14.1 M5-0 : l'extinction inopinée du build M4
- Circonstances (utilisateur) : recette « agfa apx 100 » (style 38), contraste changé **au levier ADJ**, vers **+2** ; **non reproduit** en refaisant le même geste.
- Analyse statique faite :
  - module des réglages propres (`slot_params.c`) : toutes les valeurs passent par des index bornés (`combo`, `j < NP`, `owner_of`), la table est en mémoire
    allouée au chargement ; un réglage au levier pour la recette sélectionnée va directement aux champs de Monochrome Standard (le firmware tel qu'il est) ;
  - générateur des paramètres de visée et d'ADJ (0x532A2CF8), foncteurs de changement (72), lecteurs directs, listes de paramètres : les styles ajoutés y sont
    lus comme 25 (Monochrome Standard) ;
  - recherche dans tout le programme des calculs `style - 25` servant d'index (tables des 8 looks monochromes) : 3 sites, **tous bornés** (`cmp #7`, cas par défaut
    pour 38 et 39) ; **aucun** index `style - 25` sans borne.
- Conclusion : **pas de cause trouvée** dans le code ajouté ; un seul cas, non reproduit. Certitude : moyenne (l'émulateur ne rejoue pas tout le chemin du levier ADJ).
  Classé « à surveiller » : si l'extinction revient, noter recette, réglage, valeur, levier ou menu, et si c'était le premier réglage après le flash.

### 14.2 M5-1 : les icônes
- Déjà en place dans l'application : `extraSpecs` (mode Monochrome) passe l'icône de chaque place (texte « GR1 », « GR2 »... par défaut, ou une image), comme en
  couleur. Le build de test M4, construit hors de l'application, avait des icônes vides. Reste à voir une icône sur le boîtier.

### 14.3 M5-2 : packs de recettes Monochrome (2026-11-21)
- Format (`ui/src/packs.ts`) : famille `gr4mono`, écrite en **version 2** du format des packs de recettes. Une version de GR Mod Film antérieure à 1.3 lisait toute
  famille inconnue comme GR III : avec la version 2, elle répond « pack d'une version plus récente » au lieu de poser des recettes noir et blanc sur des films couleur.
  Une version 2 d'une autre famille est refusée (« newer »). Une recette Monochrome garde son nom (`names.en`), son icône et sa LUT `.cube` ; code de film, halation
  et preset `.xmp` sont retirés à l'écriture comme à la lecture.
- Application (`ui/src/store.ts`) : sur le Monochrome, l'export prend les **places ajoutées** (une place sans LUT ni nom est ignorée) ; l'import les recrée
  (« Remplacer » retire les places existantes, « Ajouter » les met après, 20 au plus), avec nom, icône et LUT reconvertie. Un pack Monochrome est refusé sur
  un autre modèle et inversement (message « pack pour un autre appareil », qui cite maintenant le GR IV Monochrome). Collection communautaire : libellé
  « GR IV Monochrome ».
- Vérifié : test `core/test/packs.test.ts` (version 2, nettoyage, refus) ; site piloté par Playwright : deux recettes (APX 100 nommée, Neopan), export, site neuf,
  import (noms et icônes « GR1 », « GR2 » retrouvés), « No movie », téléchargement ; refus du pack sur le modèle GR IV. Firmware obtenu : vérifié par le moteur,
  `mono_recipe_probe.py` 102 / 102 (courbes calculées par l'application), `nomovie_probe.py`, `holdbuttons_probe.py` 48.
- Build de test M5-2 : ce firmware (fait par le site, avec ses icônes). À vérifier sur le boîtier : icônes « GR1 » et « GR2 » dans Image Control, noms « APX 100 »
  et « GR Mod 2 », rendus comme M4.
- **Résultat sur le boîtier (2026-11-21)** : tous les tests OK (noms, icônes « GR1 » et « GR2 » dans le menu et au levier ADJ, rendus de la mire conformes à M4,
  réglages propres conservés, contraste +2 au levier répété sans extinction, vidéo absente, boutons, développement RAW). M5-3 (ombres) : voir 14.5.

### 14.4 M5-4 : finition (2026-11-21)
- Test du produit `core/test/gr4-monorecipes.test.ts` (firmware Mono 1.11) : conversion d'un `.cube` (matrice identité, même courbe sur R, G, B, croissante),
  avertissement de mélange, refus d'un `.xmp` ; build complet à deux recettes avec suppression de la vidéo et boutons, vérifié et relu (`monoRecipes` maintenant
  rapporté par `inspect`) ; refus sans place ajoutée ; refus sur le firmware 1.20.
- README : section « What is new in 1.3.0 » et ligne dans la liste des fonctions.
- Reste, sur décision de l'utilisateur : numéro de version 1.3.0, PR vers `main`, publication du site et de la release.

### 14.5 M5-3 : les ombres (2026-11-21)
- Mesures sur les photos du test M5-2 (mire, mêmes réglages). **Ordre des photos réattribué** : la photo 1 plafonne à 240, le blanc de la LUT Acros (0,94 × 255),
  la photo 3 atteint 255 : photo 1 = Neopan, photo 2 = APX 100, photo 3 = Standard (même inversion qu'en M3a-6).
- Écart mesuré moins attendu (attendu = LUT appliquée au rendu de Standard) : hautes lumières justes (0 à 4 niveaux), ombres et bas des tons moyens **trop sombres**,
  jusqu'à -15 niveaux (APX) et -10 (Neopan). Même forme pour les deux LUT, comme en M3b : écart systématique, pas du bruit.
- Inversion par LUT : la valeur que la courbe a reçue (LUT⁻¹ de la mesure) est la même pour les deux LUT à 1 niveau près ; et la **position i** de cette valeur dans
  la courbe verte de Monochrome Standard vaut le rendu de Standard à 1 ou 2 niveaux près sur toute la gamme (47 → 46,8, 77 → 77,6, 131 → 132,1, 197 → 198,4).
- Conclusion : sur le chemin des places ajoutées (drapeau 1, base neutre), **l'entrée i de la courbe est déjà le rendu de Monochrome Standard** (i / 255). La bonne
  courbe est `c[i] = 16383 × LUT(i / 255)` ; passer d'abord par la courbe verte de Standard (`c[i] = LUT(G[i])`, sections 11 et 12) assombrissait les ombres.
  Monochrome Standard lui-même utilise le drapeau 0 (base officielle, pointeurs de courbes ignorés), d'où la confusion. Certitude : élevée (deux LUT concordantes).
- Correction : `monoRecipeCurve(neutral)` (plus de courbe de Standard), moteur et test unitaire à jour. Les empreintes des recettes changent : après le flash, les
  réglages propres des recettes repartent de zéro.
- Build de vérification (site : APX 100 + Neopan, sans vidéo) : moteur vérifié, `mono_recipe_probe.py` 102 / 102, `nomovie_probe.py`. À valider sur la mire.
- **Résultat sur le boîtier (2026-11-21)** : mire, mêmes réglages ; photos reçues dans l'ordre inverse de la prise de vue (identifiées au blanc : Standard 255, Neopan 240).
  Écart mesuré moins attendu sur les 33 paliers distincts : **APX 100 moyen +0,3, absolu moyen 0,4, max +1,2 ; Neopan moyen +0,5, absolu moyen 0,7, max +2,0**
  (avant la correction : jusqu'à -15 et -10 dans les ombres). Les recettes suivent leur LUT sur toute la gamme. **M5-3 validé.**
- Publication : option B retenue par l'utilisateur (la correction entre dans `main` avant le tag `v1.3.0`).
