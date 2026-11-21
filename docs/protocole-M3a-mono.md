# Protocole M3a : une courbe de recette sur le GR IV Monochrome

Date : 2026-11-21. Étude complète : `docs/gr4-mono-recettes-etude.md`.

## 1. Ce que contient le firmware

- Fichier `fwdc248b.bin` (GR IV Monochrome 1.11) : la 1.2.0 habituelle (sans vidéo, boutons personnalisés) plus **un seul changement de test** :
  le look **Soft** (Monochrome Soft) reçoit la **courbe Agfa APX 100** (tirée de la LUT fournie), à la place de sa courbe d'origine (celle de Monochrome Standard).
- Pas de nouveau look : Soft garde son nom, sa place dans le menu, ses réglages et son effet de douceur. Seule sa courbe de tonalité change.
- But : vérifier sur le boîtier qu'une courbe de style agit bien sur la luminance comme prévu, avant de coder les vraies recettes (looks ajoutés).

Ce que la courbe doit produire (calcul, sur 0 à 1) : là où Monochrome Standard rend un ton à **0,06** (noir), **0,21**, **0,50**, **0,76**, **1,00** (blanc),
Soft (APX) doit rendre environ **0,14**, **0,34**, **0,74**, **0,90**, **0,98** : noirs relevés, tons moyens nettement plus clairs, hautes lumières compressées.

## 2. Flasher

Batterie pleine, carte formatée dans l'appareil, `fwdc248b.bin` seul à la racine, mise à jour par le menu habituel du GR IV, puis retirer le fichier de la carte.

## 3. Réglages (identiques pour les deux looks)

- Mode **M** (ou A avec la correction d'exposition bloquée) : même ouverture, même vitesse, même ISO pour toutes les photos.
- **Monochrome Standard** et **Soft** avec tous leurs réglages à **0** (contraste, hautes lumières, ombres, netteté, clarté, grain désactivé).
- Red Filter désactivé, Date Imprint désactivé, JPEG en meilleure qualité, RAW+JPEG si possible.

## 4. Les photos

1. **Un dégradé de gris** : sur un écran d'ordinateur en plein écran (une image d'un dégradé du noir au blanc, ou une charte de gris imprimée), photographié de face,
   l'écran net et sans reflet. Une photo avec **Monochrome Standard**, une avec **Soft**, sans rien bouger entre les deux.
2. **Une scène habituelle** (intérieur ou extérieur, avec des ombres et un ciel ou une fenêtre) : une photo en Monochrome Standard, une en Soft.
3. En option, une scène avec Soft puis **Soft + Red Filter**, pour l'idée « HIE ».

## 5. Ce qu'il faut me transmettre

- Les **JPEG d'origine** (pas de capture d'écran) des photos 1 et 2, en indiquant lequel est Standard et lequel est Soft.
- Ce que vous voyez : le rendu de Soft ressemble-t-il à de l'APX 100 (gris clairs, noirs moins profonds, hautes lumières douces) ?
- Tout comportement anormal (menu, écran de réglages de Soft, lecture, blocage).

Je mesurerai les gris du dégradé sur les deux photos et les comparerai à la courbe attendue.

## 6. Ce qui a été vérifié avant ce test

- `tools/gr4v121/mono_curve_check.py` : dans la table des courbes, seule la colonne de Soft change, dans les trois variantes, vers un descripteur
  comme celui de High Contrast (courbe propre) dont les trois pointeurs mènent à la courbe APX attendue (114 contrôles).
- Les autres sondes (lignes Hold, sans vidéo) passent sur ce build ; les contrôles internes du firmware passent.
- **Non vérifié** : le rendu réel. C'est l'objet du test.

## 7. Retour en arrière

Reflasher la 1.2.0 habituelle (ou le firmware officiel). En cas de blocage : retirer la batterie, la remettre, et reflasher.
