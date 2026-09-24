# Brief — Claude Code

## Objectif de cette itération
Construire le socle Phase 1 uniquement (voir `00-overview.md`) : speech-to-text
fonctionnel + rendu shader en grille de grains + transition de chute. **Pas** de
Jev, **pas** d'emoji détecté automatiquement — juste le mot brut du STT rendu en
grains.

## Stack recommandée
- Vanilla JS + **WebGL2** en direct (pas de framework 3D lourd type Three.js —
  l'effet est 2D/instanced, pas besoin de scène 3D complète, et ça garde le
  contrôle total sur le shader pour la Phase 2)
- Si le boilerplate WebGL2 brut ralentit l'itération, une lib minimaliste comme
  `twgl.js` ou `regl` est acceptable pour réduire la verbosité — mais le shader
  (vertex/fragment) doit rester écrit à la main, pas généré
- Aucune dépendance serveur : tout tourne côté client (STT navigateur + rendu GPU
  local)

## Structure de fichiers suggérée
```
/src
  main.js           # orchestrateur, boucle de rendu
  speech.js          # wrapper Web Speech API + fallback input texte
  textMask.js         # génération du masque canvas 2D par mot
  grainField.js        # gestion de la grille de grains, buffers d'instance
  shaders/
    grain.vert
    grain.frag
/index.html
```

## Jalons / critères d'acceptation

1. **STT fonctionnel avec fallback**
   - Le micro capture la voix en continu (si permissions/navigateur OK)
   - Un champ texte permet de simuler une phrase si le micro est indisponible
   - Une phrase "finalisée" déclenche l'affichage

2. **Rendu en grille de grains conforme à la référence**
   - Le mot affiché est composé uniquement de points sur grille, jamais de texte
     "plein"/typographique visible
   - Les points remplissent densément l'intérieur des lettres (le fill), pas
     seulement leurs contours
   - Grille parfaitement régulière et déterministe pour cette itération : pas de
     bruit/jitter aléatoire (à ajouter plus tard si besoin)

3. **Transition de chute**
   - À la phrase suivante (ou après une pause de silence), les grains du mot
     précédent tombent avec gravité + léger rebond amorti + fade, avant de
     disparaître
   - La physique tourne sur GPU (pas de boucle CPU par grain et par frame)

4. **Performance**
   - Fluide (60fps visé) même avec un mot de taille généreuse à l'écran
   - Aucun recalcul de masque ou de buffer d'instance en dehors des changements de
     texte

## Explicitement hors scope pour cette itération
- Intégration Jev / détection d'emoji automatique
- Bruit/jitter organique sur la grille (grille régulière et déterministe pour
  l'instant)
- Couleur autre que noir/gris sur fond blanc
- Historique de plusieurs mots affichés simultanément (une phrase/mot à la fois
  suffit pour valider le socle)

## Référence utile
Le prototype précédent (`ascii-speak-prototype.html`, lettres individuelles en 2D
canvas avec chute/rebond/squash & stretch) sert de base pour les réglages de
physique (gravité, amortissement, timing) — à porter dans le vertex shader plutôt
qu'à réécrire de zéro.
