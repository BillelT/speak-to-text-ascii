# Spec visuelle — rendu en grille de grains

## Référence
Voir le screenshot fourni par l'utilisateur : le mot "Hello" est composé de
colonnes de points régulièrement espacés qui remplissent l'intérieur des lettres
(le fill), pas seulement leur contour. Pour cette itération : grille parfaitement
régulière, sans bruit/jitter ajouté — on gardera ça pour une itération ultérieure
une fois le socle validé.

**Important : ce n'est pas du texte affiché normalement.** Le texte ne doit jamais
être visible comme une police "classique" — la forme des lettres n'émerge QUE de
l'arrangement des grains. C'est une contrainte forte du projet, pas un détail
cosmétique.

## Principe technique — masque de texte → grille de grains

1. **Génération du masque** : le mot/la phrase à afficher est dessiné une fois sur
   un canvas 2D offscreen (police système, taille contrôlée), qui sert de texture
   de référence — c'est le plus simple et le plus fiable pour obtenir des formes de
   lettres nettes, plutôt que de calculer des glyphes en SDF à la main.
2. **Grille fixe** : par-dessus toute la zone d'affichage, une grille régulière de
   points est définie (espacement en pixels, ex: 6-10px selon la taille du texte).
   Chaque cellule de la grille correspond à un grain potentiel.
3. **Échantillonnage** : pour chaque cellule de la grille, on échantillonne l'alpha
   du masque de texte à cette position (+ éventuellement une petite zone autour,
   moyenne locale). Cette valeur pilote la **taille** et l'**opacité** du point : 0
   si hors de la lettre, taille/opacité max dès que la cellule est dans le fill —
   le remplissage doit être uniformément dense à l'intérieur des pleins, pas
   seulement marqué sur les bords/contours. **Pas de jitter aléatoire de
   position/taille pour l'instant** : grille parfaitement régulière, déterministe.
   Le bruit organique pourra être ajouté dans une itération ultérieure si besoin.
4. **Rendu GPU** : les grains sont dessinés en **instanced rendering** (WebGL2) —
   un seul draw call pour toute la grille, chaque instance = un point avec sa
   position de grille + les attributs d'alpha/taille/jitter dérivés du masque
   (passés via une texture de données ou un buffer d'instance calculé au moment où
   le texte change, pas à chaque frame).

## Pourquoi shader plutôt que 2D canvas ici
Contrairement au premier prototype (texte brut qui tombait lettre par lettre), là
on parle potentiellement de centaines à quelques milliers de points par mot, animés
individuellement (position, taille, opacité, physique de chute). Le 2D canvas
`fillRect`/`arc` par point en boucle JS devient un goulot d'étranglement bien avant
le GPU. Le shader + instancing permet de garder ça fluide même avec beaucoup de
grains et une physique par-grain.

## Style des grains
- Points ronds (petits cercles), pas des carrés — plus organique, correspond au
  screenshot
- Couleur : noir/gris très foncé sur fond blanc, pas de couleur vive pour l'instant
  (rester sobre, la Phase 2/emoji pourra introduire de la couleur si pertinent)
- Taille de grain à ajuster empiriquement mais viser quelque chose de **petit et
  dense** (le screenshot suggère des points fins, plusieurs dizaines par hauteur de
  lettre) — pas un pixel art grossier
- Pour l'instant, opacité/taille uniformes à l'intérieur d'un plein (dérivées
  uniquement de l'échantillonnage du masque, pas de variation aléatoire ajoutée)

## Transition de "chute"/dissolution
Quand une phrase est finalisée et qu'on passe à la suivante (ou après une pause) :
- Chaque grain devient une particule indépendante avec sa propre physique
  (gravité + petite impulsion latérale aléatoire + léger rebond amorti avant de
  disparaître en fondu) — c'est la version "grain" du comportement déjà prototypé
  en 2D pour les lettres, mais appliqué à chaque point de la grille individuellement
- Idéalement cette physique tourne **dans le vertex shader** (mouvement balistique
  analytique piloté par un temps de "naissance" par instance : `position =
  initialPosition + velocity * t + 0.5 * gravity * t²`), pour ne pas dépendre du
  CPU même avec beaucoup de grains simultanés
- Le nouveau mot peut commencer à apparaître pendant que l'ancien tombe encore
  (chevauchement léger) pour garder un rythme dynamique plutôt que des étapes
  strictement séquentielles

## Ce qui reste ouvert / à itérer visuellement une fois le socle en place
- Espacement de grille exact et taille de point (à ajuster à l'œil vs le screenshot)
- Vitesse/intensité de la chute (déjà exploré empiriquement dans le prototype 2D —
  réutiliser ces réglages comme point de départ : gravité, amortissement du rebond,
  squash & stretch)
- Faut-il un léger effet de grain/bruit animé même sur le texte "au repos" (vie
  subtile) ou rester parfaitement statique tant qu'on parle
