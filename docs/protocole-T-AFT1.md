# Protocole T-AFT1 : lire ce que fait l'autofocus (GR III 2.10)

Date : 2026-11-21. Objectif : découvrir, sur le boîtier, la **suite réelle des codes d'action** de l'autofocus par contraste et la **durée de chaque
phase**, imprimées sur la photo par le date imprint. C'est une étape de recherche : le but n'est pas encore de comparer deux firmwares (c'est T-AFT3).
Plan complet : `docs/film-mode-notes.md`, section « Mesure de la durée d'AF par le date imprint ».

## 1. Le fichier

- Fichier : `fwdc239b.bin` (build GR Mod Film complet de test : mode pellicule, grain, boutons, Save/Load Settings, 2 films, ratio 65:24, SR par vitesse,
  AF Point, plus le chronomètre T-AFT1). L'autofocus est **celui d'origine** : aucune modification des 19 mots de l'auteur.
- Il ne doit servir qu'à ce test. Revenir à votre firmware habituel ensuite, avec la même procédure.

## 2. Avant de commencer

1. Batterie pleine. Carte SD formatée dans l'appareil, **sans autre fichier firmware**.
2. Copier `fwdc239b.bin` à la racine de la carte, flasher (procédure Ricoh habituelle : MENU maintenu à l'allumage, confirmer), éteindre quand « completed »
   s'affiche, **retirer le fichier de la carte**.
3. Réglages à faire dans l'appareil et à noter :
   - **Date Imprint activé** (le chronomètre s'imprime par ce moyen) ;
   - mode **P**, autofocus **AF simple** (AF-S), zone **Spot au centre**, **Face/Eye Detection désactivée**, **AF Assist Light désactivée** ;
   - pas de mise au point en continu avant l'appui, si le menu le propose ;
   - mode U : **P, Av, Tv ou M** (pas de U1 à U3, pour ne pas lancer un rouleau).

## 3. Le geste, à répéter à l'identique

1. Appareil sur trépied, cadré sur une page de texte à 1,5 m. Un second repère (mur) à 5 m pour défocaliser.
2. Défocaliser : pivoter vers le repère lointain, demi-appui, attendre la mise au point, relâcher.
3. Revenir sur la page de texte.
4. **Demi-appui franc** jusqu'au cadre vert et au bip, **puis appui complet** : la photo est prise et le date imprint est écrit.
5. Attendre 3 secondes. Recommencer.

## 4. Les trois conditions (même geste)

| Condition | Lumière | Photos |
| --- | --- | --- |
| Claire | environ 300 lux sur la page | 10 |
| Moyenne | environ 30 lux | 10 |
| Sombre | environ 5 à 10 lux (une lampe tamisée, volets fermés) | 10 |

Noter la lumière avec une application de mesure en lux sur le téléphone. Total : 30 photos.

## 5. Lire l'impression

Sur chaque photo, le date imprint écrit la date puis, à la suite, **des groupes de deux chiffres** : ce sont les sept cases de l'anneau de recherche, dans l'ordre
des écritures (une case à 246 n'imprime rien). Chaque case décrit **une phase qui vient de finir**, de l'autofocus de cette photo :

- **chiffre des dizaines** : la durée de cette phase en pas de 50 ms, de 0 à 9 (9 veut dire 450 ms ou plus, ou « jamais vu avant ») ;
- **chiffre des unités** : le code d'action de la phase, par son rang : 0 repos, 1 code 1, 2 code 2, 3 code 4, 4 code 8, 5 code 0x10, 6 code 0x20, 7 code 0x40, 8 code 0x80.

Exemple attendu d'un appui en lumière faible (hypothèse de l'étude de l'auteur) : `90 42 63 14 80 ...` = repos long, puis code 2 (210 ms), code 4 (335 ms),
code 8 (70 ms), code 0x80 (moins de 50 ms).

À prendre en photo si l'écriture est petite : photographier l'écran de l'appareil en lecture, ou zoomer à 100 % sur l'ordinateur.

## 6. Ce qu'il faut me transmettre

Pour chaque photo (30) : la condition, la lumière en lux, les chiffres imprimés **tels quels**, et si l'appui a réussi (cadre vert), échoué ou fixé le mauvais
objet. Une simple liste suffit, par exemple :

| N° | Condition | Lux | Chiffres imprimés | Résultat |
| --- | --- | --- | --- | --- |
| 1 | Claire | 310 | 90 42 63 14 80 | vert |

Dire aussi : si **les chiffres se répètent d'une photo à l'autre** (l'anneau n'est pas remis à zéro), si **rien n'est imprimé**, et si l'appareil se comporte
autrement (autofocus plus lent, bip différent, blocage, redémarrage).

## 7. Ce que j'en tirerai

- La **suite de codes** d'un appui (et donc le code de repos et celui de la mise au point confirmée).
- Les durées de phase à 50 ms près (T-AFT2 les affinera au pas de 10 ms).
- Si le crochet change quelque chose à l'autofocus (comparaison avec votre sensation habituelle) : il n'est censé rien changer.

## 8. Arrêt et retour

Si l'appareil se fige, redémarre en boucle, affiche une erreur ou si l'autofocus ne fonctionne plus : arrêter, ne pas insister, me le dire. Pour revenir en arrière,
reflasher votre firmware GR Mod Film habituel ou le firmware officiel de Ricoh.

## 9. Ce qui a été vérifié avant ce test

- Le crochet (sortie du répartiteur d'AF, `0x5340a354`) est vérifié en émulation par `tools/gr3x/af_time_probe.py` : registres conservés, code stocké comme avant,
  octet noté selon le codage ci-dessus, anneau qui boucle à sept cases (11 contrôles).
- Le firmware passe les contrôles internes de GR Mod Film.
- **Non vérifié** : le format exact de l'impression à l'écran (la fonction vient d'un module de date de recherche déjà utilisé pour d'autres tests) et le comportement
  réel du répartiteur sur le boîtier : c'est justement l'objet de ce test.
