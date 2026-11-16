# Bogues relevés pendant la campagne V1

Décision du 2026-11-15 : on **collecte** les bogues pendant la campagne ; les tests de vérification et les
correctifs se font tous à la fin. Chaque entrée : ce qui a été vu, la cause probable, l'état, les tests à
faire sur le boîtier.

| N° | Bogue | État |
|---|---|---|
| 1 | L'écran vibre avant la mise au point | Corrigé dans 1.0.0-RC2, à vérifier sur le boîtier |
| 2 | Pas de superposition à la première photo après l'allumage | À reproduire |
| 3 | Photos de pellicule dans le dossier RICOH (P, Av, Tv, M) | Hypothèse, correctif proposé, à reproduire |

## 1. L'écran vibre avant la mise au point (RC1)

- Vu : pas systématique ; Shake Reduction réglée sur une vitesse (1/60), lumière faible.
- Cause (certitude forte) : la SR par vitesse est recalculée à chaque changement de vitesse de la visée ;
  en basse lumière la vitesse oscille autour du seuil, la SR se coupe et se rallume, le capteur se recentre.
- Correctif (RC2, choix de l'utilisateur) : hystérésis de 2/3 d'IL (`sr-speed.ts`, recette `srHyst`).
- Tests à faire (RC2) :
  1. Seuil 1/60, même pénombre, viser 10 à 20 s sans mise au point : plus de vibration.
  2. Vers 1/30 : SR active (icône allumée) ; vers 1/250 : coupée (icône éteinte).

## 2. Pas de superposition à la première photo après l'allumage

- Vu : U1, mode pellicule ; allumage, déclenchement, pas de superposition ; la photo suivante a fonctionné.
  Détails non retenus (quelle photo, réveil ou allumage).
- Piste : l'allumage en U force la multi-exposition après Mode Memory (V1-RC4, validé) ; un réveil de
  veille ne passe pas par l'allumage. Lien possible avec le bogue 3.
- Tests à faire (U1, mode pellicule, rouleau entamé), noter à chaque fois le compteur avant et après :
  1. Extinction au bouton, rallumage, 2 photos sans Film Advance : la 2e se superpose-t-elle à la 1re ?
  2. Veille, réveil à mi-course, 2 photos sans Film Advance : même question.

## 3. Photos de pellicule dans le dossier RICOH

- Vu : des fichiers nommés avec le code du film (le nommage du mode pellicule a marché) rangés dans le
  dossier des modes libres. Contexte : changement de mode, Rewind ou fin de rouleau. Quelles photos : non
  retenu.
- Hypothèse (certitude moyenne) : une vue en attente (déclenchée, pas avancée), puis la molette tournée ;
  le boîtier termine la multi-exposition et écrit le fichier pendant le changement de mode, quand il dit
  encore U1 mais que l'enregistrement en cours est déjà celui de P (écart déjà vu en T16-CLO3). Le crochet de
  `SetFilePath` (`film-roll.ts`, `installFolders`) prend alors le chemin des modes libres : le garde-fou
  T14-DIR14 ne joue que si le mode actif a déjà changé.
- Correctif proposé (non fait) : à l'écriture d'un fichier, si une vue est en attente pour un mode U et que
  l'enregistrement en cours n'a pas le mode pellicule, le rouleau est lu dans la BOX de ce mode U ; le cas
  normal ne change pas. Vérification : un cas d'émulation de cet écart, `film_roll_check.py`, les sondes.
- Tests à faire :
  1. U1, rouleau entamé : une photo sans avancer, puis molette sur P tout de suite : dossier de la photo ?
  2. Même chose avec Rewind Film (touche ou menu) au lieu de la molette : dossier ?
  3. Contrôle : photo, Film Advance, puis P : la photo doit être dans le dossier du rouleau.
  4. Les photos mal rangées étaient-elles superposées ou simples ? (lien avec le bogue 2)
