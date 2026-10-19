(function () {
  "use strict";

  // =====================================================================
  //  Problema de los fumadores (Patil) — se registra en el motor (concurrencia.js)
  //  Modelo: tiempo virtual en ms. Las acciones sin sleep (acquire/release/lock)
  //  ocurren en el mismo instante; sleep_for(ETAPA_MS) hace avanzar el reloj.
  // =====================================================================

  const CPP_SRC = "// Problema de los Fumadores con hilos y semáforos reales (C++20)\n// Compilar: g++ -std=c++20 -O2 -pthread fumadores.cpp -o fumadores\n\n#include <iostream>\n#include <mutex>\n#include <random>\n#include <semaphore>\n#include <string>\n#include <thread>\n#include <vector>\n#include <chrono>\n\nusing namespace std;\n\nconst int RONDAS = 9;     // rondas a completar\nconst int ETAPA_MS = 500; // duración de recoger / fumar\n\nenum\n{\n    TABACO,\n    PAPEL,\n    CERILLAS\n};\nconst char *NOMBRE[3] = {\"Tabaco\", \"Papel\", \"Cerillas\"};\n\n// Semáforos\ncounting_semaphore<> agenteSem(1);                                 // turno del agente\ncounting_semaphore<> ingredienteSem[3] = {counting_semaphore<>(0), // agente -> empujadores\n                                          counting_semaphore<>(0),\n                                          counting_semaphore<>(0)};\ncounting_semaphore<> fumadorSem[3] = {counting_semaphore<>(0), // empujador -> fumador\n                                      counting_semaphore<>(0),\n                                      counting_semaphore<>(0)};\n\n// Mutex y datos compartidos\nmutex mutexEmpujadores; // protege hay[]\nbool hay[3] = {false, false, false};\nmutex mutexSalida;     // evita mezclar líneas de cout\nbool terminar = false; // se escribe solo tras completar todas las rondas\n\nvoid log(const string &texto)\n{\n    lock_guard<mutex> lock(mutexSalida);\n    cout << texto << endl;\n}\n\n// El agente coloca dos ingredientes al azar y espera a que alguien fume.\nvoid agente()\n{\n    mt19937 gen(random_device{}());\n    for (int ronda = 1; ronda <= RONDAS; ronda++)\n    {\n        agenteSem.acquire(); // espera la mesa libre\n\n        int falta = uniform_int_distribution<int>(0, 2)(gen);\n        int a = (falta + 1) % 3, b = (falta + 2) % 3;\n\n        log(\"\\n--- Ronda \" + to_string(ronda) + \" ---\");\n        log(string(\"Agente: pone \") + NOMBRE[a] + \" y \" + NOMBRE[b]);\n\n        ingredienteSem[a].release();\n        ingredienteSem[b].release();\n    }\n\n    agenteSem.acquire(); // espera a que termine la última ronda\n    terminar = true;\n    for (int i = 0; i < 3; i++)\n    { // despierta a los demás para que salgan\n        ingredienteSem[i].release();\n        fumadorSem[i].release();\n    }\n}\n\n// Un empujador por ingrediente: decide qué fumador debe despertar.\nvoid empujador(int i)\n{\n    int j = (i + 1) % 3, k = (i + 2) % 3;\n    while (true)\n    {\n        ingredienteSem[i].acquire();\n        if (terminar)\n            return;\n\n        lock_guard<mutex> lock(mutexEmpujadores);\n        if (hay[j])\n        {\n            hay[j] = false;\n            fumadorSem[k].release();\n        } // faltaba k\n        else if (hay[k])\n        {\n            hay[k] = false;\n            fumadorSem[j].release();\n        } // faltaba j\n        else\n        {\n            hay[i] = true;\n        } // espera al otro\n    }\n}\n\n// El fumador i tiene el ingrediente i y necesita los otros dos.\nvoid fumador(int i)\n{\n    string nombre = \"Fumador \" + to_string(i + 1) + \" (\" + NOMBRE[i] + \")\";\n    while (true)\n    {\n        fumadorSem[i].acquire();\n        if (terminar)\n            return;\n\n        log(nombre + \": recoge los ingredientes\");\n        this_thread::sleep_for(chrono::milliseconds(ETAPA_MS));\n        log(nombre + \": fuma\");\n        this_thread::sleep_for(chrono::milliseconds(ETAPA_MS));\n        log(nombre + \": termina\");\n\n        agenteSem.release(); // devuelve el turno al agente\n    }\n}\n\nint main()\n{\n    vector<thread> hilos;\n    for (int i = 0; i < 3; i++)\n        hilos.emplace_back(empujador, i);\n    for (int i = 0; i < 3; i++)\n        hilos.emplace_back(fumador, i);\n    hilos.emplace_back(agente);\n\n    for (auto &h : hilos)\n        h.join();\n    log(\"\\nSimulación finalizada.\");\n}\n";

  const KEYS = ["tobacco", "paper", "match"];
  const ING = {
    tobacco: { icon: "🌿", name: "Tabaco", cls: "emerald", face: "🧔" },
    paper: { icon: "📜", name: "Papel", cls: "cyan", face: "👩" },
    match: { icon: "🔥", name: "Cerillas", cls: "orange", face: "🧑" },
  };
  const nm = (k) => ING[k].name.toLowerCase();

  let S = null, cfg = null;

  const PSEUDO = {
    semaforos: `// Semáforos: agenteSem=1; ingredienteSem[3]=0; fumadorSem[3]=0
// Datos compartidos: hay[3]=false (protegido por mutexEmpujadores)

AGENTE                           EMPUJADOR del ingrediente i
  repite RONDAS veces              repite
    agenteSem.acquire()              ingredienteSem[i].acquire()
    elige 2 ingredientes             { sección crítica: lock(mutexEmpujadores)
    ingredienteSem[a].release()        si hay[j]: hay[j]=false; fumadorSem[k].release()
    ingredienteSem[b].release()        si no, si hay[k]: hay[k]=false; fumadorSem[j].release()
                                       si no: hay[i]=true }

FUMADOR i (tiene el ingrediente i)
  repite
    fumadorSem[i].acquire()
    recoge ingredientes; sleep_for(ETAPA_MS)
    fuma;                sleep_for(ETAPA_MS)
    agenteSem.release()`,
    ingenua: `// Semáforos: agenteSem=1; ingredienteSem[3]=0

AGENTE
  repite RONDAS veces
    agenteSem.acquire()
    elige 2 ingredientes
    ingredienteSem[a].release()
    ingredienteSem[b].release()

FUMADOR i (necesita los otros dos: A y B)
  repite
    ingredienteSem[A].acquire()    // ¡toma uno...
    ingredienteSem[B].acquire()    // ...y se queda esperando el otro!
    recoge ingredientes; sleep_for(ETAPA_MS)
    fuma;                sleep_for(ETAPA_MS)
    agenteSem.release()

// Problema: dos fumadores pueden tomar un ingrediente cada uno y
// quedarse esperando el que tiene el otro → interbloqueo (deadlock).`,
  };
  const MODE_HINT = {
    semaforos: "Tres hilos intermedios (empujadores) llevan la cuenta de lo que hay en la mesa dentro de una sección crítica y despiertan solo al fumador correcto. Nunca se bloquea.",
    ingenua: "Cada fumador hace acquire() de sus dos ingredientes uno a uno. Si dos de ellos agarran uno cada uno, nadie puede continuar: interbloqueo.",
  };

  // ---------- Estado ----------
  function newState() {
    S = {
      now: 0, // reloj virtual (ms)
      rounds: 0,
      terminar: false,
      done: false,
      deadlock: false,
      sem: { agent: 1, tobacco: 0, paper: 0, match: 0 }, // agenteSem / ingredienteSem[]
      pend: { tobacco: 0, paper: 0, match: 0 }, // hay[] de los empujadores
      wake: { tobacco: 0, paper: 0, match: 0 }, // fumadorSem[]
      table: [],
      cs: [], // empujador dentro de la sección crítica en la última acción
      last: { t: "" }, // última acción (para animaciones)
      ops: { acquire: 0, ag2ing: 0, ing2fum: 0, fum2ag: 0, lock: 0, loops: 0 },
      smokers: KEYS.map((k) => ({ own: k, state: "waiting", startAt: 0, endAt: 0, held: [], smoked: 0 })),
      log: [],
      out: [],
    };
  }
  const who = (sm) => `Fumador ${KEYS.indexOf(sm.own) + 1} (${ING[sm.own].name})`;
  const logd = (m, c) => S.log.push({ t: Math.round(S.now), m, c: c || "" });
  const out = (l) => S.out.push(l);

  // ---------- Acciones atómicas de los hilos ----------
  function enabled() {
    const s = S, a = [];
    s.smokers.forEach((sm, i) => {
      if (sm.state !== "waiting" && sm.state !== "holding") return;
      if (cfg.mode === "semaforos") {
        if (s.wake[sm.own] > 0) a.push({ t: "smk", i });
      } else {
        const next = KEYS.filter((k) => k !== sm.own).find((k) => !sm.held.includes(k));
        if (next && s.sem[next] > 0) a.push({ t: "smk", i });
      }
    });
    if (cfg.mode === "semaforos") KEYS.forEach((k) => { if (s.sem[k] > 0) a.push({ t: "push", k }); });
    if (!s.terminar && s.sem.agent > 0) a.push({ t: "agent" });
    return a;
  }
  function sleeping() {
    return S.smokers.filter((m) => m.state === "rolling" || m.state === "smoking").sort((a, b) => a.endAt - b.endAt)[0];
  }
  function startSleep(sm, state) {
    sm.state = state;
    sm.startAt = S.now;
    sm.endAt = S.now + cfg.etapa;
  }

  function execute(act) {
    const s = S;
    s.cs = [];
    s.last = { t: act.t, i: act.i, k: act.k };
    if (act.t === "agent") {
      s.sem.agent--; s.ops.acquire++; s.ops.loops++;
      if (s.rounds >= cfg.rounds) { // última espera: todo terminó → terminar = true
        s.terminar = true; s.done = true;
        logd("Agente: agenteSem.acquire() final → terminar = true y despierta a los demás hilos", "ok");
        out(""); out("Simulación finalizada.");
        return;
      }
      s.rounds++;
      const miss = KEYS[Math.floor(Math.random() * 3)];
      const items = KEYS.filter((k) => k !== miss);
      s.table = items.slice();
      items.forEach((k) => s.sem[k]++);
      s.ops.ag2ing += 2;
      out(""); out(`--- Ronda ${s.rounds} ---`);
      out(`Agente: pone ${ING[items[0]].name} y ${ING[items[1]].name}`);
      logd(`🤖 Agente: agenteSem.acquire() → pone ${ING[items[0]].icon} ${nm(items[0])} y ${ING[items[1]].icon} ${nm(items[1])}; 2 × ingredienteSem.release() (fuma quien tiene ${nm(miss)})`, "agent");
    } else if (act.t === "push") {
      const k = act.k;
      s.sem[k]--; s.ops.acquire++; s.ops.lock++; s.ops.loops++;
      s.cs = [k];
      const [x, y] = KEYS.filter((q) => q !== k);
      if (s.pend[x] > 0) {
        s.pend[x] = 0; s.wake[y]++; s.ops.ing2fum++;
        logd(`⚙ Empujador ${nm(k)} [lock]: hay[${nm(x)}] = true → hay[${nm(x)}] = false; fumadorSem[${nm(y)}].release()`);
      } else if (s.pend[y] > 0) {
        s.pend[y] = 0; s.wake[x]++; s.ops.ing2fum++;
        logd(`⚙ Empujador ${nm(k)} [lock]: hay[${nm(y)}] = true → hay[${nm(y)}] = false; fumadorSem[${nm(x)}].release()`);
      } else {
        s.pend[k] = 1;
        logd(`⚙ Empujador ${nm(k)} [lock]: aún falta el otro → hay[${nm(k)}] = true`);
      }
    } else {
      const sm = s.smokers[act.i], I = ING[sm.own];
      if (cfg.mode === "semaforos") {
        s.wake[sm.own]--; s.ops.acquire++;
        s.table = [];
        startSleep(sm, "rolling");
        out(`${who(sm)}: recoge los ingredientes`);
        logd(`${I.icon} ${who(sm)}: fumadorSem.acquire() → recoge los ingredientes (sleep_for ${cfg.etapa} ms)`, "ok");
      } else {
        const next = KEYS.filter((k) => k !== sm.own).find((k) => !sm.held.includes(k));
        s.sem[next]--; s.ops.acquire++;
        sm.held.push(next);
        s.table = s.table.filter((k) => k !== next);
        if (sm.held.length === 2) {
          sm.held = [];
          startSleep(sm, "rolling");
          out(`${who(sm)}: recoge los ingredientes`);
          logd(`${I.icon} ${who(sm)}: tomó ${ING[next].icon} ${nm(next)} y ya tiene los dos → recoge (sleep_for ${cfg.etapa} ms)`, "ok");
        } else {
          sm.state = "holding";
          logd(`${I.icon} ${who(sm)}: tomó ${ING[next].icon} ${nm(next)} y espera el otro (retención y espera)`, "warn");
        }
      }
    }
  }
  // el sleep_for de un fumador termina
  function complete(sm) {
    const s = S, I = ING[sm.own];
    s.cs = [];
    s.last = { t: "wake", i: s.smokers.indexOf(sm) };
    s.now = Math.max(s.now, sm.endAt);
    if (sm.state === "rolling") {
      startSleep(sm, "smoking");
      out(`${who(sm)}: fuma`);
      logd(`${I.icon} ${who(sm)}: fuma (sleep_for ${cfg.etapa} ms)`);
    } else {
      sm.state = "waiting";
      sm.smoked++;
      s.sem.agent++; s.ops.fum2ag++; s.ops.loops++;
      out(`${who(sm)}: termina`);
      logd(`${I.icon} ${who(sm)}: termina (cigarrillo #${sm.smoked}) → agenteSem.release()`, "ok");
    }
  }
  // un paso lógico: una acción atómica (o el fin de un sleep)
  function doNext() {
    if (S.done || S.deadlock) return false;
    const en = enabled();
    if (en.length) { execute(en[Math.floor(Math.random() * en.length)]); return true; }
    const sm = sleeping();
    if (sm) { complete(sm); return true; }
    S.deadlock = true;
    S.last = { t: "dead" };
    logd("⛔ INTERBLOQUEO: ningún hilo puede avanzar.", "err");
    return false;
  }

  // ---------- Escena ----------
  function chip(label, val, hl) {
    return `<div class="cc-sem${hl ? " cc-sem--on" : ""}"><span>${label}</span><b>${val}</b></div>`;
  }
  function stateText(sm) {
    switch (sm.state) {
      case "rolling": return "🤲 Recogiendo los ingredientes";
      case "smoking": return "💨 Fumando";
      case "holding": return `✋ Retiene ${sm.held.map((k) => ING[k].icon).join("")} y espera el otro`;
      default: return cfg.mode === "semaforos" ? "⏳ Dormido en acquire()" : "⏳ Esperando ingredientes";
    }
  }
  function faceOf(sm) {
    if (S.deadlock && sm.state === "holding") return "😱";
    if (S.done) return "😎";
    return { waiting: "😐", holding: "😰", rolling: "🧐", smoking: "😮‍💨" }[sm.state];
  }
  const pctOf = (sm) => (sm.state === "rolling" || sm.state === "smoking" ? Math.max(0, Math.min(100, ((S.now - sm.startAt) / (sm.endAt - sm.startAt)) * 100)) : 0);

  function sceneHtml() {
    const s = S, sem = cfg.mode === "semaforos", L = s.last;
    const turno = s.sem.agent > 0 && !s.done;
    const placed = L.t === "agent" && s.table.length > 0;

    const agent = `<div class="sc-agent${L.t === "agent" ? " is-active" : ""}">
        <div class="sc-avatar sc-avatar--agent">🤖</div>
        <div class="sc-name">Agente</div>
        <div class="sc-lamp ${turno ? "lamp-green" : "lamp-red"}">${s.done ? "terminó" : turno ? "agenteSem = 1" : "agenteSem = 0"}</div>
        <div class="sc-sub">${s.done ? "join()" : turno ? "tiene el turno" : "dormido en acquire()"}</div>
        <div class="sc-sub code-font">ronda ${Math.min(s.rounds, cfg.rounds)}/${cfg.rounds}</div>
      </div>`;

    const items = s.table.length
      ? s.table.map((k, n) => `<span class="sc-item sc-item--${ING[k].cls}${placed ? " is-new" : ""}" style="animation-delay:${n * 120}ms"><b>${ING[k].icon}</b><small>${ING[k].name}</small></span>`).join("")
      : '<span class="sc-empty">mesa vacía</span>';
    const table = `<div class="sc-tablewrap"><div class="sc-table"><span class="sc-table__label">MESA</span><div class="sc-table__items">${items}</div></div><div class="sc-legs"><i></i><i></i></div></div>`;

    const flow1 = `<div class="sc-flow${L.t === "agent" ? " is-pulse" : ""}"><span>agente</span><em>↓ ingredienteSem.release()</em>${KEYS.map((k) => `<span class="sc-tok${s.sem[k] > 0 ? " on" : ""}">${ING[k].icon} ${s.sem[k]}</span>`).join("")}<em>↓ ${sem ? "empujadores" : "fumadores"}</em></div>`;

    let pushers = "";
    if (sem) {
      pushers = `<div class="sc-pushers">
        ${KEYS.map((k) => {
          const inCs = s.cs.includes(k);
          return `<div class="sc-pusher${inCs ? " in-cs" : ""}"><div class="sc-gear${inCs ? " spin" : ""}">⚙</div><div><strong>Empujador ${ING[k].icon}</strong><small>${inCs ? "en sección crítica" : s.sem[k] > 0 ? "listo para actuar" : "dormido en acquire()"}</small></div><span class="sc-flag${s.pend[k] ? " on" : ""}" title="hay[${nm(k)}]">hay=${s.pend[k] ? "T" : "F"}</span></div>`;
        }).join("")}
        <div class="sc-mutex${s.cs.length ? " on" : ""}"><span>${s.cs.length ? "🔒" : "🔓"}</span><small>mutexEmpujadores</small></div>
      </div>
      <div class="sc-flow${L.t === "push" ? " is-pulse" : ""}"><span>empujadores</span><em>↓ fumadorSem.release()</em>${KEYS.map((k) => `<span class="sc-tok${s.wake[k] > 0 ? " on" : ""}">${ING[k].icon} ${s.wake[k]}</span>`).join("")}<em>↓ fumadores</em></div>`;
    }

    const smokers = s.smokers.map((sm, i) => {
      const I = ING[sm.own], need = KEYS.filter((k) => k !== sm.own);
      const dead = s.deadlock && sm.state === "holding";
      const smoke = sm.state === "smoking" ? '<span class="sc-smoke"><i>💨</i><i>💨</i><i>💨</i></span>' : "";
      const cigs = sm.smoked ? "🚬".repeat(Math.min(sm.smoked, 12)) + (sm.smoked > 12 ? "…" : "") : "—";
      return `<div class="sc-smoker sc-smoker--${sm.state} accent-${I.cls}${dead ? " is-dead" : ""}${L.t === "wake" && L.i === i ? " is-active" : ""}">
        <div class="sc-crate"><span>📦</span><b>∞ ${I.icon}</b><small>${I.name}</small></div>
        <div class="sc-avatar-wrap"><div class="sc-avatar">${faceOf(sm)}</div>${smoke}</div>
        <div class="sc-name">Fumador ${i + 1}</div>
        <div class="sc-need">necesita ${need.map((k) => ING[k].icon).join(" + ")}</div>
        <div class="sc-state">${stateText(sm)}</div>
        <div class="sc-progress"><i data-bar="${i}" style="width:${pctOf(sm).toFixed(1)}%"></i></div>
        <div class="sc-held">${sm.held.length ? "retiene " + sm.held.map((k) => ING[k].icon).join(" ") : sem ? `fumadorSem = ${s.wake[sm.own]}` : "&nbsp;"}</div>
        <div class="sc-cigs" title="cigarrillos fumados">${cigs} <b>${sm.smoked}</b></div>
      </div>`;
    }).join("");

    const flow3 = `<div class="sc-flow sc-flow--up${L.t === "wake" && S.sem.agent > 0 ? " is-pulse" : ""}"><span>fumador</span><em>↑ agenteSem.release() al terminar</em><span class="sc-tok${s.sem.agent > 0 ? " on" : ""}">agenteSem ${s.sem.agent}</span></div>`;

    let overlay = "";
    if (s.deadlock) overlay = `<div class="sc-overlay sc-overlay--err"><b>⛔ INTERBLOQUEO</b><span>cada fumador retiene un ingrediente y espera el que tiene otro; el agente espera agenteSem</span></div>`;
    else if (s.done) overlay = `<div class="sc-overlay sc-overlay--ok"><b>🎉 ¡Todos fumaron!</b><span>${s.smokers.reduce((a, m) => a + m.smoked, 0)} cigarrillos en ${Math.round(s.now)} ms — sin bloqueos</span></div>`;

    return `${overlay}
      <div class="sc-top">${agent}${table}</div>
      ${flow1}${pushers}
      <div class="sc-smokers">${smokers}</div>
      ${flow3}`;
  }

  // ---------- Conceptos ----------
  function card(icon, title, tag, def, body) {
    return `<div class="cc-card"><h3 class="cc-card__title"><span>${icon} ${title}</span><span class="cc-tag">${tag}</span></h3><p class="cc-def">${def}</p>${body}</div>`;
  }
  const row = (dot, name, txt) => `<li class="cc-row"><span class="cc-dot cc-dot--${dot}"></span><b>${name}</b><span>${txt}</span></li>`;

  function conceptsHtml() {
    const s = S, sem = cfg.mode === "semaforos";
    const agRow = s.done ? ["off", "Terminó (join)"] : s.sem.agent > 0 ? ["on", "Listo: tiene el turno (agenteSem = 1)"] : ["block", "Bloqueado en agenteSem.acquire()"];

    const th = [row(agRow[0], "Agente", agRow[1])];
    if (sem) KEYS.forEach((k) => th.push(row(s.cs.includes(k) ? "crit" : s.done ? "off" : s.sem[k] > 0 ? "on" : "block", `Empujador ${nm(k)}`, s.cs.includes(k) ? "En sección crítica (tiene el mutex)" : s.done ? "Terminó" : s.sem[k] > 0 ? "Listo: hay ingrediente que procesar" : `Bloqueado en ingredienteSem[${nm(k)}].acquire()`)));
    s.smokers.forEach((sm) => {
      const d = s.done ? "off" : sm.state === "waiting" ? (sem && s.wake[sm.own] > 0 ? "on" : "block") : sm.state === "holding" ? "warn" : "on";
      th.push(row(d, `Fumador ${nm(sm.own)}`, s.done ? "Terminó" : stateText(sm).replace(/^\S+\s/, "")));
    });
    const cHilos = card("🧵", "Hilos", "std::thread",
      `Flujos de ejecución concurrentes dentro de un mismo proceso. Comparten memoria (la mesa, <code>hay[]</code>) y el planificador los intercala. Aquí hay <strong>${th.length}</strong>: ${sem ? "agente, 3 empujadores y 3 fumadores" : "agente y 3 fumadores"}.`,
      `<ul class="cc-list">${th.join("")}</ul>`);

    const using = new Set();
    s.smokers.forEach((sm) => { if (sm.state === "rolling" || sm.state === "smoking") KEYS.filter((k) => k !== sm.own).forEach((k) => using.add(k)); });
    const rec = [row(s.table.length ? "on" : "off", "🪑 Mesa", s.table.length ? `ocupada por ${s.table.map((k) => ING[k].icon).join("")}` : "libre")];
    KEYS.forEach((k) => {
      const holder = s.smokers.find((sm) => sm.held.includes(k));
      let d = "off", t = "no disponible (el agente no lo ha puesto)";
      if (holder) { d = "warn"; t = `retenido por el fumador de ${nm(holder.own)}`; }
      else if (s.table.includes(k)) { d = "on"; t = "en la mesa, disponible"; }
      else if (using.has(k)) { d = "on"; t = "en uso por un fumador"; }
      rec.push(row(d, `${ING[k].icon} ${ING[k].name}`, t));
    });
    rec.push(row(s.sem.agent > 0 ? "off" : "on", "🎟️ Turno del agente", s.sem.agent > 0 ? "libre (agenteSem = 1)" : "ocupado: espera a que alguien fume"));
    const cRec = card("📦", "Recursos", "compartidos",
      "Lo que los hilos necesitan para avanzar y que no se puede usar a la vez sin coordinación. Si se asignan mal, aparece el interbloqueo.",
      `<ul class="cc-list">${rec.join("")}</ul>`);

    let sc;
    if (sem) {
      const hay = KEYS.map((k) => `${nm(k)}=${s.pend[k] ? "true" : "false"}`).join(", ");
      sc = `<div class="cc-mutex ${s.cs.length ? "cc-mutex--on" : ""}">${s.cs.length ? "🔒 mutexEmpujadores ocupado" : "🔓 mutexEmpujadores libre"}</div>
        <p class="cc-line">${s.cs.length ? "Dentro ahora: empujador " + nm(s.cs[0]) + ". Los demás esperarían su turno." : "Ningún empujador está dentro ahora."}</p>
        <p class="cc-line code-font">hay[] = { ${hay} }</p>
        <p class="cc-line">Sin el mutex, dos empujadores podrían leer y escribir <code>hay[]</code> a la vez y despertar al fumador equivocado (condición de carrera).</p>`;
    } else {
      sc = `<div class="cc-mutex">⚠ Sin sección crítica</div>
        <p class="cc-line">En esta variante no hay datos protegidos: los fumadores compiten directamente por los semáforos de ingredientes. Nada coordina quién agarra qué, y eso permite el bloqueo.</p>`;
    }
    const cSc = card("🔒", "Sección crítica", "exclusión mutua",
      "Fragmento de código que accede a datos compartidos y solo puede ejecutar un hilo a la vez.", sc);

    const hold = s.smokers.some((sm) => sm.held.length);
    const cond = [
      ["Exclusión mutua", true, "un ingrediente lo usa un solo fumador"],
      ["Retención y espera", hold, sem ? "no se da: nadie retiene un ingrediente a medias" : hold ? "un fumador retiene uno y espera el otro" : "ningún fumador retiene nada ahora"],
      ["Sin apropiación", hold, sem ? "no aplica" : "no se le puede quitar lo retenido"],
      ["Espera circular", s.deadlock, s.deadlock ? "cada fumador espera lo que retiene otro" : "no hay ciclo de espera"],
    ];
    const cDead = card("⛔", "Interbloqueo", "deadlock",
      "Ocurre cuando se cumplen a la vez las 4 condiciones de Coffman. Los empujadores rompen la <em>retención y espera</em>.",
      `<ul class="cc-list">${cond.map(([n, on, t]) => row(on ? "crit" : "off", n, t)).join("")}</ul>
       <p class="cc-line">${s.deadlock ? "<strong class='text-rose'>Las 4 se cumplen: interbloqueo.</strong>" : sem ? "Una condición no se cumple: no puede haber interbloqueo." : hold ? "Cuidado: si se completa el ciclo, habrá interbloqueo." : "Todavía no."}</p>`);

    const o = s.ops;
    const cSync = card("🔗", "Sincronización y comunicación", "semáforos · monitores · bucles",
      "Los hilos se coordinan (sincronización) y se avisan unos a otros (comunicación) mediante estos mecanismos.",
      `<div class="cc-flow">
         <span>🤖 Agente</span><em>ingredienteSem <b>${o.ag2ing}</b> →</em>
         ${sem ? `<span>⚙ Empujador</span><em>fumadorSem <b>${o.ing2fum}</b> →</em>` : ""}
         <span>🚬 Fumador</span><em>agenteSem <b>${o.fum2ag}</b> ↺</em>
       </div>
       <ul class="cc-list">
         ${row("on", "Semáforos", `counting_semaphore: ${o.acquire} acquire() · ${o.ag2ing + o.ing2fum + o.fum2ag} release() (señales entre hilos)`)}
         ${row(sem ? "on" : "off", "Monitor", sem ? `mutexEmpujadores + <code>hay[]</code> = datos + exclusión mutua: ${o.lock} entradas` : "No se usa en esta variante")}
         ${row("on", "Bucles", `<code>while(true)</code>: ${o.loops} iteraciones. <code>acquire()</code> duerme al hilo (sin espera activa)`)}
       </ul>`);

    return cHilos + cRec + cSc + cDead + cSync;
  }

  // ---------- Paneles que el motor pide a cada problema ----------
  function semsHtml() {
    const s = S;
    let sems = chip("agenteSem", s.sem.agent, s.sem.agent > 0) + KEYS.map((k) => chip(`ingredienteSem[${nm(k)}]`, s.sem[k], s.sem[k] > 0)).join("");
    if (cfg.mode === "semaforos") {
      sems += KEYS.map((k) => chip(`hay[${nm(k)}] (mutex)`, s.pend[k], s.pend[k] > 0)).join("");
      sems += KEYS.map((k) => chip(`fumadorSem[${nm(k)}]`, s.wake[k], s.wake[k] > 0)).join("");
    }
    return sems;
  }
  function clockText(running) {
    const s = S, total = s.smokers.reduce((a, m) => a + m.smoked, 0);
    const status = s.deadlock ? '<span class="text-rose">⛔ INTERBLOQUEO</span>' : s.done ? '<span class="text-emerald">✔ Finalizado</span>' : running ? "▶ En ejecución" : "⏸ Detenido";
    return `t = ${Math.round(s.now)} ms · Ronda ${Math.min(s.rounds, cfg.rounds)}/${cfg.rounds} · Cigarrillos ${total} · ${status}`;
  }
  function updateBars() {
    S.smokers.forEach((sm, i) => {
      const b = document.querySelector(`#cc-scene [data-bar="${i}"]`);
      if (b) b.style.width = pctOf(sm).toFixed(1) + "%";
    });
  }

  CC.register({
    id: "fumadores",
    tab: "🚬 Los fumadores",
    subtitle: "Problema de los fumadores — hilos, recursos, sección crítica, interbloqueo y sincronización",
    file: "fumadores.cpp",
    bin: "fumadores",
    compile: "g++ -std=c++20 -O2 -pthread fumadores.cpp -o fumadores && ./fumadores",
    intro: `Un <strong>agente</strong> tiene ingredientes infinitos. Hay tres <strong>fumadores</strong> (hilos), cada uno con un
      ingrediente infinito distinto (tabaco, papel o cerillas). El agente pone al azar <em>dos</em> ingredientes distintos
      en la mesa; el fumador que tiene el tercero los recoge, fuma y devuelve el turno al agente
      (<code>agenteSem.release()</code>). Es el ejemplo clásico para estudiar hilos, recursos compartidos, sección crítica,
      interbloqueo y mecanismos de sincronización.`,
    modes: [["semaforos", "Con semáforos + empujadores (correcta)"], ["ingenua", "Ingenua: cada fumador toma por su cuenta (puede bloquearse)"]],
    modeHint: MODE_HINT,
    consts: [
      { key: "rounds", label: "RONDAS", min: 1, max: 500, def: 9 },
      { key: "etapa", label: "ETAPA_MS", min: 100, max: 5000, step: 100, def: 500, cls: "num" },
    ],
    constHint: "Igual que en el código: cuántas rondas juega el agente y cuánto dura cada <code>sleep_for</code> (recoger / fumar).",
    codeNote: "Es la solución con empujadores: la que se simula en el modo “Con semáforos + empujadores”.",
    cppMap: `<span><b>Hilos</b> → <code>vector&lt;thread&gt;</code> (3 empujadores, 3 fumadores, 1 agente)</span>
      <span><b>Semáforos</b> → <code>counting_semaphore</code> (<code>agenteSem</code>, <code>ingredienteSem</code>, <code>fumadorSem</code>)</span>
      <span><b>Sección crítica</b> → <code>lock_guard&lt;mutex&gt;</code> sobre <code>hay[]</code></span>
      <span><b>Bucles</b> → <code>while (true)</code> / <code>for</code> de cada hilo</span>
      <span><b>Interbloqueo</b> → evitado: el fumador nunca retiene un ingrediente a medias</span>`,
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
