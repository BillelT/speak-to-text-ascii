// Point de branchement Phase 2 (voir 00-overview.md / 02-architecture.md) :
// détecte si un mot du texte STT a un équivalent visuel évident dans une
// bibliothèque fermée, et retourne le glyphe à substituer.
//
// Le contrat exposé à l'orchestrateur (main.js) est volontairement minimal et
// ne dépend d'aucune implémentation particulière :
//
//   resolveGlyph(text) -> Promise<{ span, glyph, score } | null>
//     - span  : la sous-chaîne de `text` à remplacer (respecte la casse d'origine)
//     - glyph : le glyphe unicode (emoji) à mettre à la place
//     - score : confiance du match, dans [0, 1]
//     - null  : aucune décision assez nette ("Noul") -> le texte brut est gardé
//
// main.js gère déjà tout ce qui est indépendant de Jev lui-même : debounce sur
// les résultats interim, protection contre les réponses obsolètes (le texte a
// changé pendant l'appel), et substitution du mot dans la phrase affichée.
// Cette fonction est le SEUL endroit à remplacer pour brancher le vrai Jev.

// ---------------------------------------------------------------------------
// TODO(Jev) : remplacer le corps de resolveGlyph par le vrai appel à Jev
// (TypeSafe, primitives Choice/Score/Noul). La forme attendue, d'après les
// docs du projet :
//
//   const decision = await jev.decide({
//     input: text,
//     choices: EMOJI_LIBRARY.map((e) => ({ id: e.glyph, keywords: e.keywords })),
//   });
//   if (decision.kind === "Noul") return null;
//   return { span: decision.matchedSpan, glyph: decision.choice.id, score: decision.score };
//
// D'ici là, l'implémentation ci-dessous est un matcher local à base de
// mots-clés, purement synchrone (pas d'appel réseau), qui respecte le même
// contrat pour que tout le reste du pipeline (main.js, grainField.js,
// textMask.js) n'ait rien à changer le jour où le vrai Jev est branché.
// ---------------------------------------------------------------------------

// Bibliothèque fermée de candidats ("Choice"). À étendre librement — chaque
// entrée est { glyph, keywords }, les keywords sont comparés insensibles à la
// casse contre le texte STT (français par défaut, cf. speech.js).
export const EMOJI_LIBRARY = [
  { glyph: "👍", keywords: ["bien", "génial", "super", "good", "great", "parfait", "nickel"] },
  { glyph: "❤️", keywords: ["amour", "aime", "love", "cœur", "coeur"] },
  { glyph: "😂", keywords: ["mdr", "lol", "drôle", "haha", "hilarant"] },
  { glyph: "🔥", keywords: ["feu", "fire", "chaud", "incroyable"] },
  { glyph: "☀️", keywords: ["soleil", "ensoleillé", "beau temps"] },
  { glyph: "🌧️", keywords: ["pluie", "il pleut"] },
  { glyph: "😢", keywords: ["triste", "pleure", "pleurer"] },
  { glyph: "🎉", keywords: ["fête", "célébration", "youpi", "bravo"] },
  { glyph: "☕", keywords: ["café", "coffee"] },
  { glyph: "🚀", keywords: ["fusée", "décolle", "lancement"] },
];

// Score minimal pour accepter un remplacement plutôt que "Noul" (garder le
// texte brut). À ajuster à l'œil selon le taux de faux positifs constaté.
export const JEV_SCORE_THRESHOLD = 0.6;

let enabled = true;
export function isJevEnabled() {
  return enabled;
}
export function setJevEnabled(value) {
  enabled = value;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Renvoie la sous-chaîne de `text` qui matche `keyword` (casse d'origine
// préservée, pour un `.replace()` propre côté appelant), ou null.
// Note : \b de JS ne reconnaît pas les lettres accentuées comme "mot" (donc
// "café" ne matcherait jamais en fin de chaîne) — on utilise des lookarounds
// Unicode (\p{L}) à la place d'un \b classique.
function findSpan(text, keyword) {
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}(?![\\p{L}\\p{N}])`,
    "iu",
  );
  const match = text.match(re);
  return match ? match[0] : null;
}

export async function resolveGlyph(text) {
  if (!enabled || !text || !text.trim()) return null;

  let best = null;
  for (const entry of EMOJI_LIBRARY) {
    for (const keyword of entry.keywords) {
      const span = findSpan(text, keyword);
      if (!span) continue;
      // match de mot entier -> confiance max ; sinon (keyword multi-mots
      // retrouvé tel quel) confiance un cran en dessous.
      const score = span.toLowerCase() === keyword.toLowerCase() ? 1 : 0.75;
      if (!best || score > best.score) best = { span, glyph: entry.glyph, score };
    }
  }

  if (!best || best.score < JEV_SCORE_THRESHOLD) return null; // Noul
  return best;
}
