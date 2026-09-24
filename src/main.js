import { GrainField } from "./grainField.js";
import { OrbitCamera } from "./camera.js";
import { createSpeechController, isSpeechSupported } from "./speech.js";
import { mountDebugPanel } from "./debugPanel.js";

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

const speech = createSpeechController({
  onInterim(text) {
    field.setInterim(text, performance.now() / 1000);
    scheduleAutoFinalize();
  },
  onFinal(text) {
    clearTimeout(silenceTimer);
    field.setInterim(text, performance.now() / 1000);
    field.finalize();
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
  field.setInterim(text, performance.now() / 1000);
  field.finalize();
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
