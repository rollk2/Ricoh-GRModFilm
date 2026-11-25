# Tests sur le boîtier avant la 1.3.5 (2026-11-25)

Deux firmwares, un par boîtier. Chacun a été vérifié avant envoi : relu et reconnu par l'application, contrôlé à l'émulateur
(voir `docs/film-mode-notes.md`, section 1.3.5, et `docs/amont-0.9-etude.md`).

Avant chaque flash : batterie chargée, copie du firmware officiel à portée de main, carte formatée dans l'appareil.
Copier `fwdc239b.bin` (GR III) ou `fwdc248b.bin` (GR IV) à la racine de la carte, puis Menu > Setup > Firmware Update.

---

## T-SRB1 : GR III 2.10, stabilisation selon la vitesse devenue option bêta

Fichier : `T-SRB1-GR3-firmware.zip` (`fwdc239b.bin`, SHA-256 commençant par `6819c43d18262ff2`).

Contenu : mode pellicule, 6 films (Classic Neg, Classic Chrome, Astia, Eterna, Nostalgic Neg, Reala Ace, pack abpy),
ratios 65:24, 2.39:1, 2:1, 5:4, date imprimée, sans vidéo, boutons Hold, **sans** l'option « SR by shutter speed ».

But : vérifier qu'un boîtier où une vitesse SR a été choisie avec un ancien firmware revient proprement au menu
d'origine (Off / On), sans vibration.

### Préparation (avec ton firmware actuel 1.3.4, avant de flasher T-SRB1)
1. Menu > Shake Reduction : choisir une vitesse, par exemple **1/250**.
2. Enregistrer aussi une vitesse dans un mode U : passer en U1, Shake Reduction sur **1/60**, puis Menu > Mode Memory /
   enregistrer les réglages en U1 comme d'habitude.
3. Éteindre.

### Flash puis vérifications
| # | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Flasher T-SRB1, rallumer, mode P | L'appareil démarre normalement |
| 2 | Menu > Shake Reduction | La liste ne propose que **Off** et **On** ; **On** est sélectionné (la vitesse 1/250 a été remise à On) |
| 3 | Écran de prise de vue | La main SR s'affiche normalement, sans clignoter |
| 4 | Viser 10 s à 1/30 puis à 1/1000 | Aucun bourdonnement ni vibration de l'objectif |
| 5 | Passer en U1 | Shake Reduction sur **On** (la vitesse 1/60 enregistrée a été remise à On) ; pas de vibration |
| 6 | Shake Reduction sur **Off**, éteindre, rallumer | Reste sur Off (le réglage normal fonctionne) |
| 7 | Shake Reduction sur **On**, photo à main levée en 1/15 | Photo nette, stabilisation active |
| 8 | Mode pellicule : charger un film en U, prendre 2 vues, Film Advance | Fonctionne comme en 1.3.4 |
| 9 | Veille puis réveil, changer de film | Pas de gel |

À noter si un point échoue : le numéro du point, ce qui s'affiche, une photo de l'écran si possible.

---

## T-BG1 : GR IV Monochrome 1.11, batterie en %, grilles, tri des ratios

Fichier : `T-BG1-GR4Mono-firmware.zip` (`fwdc248b.bin`, SHA-256 commençant par `020a1bb8ffe8b06b`).

Contenu : recette Tri-X 400, sans vidéo, boutons, ratio 65:24 ajouté, ordre du menu Aspect Ratio 3:2, 65:24, 1:1,
16:9, 4:3 (déjà validé par T-RO1), **batterie en pourcentage**, **grilles personnalisées** :
- grille 3x3 : les 2 tiers horizontaux et verticaux, **plus** la ligne centrale horizontale et verticale, **plus** les deux
  diagonales (les 8 lignes) ;
- grille 4x4 : seulement les **quarts** (2 lignes horizontales, 2 verticales), **sans** ligne centrale ni diagonale.

### Batterie
| # | Action | Résultat attendu |
| --- | --- | --- |
| 1 | Allumer, écran de prise de vue | L'icône de batterie montre un **chiffre** (10 à 100) au lieu des 3 barres |
| 2 | Lecture (bouton Play) | Même chiffre dans l'icône |
| 3 | Comparer au niveau réel connu (batterie pleine : 90 ou 100) | Cohérent à 10 % près |
| 4 | Utiliser l'appareil 15 à 20 min (photos, menus) | Le chiffre baisse par pas de 10, sans revenir en arrière ni clignoter entre deux valeurs |
| 5 | Brancher le câble USB (alimentation) appareil allumé | L'icône d'origine de l'appareil (prise) réapparaît ; débrancher : le chiffre revient |
| 6 | (Si l'occasion se présente) batterie presque vide | 20 % en jaune, 10 % en rouge ; sous 5 % l'icône vide d'origine |

### Grilles
| # | Action | Résultat attendu |
| --- | --- | --- |
| 7 | Menu > réglage de l'affichage > Grid Style : **3x3** | 8 lignes : 2 horizontales aux tiers, 1 horizontale au centre, 2 verticales aux tiers, 1 verticale au centre, 2 diagonales d'angle en angle |
| 8 | Grid Style : **4x4** | 4 lignes seulement : 2 horizontales et 2 verticales aux quarts (à 1/4 et 3/4) ; **pas** de ligne au centre, **pas** de diagonale |
| 9 | Avec la grille 3x3, passer en ratio 65:24 puis 1:1 | Grille visible et cohérente dans le cadre |
| 10 | Grid Style : Off | Plus de grille |

### Le reste (non-régression)
| # | Action | Résultat attendu |
| --- | --- | --- |
| 11 | Menu Aspect Ratio et bouton Fn | Ordre 3:2, 65:24, 1:1, 16:9, 4:3 (comme T-RO1) |
| 12 | Image Control > Tri-X 400, une photo | Rendu noir et blanc normal |
| 13 | Veille puis réveil, changer de look (Tri-X, Standard, autre) | Pas de gel, pas d'extinction |
| 14 | Veille puis réveil, changer de ratio | Pas de gel |

À noter si un point échoue : le numéro du point, ce qui s'affiche, une photo de l'écran si possible.

---

## Résultats

| Test | Date | Résultat | Remarques |
| --- | --- | --- | --- |
| T-SRB1 (GR III) | 2026-11-25 | **Validé** | Avant le flash, Shake Reduction et les modes U étaient sur 1/40 (1.3.4). Après : liste On / Off seulement ; main SR normale à 1/20, 1/40, 1/100 ; plus aucune vibration (constatée auparavant) ; Off gardé après extinction, main cachée ; On + photo à main levée à 1/15 ; mode U, film chargé, photo, Film Advance : comme avant. Point 9 sans objet : pas de mode veille sur le GR III (nouvelle demande, cahier des charges). |
| T-BG1 (GR IV Monochrome) | 2026-11-25 | **Validé** | Batterie : nombre en prise de vue et en lecture (30, 20 en jaune, 40), icône prise sur USB, retour au débranchement (point 3 non testable). Ratios, Tri-X, veille puis look ou ratio : sans gel. Grilles, mesurées sur les photos de l'écran : « 3x3 » = lignes à 1/3, 1/2, 2/3 dans les deux sens et les deux diagonales ; « 4x4 » = lignes à 1/4 et 3/4 seulement (bande centrale deux fois plus large). Conforme au réglage du test, pas d'inversion : la 4x4 réduite aux quarts ressemblait à une 3x3. |
