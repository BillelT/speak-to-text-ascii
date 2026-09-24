import { GrainField } from "./grainField.js";
import { OrbitCamera } from "./camera.js";
import { createSpeechController, isSpeechSupported } from "./speech.js";
import { mountDebugPanel } from "./debugPanel.js";
import { resolveGlyph } from "./jev.js";

const canvas = document.getElementById("scene");
const field = new GrainField(canvas);
const camera = new OrbitCamera(canvas);

const micBtn = document.getElementById("mic-btn");
const keyboardBtn = document.getElementById("keyboard-btn");
const textForm = document.getElementById("text-form");
const textInput = document.getElementById("text-input");
const debugToggle = document.getElementById("debug-toggle");
const debugPanel = document.getElementById("debug-panel");

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  field.resize(window.innerWidth, window.innerHeight, dpr);
  field.rebuildAll();
}
window.addEventListener("resize", resize);
resize();

// ---------- speech input ----------

let silenceTimer = null;
function scheduleAutoFinalize() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => field.finalize(), 1200);
}

// ---------- Jev (Phase 2) : remplacement d'un mot par un glyphe détecté ----------
// Point d'interception entre "texte STT" et "texte envoyé au masque" (voir
// 02-architecture.md). resolveGlyph() est la seule chose spécifique à Jev ;
// tout ce qui suit (debounce, anti-obsolescence, substitution) est générique.

const JEV_DEBOUNCE_MS = 180;

function applyJevDecision(layer, sourceText, decision) {
  if (!decision) return; // Noul : rien d'assez net, on garde le texte brut
  if (!layer || layer.state === "falling" || layer.state === "done") return; // trop tard
  if (layer.text !== sourceText) return; // le texte affiché a déjà changé
  const patched = sourceText.replace(decision.span, decision.glyph);
  if (patched === layer.text) return;
  layer.text = patched;
  layer.rebuild(field.fitFontSize(patched), field.params.spacing * field.dpr);
}

// Débattu sur les résultats interim : le texte change vite pendant qu'on
// parle, on ne veut pas relancer Jev à chaque caractère.
function scheduleJevCheck(text, layer) {
  clearTimeout(layer._jevDebounce);
  const token = (layer._jevToken || 0) + 1;
  layer._jevToken = token;
  layer._jevDebounce = setTimeout(async () => {
    const decision = await resolveGlyph(text);
    if (layer._jevToken !== token) return; // une saisie plus récente a pris le dessus
    applyJevDecision(layer, text, decision);
  }, JEV_DEBOUNCE_MS);
}

// Sur une phrase finalisée : pas de debounce, mais toujours protégé par le
// même token pour ignorer une réponse qui arriverait après coup.
function checkJevNow(text, layer) {
  clearTimeout(layer._jevDebounce);
  const token = (layer._jevToken || 0) + 1;
  layer._jevToken = token;
  resolveGlyph(text).then((decision) => {
    if (layer._jevToken !== token) return;
    applyJevDecision(layer, text, decision);
  });
}

const speech = createSpeechController({
  onInterim(text) {
    const layer = field.setInterim(text, performance.now() / 1000);
    scheduleAutoFinalize();
    scheduleJevCheck(text, layer);
  },
  onFinal(text) {
    clearTimeout(silenceTimer);
    const layer = field.setInterim(text, performance.now() / 1000);
    field.finalize();
    checkJevNow(text, layer);
  },
  onStateChange(listening) {
    micBtn.classList.toggle("listening", listening);
  },
  onUnavailable() {
    micBtn.classList.add("hidden");
    textForm.classList.remove("hidden");
    textInput.focus();
  },
});

if (!isSpeechSupported()) {
  micBtn.classList.add("hidden");
  textForm.classList.remove("hidden");
  textInput.focus();
}

micBtn.addEventListener("click", () => speech.toggle());

keyboardBtn.addEventListener("click", () => {
  textForm.classList.toggle("hidden");
  if (!textForm.classList.contains("hidden")) textInput.focus();
});

textForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  const layer = field.setInterim(text, performance.now() / 1000);
  field.finalize();
  checkJevNow(text, layer);
  textInput.value = "";
});

// ---------- debugger ----------

let panel = null;
debugToggle.addEventListener("click", () => {
  debugPanel.classList.toggle("hidden");
  if (!panel && !debugPanel.classList.contains("hidden")) {
    panel = mountDebugPanel(debugPanel, {
      grainField: field,
      camera,
      getGrainCount: () => field.grainCount(),
    });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "d" && document.activeElement !== textInput) {
    debugToggle.click();
  }
});

// ---------- render loop ----------

function frame() {
  const now = performance.now() / 1000;
  const projection = camera.projection(canvas.width, canvas.height);
  field.render(now, projection);
  if (panel) panel.tick();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
