// Apple-ish inspector for the shader: live uniform tuning + an orbit camera
// to see the grain field and its fall physics from an angle. Dev tool only,
// never affects the default flat 2D look.

function row(container, { label, min, max, step, value, format, onChange }) {
  const el = document.createElement("div");
  el.className = "dbg-row";

  const lab = document.createElement("label");
  lab.textContent = label;

  const input = document.createElement("input");
  input.type = "range";
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;

  const out = document.createElement("output");
  const fmt = format || ((v) => v);
  out.textContent = fmt(value);

  input.addEventListener("input", () => {
    const v = parseFloat(input.value);
    out.textContent = fmt(v);
    onChange(v);
  });

  el.append(lab, input, out);
  container.appendChild(el);
  return input;
}

export function mountDebugPanel(panelEl, { grainField, camera, getGrainCount }) {
  const p = grainField.params;

  const title = document.createElement("p");
  title.className = "dbg-title";
  title.innerHTML = '<span>Shader debugger</span><span class="dbg-stats"><span id="dbg-fps">60</span> fps · <span id="dbg-count">0</span></span>';
  panelEl.appendChild(title);

  const cameraRow = document.createElement("div");
  cameraRow.className = "dbg-row";
  const cameraLabel = document.createElement("label");
  cameraLabel.textContent = "3D view";
  const cameraSwitch = document.createElement("button");
  cameraSwitch.className = "dbg-switch";
  cameraSwitch.type = "button";
  cameraSwitch.addEventListener("click", () => {
    camera.enabled = !camera.enabled;
    cameraSwitch.classList.toggle("on", camera.enabled);
    if (!camera.enabled) camera.reset();
  });
  cameraRow.append(cameraLabel, cameraSwitch);
  panelEl.appendChild(cameraRow);

  const sep1 = document.createElement("div");
  sep1.className = "dbg-sep";
  panelEl.appendChild(sep1);

  row(panelEl, {
    label: "Grid spacing", min: 4, max: 18, step: 1, value: p.spacing,
    onChange: (v) => { p.spacing = v; grainField.rebuildAll(); },
  });
  row(panelEl, {
    label: "Point size", min: 2, max: 14, step: 0.5, value: p.pointSize,
    onChange: (v) => { p.pointSize = v; },
  });
  row(panelEl, {
    label: "Hold before fall", min: 200, max: 3000, step: 50, value: p.holdMs,
    format: (v) => `${(v / 1000).toFixed(2)}s`,
    onChange: (v) => { p.holdMs = v; },
  });
  row(panelEl, {
    label: "Gravity", min: 400, max: 4000, step: 50, value: p.gravity,
    onChange: (v) => { p.gravity = v; },
  });
  row(panelEl, {
    label: "Lateral spread", min: 0, max: 400, step: 10, value: p.lateralSpeed,
    onChange: (v) => { p.lateralSpeed = v; },
  });
  row(panelEl, {
    label: "Fall depth", min: -400, max: -20, step: 10, value: p.fallFloor,
    format: (v) => `${Math.abs(v)}px`,
    onChange: (v) => { p.fallFloor = v; },
  });
  row(panelEl, {
    label: "Fade duration", min: 400, max: 2600, step: 50, value: p.fallFadeMs,
    format: (v) => `${(v / 1000).toFixed(2)}s`,
    onChange: (v) => { p.fallFadeMs = v; },
  });

  const sep2 = document.createElement("div");
  sep2.className = "dbg-sep";
  panelEl.appendChild(sep2);

  const hint = document.createElement("p");
  hint.className = "dbg-hint";
  hint.textContent = "D to toggle · drag/scroll canvas in 3D view";
  panelEl.appendChild(hint);

  const fpsEl = panelEl.querySelector("#dbg-fps");
  const countEl = panelEl.querySelector("#dbg-count");
  let frames = 0;
  let last = performance.now();

  return {
    tick() {
      frames++;
      const now = performance.now();
      if (now - last >= 500) {
        fpsEl.textContent = Math.round((frames * 1000) / (now - last));
        countEl.textContent = getGrainCount();
        frames = 0;
        last = now;
      }
    },
  };
}
