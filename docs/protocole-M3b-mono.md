# Protocole M3b : une recette « APX 100 » dans le menu du GR IV Monochrome

Date : 2026-11-21. Étude : `docs/gr4-mono-recettes-etude.md`, section 12.

## 1. Ce que contient le firmware

- 1.2.0 habituelle (sans vidéo, boutons personnalisés) plus **un look ajouté**, « APX 100 », dans la liste d'Image Control, après les looks d'origine.
  Les looks d'origine (Standard, Soft, High Contrast, etc.) sont **inchangés** : Soft retrouve son rendu d'usine.
- La recette suit le chemin validé par M3a-6 (courbe propre après une courbe de base neutre) et repose sur **Monochrome Standard** : mêmes réglages disponibles
  (contraste, hautes lumières, ombres, netteté, etc., grain), avec **ses propres valeurs**, enregistrées avec les réglages, départ à 0.
- Icône provisoire (un dégradé), nom en anglais.

## 2. Vérifications, dans l'ordre (arrêter à la première anomalie)

1. **Menu** : Image Control montre « APX 100 » après les looks d'origine. Le choisir.
2. **Visée** : l'image passe au rendu APX (plus clair dans les tons moyens, noirs relevés, comme Soft en M3a-6).
3. **Réglages de la recette** : ouvrir ses paramètres. Noter les réglages proposés et leur nom (c'est ce qui nommera les paramètres 2 à 7 et 17 à 21 de l'étude).
   Changer le contraste à +2, sortir, revenir : la valeur doit être restée à +2, et Monochrome Standard ne doit **pas** avoir changé.
4. **Photo** : la mire (mêmes conditions que M3a : trépied, M, 1/13 s, f/2.8, ISO 160) en **Standard** puis en **APX 100** (contraste remis à 0). Me les envoyer
   avec l'ordre.
5. **Extinction et rallumage** : APX 100 toujours choisi, contraste toujours tel que laissé.
6. **Lecture** : la photo APX 100 s'affiche ; l'écran d'informations indique le look (au moins sans erreur).
7. **Facultatif, développement RAW dans l'appareil** (si vous avez pris en RAW+JPEG) : développer la photo APX 100. Ce point n'est vérifié que partiellement en
   émulation : si les réglages affichés sont faux ou si l'appareil se bloque, le noter.
8. **Mode Memory / U** : si vous utilisez une position U, y enregistrer APX 100, puis revenir dessus.

## 3. Ce qui a été vérifié avant ce test

- `tools/gr4v121/mono_recipe_probe.py` (56 contrôles) : la recette est visible sur le Monochrome seulement ; ses enregistrements sont ceux de Monochrome Standard,
  avec une matrice neutre et le chemin de courbe validé ; ses réglages lisent les champs de Monochrome Standard ; l'écran de réglages reçoit la liste de Monochrome Standard.
- Le module des réglages propres est recompilé pour Monochrome Standard ; le module des recettes couleur est inchangé octet pour octet, et un firmware couleur avec une
  recette ajoutée aussi.
- Les sondes des lignes Hold, des appuis, de la suppression de la vidéo et de Red Filter passent sur ce build ; les contrôles internes passent.
- **Non vérifié** : le rendu réel, l'écran de réglages réel, le développement RAW (positions des réglages dans la ligne RAW, déduites).

## 4. Retour en arrière

Reflasher la 1.2.0 habituelle (ou le firmware officiel). La recette garde ses réglages dans un enregistrement à part, ignoré sans elle.
