(function () {
  "use strict";

  // =====================================================================
  //  Simulación de concurrencia — MOTOR común a todos los problemas
  //  Cada problema vive en su propio archivo (problema-*.js) y se registra con
  //  CC.register({...}). Para agregar uno nuevo: crear el archivo, registrarlo y
  //  añadir su <script> en index.html después de este. Nada más.
  //
  //  Contrato de un problema (objeto pasado a CC.register):
  //    id, tab, subtitle, file, bin, compile, intro, modes[[valor,texto]], modeHint{},
  //    consts[{key,label,min,max,step,def,cls}], constHint, cppMap, codeNote, cpp, pseudo{}
  //    reset(cfg)        crea el estado nuevo      S()            devuelve el estado (now/done/deadlock)
  //    hasAction()       ¿hay acciones atómicas?   sleeping()     próximo sleep_for a terminar ({endAt}) o null
  //    step()            ejecuta un paso lógico    updateBars()   actualiza barras sin reconstruir la escena
  //    scene() concepts() sems() clock(running)    HTML de cada panel
  //    (S().out = líneas de cout, S().log = [{t,m,c}])
  //  Modelo: tiempo virtual en ms. Las acciones sin sleep ocurren en el mismo instante.
  // =====================================================================

  const $ = (id) => document.getElementById(id);
  const problems = [];
  const HOP = 450; // pausa visual entre acciones simultáneas (ms de pantalla a velocidad ×1)

  // piezas de interfaz compartidas por los problemas nuevos
  const UI = {
    chip: (label, val, hl) => `<div class="cc-sem${hl ? " cc-sem--on" : ""}"><span>${label}</span><b>${val}</b></div>`,
    card: (icon, title, tag, def, body) => `<div class="cc-card"><h3 class="cc-card__title"><span>${icon} ${title}</span><span class="cc-tag">${tag}</span></h3><p class="cc-def">${def}</p>${body}</div>`,
    row: (dot, name, txt) => `<li class="cc-row"><span class="cc-dot cc-dot--${dot}"></span><b>${name}</b><span>${txt}</span></li>`,
  };
  // utilidades para problemas con tiempo virtual: temporizadores (sleep_for), paso lógico y tarjetas de hilo.
  // Un temporizador es {kind, who, startAt, endAt}; 'who' es el hilo (objeto con .key) y complete(t) lo trata al vencer.
  const kit = (getS) => {
    const pct = (t) => { const S = getS(); return t && t.endAt > t.startAt ? Math.max(0, Math.min(100, ((S.now - t.startAt) / (t.endAt - t.startAt)) * 100)) : 0; };
    const earliest = () => getS().timers.slice().sort((a, b) => a.endAt - b.endAt)[0] || null;
    const tOf = (who) => getS().timers.find((t) => t.who === who);
    return {
      pct, tOf, sleeping: earliest,
      rnd: (a, b) => a + Math.floor(Math.random() * (Math.max(a, b) - a + 1)),
      logd: (m, c) => { const S = getS(); S.log.push({ t: Math.round(S.now), m, c: c || "" }); },
      out: (l) => getS().out.push(l),
      addTimer: (kind, who, ms) => { const S = getS(); S.timers.push({ kind, who, startAt: S.now, endAt: S.now + ms }); },
      // un paso lógico: una acción atómica al azar o, si no hay ninguna, el fin del próximo sleep_for
      next(enabled, execute, complete, deadMsg) {
        const S = getS();
        if (S.done || S.deadlock) return false;
        const en = enabled();
        if (en.length) { execute(en[Math.floor(Math.random() * en.length)]); return true; }
        const t = earliest();
        if (t) { S.timers.splice(S.timers.indexOf(t), 1); S.now = Math.max(S.now, t.endAt); complete(t); return true; }
        S.deadlock = true; S.last = { t: "dead" };
        S.log.push({ t: Math.round(S.now), m: deadMsg || "⛔ INTERBLOQUEO: ningún hilo puede avanzar.", c: "err" });
        return false;
      },
      updateBars() {
        const S = getS();
        document.querySelectorAll("#cc-scene [data-bar]").forEach((el) => {
          const [k, w] = el.dataset.bar.split(":");
          const t = S.timers.find((x) => x.kind === k && x.who && x.who.key === w);
          if (t) el.style.width = pct(t).toFixed(1) + "%";
        });
      },
      // tarjeta de un hilo: {face,name,sub,state,st,acc,active,dead,t(temporizador),foot}
      thread(o) {
        const t = o.t;
        return `<div class="sc-smoker accent-${o.acc || "cyan"} sc-smoker--${o.st || "waiting"}${o.active ? " is-active" : ""}${o.dead ? " is-dead" : ""}">
          <div class="sc-avatar-wrap"><div class="sc-avatar">${o.face}</div></div>
          <div class="sc-name">${o.name}</div><div class="sc-need">${o.sub || "&nbsp;"}</div>
          <div class="sc-state">${o.state}</div>
          <div class="sc-progress"><i ${t ? `data-bar="${t.kind}:${t.who.key}"` : ""} style="width:${pct(t).toFixed(1)}%"></i></div>
          <div class="sc-held">${o.foot || "&nbsp;"}</div></div>`;
      },
    };
  };
  // La escena se reconstruye en cada paso: este retardo negativo hace que las animaciones continuas
  // (cinta, humo, poste) conserven su fase en vez de reiniciarse y dar tirones.
  const phase = (ms, off = 0) => `animation-delay:-${(Date.now() + off) % ms}ms;`;
  window.CC = { register: (p) => problems.push(p), ui: UI, kit, phase };

  const root = $("sec-conc"), secCpu = $("sec-cpu");
  let P = null, cfg = {}, raf = null, running = false, speed = 1, hold = 0, lastTs = 0;

  // ---------- Navegación principal (CPU / concurrencia) + encabezado ----------
  const CPU_HEAD = ["🖥️", "Simulador de Planificación de CPU", "FCFS · SJF · SRTF · Round Robin — multinúcleo, hilos y lotes grandes (1000+ procesos)"];
  const navCpu = $("nav-cpu"), navConc = $("nav-conc");
  let inConc = false;
  function setHead() {
    const [ic, t, sub] = inConc ? ["🔀", "Simulación de concurrencia", P ? P.subtitle : ""] : CPU_HEAD;
    $("app-icon").textContent = ic;
    $("app-title").textContent = t;
    $("app-subtitle").textContent = sub;
    document.title = t;
  }
  function showSection(which) {
    inConc = which === "conc";
    secCpu.classList.toggle("hidden", inConc);
    root.classList.toggle("hidden", !inConc);
    navCpu.classList.toggle("active", !inConc);
    navConc.classList.toggle("active", inConc);
    setHead();
    if (!inConc) stop();
  }
  navCpu.addEventListener("click", () => showSection("cpu"));
  navConc.addEventListener("click", () => showSection("conc"));

  // ---------- Código C++ con resaltado ----------
  function highlightCpp(src) {
    const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const re = /(\/\/[^\n]*)|(#include[^\n]*)|("(?:[^"\\]|\\.)*")|\b(const|int|bool|void|string|while|for|if|else|return|using|namespace|enum|true|false|auto|break)\b|\b(counting_semaphore|mutex|lock_guard|thread|vector|mt19937|random_device|uniform_int_distribution|chrono|this_thread)\b|\b(\d+)\b/g;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const cls = m[1] ? "c" : m[2] ? "p" : m[3] ? "s" : m[4] ? "k" : m[5] ? "t" : "n";
      out += `<span class="tk-${cls}">${esc(m[0])}</span>`;
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }

  // ---------- Estructura de la sección ----------
  function buildShell() {
    root.innerHTML = `
  <section class="panel-card">
    <div class="panel-card__header">
      <h2 class="panel-card__title">Simulación de concurrencia</h2>
      <div id="cc-problems" class="cc-problems"></div>
    </div>
    <p id="cc-intro" class="hint cc-intro"></p>
    <div class="form-grid">
      <div class="form-box">
        <p class="form-box__label">Solución</p>
        <select id="cc-mode" class="input cc-select"></select>
        <p id="cc-mode-hint" class="hint"></p>
      </div>
      <div class="form-box">
        <p class="form-box__label">Constantes del programa</p>
        <div id="cc-consts" class="field-row"></div>
        <p id="cc-const-hint" class="hint"></p>
      </div>
      <div class="form-box">
        <p class="form-box__label">Reproducción</p>
        <div class="field-row">
          <button id="cc-play" class="btn btn--sm btn--play" type="button">▶ Iniciar</button>
          <button id="cc-step" class="btn btn--sm btn--secondary" type="button" title="Ejecuta una sola acción de un hilo (atajo: flecha derecha →)">⏭ Paso (→)</button>
          <button id="cc-reset" class="btn btn--sm btn--secondary" type="button">⟲ Reiniciar</button>
        </div>
        <label class="range-field" style="margin-top:8px">Velocidad
          <input id="cc-speed" type="range" min="25" max="400" step="25" value="100" />
          <span id="cc-speed-label" class="code-font">×1</span>
        </label>
      </div>
    </div>
  </section>

  <section class="panel-card">
    <div class="panel-card__header">
      <h2 class="panel-card__title">Escenario</h2>
      <div class="cc-stats code-font" id="cc-stats"></div>
    </div>
    <div id="cc-scene" class="sc-stage"></div>
  </section>

  <section class="panel-card">
    <div class="panel-card__header">
      <h2 class="panel-card__title">Conceptos en vivo</h2>
      <span class="hint" style="margin:0">Cada tarjeta muestra qué está pasando ahora mismo con ese concepto.</span>
    </div>
    <div id="cc-concepts" class="cc-concepts"></div>
  </section>

  <div class="cc-lower">
    <section class="panel-card cc-lower__box">
      <div class="panel-card__header"><h2 class="panel-card__title">Semáforos y contadores</h2></div>
      <div id="cc-sems" class="cc-sems"></div>
    </section>
    <section class="panel-card cc-lower__box">
      <div class="panel-card__header"><h2 class="panel-card__title">Salida del programa <span class="pill-count code-font">cout</span></h2></div>
      <pre id="cc-term" class="cc-term custom-scrollbar"></pre>
    </section>
    <section class="panel-card cc-lower__box">
      <div class="panel-card__header"><h2 class="panel-card__title">Registro de eventos</h2></div>
      <div id="cc-log" class="cc-log custom-scrollbar"></div>
    </section>
  </div>

  <section class="panel-card">
    <details class="detail-toggle cc-code">
      <summary>Ver pseudocódigo de la solución elegida</summary>
      <pre id="cc-pseudo" class="cc-pre code-font"></pre>
    </details>
  </section>

  <section class="panel-card">
    <div class="panel-card__header">
      <h2 class="panel-card__title">Código propuesto <span class="pill-count code-font">C++20 · hilos y semáforos reales</span></h2>
      <div class="toolbar">
        <button id="cc-copy" class="btn btn--sm btn--secondary" type="button">📋 Copiar</button>
        <button id="cc-download" class="btn btn--sm btn--add" type="button"></button>
      </div>
    </div>
    <p id="cc-compile" class="hint cc-intro"></p>
    <div id="cc-map" class="cc-map"></div>
    <pre id="cc-cpp" class="cc-pre cc-cpp code-font custom-scrollbar"></pre>
  </section>`;

    $("cc-problems").innerHTML = problems.map((p) => `<button class="tab-btn" type="button" data-pid="${p.id}">${p.tab}</button>`).join("");
    $("cc-problems").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pid]");
      if (b && (!P || b.dataset.pid !== P.id)) selectProblem(b.dataset.pid);
    });
    $("cc-play").addEventListener("click", play);
    $("cc-step").addEventListener("click", stepOnce);
    $("cc-reset").addEventListener("click", reset);
    $("cc-mode").addEventListener("change", reset);
    $("cc-consts").addEventListener("change", reset);
    $("cc-speed").addEventListener("input", function () {
      speed = parseInt(this.value, 10) / 100;
      $("cc-speed-label").textContent = "×" + speed;
    });
    $("cc-copy").addEventListener("click", async function () {
      const btn = this, src = P.cpp;
      try { await navigator.clipboard.writeText(src); }
      catch (e) {
        const ta = document.createElement("textarea");
        ta.value = src; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (_) {}
        ta.remove();
      }
      btn.textContent = "✔ Copiado";
      setTimeout(() => (btn.textContent = "📋 Copiar"), 1500);
    });
    $("cc-download").addEventListener("click", () => {
      const url = URL.createObjectURL(new Blob([P.cpp], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url; a.download = P.file;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  // ---------- Cambio de problema ----------
  function selectProblem(id) {
    stop();
    P = problems.find((p) => p.id === id);
    document.querySelectorAll("#cc-problems [data-pid]").forEach((b) => b.classList.toggle("active", b.dataset.pid === id));
    cfg = { mode: P.modes[0][0] };
    $("cc-intro").innerHTML = P.intro;
    $("cc-mode").innerHTML = P.modes.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
    $("cc-consts").innerHTML = P.consts.map((c) =>
      `<label class="cfg-label code-font">${c.label} <input id="cc-k-${c.key}" type="number" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.def}" class="input input--${c.cls || "num-sm"} code-font" /></label>`).join("");
    $("cc-const-hint").innerHTML = P.constHint;
    $("cc-compile").innerHTML = `Compilar y ejecutar: <code>${P.compile.replace(/&/g, "&amp;")}</code>. ${P.codeNote}`;
    $("cc-map").innerHTML = P.cppMap;
    $("cc-cpp").innerHTML = highlightCpp(P.cpp);
    $("cc-download").textContent = "⬇ Descargar " + P.file;
    setHead();
    reset();
  }

  // ---------- Render ----------
  function render() {
    const S = P.S();
    $("cc-stats").innerHTML = P.clock(running);
    $("cc-scene").innerHTML = P.scene();
    $("cc-concepts").innerHTML = P.concepts();
    $("cc-sems").innerHTML = P.sems();
    const term = $("cc-term");
    term.textContent = S.out.length ? S.out.join("\n") : "$ ./" + P.bin + "\n";
    term.scrollTop = term.scrollHeight;
    $("cc-log").innerHTML = S.log.slice(-80).reverse().map((l) => `<div class="cc-log__row ${l.c}"><span class="cc-log__t">t=${l.t} ms</span>${l.m}</div>`).join("") || '<div class="cc-empty">Pulsa “Iniciar” o “Paso”.</div>';
    $("cc-play").textContent = running ? "⏸ Pausa" : "▶ Iniciar";
    $("cc-pseudo").textContent = P.pseudo[cfg.mode];
    $("cc-mode-hint").textContent = P.modeHint[cfg.mode];
  }

  // ---------- Control (reloj virtual impulsado por requestAnimationFrame) ----------
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }
  function frame(ts) {
    if (!running) return;
    const S = P.S();
    const dt = Math.min(100, ts - lastTs) * speed;
    lastTs = ts;
    if (hold > 0) hold -= dt;
    else if (P.hasAction()) { P.step(); hold = HOP; render(); }
    else {
      const sm = P.sleeping();
      if (!sm) { P.step(); render(); }
      else {
        S.now += dt;
        if (S.now >= sm.endAt) { P.step(); hold = HOP / 2; render(); }
        else { $("cc-stats").innerHTML = P.clock(running); P.updateBars(); }
      }
    }
    if (S.done || S.deadlock) { stop(); render(); return; }
    raf = requestAnimationFrame(frame);
  }
  function play() {
    if (running) { stop(); render(); return; }
    const S = P.S();
    if (S.done || S.deadlock) reset();
    running = true;
    lastTs = performance.now();
    raf = requestAnimationFrame(frame);
    render();
  }
  function stepOnce() {
    stop();
    const S = P.S();
    if (S.done || S.deadlock) reset();
    P.step();
    render();
  }
  function readCfg() {
    cfg.mode = $("cc-mode").value;
    P.consts.forEach((c) => {
      const v = parseInt($("cc-k-" + c.key).value, 10);
      cfg[c.key] = Math.min(c.max, Math.max(c.min, isNaN(v) ? c.def : v));
      $("cc-k-" + c.key).value = cfg[c.key];
    });
  }
  function reset() {
    stop();
    readCfg();
    P.reset(cfg);
    hold = 0;
    render();
  }

  // Flecha derecha = botón «Paso» (solo en la sección de concurrencia y sin escribir en un campo)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || !inConc || !P) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    e.preventDefault();
    stepOnce();
  });

  // Se construye al terminar de cargar: así todos los problemas ya se registraron.
  window.addEventListener("load", () => {
    if (!problems.length) return;
    buildShell();
    selectProblem(problems[0].id);
  });
})();
