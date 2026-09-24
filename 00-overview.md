# ASCII Speak — Overview

## Pitch
Une expérience web plein écran, fond blanc, qui transforme la voix en direct en
**typographie générative faite de grains** : chaque mot prononcé (ou emoji détecté
plus tard) apparaît sous forme d'une grille de petits points structurés qui dessinent
la forme du texte — pas du texte "brut" affiché normalement, un rendu granulaire,
type halftone/dot-matrix (cf. référence visuelle fournie : le mot "Hello" composé de
colonnes de points qui remplissent l'intérieur des lettres). Pour cette itération :
grille de grains régulière et déterministe, sans bruit organique ajouté.

Quand la personne arrête de parler / fait une pause, les grains se détachent et
tombent avec une physique "juicy" (gravité, léger rebond, fade), avant de laisser
place au mot suivant.

## Scope — deux phases distinctes

### Phase 1 (prioritaire, c'est le socle du projet)
- Speech-to-text en direct (navigateur, Web Speech API)
- Rendu shader du texte détecté sous forme de grille de grains (voir
  `01-visual-spec.md`)
- Transition de "chute"/dissolution des grains à la pause de parole
- Présentation artistique soignée (fond blanc, densité, timing) — **c'est la partie
  qui doit être exceptionnelle**, le reste est secondaire pour l'instant

### Phase 2 (plus tard, pas dans ce brief)
- Intégration de **Jev** (modèle de décision structurée de TypeSafe, primitives
  Choice/Score/Noul) pour détecter en quasi temps réel quel emoji correspond au
  sens de la phrase parmi une bibliothèque fermée (ex: "I am good" → 👍)
- L'emoji détecté remplacerait le mot correspondant et serait rendu avec le même
  moteur de grains (donc le moteur de rendu de Phase 1 doit déjà accepter n'importe
  quel glyphe unicode en entrée, texte ou emoji, sans hypothèse figée)

## Pourquoi cette séparation
La Phase 1 doit tourner et être visuellement aboutie sans dépendre d'aucun appel
réseau IA — seul le STT (local, navigateur) et le rendu (local, GPU) sont dans la
boucle temps réel. Jev viendra se brancher en Phase 2 sans toucher au moteur de
rendu, juste en changeant la source du texte affiché sur certains mots.

## Documents
- `01-visual-spec.md` — spec du rendu visuel (la partie la plus importante)
- `02-architecture.md` — pipeline technique complet, STT → texture → shader → physique
- `03-claude-code-brief.md` — brief actionnable, stack, structure de fichiers,
  jalons d'acceptation
