# Campagne de tests de la V1 (GR Mod Film 1.0.0)

Protocole à suivre sur le boîtier avec le candidat **1.0.0-RC1**, d'abord sur le GR III 2.10, puis sur le
GR IIIx 1.60 (semaine suivante). Chaque bloc se fait en une séance ; à la fin de chaque bloc, Claude pose
les questions de résultat en QCM. Un écart se note avec : le bloc, l'étape, ce qui était attendu, ce qui
s'est passé, et si possible une photo de l'écran.

## Le candidat 1.0.0-RC1

Construit comme le fait le programme (même chemin, mêmes options), avec la collection communautaire :

- Films : 1 « Sample Warm » (code SWRM), 2 « Sample Cool » (SCOL), 3 « Film 3 » (sans preset).
- Ratios ajoutés : XPan 65:24, Scope 2.39:1, Univisium 2:1, Large format 5:4.
- Interrupteurs : mode pellicule, No movie, Rear dial off, date imprint, soft focus.
- La version écrite dans `GRFILM.SET` est encore « 0.9.9 » (passera à « 1.0.0 » à la release : seul ce
  texte change).

Avant de commencer : une carte formatée dans le boîtier, la batterie chargée, une deuxième carte pour le
bloc 8, et le firmware officiel sur l'ordinateur pour le bloc 9.

## Bloc 1. Installation et menus

1. Copier le RC1 à la racine de la carte, flasher (Setup > Firmware Info/Options > Update).
2. Au redémarrage : Setup > Firmware Info/Options indique 2.10 (GR III) ou 1.60 (GR IIIx).
3. Image Control : les 3 films apparaissent après les looks du boîtier, avec leurs noms et icônes.
4. Aspect Ratio : 3:2, 1:1, puis XPan, Scope, Univisium, Large format, dans l'ordre choisi.
5. Pas d'onglet Movie Settings en P, Av, Tv, M ; en U1 à U3, l'onglet « Film Mode » est à sa place.
6. Setup : Hide Settings, Save Settings to Card, Load Settings from Card sous Firmware Info/Options.

## Bloc 2. Vie d'un rouleau

1. En U1 : film Sample Warm, ratio 3:2, Film Roll Mode sur On (onglet Film Mode), Save Settings dans U1.
2. Régler une touche sur Film Advance (Fn Button Settings).
3. Première vue : le compteur affiche `1/36` puis, après Film Advance, `2/36`. Le dossier `NNNSWR36` est
   créé, les fichiers s'appellent `SWRM....JPG`.
4. Plusieurs déclenchements sans avancer : une seule image, superposée. Film Advance l'enregistre.
5. Éteindre en cours de surimpression : la vue est enregistrée et compte comme une avance.
6. Changer de film ou de format en cours de rouleau : verrou du rouleau (lignes absentes du menu, touches
   et ADJ sans effet) ; Rewind (onglet Film Mode) : « Execute » termine le rouleau, message « New roll
   loaded. », la vue suivante ouvre un nouveau dossier.
7. Ratio XPan dans U2 : compteur `/21`. Noter la longueur affichée pour Scope, Univisium et Large format.
8. Formater la carte : tous les rouleaux reprennent à la première vue.
9. Fin de rouleau (avec un format court ou en avançant jusqu'au bout) : message de fin 2 s (OK le ferme),
   la vue suivante démarre un nouveau rouleau.

## Bloc 3. Touches

1. Fn Button Settings : WB Button et Macro Button présents ; laissés tels quels, ils gardent Balance des
   blancs et Macro.
2. Rewind Film sur une touche : « Rewind the film? » 4 s ; OK rembobine, MENU ou l'attente annule.
3. Lignes Hold : une fonction en appui long sur Fn, ISO, Drive, WB, Macro ; l'appui court agit au relâcher.
4. Rear dial off : la molette arrière ne fait rien, ses 4 touches et OK marchent ; Fn maintenu + molette
   avant fait ce que faisait la molette arrière (profondeur de champ en Snap) ; Fn seul agit au relâcher.
5. Wireless Button : mêmes fonctions que les autres touches (Film Advance compris).

## Bloc 4. Recettes de la collection

1. Photo d'une même scène avec Standard, Sample Warm et Sample Cool : Warm plus chaud, Cool plus froid,
   contraste doux, rien de cassé (couleurs, bruit, bandes).
2. Paramètres d'un film : la ligne Grain Effect (Off, 1, 2, 3) ; une photo à 3 montre le grain.
3. Halation : une source lumineuse dans le cadre, la halation visible selon le réglage.
4. Film 3 (sans preset) : rendu de Standard, nom « Film 3 ».
5. Temps d'enregistrement et d'extinction comme avec Standard.

## Bloc 5. Ratios

1. Chaque ratio ajouté : cadrage de la visée et taille de l'image conformes (XPan 6000×2216).
2. L'ordre du menu et le cycle de la touche Fn suivent l'ordre choisi.
3. Le ratio choisi reste après extinction et rallumage.

## Bloc 6. Réglages sur la carte

1. Hide Settings : cocher Flash Mode, la ligne quitte le menu, les listes des touches et Mode Memory ;
   décocher la fait revenir.
2. Save Settings to Card : `GRFILM.SET` à la racine (25 772 octets) ; le relire avec le programme ou le
   site (page Features) : modèle et version justes.
3. Changer quelques réglages et une BOX, puis Load Settings from Card : réglages revenus après
   redémarrage, rouleaux rembobinés.
4. Un `GRFILM.SET` d'un autre modèle ou abîmé : refusé, rien ne change.

## Bloc 7. Date et flou

1. Date imprint : date (et nom du look) imprimée selon le menu ; sans date, rien d'imprimé.
2. Soft focus sur le levier ADJ : Weak, Medium, Strong visibles, Off net.

## Bloc 8. Robustesse

1. Extinction en plein rouleau, rallumage : le rouleau reprend à la bonne vue, dans le même dossier.
2. Batterie retirée puis remise en cours de rouleau : idem (au pire la vue en cours perdue).
3. Changer de carte en cours de rouleau : le rouleau repart à 1 dans un nouveau dossier.
4. Lecture : ouvre la dernière photo prise, quel que soit le dossier.
5. Passer de U1 à U2 à P et revenir : chaque rouleau reprend où il en était, P range ses photos à part.
6. SR par vitesse : choisir 1/60, l'icône SR s'éteint au-dessus de 1/60.

## Bloc 9. Retour au firmware officiel

1. Remettre les réglages d'usine (Setup > Reset Settings) comme le demande le programme.
2. Flasher le firmware officiel (2.10 ou 1.60) : le boîtier démarre normalement, sans les ajouts.
3. Reflasher le RC1 : tout revient, les BOX gardent ce qui est compatible.

## Résultats

| Bloc | GR III 2.10 | GR IIIx 1.60 |
|---|---|---|
| 1. Installation et menus | | |
| 2. Vie d'un rouleau | | |
| 3. Touches | | |
| 4. Recettes | | |
| 5. Ratios | | |
| 6. Réglages sur la carte | | |
| 7. Date et flou | | |
| 8. Robustesse | | |
| 9. Retour à l'officiel | | |
