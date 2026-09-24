# Architecture technique

## Pipeline complet (Phase 1)

```
Micro
  │
  ▼
Web Speech API (navigateur, local)
  │  → texte interim (en cours) + texte final (phrase finalisée)
  ▼
Générateur de masque de texte (canvas 2D offscreen)
  │  → texture (bitmap alpha de la phrase courante)
  ▼
Moteur de grille de grains (WebGL2, instanced rendering)
  │  → échantillonne la texture, pilote taille/opacité/jitter par grain
  ▼
Rendu à l'écran (fond blanc, grains noirs/gris)
  │
  ▼ (à la pause / phrase suivante)
Physique de chute par grain (GPU, vertex shader)
  → dissolution, puis nouveau mot
```

## Modules

### 1. STT (`speech.js` ou équivalent)
- `SpeechRecognition` / `webkitSpeechRecognition`, `continuous: true`,
  `interimResults: true`
- Expose deux callbacks : `onInterim(text)` et `onFinal(text)`
- **Fallback obligatoire** : un input texte pour simuler des phrases, parce que
  l'API vocale peut être bloquée selon navigateur/permissions/contexte
  (déjà présent dans le prototype précédent — à réutiliser)

### 2. Générateur de masque (`textMask.js`)
- Canvas 2D offscreen, taille = zone d'affichage du mot (ou de toute la scène,
  selon si on veut un seul mot centré ou une ligne qui défile — à trancher au
  design, cf. `03-claude-code-brief.md`)
- Dessine le texte courant (police, taille, alignement)
- Fournit une fonction pour lire l'alpha à une coordonnée donnée (ou exporte
  directement le canvas comme texture GPU)

### 3. Grille de grains (`grainField.js` + shaders `.vert`/`.frag`)
- Définit la grille de positions (espacement fixe en pixels, calculé une fois selon
  la taille de viewport)
- À chaque nouveau mot : recalcule les attributs par instance (taille, opacité,
  seed de jitter) en échantillonnant le masque de texte à chaque position de grille
  — ce calcul peut se faire côté CPU une fois (pas par frame) et être uploadé comme
  buffer d'instance, ou directement dans le fragment shader en passant le masque
  comme texture (à trancher selon perf réelle, mais commencer par le plus simple :
  CPU une fois par mot, upload buffer)
- Le rendu par frame se limite à mettre à jour un uniform de temps (pour
  l'animation de chute) — pas de recalcul CPU par frame

### 4. Physique de chute (dans le vertex shader)
- Chaque grain "tombant" a un temps de naissance (`birthTime`) stocké comme
  attribut d'instance
- Le vertex shader calcule la position courante de façon analytique à partir de
  `t = uTime - birthTime`, pas de simulation itérative CPU
- L'opacité de fade-out peut être dérivée du même `t`

### 5. Orchestrateur (`main.js`)
- Reçoit les événements STT
- Décide quand un mot est "terminé" et doit basculer en mode chute (sur `onFinal`,
  ou sur une pause de silence détectée)
- Déclenche la génération du masque pour le nouveau texte
- Boucle de rendu (`requestAnimationFrame`)

## Notes de performance
- Le nombre de grains dépend de la taille du texte et de l'espacement de grille —
  pour un mot affiché en grand à l'écran, ça peut monter à quelques milliers de
  points. L'instanced rendering WebGL2 gère ça sans problème tant que la logique
  par-frame reste sur GPU (uniforms + shader), pas de boucle JS par grain.
- Éviter de recalculer le masque de texte à chaque frame — seulement quand le texte
  affiché change.

## Point d'extension pour la Phase 2 (Jev)
Le module orchestrateur ne doit pas supposer que le texte affiché == texte STT brut.
Prévoir un point d'interception entre "texte finalisé par le STT" et "texte envoyé
au générateur de masque", où un mot pourra être remplacé par un glyphe emoji choisi
par Jev. Le moteur de rendu (masque + grille de grains) doit fonctionner
indifféremment avec du texte latin ou un emoji unicode — pas de logique spécifique
aux caractères à coder en dur dans le renderer.
