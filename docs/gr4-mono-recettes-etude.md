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
