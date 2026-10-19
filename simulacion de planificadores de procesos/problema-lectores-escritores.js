(function () {
  "use strict";

  // =====================================================================
  //  Lectores-Escritores (shared_mutex) — se registra en el motor (concurrencia.js)
  // =====================================================================

  const CPP_SRC = "// Problema Lectores-Escritores con hilos (C++20)\n// Mecanismo: shared_mutex (cerrojo lector/escritor).\n//   - shared_lock  -> varios lectores a la vez\n//   - unique_lock  -> un escritor en exclusiva (sin lectores ni otros escritores)\n// Compilar: g++ -std=c++20 -O2 -pthread lectores_escritores.cpp -o lectores_escritores\n\n#include <atomic>\n#include <chrono>\n#include <iostream>\n#include <mutex>\n#include <random>\n#include <shared_mutex>\n#include <string>\n#include <thread>\n#include <vector>\n\nusing namespace std;\n\nconst int LECTORES = 4;\nconst int ESCRITORES = 2;\nconst int ITERACIONES = 4;\n\nshared_mutex cerrojo; // protege 'dato'\nint dato = 0;         // recurso compartido\n\natomic<int> lectoresActivos{0}; // solo para mostrar la concurrencia de lectores\nmutex mutexSalida;\n\nvoid escribir(const string &texto)\n{\n    lock_guard<mutex> lock(mutexSalida);\n    cout << texto << endl;\n}\n\nvoid lector(int id)\n{\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> espera(50, 300);\n    for (int k = 0; k < ITERACIONES; k++)\n    {\n        this_thread::sleep_for(chrono::milliseconds(espera(gen)));\n        {\n            shared_lock<shared_mutex> lock(cerrojo); // entran varios lectores\n            int activos = ++lectoresActivos;\n            escribir(\"Lector \" + to_string(id) + \": lee dato = \" + to_string(dato) +\n                     \"  (lectores activos: \" + to_string(activos) + \")\");\n            this_thread::sleep_for(chrono::milliseconds(300)); // \"lee\"\n            --lectoresActivos;\n        }\n    }\n}\n\nvoid escritor(int id)\n{\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> espera(200, 500);\n    for (int k = 0; k < ITERACIONES; k++)\n    {\n        this_thread::sleep_for(chrono::milliseconds(espera(gen)));\n        {\n            unique_lock<shared_mutex> lock(cerrojo); // exclusión total\n            escribir(\">>> Escritor \" + to_string(id) + \": entra a escribir (lectores activos: \" +\n                     to_string(lectoresActivos.load()) + \")\");\n            dato++;\n            this_thread::sleep_for(chrono::milliseconds(400)); // \"escribe\"\n            escribir(\">>> Escritor \" + to_string(id) + \": terminó, dato = \" + to_string(dato));\n        }\n    }\n}\n\nint main()\n{\n    vector<thread> hilos;\n    for (int i = 1; i <= LECTORES; i++)\n        hilos.emplace_back(lector, i);\n    for (int i = 1; i <= ESCRITORES; i++)\n        hilos.emplace_back(escritor, i);\n\n    for (auto &h : hilos)\n        h.join();\n    escribir(\"\\nSimulación finalizada. Valor final = \" + to_string(dato));\n}\n";

  const { chip, card, row } = CC.ui;
  let S = null, cfg = null;
  const K = CC.kit(() => S), { rnd, logd, out, addTimer, tOf } = K;
  const isR = (th) => th.key[0] === "l";
  const thinkMs = (th) => (isR(th) ? rnd(50, 300) : rnd(200, 500));

  const PSEUDO = {
    shared: `// Cerrojo: shared_mutex cerrojo   (protege 'dato')    atomic<int> lectoresActivos

LECTOR i (ITERACIONES veces)            ESCRITOR j (ITERACIONES veces)
  sleep_for(50..300)                      sleep_for(200..500)
  { shared_lock(cerrojo)                  { unique_lock(cerrojo)    // exclusión total
      ++lectoresActivos                       escribe "entra a escribir"
      escribe "lee dato"                      dato++
      sleep_for(300)    // lee                sleep_for(400)        // escribe
      --lectoresActivos }                     escribe "terminó" }

// shared_lock: varios lectores a la vez.  unique_lock: un escritor solo, sin lectores.
// std::shared_mutex no fija quién entra primero: aquí se elige al azar entre los que pueden.`,
    escritores: `// Igual que el código, pero con PRIORIDAD A ESCRITORES (cola justa):
// un lector nuevo NO entra si hay un escritor esperando.

LECTOR:   espera mientras (hay escritor dentro) o (hay escritor esperando)
ESCRITOR: espera mientras (hay lectores dentro) o (hay escritor dentro)

// Los escritores no sufren inanición, pero los lectores pueden esperar más.`,
    nolock: `// Igual que el código, pero SIN cerrojo: nadie espera a nadie.

ESCRITOR j
  tmp = dato                 // lee al entrar
  sleep_for(400)             // escribe (otros hilos siguen corriendo)
  dato = tmp + 1             // escribe con un valor viejo

LECTOR i
  lee dato                   // puede leer mientras un escritor está a medias

// Dos escritores a la vez pierden una actualización; un lector puede ver un dato inconsistente.`,
  };
  const MODE_HINT = {
    shared: "Varios lectores pueden estar dentro a la vez (compartido); un escritor exige el cerrojo para él solo (exclusivo). El estándar no fija prioridades: se elige al azar.",
    escritores: "Variante con prioridad a escritores: los lectores nuevos esperan si hay un escritor en cola. Evita que los escritores sufran inanición, a costa de más espera para los lectores.",
    nolock: "Sin cerrojo, lectores y escritores se pisan: se leen datos a medias, y dos escritores a la vez pierden una actualización (el valor final queda por debajo de lo esperado).",
  };

  function newState() {
    const mk = (n, pre) => Array.from({ length: n }, (_, i) => ({ key: pre + (i + 1), id: i + 1, pc: "think", k: 0, tmp: 0, from: 0 }));
    S = {
      now: 0, done: false, deadlock: false, dato: 0, sh: 0, wr: 0, activos: 0,
      rs: mk(cfg.lect, "l"), ws: mk(cfg.escr, "e"), timers: [], last: { t: "" },
      dirty: 0, conf: 0, writes: 0, maxSh: 0, maxW: { r: 0, w: 0 }, ops: { sh: 0, ex: 0 },
      log: [], out: [],
    };
    S.rs.concat(S.ws).forEach((th) => addTimer("think", th, thinkMs(th)));
  }
  const all = () => S.rs.concat(S.ws);

  function enabled() {
    const a = [], nolock = cfg.mode === "nolock", prio = cfg.mode === "escritores";
    const wwait = S.ws.some((w) => w.pc === "acq");
    S.rs.forEach((r) => { if (r.pc === "acq" && (nolock || (S.wr === 0 && !(prio && wwait)))) a.push({ t: "r_acq", w: r }); });
    S.ws.forEach((w) => { if (w.pc === "acq" && (nolock || (S.wr === 0 && S.sh === 0))) a.push({ t: "w_acq", w }); });
    return a;
  }
  function execute(act) {
    const s = S, w = act.w, nolock = cfg.mode === "nolock", waited = Math.round(s.now - w.from);
    s.last = { t: act.t, key: w.key };
    if (act.t === "r_acq") {
      s.maxW.r = Math.max(s.maxW.r, waited);
      s.sh++; s.activos++; s.ops.sh++; s.maxSh = Math.max(s.maxSh, s.sh);
      out(`Lector ${w.id}: lee dato = ${s.dato}  (lectores activos: ${s.activos})`);
      if (s.wr > 0) { s.dirty++; logd(`⚠ Lector ${w.id}: lee dato = ${s.dato} mientras un escritor está escribiendo (lectura sucia)`, "err"); }
      else logd(`📖 Lector ${w.id}: shared_lock obtenido (esperó ${waited} ms) → lee dato = ${s.dato}; lectoresActivos = ${s.activos}`, "ok");
      w.pc = "read"; addTimer("read", w, cfg.lms);
    } else {
      s.maxW.w = Math.max(s.maxW.w, waited);
      if (s.wr > 0 || s.sh > 0) { s.conf++; logd(`⚠ Escritor ${w.id}: entra mientras hay ${s.sh} lectores y ${s.wr} escritores dentro`, "err"); }
      else logd(`✍ Escritor ${w.id}: unique_lock obtenido (esperó ${waited} ms) → entra a escribir`, "agent");
      s.wr++; s.ops.ex++;
      out(`>>> Escritor ${w.id}: entra a escribir (lectores activos: ${s.activos})`);
      if (nolock) w.tmp = s.dato; else s.dato++;
      w.pc = "write"; addTimer("write", w, cfg.wms);
    }
  }
  function advance(th) {
    th.k++;
    if (th.k < cfg.iter) { th.pc = "think"; K.addTimer("think", th, thinkMs(th)); return; }
    th.pc = "done";
    if (all().every((x) => x.pc === "done")) {
      out(""); out(`Simulación finalizada. Valor final = ${S.dato}`); S.done = true;
      logd(`🏁 main: todos los hilos terminaron → valor final = ${S.dato}`, "ok");
    }
  }
  function complete(t) {
    const s = S, w = t.who;
    s.last = { t: "end", key: w.key };
    if (t.kind === "think") { w.pc = "acq"; w.from = s.now; return; }
    if (t.kind === "read") {
      s.activos--; s.sh--;
      logd(`📖 Lector ${w.id}: termina de leer → --lectoresActivos (${s.activos}); libera el shared_lock`);
    } else {
      if (cfg.mode === "nolock") s.dato = w.tmp + 1;
      s.writes++; s.wr--;
      out(`>>> Escritor ${w.id}: terminó, dato = ${s.dato}`);
      logd(`✍ Escritor ${w.id}: terminó, dato = ${s.dato}; libera el unique_lock`, "ok");
    }
    advance(w);
  }
  const doNext = () => K.next(enabled, execute, complete);

  // ---------- Escena ----------
  function card_(th) {
    const s = S, t = tOf(th), r = isR(th);
    const st = r ? { think: "💭 Piensa (sleep_for)", acq: "⏳ Bloqueado en shared_lock", read: "📖 Leyendo dato", done: "✔ Terminó" }[th.pc]
      : { think: "💭 Piensa (sleep_for)", acq: "⏳ Bloqueado en unique_lock", write: "✍ Escribiendo (exclusivo)", done: "✔ Terminó" }[th.pc];
    return K.thread({ face: th.pc === "done" ? "😎" : r ? "🧑‍🎓" : "🧑‍💻", name: `${r ? "Lector" : "Escritor"} ${th.id}`, sub: "&nbsp;", state: st,
      st: th.pc === "read" ? "smoking" : th.pc === "write" ? "rolling" : th.pc === "acq" ? "holding" : "waiting", acc: r ? "cyan" : "orange", t, active: s.last.key === th.key, foot: `vuelta ${th.k}/${cfg.iter}` });
  }
  function sceneHtml() {
    const s = S, nolock = cfg.mode === "nolock";
    const bad = s.wr > 0 && (s.sh > 0 || s.wr > 1);
    const icon = s.wr ? "🔒" : s.sh ? "👥" : "🔓";
    const lockTxt = s.wr ? `exclusivo${s.wr > 1 ? " ×" + s.wr : ""} (escritor)` : s.sh ? `compartido ×${s.sh} (lectores)` : "libre";
    const core = `<div class="rw-core${s.wr ? " is-write" : s.sh ? " is-read" : ""}${bad ? " is-bad" : ""}">
        <span class="bb-label">ARCHIVO COMPARTIDO</span>
        <div class="rw-book"><div class="rw-dato">dato = ${s.dato}</div>${s.wr ? `<span class="rw-pen" style="${CC.phase(1400)}">✒️</span>` : ""}</div>
        <div class="rw-actors">${"👀".repeat(Math.min(s.sh, 6))}${s.wr ? " ✍️" : ""}</div>
        <div class="bb-count${bad ? " bad" : ""}">${icon} ${nolock ? "sin cerrojo" : "shared_mutex"} · ${lockTxt}</div>
        <div class="bb-count code-font">lectoresActivos = ${s.activos}</div></div>`;
    let overlay = "";
    if (s.done) {
      const expected = s.writes;
      overlay = (s.dato !== expected || s.dirty || s.conf)
        ? `<div class="sc-overlay sc-overlay--err"><b>⚠ Sin cerrojo</b><span>valor final ${s.dato} en vez de ${expected}${s.dirty ? ` · ${s.dirty} lecturas sucias` : ""}${s.conf ? ` · ${s.conf} entradas simultáneas` : ""}</span></div>`
        : `<div class="sc-overlay sc-overlay--ok"><b>🎉 Todos terminaron</b><span>dato = ${s.dato} tras ${s.writes} escrituras en ${Math.round(s.now)} ms · hasta ${s.maxSh} lectores a la vez · espera máx. escritor ${s.maxW.w} ms</span></div>`;
    }
    return `${overlay}<div class="zn zn--read"><span class="zn-label">📚 SALA DE LECTURA · LECTORES</span><div class="th-grid">${s.rs.map(card_).join("")}</div></div>
      <div class="rw-link${s.sh ? " on-read" : ""}">▼ lectura compartida ▼</div>${core}<div class="rw-link${s.wr ? " on-write" : ""}">▲ escritura exclusiva ▲</div>
      <div class="zn zn--write"><span class="zn-label">✒️ ESCRIBANÍA · ESCRITORES</span><div class="th-grid">${s.ws.map(card_).join("")}</div></div>`;
  }
  // ---------- Conceptos ----------
  function conceptsHtml() {
    const s = S, nolock = cfg.mode === "nolock", o = s.ops;
    const cnt = (arr, pc) => arr.filter((x) => x.pc === pc).length;
    const rw = (th) => row(th.pc === "done" ? "off" : th.pc === "acq" ? "block" : th.pc === "think" ? "on" : "crit", `${isR(th) ? "Lector" : "Escritor"} ${th.id}`, th.pc === "done" ? "Terminó" : th.pc === "acq" ? "Bloqueado esperando el cerrojo" : th.pc === "think" ? "Piensa (sleep_for)" : isR(th) ? "Dentro: leyendo (compartido)" : "Dentro: escribiendo (exclusivo)");
    const cHilos = card("🧵", "Hilos", "std::thread", `Comparten <code>dato</code>. Hay <strong>${cfg.lect + cfg.escr + 1}</strong>: ${cfg.lect} lectores, ${cfg.escr} escritores y main.`, `<ul class="cc-list">${all().map(rw).join("")}</ul>`);

    const cRec = card("📦", "Recursos", "compartidos", "Un único dato y el cerrojo que lo protege: leer es compatible con leer, pero escribir exige exclusividad.",
      `<ul class="cc-list">
        ${row("on", "🔢 dato", `valor actual = ${s.dato}`)}
        ${row(nolock ? "off" : s.wr ? "crit" : s.sh ? "on" : "off", "🔐 Cerrojo", nolock ? "no existe en esta variante" : s.wr ? "tomado en exclusiva por un escritor" : s.sh ? `compartido por ${s.sh} lectores` : "libre")}
        ${row("on", "👥 lectoresActivos", `atomic<int> = ${s.activos} (solo para mostrar)`)}
        ${row(cnt(s.rs, "acq") + cnt(s.ws, "acq") ? "block" : "off", "⏳ En espera", `${cnt(s.rs, "acq")} lectores · ${cnt(s.ws, "acq")} escritores`)}
      </ul>`);

    const sc = nolock
      ? `<div class="cc-mutex">⚠ Sin sección crítica</div><p class="cc-line">Escritores y lectores acceden a la vez. Lecturas sucias: <strong>${s.dirty}</strong> · entradas simultáneas: <strong>${s.conf}</strong>. Un escritor lee <code>dato</code> al entrar y escribe <code>tmp+1</code> al salir: si otro escribió entre medias, se pierde una actualización.</p>`
      : `<div class="cc-mutex ${s.wr ? "cc-mutex--on" : ""}">${s.wr ? "🔒 unique_lock (escritor dentro)" : s.sh ? "👥 shared_lock ×" + s.sh : "🔓 cerrojo libre"}</div>
         <p class="cc-line"><code>shared_lock</code> permite varios lectores a la vez (máximo visto: <strong>${s.maxSh}</strong>); <code>unique_lock</code> exige estar solo. Es una sección crítica con dos modos de acceso.</p>`;
    const cSc = card("🔒", "Sección crítica", "shared / unique", "Región que accede a datos compartidos: aquí leer en paralelo es seguro, escribir no.", sc);

    const cond = [
      ["Exclusión mutua", !nolock, "el escritor necesita el cerrojo para él solo"],
      ["Retención y espera", false, "no: cada hilo necesita un solo recurso"],
      ["Sin apropiación", !nolock, "el cerrojo no se le quita a quien lo tiene"],
      ["Espera circular", false, "no hay ciclo: no hay interbloqueo"],
    ];
    const polTxt = { shared: "Sin prioridad fija: un flujo continuo de lectores podría retrasar a un escritor.", escritores: "Prioridad a escritores: los lectores nuevos esperan si hay un escritor en cola.", nolock: "Sin cerrojo nadie espera (pero los datos se corrompen)." }[cfg.mode];
    const cDead = card("⛔", "Interbloqueo e inanición", "deadlock · starvation", "No hay interbloqueo, pero sí un riesgo distinto: la <em>inanición</em>, cuando un hilo espera indefinidamente porque otros siguen pasando antes.",
      `<ul class="cc-list">${cond.map(([n, on, t]) => row(on ? "crit" : "off", n, t)).join("")}
        ${row(s.maxW.w > 1000 ? "warn" : "on", "Espera máxima", `escritor ${s.maxW.w} ms · lector ${s.maxW.r} ms`)}</ul><p class="cc-line">${polTxt}</p>`);

    const cSync = card("🔗", "Sincronización y comunicación", "shared_mutex · atomic",
      "El cerrojo sincroniza el acceso a <code>dato</code>; <code>atomic&lt;int&gt;</code> permite contar lectores sin mutex; <code>mutexSalida</code> evita mezclar líneas de cout.",
      `<ul class="cc-list">
         ${row(nolock ? "off" : "on", "shared_lock", `${o.sh} adquisiciones compartidas`)}
         ${row(nolock ? "off" : "on", "unique_lock", `${o.ex} adquisiciones exclusivas`)}
         ${row("on", "atomic", "lectoresActivos se actualiza sin bloquear al hilo")}
         ${row("on", "Bucles", `<code>for</code> de ${cfg.iter} iteraciones por hilo`)}
       </ul>`);
    return cHilos + cRec + cSc + cDead + cSync;
  }

  function semsHtml() {
    const s = S, c = (arr) => arr.filter((x) => x.pc === "acq").length;
    return chip("dato", s.dato, true) + chip("lectoresActivos", s.activos, s.activos > 0) + chip("lectores en cerrojo", s.sh, s.sh > 0) + chip("escritor en cerrojo", s.wr, s.wr > 0)
      + chip("lectores esperando", c(s.rs), c(s.rs) > 0) + chip("escritores esperando", c(s.ws), c(s.ws) > 0);
  }
  function clockText(running) {
    const s = S;
    const status = s.done ? '<span class="text-emerald">✔ Finalizado</span>' : running ? "▶ En ejecución" : "⏸ Detenido";
    return `t = ${Math.round(s.now)} ms · dato = ${s.dato} · Escrituras ${s.writes}/${cfg.escr * cfg.iter} · ${status}`;
  }

  CC.register({
    id: "lectores-escritores",
    tab: "📖 Lectores-escritores",
    subtitle: "Lectores-escritores — shared_mutex, acceso compartido vs exclusivo, inanición y condiciones de carrera",
    file: "lectores_escritores.cpp",
    bin: "lectores_escritores",
    compile: "g++ -std=c++20 -O2 -pthread lectores_escritores.cpp -o lectores_escritores && ./lectores_escritores",
    intro: `Un dato compartido lo leen y lo modifican muchos hilos. Los <strong>lectores</strong> pueden leer a la vez entre sí
      (<code>shared_lock</code>), pero un <strong>escritor</strong> necesita el dato para él solo, sin lectores ni otros escritores
      (<code>unique_lock</code>). Es el ejemplo clásico de un cerrojo con dos modos de acceso, y de cómo la política de prioridad
      puede provocar inanición.`,
    modes: [["shared", "shared_mutex (como el código; orden al azar)"], ["escritores", "Prioridad a escritores (cola justa)"], ["nolock", "Sin cerrojo: lecturas sucias y escrituras perdidas"]],
    modeHint: MODE_HINT,
    consts: [
      { key: "lect", label: "LECTORES", min: 1, max: 8, def: 4 },
      { key: "escr", label: "ESCRITORES", min: 1, max: 6, def: 2 },
      { key: "iter", label: "ITERACIONES", min: 1, max: 20, def: 4 },
      { key: "lms", label: "LECTURA_MS", min: 50, max: 3000, step: 50, def: 300, cls: "num" },
      { key: "wms", label: "ESCRITURA_MS", min: 50, max: 3000, step: 50, def: 400, cls: "num" },
    ],
    constHint: "Las tres primeras son constantes del código; LECTURA_MS y ESCRITURA_MS son los <code>sleep_for(300)</code> y <code>sleep_for(400)</code> dentro de cada sección. Las esperas entre accesos (50–300 y 200–500 ms) son las del código. Sube los lectores y baja la pausa para ver a un escritor esperar más.",
    codeNote: "Es la solución con <code>shared_mutex</code>: la que se simula en el modo “shared_mutex”.",
    cppMap: `<span><b>Hilos</b> → <code>vector&lt;thread&gt;</code> (lectores y escritores)</span>
      <span><b>Cerrojo lector/escritor</b> → <code>shared_mutex</code>: <code>shared_lock</code> (compartido) / <code>unique_lock</code> (exclusivo)</span>
      <span><b>Sección crítica</b> → el bloque de cada hilo con el cerrojo tomado, sobre <code>dato</code></span>
      <span><b>Contador sin mutex</b> → <code>atomic&lt;int&gt; lectoresActivos</code> (solo para mostrar)</span>
      <span><b>Bucles</b> → <code>for</code> de <code>ITERACIONES</code> en cada hilo</span>`,
    cpp: CPP_SRC,
    pseudo: PSEUDO,
    reset: (c) => { cfg = c; newState(); },
    S: () => S,
    hasAction: () => enabled().length > 0,
    sleeping: K.sleeping,
    step: doNext,
    updateBars: K.updateBars,
    scene: sceneHtml,
    concepts: conceptsHtml,
    sems: semsHtml,
    clock: clockText,
  });
})();
