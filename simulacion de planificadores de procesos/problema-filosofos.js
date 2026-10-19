(function () {
  "use strict";

  // =====================================================================
  //  Filósofos comensales (monitor) — se registra en el motor (concurrencia.js)
  // =====================================================================

  const CPP_SRC = "// Problema de los Filósofos Comensales con hilos (C++20)\n// Mecanismo: MONITOR = mutex + condition_variable (una por filósofo).\n// Un filósofo solo pasa a COMIENDO si ninguno de sus vecinos está COMIENDO,\n// y toma ambos tenedores de forma atómica -> no hay interbloqueo.\n// Compilar: g++ -std=c++20 -O2 -pthread filosofos.cpp -o filosofos\n\n#include <chrono>\n#include <condition_variable>\n#include <iostream>\n#include <mutex>\n#include <random>\n#include <string>\n#include <thread>\n#include <vector>\n\nusing namespace std;\n\nconst int N = 5;\nconst int COMIDAS = 3; // veces que come cada filósofo\n\nenum Estado\n{\n    PENSANDO,\n    HAMBRIENTO,\n    COMIENDO\n};\n\nmutex mutexSalida;\nvoid escribir(const string &texto)\n{\n    lock_guard<mutex> lock(mutexSalida);\n    cout << texto << endl;\n}\n\nclass Mesa\n{\n    mutex m;\n    condition_variable cv[N];\n    Estado estado[N] = {PENSANDO, PENSANDO, PENSANDO, PENSANDO, PENSANDO};\n\n    static int izq(int i) { return (i + N - 1) % N; }\n    static int der(int i) { return (i + 1) % N; }\n    bool vecinosLibres(int i) const\n    {\n        return estado[izq(i)] != COMIENDO && estado[der(i)] != COMIENDO;\n    }\n\npublic:\n    void tomarTenedores(int i)\n    {\n        unique_lock<mutex> lock(m);\n        estado[i] = HAMBRIENTO;\n        cv[i].wait(lock, [&] { return vecinosLibres(i); }); // espera sin ocupar CPU\n        estado[i] = COMIENDO;\n    }\n\n    void soltarTenedores(int i)\n    {\n        lock_guard<mutex> lock(m);\n        estado[i] = PENSANDO;\n        // Los vecinos podrían ahora poder comer\n        cv[izq(i)].notify_one();\n        cv[der(i)].notify_one();\n    }\n};\n\nMesa mesa;\n\nvoid filosofo(int i)\n{\n    mt19937 gen(random_device{}());\n    uniform_int_distribution<int> espera(200, 600);\n    string nombre = \"Filósofo \" + to_string(i + 1);\n\n    for (int k = 1; k <= COMIDAS; k++)\n    {\n        escribir(nombre + \": piensa\");\n        this_thread::sleep_for(chrono::milliseconds(espera(gen)));\n\n        escribir(nombre + \": tiene hambre\");\n        mesa.tomarTenedores(i);\n\n        escribir(nombre + \": COME (\" + to_string(k) + \"/\" + to_string(COMIDAS) + \")\");\n        this_thread::sleep_for(chrono::milliseconds(espera(gen)));\n\n        mesa.soltarTenedores(i);\n        escribir(nombre + \": deja los tenedores\");\n    }\n    escribir(nombre + \": terminó de cenar\");\n}\n\nint main()\n{\n    vector<thread> hilos;\n    for (int i = 0; i < N; i++)\n        hilos.emplace_back(filosofo, i);\n    for (auto &h : hilos)\n        h.join();\n    escribir(\"\\nSimulación finalizada.\");\n}\n";

  const { chip, card, row } = CC.ui;
  let S = null, cfg = null;
  const K = CC.kit(() => S), { rnd, logd, out, addTimer, tOf } = K;
  const NAME = (p) => `Filósofo ${p.id + 1}`;
  const izq = (i) => (i + cfg.n - 1) % cfg.n, der = (i) => (i + 1) % cfg.n;
  const EST = { P: "pensando", H: "hambriento", C: "comiendo" };

  const PSEUDO = {
    monitor: `// Monitor Mesa: mutex m + condition_variable cv[N]; estado[i] ∈ {PENSANDO, HAMBRIENTO, COMIENDO}

tomarTenedores(i):                      soltarTenedores(i):
  { lock(m)                               { lock(m)
    estado[i] = HAMBRIENTO                  estado[i] = PENSANDO
    cv[i].wait(lock, vecinosLibres(i))      cv[izq(i)].notify_one()
    estado[i] = COMIENDO }                  cv[der(i)].notify_one() }

vecinosLibres(i) = estado[izq(i)] != COMIENDO  y  estado[der(i)] != COMIENDO

FILÓSOFO i (COMIDAS veces): piensa; tiene hambre; tomarTenedores(i); COME; soltarTenedores(i)
// Los dos tenedores se toman de forma atómica dentro del monitor: no hay retención y espera.`,
    ingenua: `// Cada tenedor es un mutex. Todos toman primero el IZQUIERDO y luego el DERECHO.

FILÓSOFO i (COMIDAS veces)
  piensa; tiene hambre
  lock(tenedor[izq(i)])          // toma uno...
  sleep_for(PAUSA_MS)            // ...y antes de pedir el otro, un descuido
  lock(tenedor[der(i)])          // ...y se queda esperando el segundo
  COME
  unlock(tenedor[der(i)]); unlock(tenedor[izq(i)])

// Si los N toman su tenedor izquierdo a la vez, cada uno espera el de su vecino:
// espera circular → interbloqueo (deadlock).`,
    ordenada: `// Cada tenedor es un mutex, con un ORDEN global: se toma siempre primero el de menor número.

FILÓSOFO i (COMIDAS veces)
  piensa; tiene hambre
  a = min(izq(i), der(i));  b = max(izq(i), der(i))
  lock(tenedor[a]); sleep_for(PAUSA_MS); lock(tenedor[b])
  COME
  unlock(tenedor[b]); unlock(tenedor[a])

// El orden global rompe la espera circular: el filósofo N-1 pide primero el tenedor 0
// (no el N-1), así nunca se cierra el ciclo. Sigue habiendo retención y espera, pero no interbloqueo.`,
  };
  const MODE_HINT = {
    monitor: "Un monitor (mutex + condition_variable) decide quién puede comer y toma los dos tenedores a la vez. cv.wait() duerme al hilo sin gastar CPU hasta que un vecino lo avise.",
    ingenua: "Cada filósofo toma su tenedor izquierdo y luego el derecho. Si todos tienen hambre a la vez, cada uno retiene un tenedor y espera el de su vecino: interbloqueo.",
    ordenada: "Los tenedores se numeran y se piden siempre de menor a mayor. Un filósofo sigue reteniendo uno mientras espera, pero el ciclo de espera ya no puede cerrarse.",
  };

  function newState() {
    const N = cfg.n;
    S = {
      now: 0, done: false, deadlock: false, cs: false, last: { t: "" },
      fork: Array(N).fill(null), timers: [],
      ph: Array.from({ length: N }, (_, i) => ({ key: "f" + (i + 1), id: i, pc: "plog", k: 0, est: "P", first: 0, second: 0 })),
      ops: { lock: 0, wait: 0, notify: 0, take: 0 }, log: [], out: [],
    };
    S.ph.forEach((p) => {
      const l = izq(p.id), r = p.id;
      p.first = cfg.mode === "ordenada" ? Math.min(l, r) : l;
      p.second = p.first === l ? r : l;
    });
  }
  const libres = (i) => S.ph[izq(i)].est !== "C" && S.ph[der(i)].est !== "C";

  function enabled() {
    const a = [];
    S.ph.forEach((p) => {
      switch (p.pc) {
        case "waitcv": if (libres(p.id)) a.push({ t: "wake", w: p }); break;
        case "f1": if (S.fork[p.first] === null) a.push({ t: "f1", w: p }); break;
        case "f2": if (S.fork[p.second] === null) a.push({ t: "f2", w: p }); break;
        case "plog": case "hlog": case "take": case "elog": case "drop": case "dlog": a.push({ t: p.pc, w: p }); break;
      }
    });
    return a;
  }
  function execute(act) {
    const s = S, w = act.w, n = NAME(w), mon = cfg.mode === "monitor";
    s.cs = false;
    s.last = { t: act.t, key: w.key };
    switch (act.t) {
      case "plog": out(`${n}: piensa`); w.pc = "thinking"; addTimer("think", w, rnd(200, 600)); logd(`🤔 ${n}: piensa (sleep_for)`); break;
      case "hlog": out(`${n}: tiene hambre`); w.est = "H"; w.pc = mon ? "take" : "f1"; logd(`😋 ${n}: tiene hambre`); break;
      case "take":
        s.cs = true; s.ops.lock++; w.est = "H";
        if (libres(w.id)) { w.est = "C"; w.pc = "elog"; logd(`🔒 ${n}: [lock] estado = HAMBRIENTO; vecinos libres → estado = COMIENDO (toma ambos tenedores)`, "ok"); }
        else { w.pc = "waitcv"; s.ops.wait++; logd(`⏳ ${n}: [lock] estado = HAMBRIENTO; un vecino come → cv[${w.id}].wait() (duerme y suelta el mutex)`, "warn"); }
        break;
      case "wake": s.ops.lock++; s.cs = true; w.est = "C"; w.pc = "elog"; logd(`🔔 ${n}: lo despiertan, vecinos libres → estado = COMIENDO`, "ok"); break;
      case "f1":
        s.fork[w.first] = w.id; s.ops.take++; out(`${n}: toma el tenedor ${w.first + 1}`);
        logd(`🍴 ${n}: lock(tenedor[${w.first + 1}]) → lo tiene${cfg.pausa > 0 ? `; sleep_for(${cfg.pausa} ms) antes de pedir el otro` : ""}`);
        if (cfg.pausa > 0) { w.pc = "pausing"; addTimer("pause", w, cfg.pausa); } else w.pc = "f2";
        break;
      case "f2":
        s.fork[w.second] = w.id; s.ops.take++; w.est = "C"; w.pc = "elog"; out(`${n}: toma el tenedor ${w.second + 1}`);
        logd(`🍴 ${n}: lock(tenedor[${w.second + 1}]) → tiene los dos`, "ok"); break;
      case "elog":
        out(`${n}: COME (${w.k + 1}/${cfg.comidas})`); w.pc = "eating"; addTimer("eat", w, rnd(200, 600));
        logd(`🍝 ${n}: COME (${w.k + 1}/${cfg.comidas})`, "ok"); break;
      case "drop":
        w.est = "P"; w.pc = "dlog";
        if (mon) {
          s.cs = true; s.ops.lock++; s.ops.notify += 2;
          logd(`🔓 ${n}: [lock] estado = PENSANDO; cv[${izq(w.id) + 1}].notify_one(); cv[${der(w.id) + 1}].notify_one()`);
        } else { s.fork[w.first] = null; s.fork[w.second] = null; logd(`🔓 ${n}: unlock de ambos tenedores`); }
        break;
      case "dlog":
        out(`${n}: deja los tenedores`); w.k++;
        if (w.k < cfg.comidas) w.pc = "plog";
        else {
          out(`${n}: terminó de cenar`); w.pc = "done"; logd(`🏁 ${n}: terminó de cenar`, "ok");
          if (s.ph.every((x) => x.pc === "done")) { out(""); out("Simulación finalizada."); s.done = true; logd("🏁 main: todos los hilos terminaron → simulación finalizada", "ok"); }
        }
        break;
    }
  }
  function complete(t) {
    const w = t.who;
    w.pc = t.kind === "think" ? "hlog" : t.kind === "pause" ? "f2" : "drop";
  }
  const doNext = () => K.next(enabled, execute, complete, "⛔ INTERBLOQUEO: cada filósofo tiene un tenedor y espera el que tiene su vecino");

  // ---------- Escena ----------
  function holder(k) {
    if (cfg.mode !== "monitor") return S.fork[k];
    if (S.ph[k].est === "C") return k;
    return S.ph[der(k)].est === "C" ? der(k) : null;
  }
  function stateTxt(p) {
    const s = S;
    if (p.pc === "done") return "✔ Terminó de cenar";
    if (p.pc === "waitcv") return "⏳ Dormido en cv.wait()";
    if (p.pc === "f2" || p.pc === "pausing") return `✋ Tiene el tenedor ${p.first + 1}, espera el ${p.second + 1}`;
    if (p.pc === "f1") return `⏳ Espera el tenedor ${p.first + 1}`;
    return p.est === "C" ? "🍝 Comiendo" : p.est === "H" ? "😋 Hambriento" : "🤔 Pensando";
  }
  function sceneHtml() {
    const s = S, N = cfg.n, dead = s.deadlock, mon = cfg.mode === "monitor";
    // posiciones en elipse (% del ancho y del alto de la mesa); los asientos usan un radio vertical menor para no salirse
    const pos = (deg, rx, ry) => { const a = (deg * Math.PI) / 180; return `left:${(50 + rx * Math.sin(a)).toFixed(1)}%;top:${(50 - ry * Math.cos(a)).toFixed(1)}%`; };
    const seats = s.ph.map((p) => {
      const t = tOf(p), face = dead ? "😱" : p.pc === "done" ? "😎" : { P: "🤔", H: "😫", C: "😋" }[p.est];
      const bub = dead ? "😱" : p.pc === "done" ? "" : p.est === "P" ? "💭" : p.est === "H" ? "❗" : "";
      return `<div class="ph-seat" style="${pos((p.id * 360) / N, 40, 37)}">${bub ? `<span class="ph-bubble" style="${CC.phase(2000, p.id * 400)}">${bub}</span>` : ""}${K.thread({ face, name: NAME(p), state: stateTxt(p), st: p.est === "C" ? "smoking" : p.est === "H" ? "holding" : "waiting", acc: "emerald", t, dead: dead && p.est === "H", active: s.last.key === p.key, foot: `🍝 ${p.k}/${cfg.comidas}` })}</div>`;
    }).join("");
    const plates = s.ph.map((p) => `<div class="ph-plate ph-plate--${p.est}${dead && p.est === "H" ? " is-dead" : ""}" style="${pos((p.id * 360) / N, 24, 21)}">${p.est === "C" ? `<span>🍝</span><i class="ph-steam" style="${CC.phase(1800, p.id * 300)}">♨</i>` : p.pc === "done" ? "<span>✔</span>" : ""}</div>`).join("");
    const forks = Array.from({ length: N }, (_, k) => {
      const h = holder(k);
      return `<div class="ph-fork${h !== null ? " held" : ""}" style="${pos(((k + 0.5) * 360) / N, 24, 21)}" title="Tenedor ${k + 1}${h !== null ? " (en uso por el filósofo " + (h + 1) + ")" : ""}">🍴<small>${k + 1}${h !== null ? "·F" + (h + 1) : ""}</small></div>`;
    }).join("");
    const center = `<div class="ph-center"><span class="ph-bowl">🍝</span><i class="ph-steam ph-steam--c" style="${CC.phase(1800)}">♨</i><small>${mon ? (s.cs ? "🔒 mutex m" : "🔓 mutex m") : "tenedores = mutex"}</small></div>`;
    let overlay = "";
    if (s.deadlock) overlay = '<div class="sc-overlay sc-overlay--err"><b>⛔ INTERBLOQUEO</b><span>cada filósofo retiene un tenedor y espera el de su vecino: espera circular</span></div>';
    else if (s.done) overlay = `<div class="sc-overlay sc-overlay--ok"><b>🎉 Todos cenaron</b><span>${N * cfg.comidas} comidas en ${Math.round(s.now)} ms — sin interbloqueo</span></div>`;
    return `${overlay}<div class="ph-scroll"><div class="ph-table"><div class="ph-board"></div>${center}${plates}${forks}${seats}</div></div>`;
  }
  // ---------- Conceptos ----------
  function conceptsHtml() {
    const s = S, mon = cfg.mode === "monitor", o = s.ops, N = cfg.n;
    const cHilos = card("🧵", "Hilos", "std::thread", `Un hilo por filósofo (<strong>${N}</strong>) más main. Comparten la mesa (los tenedores).`,
      `<ul class="cc-list">${s.ph.map((p) => row(p.pc === "done" ? "off" : p.pc === "waitcv" || p.pc === "f1" || p.pc === "f2" ? "block" : p.est === "C" ? "crit" : "on", NAME(p), stateTxt(p).replace(/^\S+\s/, ""))).join("")}</ul>`);

    const used = Array.from({ length: N }, (_, k) => holder(k)).filter((h) => h !== null).length;
    const cRec = card("📦", "Recursos", "compartidos", "Hay tantos tenedores como filósofos y cada comida necesita dos. Cada tenedor lo usa uno solo a la vez.",
      `<ul class="cc-list">${Array.from({ length: N }, (_, k) => { const h = holder(k); return row(h !== null ? "warn" : "on", `🍴 Tenedor ${k + 1}`, h !== null ? `en uso por el filósofo ${h + 1}` : "libre"); }).join("")}
       ${row("on", "Resumen", `${used} de ${N} tenedores en uso`)}</ul>`);

    const sc = mon
      ? `<div class="cc-mutex ${s.cs ? "cc-mutex--on" : ""}">${s.cs ? "🔒 mutex m ocupado" : "🔓 mutex m libre"}</div>
         <p class="cc-line code-font">estado[] = { ${s.ph.map((p) => p.est).join(", ")} }</p>
         <p class="cc-line">El monitor protege <code>estado[]</code>: mirar a los vecinos y cambiar el propio estado es indivisible.</p>`
      : `<div class="cc-mutex">🍴 un mutex por tenedor</div><p class="cc-line">No hay monitor: cada tenedor es un recurso exclusivo y cada filósofo pide los dos por separado (no de forma atómica).</p>`;
    const cSc = card("🔒", "Sección crítica", mon ? "monitor" : "mutex por tenedor", "Código que accede a recursos compartidos de forma exclusiva.", sc);

    const holding = s.ph.some((p) => p.pc === "f2" || p.pc === "pausing");
    const cond = [
      ["Exclusión mutua", true, "un tenedor lo usa un solo filósofo"],
      ["Retención y espera", !mon && holding, mon ? "no: toma los dos a la vez o ninguno" : holding ? "un filósofo retiene un tenedor y espera el otro" : "nadie retiene uno ahora"],
      ["Sin apropiación", !mon, mon ? "no aplica" : "no se le quita un tenedor a quien lo tiene"],
      ["Espera circular", s.deadlock, cfg.mode === "ordenada" ? "imposible: el orden global de tenedores rompe el ciclo" : s.deadlock ? "cada filósofo espera el tenedor de su vecino" : mon ? "no hay: nadie retiene nada mientras espera" : "posible si los N toman el izquierdo a la vez"],
    ];
    const cDead = card("⛔", "Interbloqueo", "deadlock", "Aparece cuando se cumplen las 4 condiciones de Coffman a la vez. Cada solución rompe una distinta.",
      `<ul class="cc-list">${cond.map(([n, on, t]) => row(on ? "crit" : "off", n, t)).join("")}</ul>
       <p class="cc-line">${s.deadlock ? "<strong class='text-rose'>Las 4 se cumplen: interbloqueo.</strong>" : mon ? "El monitor rompe la <em>retención y espera</em>." : cfg.mode === "ordenada" ? "El orden de adquisición rompe la <em>espera circular</em>." : "Sin protección, el interbloqueo puede ocurrir: sube PAUSA_MS para provocarlo."}</p>`);

    const cSync = card("🔗", "Sincronización y comunicación", mon ? "monitor · cv" : "mutex",
      mon ? "Un <strong>monitor</strong> agrupa datos, mutex y variables de condición. <code>wait()</code> duerme al hilo hasta que otro lo avisa con <code>notify_one()</code> (comunicación)." : "Los hilos solo se sincronizan bloqueando mutex; no hay avisos entre ellos.",
      `<ul class="cc-list">
         ${row(mon ? "on" : "off", "Monitor", mon ? `mutex + condition_variable: ${o.lock} entradas` : "No se usa en esta variante")}
         ${row(mon ? "on" : "off", "wait / notify", mon ? `${o.wait} esperas · ${o.notify} notificaciones` : "—")}
         ${row(mon ? "off" : "on", "lock de tenedores", mon ? "—" : `${o.take} tenedores tomados`)}
         ${row("on", "Bucles", `<code>for</code> de ${cfg.comidas} comidas por filósofo`)}
       </ul>`);
    return cHilos + cRec + cSc + cDead + cSync;
  }

  function semsHtml() {
    const s = S;
    return s.ph.map((p) => chip(`estado[${p.id + 1}]`, p.est === "P" ? "PENS" : p.est === "H" ? "HAMB" : "COME", p.est === "C")).join("")
      + chip("cv wait()", s.ops.wait, s.ops.wait > 0) + chip("notify_one()", s.ops.notify, s.ops.notify > 0) + chip("comidas", s.ph.reduce((a, p) => a + p.k, 0), true);
  }
  function clockText(running) {
    const s = S, total = s.ph.reduce((a, p) => a + p.k, 0);
    const status = s.deadlock ? '<span class="text-rose">⛔ INTERBLOQUEO</span>' : s.done ? '<span class="text-emerald">✔ Finalizado</span>' : running ? "▶ En ejecución" : "⏸ Detenido";
    return `t = ${Math.round(s.now)} ms · Comidas ${total}/${cfg.n * cfg.comidas} · ${status}`;
  }

  CC.register({
    id: "filosofos",
    tab: "🍝 Los filósofos",
    subtitle: "Filósofos comensales — monitor, variables de condición, interbloqueo y orden de adquisición",
    file: "filosofos.cpp",
    bin: "filosofos",
    compile: "g++ -std=c++20 -O2 -pthread filosofos.cpp -o filosofos && ./filosofos",
    intro: `Cinco <strong>filósofos</strong> se sientan a una mesa redonda; entre cada par hay un <strong>tenedor</strong>. Cada uno alterna entre
      pensar y comer, y para comer necesita los <em>dos</em> tenedores contiguos. Si todos toman primero el de su izquierda, ninguno puede
      comer: <strong>interbloqueo</strong>. La solución del código usa un <strong>monitor</strong> (<code>mutex</code> +
      <code>condition_variable</code>) que solo deja comer a quien tiene libres a sus dos vecinos. Es el ejemplo clásico de interbloqueo y de las 4 condiciones de Coffman.`,
    modes: [["monitor", "Monitor: mutex + condition_variable (correcta)"], ["ingenua", "Ingenua: izquierdo y luego derecho (puede bloquearse)"], ["ordenada", "Tenedores ordenados (rompe la espera circular)"]],
    modeHint: MODE_HINT,
    consts: [
      { key: "n", label: "N", min: 3, max: 8, def: 5 },
      { key: "comidas", label: "COMIDAS", min: 1, max: 10, def: 3 },
      { key: "pausa", label: "PAUSA_MS", min: 0, max: 1000, step: 50, def: 150, cls: "num" },
    ],
    constHint: "N y COMIDAS son constantes del código. <code>PAUSA_MS</code> solo existe en las variantes con tenedores sueltos: el tiempo entre tomar el primer tenedor y pedir el segundo; cuanto mayor, más probable el interbloqueo en la ingenua. Pensar y comer duran 200–600 ms, como en el código.",
    codeNote: "Es la solución con monitor: la que se simula en el modo “Monitor”. Las otras dos son variantes para comparar.",
    cppMap: `<span><b>Hilos</b> → <code>vector&lt;thread&gt;</code> (un hilo por filósofo) + main</span>
      <span><b>Monitor</b> → clase <code>Mesa</code>: <code>mutex m</code> + <code>condition_variable cv[N]</code></span>
      <span><b>Sección crítica</b> → <code>unique_lock</code> / <code>lock_guard</code> sobre <code>estado[]</code></span>
      <span><b>Comunicación</b> → <code>cv.wait()</code> duerme sin gastar CPU; <code>notify_one()</code> avisa a los vecinos</span>
      <span><b>Interbloqueo</b> → evitado: los dos tenedores se toman de forma atómica</span>`,
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
