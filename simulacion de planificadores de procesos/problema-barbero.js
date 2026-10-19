(function () {
  "use strict";

  // =====================================================================
  //  Problema del barbero dormilón — se registra en el motor (concurrencia.js)
  //  Tiempo virtual en ms. Acciones sin sleep (acquire/release/lock) = mismo instante.
  // =====================================================================

  const CPP_SRC = "// Problema del Barbero Dormilón con hilos y semáforos (C++20)\n// Mecanismo: semáforos para la sincronización barbero<->cliente + mutex que\n// protege el contador de clientes en espera.\n// Compilar: g++ -std=c++20 -O2 -pthread barbero_dormilon.cpp -o barbero_dormilon\n\n#include <chrono>\n#include <iostream>\n#include <mutex>\n#include <random>\n#include <semaphore>\n#include <string>\n#include <thread>\n#include <vector>\n\nusing namespace std;\n\nconst int SILLAS = 3;         // sillas en la sala de espera\nconst int CLIENTES = 10;      // clientes que llegarán en total\nconst int CORTE_MS = 600;     // duración de un corte\n\n// Semáforos\ncounting_semaphore<> clientesSem(0);    // clientes esperando (el barbero duerme si es 0)\ncounting_semaphore<> barberoListo(0);   // el barbero llama a un cliente\ncounting_semaphore<> corteTerminado(0); // el barbero avisa que terminó el corte\n\nmutex mutexSala;       // protege 'esperando'\nint esperando = 0;     // clientes sentados en la sala de espera\nbool cerrar = false;   // se escribe solo cuando ya no llegarán más clientes\nmutex mutexSalida;     // evita mezclar líneas de cout\n\nvoid escribir(const string &texto)\n{\n    lock_guard<mutex> lock(mutexSalida);\n    cout << texto << endl;\n}\n\nvoid barbero()\n{\n    while (true)\n    {\n        escribir(\"Barbero: duerme (sin clientes)\");\n        clientesSem.acquire(); // duerme hasta que llegue alguien\n        if (cerrar)\n            break;\n\n        {\n            lock_guard<mutex> lock(mutexSala);\n            esperando--; // un cliente deja su silla\n        }\n        barberoListo.release(); // \"siguiente\"\n\n        escribir(\"Barbero: corta el cabello\");\n        this_thread::sleep_for(chrono::milliseconds(CORTE_MS));\n        escribir(\"Barbero: terminó el corte\");\n        corteTerminado.release();\n    }\n    escribir(\"Barbero: cierra la barbería\");\n}\n\nvoid cliente(int id)\n{\n    string nombre = \"    Cliente \" + to_string(id);\n    bool seSienta = false;\n    {\n        lock_guard<mutex> lock(mutexSala);\n        if (esperando < SILLAS)\n        {\n            esperando++;\n            seSienta = true;\n            escribir(nombre + \": llega y se sienta (esperando: \" + to_string(esperando) + \")\");\n        }\n    }\n\n    if (!seSienta)\n    {\n        escribir(nombre + \": sala llena, se va\");\n        return;\n    }\n\n    clientesSem.release();  // avisa al barbero (lo despierta si dormía)\n    barberoListo.acquire(); // espera su turno\n    escribir(nombre + \": se está cortando el cabello\");\n    corteTerminado.acquire(); // espera a que termine\n    escribir(nombre + \": se va satisfecho\");\n}\n\nint main()\n{\n    thread tb(barbero);\n\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> llegada(100, 500);\n\n    vector<thread> clientes;\n    for (int i = 1; i <= CLIENTES; i++)\n    {\n        this_thread::sleep_for(chrono::milliseconds(llegada(gen)));\n        clientes.emplace_back(cliente, i);\n    }\n    for (auto &c : clientes)\n        c.join();\n\n    cerrar = true;          // nadie más llegará\n    clientesSem.release();  // despierta al barbero para que salga\n    tb.join();\n    escribir(\"\\nSimulación finalizada.\");\n}\n";

  const { chip, card, row } = CC.ui;
  const $ = (id) => document.getElementById(id);
  let S = null, cfg = null;

  const PSEUDO = {
    semaforos: `// Semáforos: clientesSem=0; barberoListo=0; corteTerminado=0
// Datos compartidos: esperando=0 (protegido por mutexSala), cerrar=false

BARBERO                              CLIENTE i
  repite                               { sección crítica: lock(mutexSala)
    escribe "duerme"                     si esperando < SILLAS:
    clientesSem.acquire()                  esperando++; se sienta
    si cerrar: sale del bucle            si no: "sala llena", se va }
    { lock(mutexSala)                  clientesSem.release()     // avisa / despierta
        esperando-- }                  barberoListo.acquire()    // espera su turno
    barberoListo.release()             se está cortando el cabello
    corta; sleep_for(CORTE_MS)         corteTerminado.acquire()  // espera el fin
    corteTerminado.release()           se va satisfecho

MAIN
  repite CLIENTES veces: sleep_for(aleatorio); crea un hilo cliente
  join() de todos los clientes; cerrar = true; clientesSem.release(); join() del barbero`,
    carrera: `// Igual que la solución correcta, pero SIN mutexSala:
// 'esperando' se lee y se escribe sin protección.

CLIENTE i
  tmp = esperando                // (1) lee
  si tmp < SILLAS:
    ...el planificador puede expulsar al hilo aquí...
    esperando = tmp + 1          // (2) escribe con un valor viejo
  si no: "sala llena", se va

BARBERO
  esperando--                    // también sin protección

// Problema: otro cliente (o el barbero) modifica 'esperando' entre (1) y (2).
// Se pierde una actualización: el contador deja de coincidir con las sillas
// realmente ocupadas y pueden sentarse más clientes que sillas (condición de carrera).`,
  };
  const MODE_HINT = {
    semaforos: "El cliente comprueba y actualiza 'esperando' dentro de una sección crítica (mutexSala). Los semáforos clientesSem, barberoListo y corteTerminado coordinan al barbero con cada cliente.",
    carrera: "Sin mutex, leer 'esperando' y escribirlo son dos pasos separables. Si otro hilo lo cambia en medio, se pierde una actualización: el contador miente y caben más clientes que sillas.",
  };

  // ---------- Estado ----------
  const rnd = (a, b) => a + Math.floor(Math.random() * (Math.max(a, b) - a + 1));
  const logd = (m, c) => S.log.push({ t: Math.round(S.now), m, c: c || "" });
  const out = (l) => S.out.push(l);
  const CL = (c) => `    Cliente ${c.id}`;
  const inChair = (c) => c.pc === "sig" || c.pc === "wait";
  // sillas realmente ocupadas: los clientes sentados menos los que el barbero ya llamó (barberoListo) y aún no se levantan
  const seatedList = () => { const l = S.clients.filter(inChair); return l.slice(0, Math.max(0, l.length - S.sem.listo)); };
  const finished = (c) => c.pc === "done" || c.pc === "left";

  function armArrival() {
    if (S.main.n < cfg.clientes) {
      const g = rnd(cfg.amin, cfg.amax);
      S.timers.push({ kind: "arrive", startAt: S.now, endAt: S.now + g });
    } else S.main.pc = "join";
  }
  function newState() {
    S = {
      now: 0, done: false, deadlock: false, cerrar: false,
      esperando: 0,
      sem: { clientes: 0, listo: 0, fin: 0 },
      barber: { pc: "log", cuts: 0 },
      main: { pc: "spawn", n: 0 },
      clients: [], timers: [],
      cs: false, last: { t: "" },
      served: 0, lost: 0, over: false, maxSeated: 0,
      ops: { acquire: 0, rel_c: 0, rel_l: 0, rel_f: 0, lock: 0, loops: 0 },
      log: [], out: [],
    };
    armArrival();
  }

  // ---------- Acciones atómicas de los hilos ----------
  function enabled() {
    const s = S, a = [], b = s.barber;
    if (b.pc === "log") a.push({ t: "blog" });
    if (b.pc === "cutlog") a.push({ t: "bcut" });
    if (b.pc === "acq" && s.sem.clientes > 0) a.push({ t: "bacq" });
    s.clients.forEach((c) => {
      if (c.pc === "new") a.push({ t: cfg.mode === "semaforos" ? "check" : "read", c });
      else if (c.pc === "write") a.push({ t: "write", c });
      else if (c.pc === "sig") a.push({ t: "csig", c });
      else if (c.pc === "wait" && s.sem.listo > 0) a.push({ t: "clisto", c });
      else if (c.pc === "cut" && s.sem.fin > 0) a.push({ t: "cfin", c });
    });
    if (s.main.pc === "join" && s.clients.every(finished)) a.push({ t: "mclose" });
    if (s.main.pc === "joinb" && b.pc === "closed") a.push({ t: "mend" });
    return a;
  }
  function sleeping() {
    return S.timers.slice().sort((a, b) => a.endAt - b.endAt)[0] || null;
  }
  // un cliente se acaba de sentar: ¿se respeta la capacidad?
  function sat(c) {
    const r = seatedList().length;
    S.maxSeated = Math.max(S.maxSeated, r);
    out(`${CL(c)}: llega y se sienta (esperando: ${S.esperando})`);
    if (r > cfg.sillas) {
      S.over = true;
      logd(`⚠ Cliente ${c.id} se sienta: hay ${r} clientes en ${cfg.sillas} sillas (el contador decía ${S.esperando - 1})`, "err");
    } else if (S.esperando !== r) {
      logd(`⚠ Cliente ${c.id} se sienta: esperando = ${S.esperando} pero hay ${r} clientes reales (contador desincronizado)`, "warn");
    } else logd(`🪑 Cliente ${c.id}: esperando++ → ${S.esperando}; se sienta`, "ok");
  }
  function leave(c, why) {
    c.pc = "left"; S.lost++;
    out(`${CL(c)}: sala llena, se va`);
    logd(`🚫 Cliente ${c.id}: ${why} → sala llena, se va`, "warn");
  }

  function execute(act) {
    const s = S, b = s.barber, c = act.c, sem = cfg.mode === "semaforos";
    s.cs = false;
    s.last = { t: act.t, id: c && c.id };
    switch (act.t) {
      case "blog":
        out("Barbero: duerme (sin clientes)"); b.pc = "acq"; s.ops.loops++;
        logd(s.sem.clientes > 0 ? "✂ Barbero: escribe «duerme» y llama a clientesSem.acquire() (ya había un cliente)" : "😴 Barbero: escribe «duerme» → clientesSem.acquire() lo bloquea", s.sem.clientes > 0 ? "" : "agent");
        break;
      case "bacq":
        s.sem.clientes--; s.ops.acquire++;
        if (s.cerrar) {
          out("Barbero: cierra la barbería"); b.pc = "closed";
          logd("✂ Barbero: clientesSem.acquire() → cerrar = true → sale del bucle y cierra la barbería", "ok");
          break;
        }
        s.esperando--; s.sem.listo++; s.ops.rel_l++;
        if (sem) { s.ops.lock++; s.cs = true; }
        b.pc = "cutlog";
        logd(`✂ Barbero: clientesSem.acquire() → ${sem ? "[lock] " : "(sin mutex) "}esperando-- → ${s.esperando}; barberoListo.release() («siguiente»)`, "agent");
        break;
      case "bcut":
        out("Barbero: corta el cabello"); b.pc = "cutting";
        s.timers.push({ kind: "cut", startAt: s.now, endAt: s.now + cfg.corte });
        logd(`💈 Barbero: corta el cabello (sleep_for ${cfg.corte} ms)`, "ok");
        break;
      case "check": // lock + comprobar + esperando++ + unlock, todo atómico
        s.ops.lock++; s.cs = true;
        if (s.esperando < cfg.sillas) { s.esperando++; c.pc = "sig"; sat(c); }
        else leave(c, `[lock] esperando = ${s.esperando} = SILLAS`);
        break;
      case "read": // sin mutex: (1) leer
        c.tmp = s.esperando;
        if (c.tmp < cfg.sillas) {
          c.pc = "yield";
          s.timers.push({ kind: "yield", c, startAt: s.now, endAt: s.now + cfg.preempt });
          logd(`🤔 Cliente ${c.id}: lee esperando = ${c.tmp} (< ${cfg.sillas}) y el planificador lo expulsa de la CPU (${cfg.preempt} ms)`, "warn");
        } else leave(c, `lee esperando = ${c.tmp}`);
        break;
      case "write": // sin mutex: (2) escribir con el valor leído antes
        s.esperando = c.tmp + 1; c.pc = "sig";
        logd(`▶ Cliente ${c.id}: escribe esperando = ${c.tmp} + 1 (valor viejo)`, "warn");
        sat(c);
        break;
      case "csig":
        s.sem.clientes++; s.ops.rel_c++; c.pc = "wait";
        logd(`🔔 Cliente ${c.id}: clientesSem.release() → avisa al barbero`);
        break;
      case "clisto":
        s.sem.listo--; s.ops.acquire++; c.pc = "cut";
        out(`${CL(c)}: se está cortando el cabello`);
        logd(`✂ Cliente ${c.id}: barberoListo.acquire() → pasa a la silla del barbero`, "ok");
        break;
      case "cfin":
        s.sem.fin--; s.ops.acquire++; c.pc = "done"; s.served++;
        out(`${CL(c)}: se va satisfecho`);
        logd(`😄 Cliente ${c.id}: corteTerminado.acquire() → se va satisfecho`, "ok");
        break;
      case "mclose":
        s.cerrar = true; s.sem.clientes++; s.ops.rel_c++; s.main.pc = "joinb";
        logd("🚪 main: todos los clientes terminaron → cerrar = true; clientesSem.release() (despierta al barbero)", "agent");
        break;
      case "mend":
        out(""); out("Simulación finalizada."); s.done = true;
        logd("🏁 main: tb.join() → simulación finalizada", "ok");
        break;
    }
  }
  // termina un sleep_for (llegada, corte o expulsión de la CPU)
  function complete(t) {
    const s = S, b = s.barber;
    s.cs = false;
    s.now = Math.max(s.now, t.endAt);
    s.timers.splice(s.timers.indexOf(t), 1);
    if (t.kind === "arrive") {
      const id = ++s.main.n;
      s.clients.push({ id, pc: "new", tmp: 0 });
      s.last = { t: "arrive", id };
      logd(`🚪 main: terminó sleep_for → emplace_back(cliente, ${id})`);
      armArrival();
    } else if (t.kind === "cut") {
      out("Barbero: terminó el corte"); s.sem.fin++; s.ops.rel_f++; b.pc = "log"; b.cuts++;
      s.last = { t: "cutend" };
      logd("💈 Barbero: terminó el corte → corteTerminado.release()", "ok");
    } else {
      t.c.pc = "write"; s.last = { t: "resume", id: t.c.id };
    }
  }
  function doNext() {
    if (S.done || S.deadlock) return false;
    const en = enabled();
    if (en.length) { execute(en[Math.floor(Math.random() * en.length)]); return true; }
    const t = sleeping();
    if (t) { complete(t); return true; }
    S.deadlock = true;
    S.last = { t: "dead" };
    logd("⛔ INTERBLOQUEO: ningún hilo puede avanzar.", "err");
    return false;
  }

  // ---------- Escena ----------
  const pct = (t) => (t && t.endAt > t.startAt ? Math.max(0, Math.min(100, ((S.now - t.startAt) / (t.endAt - t.startAt)) * 100)) : 0);
  const timerOf = (k) => S.timers.find((t) => t.kind === k);
  const FACE = { new: "🚪", yield: "🤔", write: "🤔", sig: "🪑", wait: "🪑", cut: "✂️", done: "😄", left: "🚫" };
  const CNAME = { new: "llegando", yield: "decidiendo", write: "decidiendo", sig: "sentado", wait: "esperando su turno", cut: "cortándose el pelo", done: "satisfecho", left: "se fue (sala llena)" };

  function sceneHtml() {
    const s = S, b = s.barber, L = s.last, sem = cfg.mode === "semaforos";
    const asleep = b.pc === "acq" && s.sem.clientes === 0;
    const cutting = b.pc === "cutting";
    const cutC = s.clients.find((c) => c.pc === "cut");
    const seated = seatedList();
    const desync = s.esperando !== seated.length;
    const face = b.pc === "closed" ? "😎" : asleep ? "😴" : cutting ? "😊" : "🙂";
    const act = ["blog", "bacq", "bcut", "cutend"].includes(L.t);

    const barber = `<div class="sc-agent${act ? " is-active" : ""}">
        <div class="sc-avatar-wrap"><div class="sc-avatar sc-avatar--agent">${face}</div>${asleep ? `<span class="bb-zzz">${[0, 1, 2].map((k) => `<i style="${CC.phase(2400, k * 800)}">${"Zzz"[k]}</i>`).join("")}</span>` : ""}${cutting ? `<span class="bb-snip" style="${CC.phase(2000)}">✂️</span>` : ""}</div>
        <div class="sc-name">💈 Barbero</div>
        <div class="sc-lamp ${s.sem.clientes > 0 ? "lamp-green" : "lamp-red"}">clientesSem = ${s.sem.clientes}</div>
        <div class="sc-sub">${b.pc === "closed" ? "cerró (join)" : asleep ? "dormido en acquire()" : cutting ? "cortando el cabello…" : "despierto"}</div>
        <div class="sc-progress"><i data-bar="cut" style="width:${pct(timerOf("cut")).toFixed(1)}%"></i></div>
        <div class="sc-sub code-font">cortes: ${b.cuts}</div>
      </div>`;

    const nChairs = Math.max(cfg.sillas, seated.length);
    const chairs = Array.from({ length: nChairs }, (_, i) => {
      const c = seated[i], over = i >= cfg.sillas;
      return c ? `<div class="bb-chair bb-chair--busy${over ? " bb-chair--over" : ""}"><span>${over ? "😰" : "🙂"}</span><small>Cliente ${c.id}${over ? " · ¡sin silla!" : ""}</small></div>`
        : '<div class="bb-chair"><span>🪑</span><small>libre</small></div>';
    }).join("");
    const lock = sem ? `${s.cs ? "🔒" : "🔓"} mutexSala` : "⚠ sin mutex";
    const shop = `<div class="bb-shop">
        <div class="bb-room">
          <span class="bb-label">SALA DE ESPERA · ${cfg.sillas} SILLAS</span>
          <div class="bb-chairs">${chairs}</div>
          <div class="bb-count${desync ? " bad" : ""}">${lock} · esperando = ${s.esperando} / ${cfg.sillas}${desync ? ` (reales: ${seated.length})` : ""}</div>
        </div>
        <div class="bb-cutarea">
          <span class="bb-mirror">🪞</span><span class="bb-label">SILLA DEL BARBERO</span>
          <div class="bb-bchair">${cutC ? `<div class="bb-chair bb-chair--busy"><span>${cutting ? "😌" : "🙂"}</span><small>Cliente ${cutC.id}</small></div>` : '<span class="sc-empty">vacía</span>'}</div>
        </div>
      </div>`;

    const nextN = Math.min(s.main.n + 1, cfg.clientes);
    const door = `<div class="sc-flow${L.t === "arrive" ? " is-pulse" : ""}"><span>🚪 puerta${L.t === "arrive" ? " 🔔" : ""}</span><em>sleep_for → emplace_back(cliente)</em>
        <span class="sc-tok${timerOf("arrive") ? " on" : ""}">${timerOf("arrive") ? `próximo: cliente ${nextN}/${cfg.clientes}` : "todos llegaron"}</span></div>
      <div class="sc-progress bb-arrbar"><i data-bar="arr" style="width:${pct(timerOf("arrive")).toFixed(1)}%"></i></div>`;

    const sigs = `<div class="sc-flow${["csig", "clisto", "cfin", "bacq", "mclose"].includes(L.t) ? " is-pulse" : ""}"><span>cliente ↔ barbero</span>
        <em>clientesSem</em><span class="sc-tok${s.sem.clientes > 0 ? " on" : ""}">${s.sem.clientes}</span>
        <em>barberoListo</em><span class="sc-tok${s.sem.listo > 0 ? " on" : ""}">${s.sem.listo}</span>
        <em>corteTerminado</em><span class="sc-tok${s.sem.fin > 0 ? " on" : ""}">${s.sem.fin}</span></div>`;

    const faces = s.clients.map((c) => `<span class="bb-cl bb-cl--${c.pc}${L.id === c.id ? " is-active" : ""}" title="Cliente ${c.id}: ${CNAME[c.pc]}"><b>${FACE[c.pc]}</b><small>${c.id}</small></span>`).join("")
      || '<span class="sc-empty">aún no llega nadie</span>';
    const clients = `<div class="bb-clients-wrap"><div class="bb-clients">${faces}</div>
        <div class="bb-legend">🚪 llega · 🤔 decide · 🪑 espera · ✂️ en corte · 😄 satisfecho · 🚫 se fue · atendidos <b>${s.served}</b> · perdidos <b>${s.lost}</b></div></div>`;

    let overlay = "";
    if (s.deadlock) overlay = '<div class="sc-overlay sc-overlay--err"><b>⛔ INTERBLOQUEO</b><span>ningún hilo puede avanzar</span></div>';
    else if (s.done) {
      const bad = s.over || s.esperando !== 0;
      overlay = bad
        ? `<div class="sc-overlay sc-overlay--err"><b>⚠ Condición de carrera</b><span>${s.over ? `llegó a haber ${s.maxSeated} clientes en ${cfg.sillas} sillas; ` : ""}esperando terminó en ${s.esperando} (debía ser 0)</span></div>`
        : `<div class="sc-overlay sc-overlay--ok"><b>🎉 Barbería cerrada</b><span>${s.served} atendidos y ${s.lost} que se fueron, en ${Math.round(s.now)} ms — contador consistente</span></div>`;
    }
    const closed = b.pc === "closed" || s.done;
    const pole = `<span class="bb-pole" style="${CC.phase(1200)}"></span>`;
    const sign = `<div class="bb-sign">${pole}<span>BARBERÍA</span><b class="${closed ? "bb-closed" : "bb-open"}">${closed ? "CERRADO" : "ABIERTO"}</b>${pole}</div>`;
    return `${overlay}${sign}<div class="sc-top">${barber}${shop}</div>${door}${sigs}${clients}`;
  }

  // ---------- Conceptos ----------
  function conceptsHtml() {
    const s = S, b = s.barber, sem = cfg.mode === "semaforos", o = s.ops;
    const asleep = b.pc === "acq" && s.sem.clientes === 0;
    const seated = seatedList(), cutC = s.clients.find((c) => c.pc === "cut");
    const active = s.clients.filter((c) => !finished(c));

    const mainRow = s.main.pc === "spawn" ? ["on", `sleep_for → crea el cliente ${Math.min(s.main.n + 1, cfg.clientes)}/${cfg.clientes}`]
      : s.done ? ["off", "Terminó"] : ["block", s.main.pc === "join" ? "join() esperando a los clientes" : "tb.join() esperando al barbero"];
    const barRow = b.pc === "closed" ? ["off", "Terminó"] : asleep ? ["block", "Bloqueado en clientesSem.acquire() (duerme)"] : b.pc === "cutting" ? ["on", "Cortando (sleep_for)"] : ["on", "Activo"];
    const th = [row(mainRow[0], "main", mainRow[1]), row(barRow[0], "Barbero", barRow[1]),
      row(active.length ? "on" : "off", "Clientes", `${s.main.n} creados · ${active.length} activos (${seated.length} en sala, ${cutC ? 1 : 0} en corte)`)];
    const cHilos = card("🧵", "Hilos", "std::thread",
      `Flujos concurrentes que comparten memoria (<code>esperando</code>, <code>cerrar</code>). Hay uno por el barbero, uno por la función principal y <strong>uno por cada cliente</strong>: ahora hay <strong>${2 + active.length}</strong> vivos.`,
      `<ul class="cc-list">${th.join("")}</ul>`);

    const rec = [
      row(seated.length >= cfg.sillas ? "warn" : seated.length ? "on" : "off", "🪑 Sillas de espera", `${seated.length} de ${cfg.sillas} ocupadas`),
      row(cutC ? "on" : "off", "✂ Silla del barbero", cutC ? `ocupada por el cliente ${cutC.id}` : "libre"),
      row(b.pc === "cutting" ? "warn" : "on", "💈 Barbero", b.pc === "cutting" ? "atendiendo (un cliente a la vez)" : "disponible"),
      row("on", "🔢 esperando", `variable compartida = ${s.esperando}`),
    ];
    const cRec = card("📦", "Recursos", "compartidos",
      "Lo que los hilos se disputan: hay pocas sillas y un solo barbero. Si no hay silla, el cliente se va; si no hay clientes, el barbero duerme.",
      `<ul class="cc-list">${rec.join("")}</ul>`);

    const desync = s.esperando !== seated.length;
    const sc = sem
      ? `<div class="cc-mutex ${s.cs ? "cc-mutex--on" : ""}">${s.cs ? "🔒 mutexSala ocupado" : "🔓 mutexSala libre"}</div>
        <p class="cc-line code-font">esperando = ${s.esperando} · clientes reales en sala = ${seated.length}</p>
        <p class="cc-line">Clientes (<code>esperando++</code>) y barbero (<code>esperando--</code>) modifican la misma variable: el mutex hace que la comprobación y la actualización sean indivisibles.</p>`
      : `<div class="cc-mutex">⚠ Sin sección crítica</div>
        <p class="cc-line code-font">esperando = ${s.esperando} · clientes reales en sala = ${seated.length}${desync ? " ← ¡desincronizado!" : ""}</p>
        <p class="cc-line">Leer y escribir <code>esperando</code> son dos pasos: si otro hilo lo cambia en medio, se pierde una actualización (condición de carrera).${s.over ? " <strong class='text-rose'>Ya se superó la capacidad de la sala.</strong>" : ""}</p>`;
    const cSc = card("🔒", "Sección crítica", "exclusión mutua", "Fragmento que toca datos compartidos y solo puede ejecutar un hilo a la vez.", sc);

    const wait = seated.length > 0;
    const cond = [
      ["Exclusión mutua", true, "el barbero atiende a un solo cliente a la vez"],
      ["Retención y espera", wait, wait ? "un cliente retiene su silla mientras espera su turno" : "nadie retiene una silla ahora"],
      ["Sin apropiación", wait, "no se le quita la silla a un cliente sentado"],
      ["Espera circular", s.deadlock, s.deadlock ? "ciclo de espera detectado" : "no hay: el cliente avisa (clientesSem.release) antes de esperar"],
    ];
    const cDead = card("⛔", "Interbloqueo", "deadlock",
      "Requiere las 4 condiciones de Coffman a la vez. Aquí la espera circular se rompe: el cliente siempre <em>avisa antes de esperar</em>.",
      `<ul class="cc-list">${cond.map(([n, on, t]) => row(on ? "crit" : "off", n, t)).join("")}</ul>
       <p class="cc-line">${s.deadlock ? "<strong class='text-rose'>Interbloqueo.</strong>" : "Falta la espera circular: no hay interbloqueo. (Si el cliente esperara a <code>barberoListo</code> sin avisar antes, el barbero dormiría para siempre.)"}</p>`);

    const cSync = card("🔗", "Sincronización y comunicación", "semáforos · cita · mutex",
      "Los hilos se coordinan y se avisan mediante semáforos; <code>barberoListo</code> y <code>corteTerminado</code> forman una cita entre barbero y cliente.",
      `<div class="cc-flow">
         <span>🪑 Cliente</span><em>clientesSem <b>${o.rel_c}</b> →</em>
         <span>💈 Barbero</span><em>← barberoListo <b>${o.rel_l}</b></em>
         <em>corteTerminado <b>${o.rel_f}</b> →</em><span>🪑 Cliente</span>
       </div>
       <ul class="cc-list">
         ${row("on", "Semáforos", `counting_semaphore: ${o.acquire} acquire() · ${o.rel_c + o.rel_l + o.rel_f} release()`)}
         ${row(sem ? "on" : "off", "Mutex", sem ? `mutexSala + <code>esperando</code>: ${o.lock} entradas` : "No se usa en esta variante")}
         ${row("on", "Bucles", `<code>while(true)</code> del barbero: ${o.loops} vueltas. <code>acquire()</code> duerme al hilo (sin espera activa)`)}
       </ul>`);

    return cHilos + cRec + cSc + cDead + cSync;
  }

  function semsHtml() {
    const s = S;
    return chip("clientesSem", s.sem.clientes, s.sem.clientes > 0) + chip("barberoListo", s.sem.listo, s.sem.listo > 0) + chip("corteTerminado", s.sem.fin, s.sem.fin > 0)
      + chip(cfg.mode === "semaforos" ? "esperando (mutexSala)" : "esperando (sin mutex)", s.esperando, s.esperando > 0) + chip("cerrar", s.cerrar ? "true" : "false", s.cerrar);
  }
  function clockText(running) {
    const s = S;
    const status = s.deadlock ? '<span class="text-rose">⛔ INTERBLOQUEO</span>' : s.done ? '<span class="text-emerald">✔ Finalizado</span>' : running ? "▶ En ejecución" : "⏸ Detenido";
    return `t = ${Math.round(s.now)} ms · Clientes ${s.main.n}/${cfg.clientes} · Atendidos ${s.served} · Perdidos ${s.lost} · ${status}`;
  }
  function updateBars() {
    [["cut", "cut"], ["arr", "arrive"]].forEach(([bar, kind]) => {
      const el = document.querySelector(`#cc-scene [data-bar="${bar}"]`);
      if (el) el.style.width = pct(timerOf(kind)).toFixed(1) + "%";
    });
  }

  CC.register({
    id: "barbero",
    tab: "💈 El barbero dormilón",
    subtitle: "Problema del barbero dormilón — semáforos, sección crítica, cita (rendezvous) y condiciones de carrera",
    file: "barbero_dormilon.cpp",
    bin: "barbero_dormilon",
    compile: "g++ -std=c++20 -O2 -pthread barbero_dormilon.cpp -o barbero_dormilon && ./barbero_dormilon",
    intro: `Una barbería tiene <strong>un barbero</strong> y una sala con pocas <strong>sillas</strong>. Si no hay clientes, el barbero
      duerme (<code>clientesSem.acquire()</code>). Cada <strong>cliente</strong> (un hilo) llega a destiempo: si hay silla libre se sienta,
      avisa al barbero (<code>clientesSem.release()</code>) y espera su turno; si la sala está llena, se va. El barbero llama al siguiente
      (<code>barberoListo</code>), corta el cabello y avisa del fin (<code>corteTerminado</code>). Ejemplo clásico de sincronización,
      sección crítica y condiciones de carrera.`,
    modes: [["semaforos", "Con semáforos + mutex (correcta)"], ["carrera", "Sin mutex: condición de carrera sobre 'esperando'"]],
    modeHint: MODE_HINT,
    consts: [
      { key: "sillas", label: "SILLAS", min: 1, max: 10, def: 3 },
      { key: "clientes", label: "CLIENTES", min: 1, max: 60, def: 10 },
      { key: "corte", label: "CORTE_MS", min: 100, max: 5000, step: 100, def: 600, cls: "num" },
      { key: "amin", label: "LLEGADA_MIN", min: 0, max: 3000, step: 50, def: 100, cls: "num" },
      { key: "amax", label: "LLEGADA_MAX", min: 0, max: 3000, step: 50, def: 500, cls: "num" },
      { key: "preempt", label: "PREEMPT_MS", min: 10, max: 1000, step: 10, def: 150, cls: "num" },
    ],
    constHint: "Los tres primeros son constantes del código; LLEGADA_MIN/MAX son los literales de <code>uniform_int_distribution(100, 500)</code> en main(). <code>PREEMPT_MS</code> solo existe en la simulación: cuánto tiempo el planificador deja fuera de la CPU a un cliente en la variante sin mutex.",
    codeNote: "Es la solución con semáforos y mutex: la que se simula en el modo “Con semáforos + mutex”.",
    cppMap: `<span><b>Hilos</b> → <code>thread tb</code> (barbero) + <code>vector&lt;thread&gt;</code> (un hilo por cliente) + main</span>
      <span><b>Semáforos</b> → <code>counting_semaphore</code> (<code>clientesSem</code>, <code>barberoListo</code>, <code>corteTerminado</code>)</span>
      <span><b>Sección crítica</b> → <code>lock_guard&lt;mutex&gt;</code> sobre <code>esperando</code> (<code>mutexSala</code>)</span>
      <span><b>Bucles</b> → <code>while (true)</code> del barbero / <code>for</code> de llegadas en main</span>
      <span><b>Interbloqueo</b> → evitado: el cliente avisa (<code>release</code>) antes de esperar (<code>acquire</code>)</span>`,
    cpp: CPP_SRC,
    pseudo: PSEUDO,
    reset: (c) => { cfg = c; newState(); },
    S: () => S,
    hasAction: () => enabled().length > 0,
    sleeping,
    step: doNext,
    updateBars,
    scene: sceneHtml,
    concepts: conceptsHtml,
    sems: semsHtml,
    clock: clockText,
  });
})();
