(function () {
  "use strict";

  // =====================================================================
  //  Productor-Consumidor (buffer acotado) — se registra en el motor (concurrencia.js)
  // =====================================================================

  const CPP_SRC = "// Problema Productor-Consumidor (buffer acotado) con hilos y semáforos (C++20)\n// Mecanismo: 2 semáforos contadores (huecos / llenos) + 1 mutex para el buffer.\n// Compilar: g++ -std=c++20 -O2 -pthread productor_consumidor.cpp -o productor_consumidor\n\n#include <iostream>\n#include <mutex>\n#include <random>\n#include <semaphore>\n#include <string>\n#include <thread>\n#include <vector>\n#include <chrono>\n\nusing namespace std;\n\nconst int TAM_BUFFER = 5;\nconst int PRODUCTORES = 2;\nconst int CONSUMIDORES = 3;\nconst int ITEMS_POR_PRODUCTOR = 6;\nconst int FIN = -1; // \"pastilla venenosa\" para avisar a los consumidores que terminen\n\n// Buffer circular\nint buffer[TAM_BUFFER];\nint entrada = 0, salida = 0;\n\n// Semáforos\ncounting_semaphore<> huecos(TAM_BUFFER); // espacios libres (bloquea a productores si es 0)\ncounting_semaphore<> llenos(0);          // items disponibles (bloquea a consumidores si es 0)\n\nmutex mutexBuffer; // exclusión mutua sobre entrada/salida/buffer\nmutex mutexSalida; // evita mezclar líneas de cout\n\nvoid escribir(const string &texto)\n{\n    lock_guard<mutex> lock(mutexSalida);\n    cout << texto << endl;\n}\n\nvoid poner(int item)\n{\n    huecos.acquire(); // espera un hueco libre\n    {\n        lock_guard<mutex> lock(mutexBuffer);\n        buffer[entrada] = item;\n        entrada = (entrada + 1) % TAM_BUFFER;\n    }\n    llenos.release(); // avisa que hay un item más\n}\n\nint sacar()\n{\n    llenos.acquire(); // espera un item\n    int item;\n    {\n        lock_guard<mutex> lock(mutexBuffer);\n        item = buffer[salida];\n        salida = (salida + 1) % TAM_BUFFER;\n    }\n    huecos.release(); // avisa que hay un hueco más\n    return item;\n}\n\nvoid productor(int id)\n{\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> espera(100, 400);\n    for (int k = 1; k <= ITEMS_POR_PRODUCTOR; k++)\n    {\n        this_thread::sleep_for(chrono::milliseconds(espera(gen))); // \"fabrica\"\n        int item = id * 100 + k;\n        poner(item);\n        escribir(\"Productor \" + to_string(id) + \": produjo item \" + to_string(item));\n    }\n}\n\nvoid consumidor(int id)\n{\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> espera(300, 700);\n    while (true)\n    {\n        int item = sacar();\n        if (item == FIN)\n            break;\n        escribir(\"    Consumidor \" + to_string(id) + \": consumió item \" + to_string(item));\n        this_thread::sleep_for(chrono::milliseconds(espera(gen))); // \"procesa\"\n    }\n    escribir(\"    Consumidor \" + to_string(id) + \": termina\");\n}\n\nint main()\n{\n    vector<thread> prods, cons;\n    for (int i = 1; i <= PRODUCTORES; i++)\n        prods.emplace_back(productor, i);\n    for (int i = 1; i <= CONSUMIDORES; i++)\n        cons.emplace_back(consumidor, i);\n\n    for (auto &p : prods)\n        p.join();\n\n    // Ya no habrá más producción: un FIN por consumidor\n    for (int i = 0; i < CONSUMIDORES; i++)\n        poner(FIN);\n\n    for (auto &c : cons)\n        c.join();\n    escribir(\"\\nSimulación finalizada.\");\n}\n";

  const { chip, card, row } = CC.ui;
  let S = null, cfg = null;
  const K = CC.kit(() => S), { rnd, logd, out, addTimer, tOf } = K;
  const FIN = -1;
  const lab = (it) => (it.v === FIN ? "FIN" : it.v);
  const hue = (id) => (id * 67) % 360;

  const PSEUDO = {
    semaforos: `// Semáforos: huecos=TAM_BUFFER; llenos=0   Mutex: mutexBuffer (entrada/salida/buffer)

PRODUCTOR i (repite ITEMS_POR_PRODUCTOR veces)   CONSUMIDOR j (repite hasta recibir FIN)
  sleep_for(aleatorio)        // fabrica           llenos.acquire()          // espera un item
  huecos.acquire()            // espera un hueco   { lock(mutexBuffer)
  { lock(mutexBuffer)                                 item = buffer[salida]
      buffer[entrada] = item                          salida = (salida+1) % TAM }
      entrada = (entrada+1) % TAM }                huecos.release()          // libera un hueco
  llenos.release()            // hay un item más   si item == FIN: termina
  escribe "produjo item"                           escribe "consumió"; sleep_for(aleatorio)

MAIN: join() de productores; poner(FIN) una vez por consumidor; join() de consumidores`,
    carrera: `// Igual que la solución correcta, pero SIN mutexBuffer.
// 'entrada' y 'salida' se leen y se escriben sin protección.

PRODUCTOR i                          CONSUMIDOR j
  huecos.acquire()                     llenos.acquire()
  tmp = entrada            // (1)      tmp = salida              // (1)
  ...el planificador expulsa...        ...el planificador expulsa...
  buffer[tmp] = item       // (2)      item = buffer[tmp]        // (2)
  entrada = (tmp+1) % TAM              salida = (tmp+1) % TAM
  llenos.release()                     huecos.release()

// Dos productores pueden leer el mismo 'entrada' y escribir en la misma casilla:
// un item se sobrescribe y se pierde. Dos consumidores pueden leer la misma 'salida':
// uno recibe una casilla ya vacía. Si se pierde un FIN, un consumidor no termina nunca.`,
  };
  const MODE_HINT = {
    semaforos: "huecos y llenos cuentan casillas libres y ocupadas: bloquean al productor con el buffer lleno y al consumidor con el buffer vacío. mutexBuffer protege los índices.",
    carrera: "Los semáforos siguen controlando la capacidad, pero sin mutex dos hilos pueden usar el mismo índice a la vez: se sobrescriben items, se leen casillas vacías y hasta se pierde un FIN.",
  };

  function newState() {
    S = {
      now: 0, done: false, deadlock: false,
      buf: Array(cfg.tam).fill(null), entrada: 0, salida: 0,
      sem: { huecos: cfg.tam, llenos: 0 },
      cs: false, last: { t: "" },
      prods: Array.from({ length: cfg.prods }, (_, i) => ({ key: "p" + (i + 1), id: i + 1, pc: "make", k: 0, item: 0, tmp: 0 })),
      cons: Array.from({ length: cfg.cons }, (_, i) => ({ key: "c" + (i + 1), id: i + 1, pc: "acq", item: 0, tmp: 0, n: 0 })),
      main: { pc: "join", sent: 0 },
      timers: [], produced: 0, consumed: 0, lost: 0, garbage: 0,
      ops: { acquire: 0, release: 0, lock: 0, loops: 0 },
      log: [], out: [],
    };
    S.prods.forEach((p) => addTimer("make", p, rnd(100, 400)));
  }

  function enabled() {
    const s = S, a = [], sem = cfg.mode === "semaforos", m = s.main;
    s.prods.forEach((p) => {
      if (p.pc === "hue") { if (s.sem.huecos > 0) a.push({ t: "p_hue", w: p }); }
      else if (p.pc === "put") a.push({ t: sem ? "p_put" : "p_read", w: p });
      else if (["write", "rel", "log"].includes(p.pc)) a.push({ t: "p_" + p.pc, w: p });
    });
    s.cons.forEach((c) => {
      if (c.pc === "acq") { if (s.sem.llenos > 0) a.push({ t: "c_acq", w: c }); }
      else if (c.pc === "get") a.push({ t: sem ? "c_get" : "c_read", w: c });
      else if (["write", "rel", "log"].includes(c.pc)) a.push({ t: "c_" + c.pc, w: c });
    });
    if (m.pc === "join" && s.prods.every((p) => p.pc === "done")) a.push({ t: "m_start" });
    if (m.pc === "hue" && s.sem.huecos > 0) a.push({ t: "m_hue" });
    if (m.pc === "put") a.push({ t: "m_put" });
    if (m.pc === "rel") a.push({ t: "m_rel" });
    if (m.pc === "join2" && s.cons.every((c) => c.pc === "done")) a.push({ t: "m_join" });
    return a;
  }

  function putAt(slot, v, by, who) {
    if (S.buf[slot] !== null) {
      S.lost++;
      logd(`⚠ ${who}: escribe en la casilla ${slot}, que aún tenía el item ${lab(S.buf[slot])} → ¡se pierde!`, "err");
    }
    S.buf[slot] = { v, by };
  }
  function takeFrom(slot, c) {
    const it = S.buf[slot];
    S.buf[slot] = null;
    if (it === null) {
      c.item = 0; S.garbage++;
      logd(`⚠ Consumidor ${c.id}: lee la casilla ${slot} y está vacía → item 0 (basura)`, "err");
    } else c.item = it.v;
  }

  function execute(act) {
    const s = S, w = act.w, T = cfg.tam, m = s.main;
    const P = w && `Productor ${w.id}`, C = w && `Consumidor ${w.id}`;
    s.cs = false;
    s.last = { t: act.t, key: w && w.key };
    switch (act.t) {
      case "p_hue":
        s.sem.huecos--; s.ops.acquire++; w.pc = "put";
        logd(`🏭 ${P}: huecos.acquire() → tiene un hueco (huecos = ${s.sem.huecos})`); break;
      case "p_put": {
        s.cs = true; s.ops.lock++;
        const sl = s.entrada; putAt(sl, w.item, w.id, P); s.entrada = (sl + 1) % T; w.pc = "rel";
        logd(`🏭 ${P}: [lock] buffer[${sl}] = ${w.item}; entrada = ${s.entrada}`); break;
      }
      case "p_read":
        w.tmp = s.entrada; w.pc = "yield"; addTimer("yield", w, cfg.preempt);
        logd(`🤔 ${P}: lee entrada = ${w.tmp} y el planificador lo expulsa de la CPU (${cfg.preempt} ms)`, "warn"); break;
      case "p_write":
        putAt(w.tmp, w.item, w.id, P); s.entrada = (w.tmp + 1) % T; w.pc = "rel";
        logd(`▶ ${P}: buffer[${w.tmp}] = ${w.item}; entrada = ${s.entrada} (usa el valor leído antes)`, "warn"); break;
      case "p_rel":
        s.sem.llenos++; s.ops.release++; w.pc = "log";
        logd(`🏭 ${P}: llenos.release() → hay un item más (llenos = ${s.sem.llenos})`); break;
      case "p_log":
        out(`${P}: produjo item ${w.item}`); s.produced++;
        logd(`✔ ${P}: produjo item ${w.item}`, "ok");
        if (w.k < cfg.items) { w.pc = "make"; addTimer("make", w, rnd(100, 400)); } else w.pc = "done";
        break;
      case "c_acq":
        s.sem.llenos--; s.ops.acquire++; s.ops.loops++; w.pc = "get";
        logd(`🍽 ${C}: llenos.acquire() → hay un item (llenos = ${s.sem.llenos})`); break;
      case "c_get": {
        s.cs = true; s.ops.lock++;
        const sl = s.salida; takeFrom(sl, w); s.salida = (sl + 1) % T; w.pc = "rel";
        logd(`🍽 ${C}: [lock] item = buffer[${sl}] = ${w.item === FIN ? "FIN" : w.item}; salida = ${s.salida}`); break;
      }
      case "c_read":
        w.tmp = s.salida; w.pc = "yield"; addTimer("yield", w, cfg.preempt);
        logd(`🤔 ${C}: lee salida = ${w.tmp} y el planificador lo expulsa de la CPU (${cfg.preempt} ms)`, "warn"); break;
      case "c_write":
        takeFrom(w.tmp, w); s.salida = (w.tmp + 1) % T; w.pc = "rel";
        logd(`▶ ${C}: item = buffer[${w.tmp}]; salida = ${s.salida} (usa el valor leído antes)`, "warn"); break;
      case "c_rel":
        s.sem.huecos++; s.ops.release++; w.pc = "log";
        logd(`🍽 ${C}: huecos.release() → libera un hueco (huecos = ${s.sem.huecos})`); break;
      case "c_log":
        if (w.item === FIN) {
          out(`    ${C}: termina`); w.pc = "done";
          logd(`🏁 ${C}: recibió FIN → sale del bucle y termina`, "ok");
        } else {
          out(`    ${C}: consumió item ${w.item}`); s.consumed++; w.n++;
          w.pc = "proc"; addTimer("proc", w, rnd(300, 700));
          logd(`✔ ${C}: consumió item ${w.item} (procesa con sleep_for)`, "ok");
        }
        break;
      case "m_start": m.pc = "hue"; logd("🚪 main: los productores terminaron → poner(FIN) una vez por consumidor", "agent"); break;
      case "m_hue": s.sem.huecos--; s.ops.acquire++; m.pc = "put"; break;
      case "m_put": {
        s.cs = true; s.ops.lock++;
        const sl = s.entrada; putAt(sl, FIN, 0, "main"); s.entrada = (sl + 1) % T; m.pc = "rel";
        logd(`🚪 main: [lock] buffer[${sl}] = FIN; entrada = ${s.entrada}`, "agent"); break;
      }
      case "m_rel":
        s.sem.llenos++; s.ops.release++; m.sent++;
        m.pc = m.sent < cfg.cons ? "hue" : "join2"; break;
      case "m_join":
        out(""); out("Simulación finalizada."); s.done = true;
        logd("🏁 main: todos los consumidores terminaron → simulación finalizada", "ok"); break;
    }
  }
  function complete(t) {
    const w = t.who;
    if (t.kind === "make") {
      w.k++; w.item = w.id * 100 + w.k; w.pc = "hue";
      logd(`🛠 Productor ${w.id}: terminó de fabricar el item ${w.item}`);
    } else if (t.kind === "proc") { w.pc = "acq"; }
    else { w.pc = "write"; S.last = { t: "resume", key: w.key }; }
  }
  const doNext = () => K.next(enabled, execute, complete,
    cfg.mode === "carrera" ? "⛔ BLOQUEO: un consumidor nunca recibió su FIN (se sobrescribió) y espera en llenos.acquire()" : null);

  // ---------- Escena ----------
  function prodCard(p) {
    const s = S, t = tOf(p);
    const st = { make: "🛠 Fabricando (sleep_for)", hue: s.sem.huecos > 0 ? "🔑 Hay hueco: listo" : "⏳ Bloqueado: buffer lleno", put: "📥 Dentro del buffer", yield: "🤔 Expulsado de la CPU", write: "📥 Va a escribir", rel: "🔔 Avisando", log: "✍ Escribiendo", done: "✔ Terminó" }[p.pc];
    return K.thread({ face: p.pc === "done" ? "😎" : "🏭", name: `Productor ${p.id}`, sub: p.item ? `item ${p.item}` : "&nbsp;", state: st, st: t ? "rolling" : "waiting", acc: "cyan", t, active: s.last.key === p.key, foot: `${p.k}/${cfg.items} items` });
  }
  function consCard(c) {
    const s = S, t = tOf(c);
    const st = { acq: s.sem.llenos > 0 ? "🔑 Hay item: listo" : "⏳ Bloqueado: buffer vacío", get: "📤 Dentro del buffer", yield: "🤔 Expulsado de la CPU", write: "📤 Va a leer", rel: "🔔 Liberando hueco", log: "✍ Escribiendo", proc: "🍽 Procesando (sleep_for)", done: "✔ Terminó (recibió FIN)" }[c.pc];
    return K.thread({ face: c.pc === "done" ? "😎" : c.pc === "proc" ? "😋" : "🍽️", name: `Consumidor ${c.id}`, sub: "&nbsp;", state: st, st: t ? "smoking" : "waiting", acc: "orange", t, active: s.last.key === c.key, foot: `consumió ${c.n}` });
  }
  function sceneHtml() {
    const s = S, T = cfg.tam, sem = cfg.mode === "semaforos", L = s.last;
    const slots = s.buf.map((it, i) => {
      const mk = (i === s.entrada ? '<i class="pc-mark pc-mark--in">▼ entrada</i>' : "") + (i === s.salida ? '<i class="pc-mark pc-mark--out">▲ salida</i>' : "");
      const col = it ? (it.by ? `background:hsla(${hue(it.by)},70%,50%,.35);border-color:hsl(${hue(it.by)},70%,60%)` : "background:rgba(244,63,94,.3);border-color:rgb(244,63,94)") : "";
      return `<div class="pc-slotwrap"><div class="pc-slot${it ? " full" : ""}" style="${col}">${it ? `<span class="pc-crate">${it.v === FIN ? "☠️" : "📦"}</span><b>${lab(it)}</b>` : "<small>vacía</small>"}</div><small class="pc-idx">[${i}]${mk}</small></div>`;
    }).join("");
    const used = s.buf.filter(Boolean).length;
    const badge = used >= T ? '<b class="pc-badge pc-badge--full">⛔ LLENO · los productores esperan</b>' : used === 0 ? '<b class="pc-badge pc-badge--empty">∅ VACÍO · los consumidores esperan</b>' : "";
    const buf = `<div class="pc-buf"><span class="bb-label">CINTA TRANSPORTADORA · BUFFER CIRCULAR · ${T} CASILLAS</span>
        <div class="pc-slots">${slots}</div>
        <div class="pc-belt" style="${CC.phase(900)}"></div>
        <div class="pc-gauge${used >= T ? " is-full" : ""}"><i style="width:${((used / T) * 100).toFixed(0)}%"></i><span>${used}/${T}</span></div>${badge}
        <div class="bb-count">${sem ? (s.cs ? "🔒 mutexBuffer ocupado" : "🔓 mutexBuffer libre") : "⚠ sin mutexBuffer"} · entrada = ${s.entrada} · salida = ${s.salida}</div></div>`;
    const inOn = ["p_put", "p_write", "p_rel"].includes(L.t), outOn = ["c_get", "c_write", "c_rel"].includes(L.t);
    const flow = `<div class="sc-flow${["p_rel", "c_rel", "p_hue", "c_acq"].includes(L.t) ? " is-pulse" : ""}"><span>productores</span><em>huecos.acquire()</em>
        <span class="sc-tok${s.sem.huecos > 0 ? " on" : ""}">huecos ${s.sem.huecos}</span><em>→ buffer →</em><span class="sc-tok${s.sem.llenos > 0 ? " on" : ""}">llenos ${s.sem.llenos}</span><em>llenos.acquire()</em><span>consumidores</span></div>`;
    let overlay = "";
    if (s.deadlock) overlay = `<div class="sc-overlay sc-overlay--err"><b>⛔ BLOQUEO</b><span>${sem ? "ningún hilo puede avanzar" : "un consumidor espera un FIN que se sobrescribió y nunca llegará"}</span></div>`;
    else if (s.done) overlay = (s.lost || s.garbage)
      ? `<div class="sc-overlay sc-overlay--err"><b>⚠ Condición de carrera</b><span>${s.lost} items perdidos · ${s.garbage} lecturas de casillas vacías · producidos ${s.produced}, consumidos ${s.consumed}</span></div>`
      : `<div class="sc-overlay sc-overlay--ok"><b>🎉 Todo se consumió</b><span>${s.produced} producidos = ${s.consumed} consumidos en ${Math.round(s.now)} ms — sin pérdidas</span></div>`;
    return `${overlay}<div class="zn zn--prod"><span class="zn-label">🏭 FÁBRICA · PRODUCTORES</span><div class="th-grid">${s.prods.map(prodCard).join("")}</div></div>
      <div class="pc-chute${inOn ? " on" : ""}">▼ ▼ ▼</div>${buf}<div class="pc-chute out${outOn ? " on" : ""}">▼ ▼ ▼</div>${flow}
      <div class="zn zn--cons"><span class="zn-label">🍽 COMEDOR · CONSUMIDORES</span><div class="th-grid">${s.cons.map(consCard).join("")}</div></div>`;
  }
  // ---------- Conceptos ----------
  function conceptsHtml() {
    const s = S, sem = cfg.mode === "semaforos", o = s.ops, T = cfg.tam;
    const used = s.buf.filter(Boolean).length;
    const dot = (th, blocked) => (th.pc === "done" ? "off" : blocked ? "block" : th.pc === "yield" ? "warn" : "on");
    const th = [];
    s.prods.forEach((p) => th.push(row(dot(p, p.pc === "hue" && s.sem.huecos === 0), `Productor ${p.id}`, p.pc === "done" ? "Terminó" : p.pc === "hue" && s.sem.huecos === 0 ? "Bloqueado en huecos.acquire() (buffer lleno)" : p.pc === "make" ? "Fabricando (sleep_for)" : "Activo")));
    s.cons.forEach((c) => th.push(row(dot(c, c.pc === "acq" && s.sem.llenos === 0), `Consumidor ${c.id}`, c.pc === "done" ? "Terminó" : c.pc === "acq" && s.sem.llenos === 0 ? "Bloqueado en llenos.acquire() (buffer vacío)" : c.pc === "proc" ? "Procesando (sleep_for)" : "Activo")));
    const cHilos = card("🧵", "Hilos", "std::thread", `Comparten el buffer y los índices. Hay <strong>${cfg.prods + cfg.cons + 1}</strong>: ${cfg.prods} productores, ${cfg.cons} consumidores y main.`, `<ul class="cc-list">${th.join("")}</ul>`);

    const cRec = card("📦", "Recursos", "compartidos", "Casillas del buffer: son finitas. Los productores compiten por huecos y los consumidores por items.",
      `<ul class="cc-list">
        ${row(used >= T ? "warn" : used ? "on" : "off", "🧱 Buffer", `${used} de ${T} casillas ocupadas`)}
        ${row(s.sem.huecos > 0 ? "on" : "block", "⬜ Huecos libres", `huecos = ${s.sem.huecos}`)}
        ${row(s.sem.llenos > 0 ? "on" : "off", "📦 Items disponibles", `llenos = ${s.sem.llenos}`)}
        ${row("on", "🔢 Índices", `entrada = ${s.entrada} · salida = ${s.salida}`)}
      </ul>`);

    const sc = sem
      ? `<div class="cc-mutex ${s.cs ? "cc-mutex--on" : ""}">${s.cs ? "🔒 mutexBuffer ocupado" : "🔓 mutexBuffer libre"}</div>
         <p class="cc-line">Protege <code>buffer</code>, <code>entrada</code> y <code>salida</code>. Los semáforos garantizan que haya sitio o item, pero no impiden que dos productores usen el mismo índice a la vez: eso lo hace el mutex.</p>`
      : `<div class="cc-mutex">⚠ Sin sección crítica</div>
         <p class="cc-line">Los índices se leen y escriben sin protección. Hasta ahora: <strong>${s.lost}</strong> items perdidos y <strong>${s.garbage}</strong> lecturas de casillas vacías.</p>`;
    const cSc = card("🔒", "Sección crítica", "exclusión mutua", "Fragmento que modifica datos compartidos y solo puede ejecutar un hilo a la vez.", sc);

    const cond = [
      ["Exclusión mutua", true, "una casilla la usa un solo hilo a la vez"],
      ["Retención y espera", false, "no: huecos/llenos se adquieren ANTES de tomar el mutex"],
      ["Sin apropiación", true, "no se le quita un hueco a un productor"],
      ["Espera circular", s.deadlock, s.deadlock ? "ciclo de espera detectado" : "no hay ciclo"],
    ];
    const cDead = card("⛔", "Interbloqueo", "deadlock", "Si el productor tomara el mutex <em>antes</em> de huecos.acquire() con el buffer lleno, se quedaría dentro y ningún consumidor podría sacar nada: interbloqueo. El orden de adquisición lo evita.",
      `<ul class="cc-list">${cond.map(([n, on, t]) => row(on ? "crit" : "off", n, t)).join("")}</ul>
       <p class="cc-line">${s.deadlock ? "<strong class='text-rose'>Bloqueo.</strong>" : "Una condición no se cumple: no puede haber interbloqueo."}</p>`);

    const cSync = card("🔗", "Sincronización y comunicación", "semáforos contadores",
      "huecos y llenos son semáforos contadores: sincronizan (bloquean) y comunican (avisan) entre productores y consumidores. El item FIN («pastilla venenosa») indica que no habrá más producción.",
      `<div class="cc-flow"><span>🏭 Productor</span><em>llenos.release <b>${s.produced}</b> →</em><span>🧱 Buffer</span><em>← huecos.release <b>${s.consumed}</b></em><span>🍽 Consumidor</span></div>
       <ul class="cc-list">
         ${row("on", "Semáforos", `${o.acquire} acquire() · ${o.release} release()`)}
         ${row(sem ? "on" : "off", "Mutex", sem ? `mutexBuffer: ${o.lock} entradas` : "No se usa en esta variante")}
         ${row("on", "Bucles", `<code>while(true)</code> de consumidores: ${o.loops} iteraciones; sin espera activa`)}
       </ul>`);
    return cHilos + cRec + cSc + cDead + cSync;
  }

  function semsHtml() {
    const s = S;
    return chip("huecos", s.sem.huecos, s.sem.huecos > 0) + chip("llenos", s.sem.llenos, s.sem.llenos > 0) + chip("entrada", s.entrada, false) + chip("salida", s.salida, false)
      + chip("producidos", s.produced, s.produced > 0) + chip("consumidos", s.consumed, s.consumed > 0);
  }
  function clockText(running) {
    const s = S;
    const status = s.deadlock ? '<span class="text-rose">⛔ BLOQUEO</span>' : s.done ? '<span class="text-emerald">✔ Finalizado</span>' : running ? "▶ En ejecución" : "⏸ Detenido";
    return `t = ${Math.round(s.now)} ms · Producidos ${s.produced}/${cfg.prods * cfg.items} · Consumidos ${s.consumed} · ${status}`;
  }

  CC.register({
    id: "productor-consumidor",
    tab: "🏭 Productor-consumidor",
    subtitle: "Productor-consumidor — buffer acotado, semáforos contadores, sección crítica y condiciones de carrera",
    file: "productor_consumidor.cpp",
    bin: "productor_consumidor",
    compile: "g++ -std=c++20 -O2 -pthread productor_consumidor.cpp -o productor_consumidor && ./productor_consumidor",
    intro: `Varios <strong>productores</strong> fabrican items y los dejan en un <strong>buffer circular</strong> de tamaño fijo; varios
      <strong>consumidores</strong> los sacan y procesan. Si el buffer está lleno, el productor espera un hueco
      (<code>huecos.acquire()</code>); si está vacío, el consumidor espera un item (<code>llenos.acquire()</code>). Un mutex protege los
      índices. Al final, <code>main</code> envía un <code>FIN</code> por consumidor para que terminen.`,
    modes: [["semaforos", "Con semáforos (huecos/llenos) + mutex (correcta)"], ["carrera", "Sin mutexBuffer: condición de carrera en los índices"]],
    modeHint: MODE_HINT,
    consts: [
      { key: "tam", label: "TAM_BUFFER", min: 1, max: 10, def: 5 },
      { key: "prods", label: "PRODUCTORES", min: 1, max: 5, def: 2 },
      { key: "cons", label: "CONSUMIDORES", min: 1, max: 5, def: 3 },
      { key: "items", label: "ITEMS_POR_PRODUCTOR", min: 1, max: 20, def: 6 },
      { key: "preempt", label: "PREEMPT_MS", min: 10, max: 1000, step: 10, def: 150, cls: "num" },
    ],
    constHint: "Las cuatro primeras son constantes del código. <code>PREEMPT_MS</code> solo existe en la simulación: cuánto tiempo el planificador deja fuera de la CPU a un hilo en la variante sin mutex. Los tiempos de fabricar (100–400 ms) y procesar (300–700 ms) son los del código.",
    codeNote: "Es la solución con semáforos y mutex: la que se simula en el modo “Con semáforos + mutex”.",
    cppMap: `<span><b>Hilos</b> → <code>vector&lt;thread&gt;</code> (productores y consumidores) + main</span>
      <span><b>Semáforos</b> → <code>counting_semaphore</code> (<code>huecos</code>, <code>llenos</code>)</span>
      <span><b>Sección crítica</b> → <code>lock_guard&lt;mutex&gt;</code> sobre <code>buffer</code>, <code>entrada</code> y <code>salida</code></span>
      <span><b>Bucles</b> → <code>for</code> del productor / <code>while (true)</code> del consumidor</span>
      <span><b>Terminación</b> → item <code>FIN</code> (pastilla venenosa), uno por consumidor</span>`,
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
