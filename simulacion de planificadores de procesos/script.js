(function () {
  "use strict";

  const ALGOS = [
    {
      key: "fcfs",
      name: "1. FCFS",
      sub: "First-In, First-Out",
      accent: "cyan",
      mode: "No Expulsivo",
    },
    {
      key: "sjf",
      name: "2. SJF",
      sub: "Shortest Job First",
      accent: "emerald",
      mode: "No Expulsivo",
    },
    {
      key: "srtf",
      name: "3. SRTF",
      sub: "Shortest Remaining Time First",
      accent: "amber",
      mode: "Expulsivo",
    },
    {
      key: "rr",
      name: "4. Round Robin",
      sub: "Time Slicing",
      accent: "purple",
      mode: "Expulsivo",
    },
  ];

  const PALETTE = [
    "blue",
    "emerald",
    "amber",
    "purple",
    "pink",
    "cyan",
    "rose",
    "indigo",
    "teal",
    "orange",
  ];
  const SIMS = {};
  const DETAIL_VT = {};
  let zoomPx = 16,
    cursorT = 0,
    maxT = 0,
    simMode = false,
    playing = false,
    playTimer = null,
    playSpeed = 300;

  // ---------- Estado de procesos ----------
  let PROCS = [
    { uid: 1, pid: "P1", name: "", at: 0, bt: 4, th: 3 },
    { uid: 2, pid: "P2", name: "", at: 1, bt: 3, th: 1 },
    { uid: 3, pid: "P3", name: "", at: 2, bt: 1, th: 1 },
    { uid: 4, pid: "P4", name: "", at: 3, bt: 5, th: 2 },
    { uid: 5, pid: "P5", name: "", at: 4, bt: 2, th: 1 },
  ];
  let uidSeq = 6,
    currentSort = "original",
    searchQuery = "";

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }
  function colorOf(p) {
    return PALETTE[(p.uid - 1) % PALETTE.length];
  }
  function pidNum(pid) {
    const m = String(pid).match(/(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  }
  function comparePid(a, b) {
    const na = pidNum(a.pid),
      nb = pidNum(b.pid);
    if (na !== null && nb !== null && na !== nb) return na - nb;
    return String(a.pid).localeCompare(String(b.pid), undefined, {
      numeric: true,
    });
  }
  function labelOf(p) {
    return p.name ? `${p.pid} · ${p.name}` : p.pid;
  }

  // listas largas (llegadas / cola de listos): recortadas por defecto, con un
  // enlace para expandir y ver todas — el estado de expansión persiste por lista.
  const expandState = {};
  window.toggleExpand = function (id) {
    expandState[id] = !expandState[id];
    updateCursorUI();
  };
  function renderIdListHtml(ids, max, expandId) {
    if (ids.length === 0) return "(vacía)";
    if (ids.length <= max || expandState[expandId]) {
      let html = ids.join(", ");
      if (ids.length > max)
        html += ` <button type="button" class="link-inline" onclick="toggleExpand('${expandId}')">(colapsar)</button>`;
      return html;
    }
    return (
      ids.slice(0, max).join(", ") +
      ` <button type="button" class="link-inline" onclick="toggleExpand('${expandId}')">… y ${ids.length - max} más</button>`
    );
  }

  // ---------- Utilidad: lista virtualizada (soporta miles de filas sin saturar el DOM) ----------
  function VirtualTable(scrollBox, tbody, rowH) {
    let items = [],
      renderRow = () => "",
      emptyHtml = "";
    function paint() {
      const total = items.length;
      if (total === 0) {
        tbody.innerHTML = emptyHtml;
        return;
      }
      const viewH = scrollBox.clientHeight || 240;
      const buffer = 8;
      const start = Math.max(
        0,
        Math.floor(scrollBox.scrollTop / rowH) - buffer,
      );
      const count = Math.ceil(viewH / rowH) + buffer * 2;
      const end = Math.min(total, start + count);
      let html = "";
      if (start > 0)
        html += `<tr style="height:${start * rowH}px"><td class="vt-spacer-cell"></td></tr>`;
      for (let i = start; i < end; i++) html += renderRow(items[i], i);
      if (end < total)
        html += `<tr style="height:${(total - end) * rowH}px"><td class="vt-spacer-cell"></td></tr>`;
      tbody.innerHTML = html;
    }
    scrollBox.addEventListener("scroll", paint);
    return {
      update(newItems, newRenderRow, newEmptyHtml) {
        items = newItems;
        if (newRenderRow) renderRow = newRenderRow;
        if (newEmptyHtml !== undefined) emptyHtml = newEmptyHtml;
        paint();
      },
    };
  }

  // ---------- Construcción de los 4 paneles desde <template> ----------
  function buildPanels() {
    const tpl = document.getElementById("tpl-panel");
    const main = document.getElementById("view-sim");
    ALGOS.forEach((a) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.id = `panel-${a.key}`;
      node.classList.add(`border-${a.accent}`);
      node.querySelector(".panel-title").textContent = a.name;
      node.querySelector(".panel-title").classList.add(`text-${a.accent}`);
      node.querySelector(".panel-subtitle").textContent = a.sub;
      const modeBadge = document.createElement("span");
      modeBadge.className =
        "mode-badge " +
        (a.mode === "Expulsivo"
          ? "mode-badge--expulsive"
          : "mode-badge--nonexpulsive");
      modeBadge.textContent = a.mode;
      node.querySelector(".panel-extra").appendChild(modeBadge);
      if (a.key === "rr") {
        const q = document.createElement("div");
        q.className = "quantum-field";
        q.innerHTML =
          '<label for="quantum-input">q =</label><input id="quantum-input" type="number" min="1" max="20" value="2" class="quantum-input code-font"><span>ms</span>';
        node.querySelector(".panel-extra").prepend(q);
      }
      node.querySelector(".ruler").id = `ruler-${a.key}`;
      node.querySelector(".cells").id = `cells-${a.key}`;
      node.querySelector(".detail").id = `detail-${a.key}`;
      node.querySelector(".stat-wt").id = `avgwt-${a.key}`;
      node.querySelector(".stat-tat").id = `avgtat-${a.key}`;
      node.querySelector(".stat-util").id = `util-${a.key}`;
      node.querySelector(".stat-span").id = `span-${a.key}`;
      const tbodyEl = node.querySelector(".tbody");
      const scrollEl = node.querySelector(".detail-scroll");
      main.appendChild(node);
      DETAIL_VT[a.key] = VirtualTable(scrollEl, tbodyEl, 28);
    });
    document.getElementById("quantum-input").addEventListener("change", () => {
      recomputePanel("rr");
      refreshCursorBounds();
    });
  }

  // ---------- Panel de gestión de procesos ----------
  function nextLabel() {
    let n = PROCS.length + 1,
      label = "P" + n;
    const used = new Set(PROCS.map((p) => p.pid));
    while (used.has(label)) {
      n++;
      label = "P" + n;
    }
    return label;
  }
  function setMsg(id, text, cls) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = "status-msg " + (cls || "");
  }

  const procVT = VirtualTable(
    document.getElementById("proc-scroll"),
    document.getElementById("proc-tbody"),
    34,
  );

  document.getElementById("btn-add").addEventListener("click", () => {
    const pidEl = document.getElementById("f-pid"),
      nameEl = document.getElementById("f-name");
    const at = parseInt(document.getElementById("f-at").value, 10),
      bt = parseInt(document.getElementById("f-bt").value, 10);
    if (!Number.isFinite(bt) || bt < 1) {
      setMsg(
        "add-status",
        "El tiempo de ejecución debe ser ≥ 1.",
        "status-msg--err",
      );
      return;
    }
    if (!Number.isFinite(at) || at < 0) {
      setMsg(
        "add-status",
        "La llegada no puede ser negativa.",
        "status-msg--err",
      );
      return;
    }
    let pid = pidEl.value.trim() || nextLabel();
    if (PROCS.some((p) => p.pid === pid)) {
      setMsg("add-status", 'Ya existe el ID "' + pid + '".', "status-msg--err");
      return;
    }
    const th = Math.min(
      16,
      Math.max(1, parseInt(document.getElementById("f-th").value, 10) || 1),
    );
    PROCS.push({ uid: uidSeq++, pid, name: nameEl.value.trim(), at, bt, th });
    pidEl.value = "";
    nameEl.value = "";
    document.getElementById("f-at").value = 0;
    document.getElementById("f-bt").value = 1;
    document.getElementById("f-th").value = 1;
    setMsg("add-status", '"' + pid + '" agregado.', "status-msg--ok");
    renderProcTable();
    renderAll();
  });

  document.getElementById("btn-random").addEventListener("click", () => {
    const n = parseInt(document.getElementById("r-n").value, 10);
    const atMax = parseInt(document.getElementById("r-at-max").value, 10),
      btMax = parseInt(document.getElementById("r-bt-max").value, 10);
    if (!Number.isFinite(n) || n < 1 || n > 2000) return;
    const thMax = Math.min(
      16,
      Math.max(1, parseInt(document.getElementById("r-th-max").value, 10) || 1),
    );
    const used = new Set(PROCS.map((p) => p.pid));
    for (let i = 0; i < n; i++) {
      let k = PROCS.length + 1,
        pid = "P" + k;
      while (used.has(pid)) {
        k++;
        pid = "P" + k;
      }
      used.add(pid);
      PROCS.push({
        uid: uidSeq++,
        pid,
        name: "",
        at: Math.floor(Math.random() * (atMax + 1)),
        bt: 1 + Math.floor(Math.random() * btMax),
        th: 1 + Math.floor(Math.random() * thMax),
      });
    }
    renderProcTable();
    renderAll();
  });

  document.getElementById("file-input").addEventListener("change", function () {
    const file = this.files[0];
    this.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const items = file.name.toLowerCase().endsWith(".csv")
          ? parseCsv(e.target.result)
          : parseJson(e.target.result);
        const used = new Set(PROCS.map((p) => p.pid));
        let added = 0,
          renamed = 0;
        items.forEach((it) => {
          let pid = it.pid;
          if (used.has(pid)) {
            let n = 2,
              base = pid,
              np = base + "_" + n;
            while (used.has(np)) {
              n++;
              np = base + "_" + n;
            }
            pid = np;
            renamed++;
          }
          used.add(pid);
          PROCS.push({
            uid: uidSeq++,
            pid,
            name: it.name || "",
            at: it.at,
            bt: it.bt,
            th: it.th || 1,
          });
          added++;
        });
        setMsg(
          "import-status",
          added +
            " importados" +
            (renamed ? ", " + renamed + " renombrados" : "") +
            ".",
          "status-msg--ok",
        );
        renderProcTable();
        renderAll();
      } catch (err) {
        setMsg("import-status", "Error: " + err.message, "status-msg--err");
      }
    };
    reader.readAsText(file);
  });

  function parseJson(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("el JSON debe ser una lista");
    return data.map((it, i) => {
      const pid = String(it.id ?? it.pid ?? "P" + (i + 1));
      const name = String(it.nombre ?? it.name ?? "");
      const at = parseInt(it.llegada ?? it.at ?? 0, 10);
      const bt = parseInt(
        it.tiempo_ejecucion ?? it.rafaga ?? it.duracion ?? it.bt ?? NaN,
        10,
      );
      if (!Number.isFinite(bt) || bt < 1)
        throw new Error(
          'proceso "' + pid + '" con tiempo de ejecución inválido',
        );
      return {
        pid,
        name,
        at,
        bt,
        th: Math.max(
          1,
          parseInt(it.hilos ?? it.threads ?? it.th ?? 1, 10) || 1,
        ),
      };
    });
  }
  function parseCsv(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) throw new Error("CSV sin filas de datos");
    const head = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const iId = head.findIndex((h) => ["id", "pid"].includes(h));
    const iName = head.findIndex((h) => ["nombre", "name"].includes(h));
    const iAt = head.findIndex((h) => ["llegada", "at"].includes(h));
    const iBt = head.findIndex((h) =>
      ["tiempo_ejecucion", "rafaga", "ráfaga", "duracion", "bt"].includes(h),
    );
    const iTh = head.findIndex((h) => ["hilos", "threads", "th"].includes(h));
    if (iAt === -1 || iBt === -1)
      throw new Error("faltan columnas llegada / tiempo_ejecucion");
    const out = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(",").map((x) => x.trim());
      const pid = iId !== -1 && c[iId] ? c[iId] : "P" + i;
      const name = iName !== -1 && c[iName] ? c[iName] : "";
      const at = parseInt(c[iAt], 10),
        bt = parseInt(c[iBt], 10);
      if (!Number.isFinite(at) || !Number.isFinite(bt) || bt < 1)
        throw new Error("fila " + (i + 1) + " inválida");
      out.push({
        pid,
        name,
        at,
        bt,
        th: Math.max(1, parseInt(iTh !== -1 ? c[iTh] : 1, 10) || 1),
      });
    }
    return out;
  }

  function filteredProcs() {
    if (!searchQuery) return PROCS;
    const q = searchQuery.toLowerCase();
    return PROCS.filter(
      (p) =>
        p.pid.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)),
    );
  }
  function sortedProcs() {
    const arr = filteredProcs().slice();
    switch (currentSort) {
      case "original":
        return arr;
      case "original-desc":
        return arr.reverse();
      case "at-asc":
        return arr.sort((a, b) => a.at - b.at || comparePid(a, b));
      case "at-desc":
        return arr.sort((a, b) => b.at - a.at || comparePid(b, a));
      case "pid-asc":
        return arr.sort(comparePid);
      case "pid-desc":
        return arr.sort((a, b) => comparePid(b, a));
      default:
        return arr;
    }
  }
  document
    .getElementById("sort-select")
    .addEventListener("change", function () {
      currentSort = this.value;
      renderProcTable();
    });
  document.getElementById("proc-search").addEventListener("input", function () {
    searchQuery = this.value.trim();
    renderProcTable();
  });

  function procRowHtml(p) {
    const c = colorOf(p);
    return `<tr data-uid="${p.uid}">
    <td><span class="row-dot dot-${c}"></span><input class="input input--id" data-f="pid" value="${esc(p.pid)}"></td>
    <td><input class="input input--name" data-f="name" placeholder="Opcional" value="${esc(p.name || "")}"></td>
    <td><input type="number" min="0" class="input input--num" data-f="at" value="${p.at}"></td>
    <td><input type="number" min="1" class="input input--num" data-f="bt" value="${p.bt}"></td>
    <td><input type="number" min="1" max="16" class="input input--num-sm" data-f="th" value="${p.th || 1}"></td>
    <td class="text-right"><button class="link-danger" data-del="${p.uid}">Eliminar</button></td>
  </tr>`;
  }
  function renderProcTable() {
    const list = sortedProcs();
    document.getElementById("proc-count").textContent = searchQuery
      ? `${list.length} / ${PROCS.length}`
      : PROCS.length;
    const emptyMsg = searchQuery
      ? '<tr><td colspan="6" class="data-table__empty">Sin coincidencias para la búsqueda.</td></tr>'
      : '<tr><td colspan="6" class="data-table__empty">Sin procesos cargados.</td></tr>';
    procVT.update(list, procRowHtml, emptyMsg);
  }
  document.getElementById("proc-tbody").addEventListener("change", (e) => {
    const tr = e.target.closest("tr");
    if (!tr || !tr.dataset.uid) return;
    const p = PROCS.find((x) => x.uid === Number(tr.dataset.uid));
    if (!p) return;
    const f = e.target.dataset.f;
    if (f === "pid") {
      const v = e.target.value.trim();
      if (!v || PROCS.some((x) => x.uid !== p.uid && x.pid === v)) {
        e.target.value = p.pid;
        return;
      }
      p.pid = v;
    } else if (f === "name") {
      p.name = e.target.value.trim();
    } else if (f === "at") {
      const n = parseInt(e.target.value, 10);
      if (!Number.isFinite(n) || n < 0) {
        e.target.value = p.at;
        return;
      }
      p.at = n;
    } else if (f === "bt") {
      const n = parseInt(e.target.value, 10);
      if (!Number.isFinite(n) || n < 1) {
        e.target.value = p.bt;
        return;
      }
      p.bt = n;
    } else if (f === "th") {
      const n = parseInt(e.target.value, 10);
      if (!Number.isFinite(n) || n < 1 || n > 16) {
        e.target.value = p.th || 1;
        return;
      }
      p.th = n;
    }
    renderAll();
  });
  document.getElementById("proc-tbody").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del]");
    if (!btn) return;
    PROCS = PROCS.filter((p) => p.uid !== Number(btn.dataset.del));
    renderProcTable();
    renderAll();
  });
  document.getElementById("btn-clear-all").addEventListener("click", () => {
    if (PROCS.length === 0) return;
    if (
      confirm(
        "¿Eliminar los " +
          PROCS.length +
          " procesos de la cola de entrada? Esta acción no se puede deshacer.",
      )
    ) {
      PROCS = [];
      searchQuery = "";
      document.getElementById("proc-search").value = "";
      renderProcTable();
      renderAll();
    }
  });

  // Unidad planificable = proceso entero, o cada hilo si "planificar por hilos" está activo.
  const CFG = { cores: 1, threads: false };
  const QCAP = 300; // máx. de ids de la cola guardados por instante (el total sí se guarda)
  function threadsOf(p) {
    return CFG.threads ? Math.max(1, Math.min(p.th || 1, p.bt)) : 1;
  }
  function buildUnits() {
    const units = [];
    PROCS.forEach((p, i) => {
      const k = threadsOf(p),
        base = Math.floor(p.bt / k),
        extra = p.bt % k;
      for (let j = 0; j < k; j++)
        units.push({
          pi: i,
          tid: j,
          k,
          at: p.at,
          bt: base + (j < extra ? 1 : 0),
        });
    });
    // rank estable (ID, hilo): desempate rápido por entero
    units
      .map((_, i) => i)
      .sort(
        (a, b) =>
          comparePid(PROCS[units[a].pi], PROCS[units[b].pi]) ||
          units[a].tid - units[b].tid,
      )
      .forEach((ui, r) => (units[ui].rank = r));
    return units;
  }
  function unitLabel(u) {
    return u.k > 1 ? `${PROCS[u.pi].pid}.h${u.tid + 1}` : PROCS[u.pi].pid;
  }

  function simulate(algo, quantum) {
    const n = PROCS.length,
      C = CFG.cores;
    if (n === 0)
      return {
        timeline: [],
        finishTimes: [],
        waitTimes: [],
        units: [],
        cores: C,
        busy: 0,
      };
    const units = buildUnits(),
      U = units.length;
    const cap =
      PROCS.reduce((s, p) => s + p.bt, 0) +
      Math.max(...PROCS.map((p) => p.at)) +
      10;
    const rem = units.map((u) => u.bt),
      finU = new Array(U).fill(0),
      runTicks = new Array(n).fill(0);
    const byAt = new Map();
    units.forEach((u, i) => {
      if (!byAt.has(u.at)) byAt.set(u.at, []);
      byAt.get(u.at).push(i);
    });
    const cpu = new Array(C).fill(-1),
      qLeft = new Array(C).fill(0);
    const alive = new Set(),
      rrQueue = [],
      timeline = [];
    const running = () => {
      const s = new Set();
      for (const u of cpu) if (u !== -1) s.add(u);
      return s;
    };
    const ready = () => {
      const s = running(),
        r = [];
      alive.forEach((i) => {
        if (!s.has(i)) r.push(i);
      });
      return r;
    };
    const byArrival = (a, b) =>
      units[a].at - units[b].at || units[a].rank - units[b].rank;
    let time = 0,
      done = 0,
      busy = 0;
    while (done < U && time < cap) {
      const arrivedNow = byAt.get(time) || [];
      arrivedNow.forEach((i) => alive.add(i));
      if (algo === "rr" && arrivedNow.length)
        arrivedNow
          .slice()
          .sort((a, b) => units[a].rank - units[b].rank)
          .forEach((i) => rrQueue.push(i));

      // --- asignación de núcleos ---
      if (algo === "fcfs" || algo === "sjf") {
        const free = [];
        cpu.forEach((u, c) => {
          if (u === -1) free.push(c);
        });
        if (free.length) {
          const cmp =
            algo === "fcfs"
              ? byArrival
              : (a, b) => units[a].bt - units[b].bt || byArrival(a, b);
          const r = ready().sort(cmp);
          free.forEach((c, k) => {
            if (k < r.length) cpu[c] = r[k];
          });
        }
      } else if (algo === "srtf") {
        // los C con menor tiempo restante; los que ya corrían conservan su núcleo
        const best = [...alive]
            .sort((a, b) => rem[a] - rem[b] || byArrival(a, b))
            .slice(0, C),
          keep = new Set(best);
        for (let c = 0; c < C; c++)
          if (cpu[c] !== -1 && !keep.has(cpu[c])) cpu[c] = -1;
        const placed = running(),
          rest = best.filter((u) => !placed.has(u));
        for (let c = 0; c < C && rest.length; c++)
          if (cpu[c] === -1) cpu[c] = rest.shift();
      } else {
        // rr: cola global compartida, un quantum por núcleo
        for (let c = 0; c < C; c++)
          if (cpu[c] !== -1 && qLeft[c] === 0) {
            rrQueue.push(cpu[c]);
            cpu[c] = -1;
          }
        for (let c = 0; c < C; c++)
          if (cpu[c] === -1 && rrQueue.length) {
            cpu[c] = rrQueue.shift();
            qLeft[c] = quantum;
          }
      }

      let queue, qLen;
      if (algo === "rr") {
        qLen = rrQueue.length;
        queue = rrQueue.slice(0, QCAP);
      } else {
        const r = ready().sort(byArrival);
        qLen = r.length;
        queue = r.slice(0, QCAP);
      }
      timeline.push({
        t: time,
        run: cpu.slice(),
        queueIdx: queue,
        qLen,
        arrivedNow,
      });

      // --- ejecución de 1 ms en todos los núcleos a la vez ---
      const seen = new Set();
      for (let c = 0; c < C; c++) {
        const u = cpu[c];
        if (u === -1) continue;
        busy++;
        const pi = units[u].pi;
        if (!seen.has(pi)) {
          seen.add(pi);
          runTicks[pi]++;
        }
        rem[u]--;
        if (algo === "rr") qLeft[c]--;
        if (rem[u] === 0) {
          finU[u] = time + 1;
          done++;
          alive.delete(u);
          cpu[c] = -1;
        }
      }
      time++;
    }
    // proceso termina cuando termina su último hilo; T.Es = tiempo sin ningún hilo en CPU
    const finishTimes = new Array(n).fill(0);
    units.forEach((u, i) => {
      finishTimes[u.pi] = Math.max(finishTimes[u.pi], finU[i]);
    });
    const waitTimes = finishTimes.map((f, i) => f - PROCS[i].at - runTicks[i]);
    return { timeline, finishTimes, waitTimes, units, cores: C, busy };
  }
  function statsOf(sim) {
    const n = sim.timeline.length,
      m = PROCS.length;
    if (!n || !m) return null;
    let wt = 0,
      tat = 0;
    for (let i = 0; i < m; i++) {
      wt += sim.waitTimes[i];
      tat += sim.finishTimes[i] - PROCS[i].at;
    }
    return {
      wt: wt / m,
      tat: tat / m,
      util: (sim.busy / (sim.cores * n)) * 100,
    };
  }

  // ---------- Gantt por bloques fusionados (un carril por núcleo) ----------
  function buildBlocks(timeline, c) {
    const blocks = [];
    let i = 0;
    while (i < timeline.length) {
      const r = timeline[i].run[c];
      let j = i + 1;
      while (j < timeline.length && timeline[j].run[c] === r) j++;
      blocks.push({ start: i, end: j, unit: r });
      i = j;
    }
    return blocks;
  }
  function renderRuler(key, n) {
    const el = document.getElementById(`ruler-${key}`);
    el.style.width = n * zoomPx + "px";
    const step = Math.max(1, Math.round(n / 18) || 1);
    let html = "";
    for (let t = 0; t <= n; t += step)
      html += `<span style="left:${t * zoomPx}px">${t}</span>`;
    el.innerHTML = html;
    el.onclick = (e) => {
      const r = el.getBoundingClientRect();
      setCursor(Math.floor((e.clientX - r.left) / zoomPx));
    };
  }
  const LANE = 36;
  // Cada hilo de un proceso comparte el color del proceso, pero se distingue por un patrón
  // (sólido / rayas / puntos / oscuro, se repite cada 4) y por su etiqueta "hN".
  function renderCells(key, sim) {
    const el = document.getElementById(`cells-${key}`);
    const n = sim.timeline.length,
      C = sim.cores;
    el.style.width = Math.max(n, 1) * zoomPx + "px";
    el.style.height = C * LANE + "px";
    el.style.backgroundImage =
      C > 1
        ? "repeating-linear-gradient(to bottom,transparent 0,transparent 35px,rgba(51,65,85,.8) 35px,rgba(51,65,85,.8) 36px)"
        : "none";
    let html = `<div id="clip-${key}" class="gantt-clip" style="height:${C * LANE}px;width:${(simMode ? Math.min(cursorT, n) : n) * zoomPx}px">`;
    for (let c = 0; c < C; c++) {
      buildBlocks(sim.timeline, c).forEach((b) => {
        const w = (b.end - b.start) * zoomPx,
          left = b.start * zoomPx;
        // margen vertical de 2px: carriles vecinos nunca se funden en un solo rectángulo
        const pos = `left:${left}px;top:${c * LANE + 2}px;width:${w}px;height:${LANE - 4}px`;
        if (b.unit === -1) {
          html += `<div class="gantt-block gantt-block--idle" style="${pos}" title="Núcleo ${c + 1} libre ${b.start}-${b.end} ms">${w > 26 ? "LIBRE" : ""}</div>`;
          return;
        }
        const u = sim.units[b.unit],
          p = PROCS[u.pi],
          lab = unitLabel(u);
        const full =
          labelOf(p) + (u.k > 1 ? ` · hilo ${u.tid + 1}/${u.k}` : "");
        const short = u.k > 1 ? "h" + (u.tid + 1) : lab;
        const text =
          w > lab.length * 6 + 8 ? lab : w > short.length * 6 + 4 ? short : "";
        const thCls = u.k > 1 ? ` thread-${u.tid % 4}` : "";
        html += `<div class="gantt-block block-${colorOf(p)}${thCls}" style="${pos}" title="${esc(full)} · Núcleo ${c + 1} · ${b.start}-${b.end} ms">${esc(text)}</div>`;
      });
    }
    html += "</div>";
    html += `<div id="cursor-${key}" class="gantt-cursor" style="left:${Math.min(cursorT, n) * zoomPx}px; height:${C * LANE - 2}px; display:${n ? "block" : "none"}"></div>`;
    el.innerHTML = html;
    el.onclick = (e) => {
      const r = el.getBoundingClientRect();
      setCursor(Math.floor((e.clientX - r.left) / zoomPx));
    };
  }

  // ---------- Recalcular un panel ----------
  function detailRowHtml(d) {
    const { p, ct, wt, k } = d,
      tat = ct - p.at,
      c = colorOf(p);
    const lbl = esc(labelOf(p)) + (k > 1 ? ` ×${k}h` : "");
    return `<tr><td class="text-${c}" style="font-weight:700;display:flex;align-items:center;gap:6px"><span class="row-dot dot-${c} shrink-0"></span><span class="truncate" style="max-width:140px">${lbl}</span></td><td>${p.at}</td><td>${p.bt}</td><td>${ct}</td><td class="text-cyan" style="font-weight:600">${tat}</td><td class="text-amber" style="font-weight:600">${wt}</td></tr>`;
  }
  function recomputePanel(key) {
    const quantum =
      key === "rr"
        ? parseInt(document.getElementById("quantum-input").value) || 2
        : null;
    const sim = simulate(key, quantum);
    SIMS[key] = sim;

    const rowsData = PROCS.map((p, i) => ({
      p,
      ct: sim.finishTimes[i],
      wt: sim.waitTimes[i],
      k: threadsOf(p),
    }));
    DETAIL_VT[key].update(
      rowsData,
      detailRowHtml,
      '<tr><td colspan="6" class="data-table__empty">Sin procesos</td></tr>',
    );
    const detailsEl = document.querySelector(`#panel-${key} .detail-toggle`);
    if (detailsEl) detailsEl.open = PROCS.length > 0 && PROCS.length <= 15;

    const n = sim.timeline.length;
    renderRuler(key, n);
    renderCells(key, sim);

    const st = statsOf(sim);
    document.getElementById(`avgwt-${key}`).textContent = st
      ? st.wt.toFixed(2) + " ms"
      : "—";
    document.getElementById(`avgtat-${key}`).textContent = st
      ? st.tat.toFixed(2) + " ms"
      : "—";
    document.getElementById(`util-${key}`).textContent = st
      ? st.util.toFixed(1) + " %"
      : "—";
    document.getElementById(`span-${key}`).textContent = st ? n + " ms" : "—";
  }

  function renderAll() {
    ALGOS.forEach((a) => recomputePanel(a.key));
    refreshCursorBounds();
    if (!document.getElementById("view-comp").classList.contains("hidden"))
      renderComparativa();
  }

  // ---------- Cursor / reproducción global ----------
  function refreshCursorBounds() {
    maxT = Math.max(0, ...Object.values(SIMS).map((s) => s.timeline.length));
    cursorT = Math.min(cursorT, maxT);
    updateCursorUI();
  }
  function setCursor(t) {
    cursorT = Math.max(0, Math.min(t, maxT));
    updateCursorUI();
  }
  function updateCursorUI() {
    document.getElementById("cursor-label").textContent =
      `Instante t = ${cursorT} / ${maxT} ms · ${PROCS.length} procesos` +
      (CFG.threads
        ? ` (${PROCS.reduce((s, p) => s + threadsOf(p), 0)} hilos)`
        : "");
    ALGOS.forEach(({ key }) => {
      const sim = SIMS[key];
      if (!sim) return;
      const n = sim.timeline.length;
      const clip = document.getElementById(`clip-${key}`);
      if (clip)
        clip.style.width = (simMode ? Math.min(cursorT, n) : n) * zoomPx + "px";
      const cur = document.getElementById(`cursor-${key}`);
      if (cur) {
        cur.style.left = Math.min(cursorT, n) * zoomPx + "px";
        cur.style.display = n ? "block" : "none";
      }
      const box = document.getElementById(`detail-${key}`);
      if (!box) return;
      if (!n) {
        box.textContent = "Carga procesos para simular.";
        return;
      }
      if (cursorT >= n) {
        box.innerHTML = `<strong>Finalizado</strong> en t = ${n} ms. Todos los procesos completaron (${PROCS.length} / ${PROCS.length}).`;
        return;
      }
      let done = 0;
      for (let i = 0; i < sim.finishTimes.length; i++)
        if (sim.finishTimes[i] > 0 && sim.finishTimes[i] <= cursorT) done++;
      const e = sim.timeline[cursorT],
        lab = (i) => esc(unitLabel(sim.units[i]));
      const cpuTxt = e.run.every((u) => u === -1)
        ? "CPU inactiva"
        : e.run
            .map(
              (u, c) =>
                (sim.cores > 1 ? `N${c + 1}=` : "") +
                (u > -1 ? lab(u) : "libre"),
            )
            .join(" · ");
      const arrivedTxt = e.arrivedNow.length
        ? renderIdListHtml(e.arrivedNow.map(lab), 15, key + "_arr")
        : "—";
      const more =
        e.qLen > e.queueIdx.length
          ? ` … (+${e.qLen - e.queueIdx.length} no listados)`
          : "";
      const queueTxt =
        renderIdListHtml(e.queueIdx.map(lab), 20, key + "_queue") + more;
      box.innerHTML = `<strong>t = ${cursorT} ms</strong> · Procesos: <span class="text-emerald" style="font-weight:600">${done} / ${PROCS.length}</span> terminados → En CPU: <span class="text-cyan" style="font-weight:600">${cpuTxt}</span> · Llegan: <span class="text-emerald">${arrivedTxt}</span> · Cola de listos (${e.qLen}): <span class="text-amber">${queueTxt}</span>`;
      const wrap = document.querySelector(`#panel-${key} .wrap`);
      if (wrap) {
        const curX = cursorT * zoomPx;
        if (
          curX < wrap.scrollLeft ||
          curX > wrap.scrollLeft + wrap.clientWidth - 40
        )
          wrap.scrollLeft = Math.max(0, curX - wrap.clientWidth / 2);
      }
    });
  }
  function step(delta) {
    setCursor(cursorT + delta);
    if (playing && cursorT >= maxT) togglePlay(false);
  }
  function togglePlay(force) {
    playing = force !== undefined ? force : !playing;
    document.getElementById("btn-play").textContent = playing
      ? "⏸ Pausa"
      : "▶ Reproducir";
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    if (playing) {
      simMode = true;
      if (cursorT >= maxT) cursorT = 0;
      updateCursorUI();
      playTimer = setInterval(() => {
        step(1);
      }, playSpeed);
    }
  }
  document
    .getElementById("btn-play")
    .addEventListener("click", () => togglePlay());
  document.getElementById("btn-step-back").addEventListener("click", () => {
    togglePlay(false);
    step(-1);
  });
  document.getElementById("btn-step-fwd").addEventListener("click", () => {
    togglePlay(false);
    step(1);
  });
  document.getElementById("btn-scrub-reset").addEventListener("click", () => {
    togglePlay(false);
    simMode = false;
    setCursor(0);
  });
  document.getElementById("speed-range").addEventListener("input", function () {
    // el slider representa "velocidad": a más lleno (valor alto), menor es el retraso entre pasos
    playSpeed = 1040 - parseInt(this.value, 10);
    if (playing) {
      clearInterval(playTimer);
      playTimer = setInterval(() => {
        step(1);
      }, playSpeed);
    }
  });
  document.getElementById("zoom-range").addEventListener("input", function () {
    zoomPx = parseInt(this.value, 10);
    ALGOS.forEach(({ key }) => {
      if (SIMS[key]) {
        renderRuler(key, SIMS[key].timeline.length);
        renderCells(key, SIMS[key]);
      }
    });
  });

  // ---------- Tabs ----------
  document.getElementById("tab-sim").addEventListener("click", () => {
    document.getElementById("tab-sim").classList.add("active");
    document.getElementById("tab-comp").classList.remove("active");
    document.getElementById("view-sim").classList.remove("hidden");
    document.getElementById("view-comp").classList.add("hidden");
  });
  document.getElementById("tab-comp").addEventListener("click", () => {
    document.getElementById("tab-comp").classList.add("active");
    document.getElementById("tab-sim").classList.remove("active");
    document.getElementById("view-comp").classList.remove("hidden");
    document.getElementById("view-sim").classList.add("hidden");
    renderComparativa();
  });

  // ---------- Comparativa global ----------
  function renderComparativa() {
    const tbody = document.getElementById("comp-tbody"),
      bars = document.getElementById("comp-bars");
    document.getElementById("comp-cfg").textContent =
      `${CFG.cores} núcleo(s) · planificación por ${CFG.threads ? "hilos" : "procesos"}`;
    let rows = "",
      barsHtml = "";
    const wtVals = {};
    ALGOS.forEach(({ key, name, accent }) => {
      const st = SIMS[key] ? statsOf(SIMS[key]) : null;
      if (!st) {
        rows += `<tr><td>${name}</td><td colspan="3">Sin datos</td></tr>`;
        wtVals[key] = 0;
        return;
      }
      wtVals[key] = st.wt;
      rows += `<tr><td class="text-${accent}" style="font-weight:700">${name}</td><td>${st.wt.toFixed(2)} ms</td><td>${st.tat.toFixed(2)} ms</td><td>${st.util.toFixed(1)} %</td></tr>`;
    });
    tbody.innerHTML = rows;
    const maxWT = Math.max(1, ...Object.values(wtVals));
    ALGOS.forEach(({ key, name, accent }) => {
      const pct = ((wtVals[key] / maxWT) * 100).toFixed(1);
      barsHtml += `<div>
      <div class="comp-bar__row"><span>${name}</span><span>${wtVals[key].toFixed(2)} ms (T.Es prom.)</span></div>
      <div class="comp-bar__track"><div class="comp-bar__fill dot-${accent}" style="width:${pct}%"></div></div>
    </div>`;
    });
    bars.innerHTML = barsHtml;
  }

  // ---------- Concurrencia: núcleos e hilos ----------
  function updateCfgSummary() {
    document.getElementById("cfg-summary").textContent =
      `${CFG.cores} núcleo${CFG.cores > 1 ? "s" : ""} · ${CFG.threads ? "hilos" : "procesos"}`;
    document
      .getElementById("thread-legend")
      .classList.toggle("hidden", !CFG.threads);
  }
  document.getElementById("cfg-cores").addEventListener("change", function () {
    CFG.cores = Math.min(16, Math.max(1, parseInt(this.value, 10) || 1));
    this.value = CFG.cores;
    updateCfgSummary();
    renderAll();
  });
  document
    .getElementById("cfg-threads")
    .addEventListener("change", function () {
      CFG.threads = this.checked;
      updateCfgSummary();
      renderAll();
    });

  // ---------- Perfil de CPU real: poca carga, muchos procesos ----------
  const NOMBRES = ["System", "svchost", "chrome", "explorer", "code", "firefox", "Teams", "MsMpEng", "dwm", "python", "node", "Spotify", "WhatsApp", "csrss", "services"];
  document.getElementById("btn-profile").addEventListener("click", () => {
    const util = Math.min(100, Math.max(1, parseFloat(document.getElementById("pf-util").value) || 9));
    const n = Math.min(2000, Math.max(1, parseInt(document.getElementById("pf-n").value, 10) || 100));
    const thMax = Math.min(16, Math.max(1, parseInt(document.getElementById("pf-th").value, 10) || 1));
    let win = Math.max(10, parseInt(document.getElementById("pf-win").value, 10) || 300);
    const C = CFG.cores;
    // cada proceso necesita al menos 1 ms: si el trabajo total no alcanza, se amplía la ventana
    const minWin = Math.ceil((n * 100) / (util * C));
    let ampliada = false;
    if (win < minWin) { win = minWin; ampliada = true; }
    const W = Math.max(n, Math.round((util / 100) * C * win));
    // ráfagas con cola larga: muchas cortas y pocas largas (como un administrador de tareas real)
    const w = Array.from({ length: n }, () => -Math.log(1 - Math.random()) + 0.05);
    const sw = w.reduce((a, b) => a + b, 0);
    const bt = w.map((x) => Math.max(1, Math.round((x / sw) * W)));
    let diff = W - bt.reduce((a, b) => a + b, 0), guard = 100000;
    while (diff !== 0 && guard-- > 0) {
      const i = Math.floor(Math.random() * n);
      if (diff > 0) { bt[i]++; diff--; }
      else if (bt[i] > 1) { bt[i]--; diff++; }
    }
    togglePlay(false);
    simMode = false;
    PROCS = bt.map((b, i) => ({
      uid: uidSeq++,
      pid: "P" + (i + 1),
      name: NOMBRES[Math.floor(Math.random() * NOMBRES.length)],
      at: Math.floor(Math.random() * win),
      bt: b,
      th: 1 + Math.floor(Math.random() * thMax),
    }));
    searchQuery = "";
    document.getElementById("proc-search").value = "";
    setCursor(0);
    renderProcTable();
    renderAll();
    setMsg("profile-status", `${n} procesos en ${win} ms${ampliada ? " (ventana ampliada: cada proceso necesita ≥ 1 ms)" : ""}; trabajo total ${W} ms sobre ${C} núcleo(s), ráfaga media ≈ ${(W / n).toFixed(1)} ms.`, "status-msg--ok");
  });

  // ---------- Init ----------
  updateCfgSummary();
  buildPanels();
  renderProcTable();
  renderAll();
})();
