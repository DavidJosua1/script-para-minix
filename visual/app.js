'use strict';

/* ==========================================================================
   DATOS · captura de monitor.sh del 20/09/2026, 23:07 (hora de la VM)
   Todo lo que ves en el panel sale de este objeto. Para mostrar otra captura,
   edita estos valores. Donde el informe no da un dato, el campo queda en null
   y el panel muestra "no detallado" en lugar de inventarlo.
   ========================================================================== */

const DATA = {
  sys: {
    os: 'MINIX 3.3.0 (GENERIC)',
    arch: 'i386 (32 bits)',
    platform: 'Oracle VirtualBox (invitado)',
    capture: '20/09/2026, 23:07',
    uptimeMin: 10,
    users: 2,
    usersDetail: 'consola y SSH',
    load: [0.01, 0.00, 0.01],
  },

  cpu: {
    count: 1,
    vendor: 'GenuineIntel',
    model: '«Intel» (genérico; MINIX no muestra el nombre comercial)',
    family: 6, modelNo: 10, stepping: 3,
    mhz: 4092,
    flags: ['fpu', 'apic', 'mmx', 'sse', 'sse2', 'pni', 'ssse3', 'sse4_1', 'popcnt', 'xsave', 'vmx', 'ht'],
  },

  // /proc/meminfo: tamaño de página, total, libres, mayor bloque libre, caché
  mem: { page: 4096, total: 130959, free: 119905, largest: 112068, cache: 4501 },

  disk: {
    blocks512: 4193184,
    parts: [
      { dev: '/dev/c0d0p0s0', mount: '/',     fs: 'mfs', size: 128.0,  used: 35.1,   avail: 92.9,  pct: 27, proc: 'mfs-root' },
      { dev: '/dev/c0d0p0s2', mount: '/usr',  fs: 'mfs', size: 1644.5, used: 1313.7, avail: 330.7, pct: 79, proc: 'mfs-usr'  },
      { dev: '/dev/c0d0p0s1', mount: '/home', fs: 'mfs', size: 275.0,  used: 4.3,    avail: 270.7, pct: 1,  proc: 'mfs-home' },
    ],
  },

  pci: [
    { bus: '0.0.0',  cls: '6/0/0',  id: '8086:1237', name: 'Intel 82441FX (440FX)',            fn: 'Puente host (chipset)',                 kind: 'chipset', proc: 'pci'    },
    { bus: '0.1.0',  cls: '6/1/0',  id: '8086:7000', name: 'Intel 82371SB',                    fn: 'Puente ISA (PIIX3)',                    kind: 'chipset' },
    { bus: '0.1.1',  cls: '1/1/8a', id: '8086:7111', name: 'Intel 82371AB (IDE)',              fn: 'Controlador de disco',                  kind: 'disk',    proc: 'at_wini' },
    { bus: '0.2.0',  cls: '3/0/0',  id: '80EE:BEEF', name: null,                               fn: 'Adaptador de video VGA de VirtualBox',  kind: 'video',   gpu: true },
    { bus: '0.3.0',  cls: '2/0/0',  id: '1022:2000', name: 'AMD Lance/PCI',                    fn: 'Tarjeta de red',                        kind: 'net',     proc: 'lance'  },
    { bus: '0.4.0',  cls: '8/80/0', id: '80EE:CAFE', name: 'Oracle VirtualBox backdoor device', fn: 'Integración con VirtualBox',           kind: 'vbox',    proc: 'vbox'   },
    { bus: '0.5.0',  cls: '4/1/0',  id: '8086:2415', name: null,                               fn: 'Controlador de audio (clase 4/1)',      kind: 'io' },
    { bus: '0.6.0',  cls: 'c/3/10', id: '106B:003F', name: null,                               fn: 'Controlador USB OHCI (clase c/3/10)',   kind: 'io' },
    { bus: '0.7.0',  cls: '6/80/0', id: '8086:7113', name: 'Intel 82371AB (Power)',            fn: 'Gestión de energía (ACPI)',             kind: 'chipset' },
    { bus: '0.11.0', cls: 'c/3/20', id: '8086:265C', name: null,                               fn: 'Controlador USB 2.0 EHCI (clase c/3/20)', kind: 'io' },
  ],

  net: {
    iface: '/dev/ip0', ip: '10.0.2.15', mask: '255.255.255.0', mtu: 1500,
    mode: 'NAT de VirtualBox', driver: 'lance (AMD Lance)', stack: 'inet (TCP/IP)',
    forward: 'puerto 2222 del anfitrión → puerto 22 de la VM (SSH)',
  },

  // Tabla 11 del informe: recurso de hardware → procesos que lo gestionan
  hwsw: [
    { hw: 'Bus PCI',                              key: 'pci-0.0.0', procs: ['pci'] },
    { hw: 'Controlador IDE (disco)',              key: 'pci-0.1.1', procs: ['at_wini'] },
    { hw: 'Sistemas de archivos /, /usr, /home',  key: 'disk-/usr', procs: ['mfs-root', 'mfs-usr', 'mfs-home'] },
    { hw: 'Tarjeta de red AMD Lance',             key: 'pci-0.3.0', procs: ['lance', 'inet'] },
    { hw: 'Teclado',                              key: null,        procs: ['pckbd', 'input'] },
    { hw: 'Disquetera',                           key: null,        procs: ['floppy'] },
    { hw: 'Reloj de tiempo real',                 key: null,        procs: ['readclock'] },
    { hw: 'Dispositivo VirtualBox',               key: 'pci-0.4.0', procs: ['vbox'] },
    { hw: 'Dispositivos dinámicos',               key: null,        procs: ['devman', 'devmand'] },
  ],

  // Totales por categoría según ps -axl (SZ en KiB). Total: 51 procesos, 48,032 KiB.
  totals: {
    kernel:  { n: 5,  sz: 0 },
    base:    { n: 10, sz: 9724 },
    service: { n: 20, sz: 29528 },
    user:    { n: 16, sz: 8780 },
  },
  totalSz: 48032,
  totalN: 51,

  // Estados observados en ps -axl (cifras del informe)
  states: { W: 34, S: 16, R: 1 },

  services: { available: 57, running: 27, notLoaded: ['e1000', 'rtl8139', 'ahci', 'sb16', 'usb_storage', 'vbfs'] },

  packages: [
    { name: 'Perl',                     n: 12, items: ['perl 5.18.2', '11 módulos p5-* (entre ellos los de SSL)'] },
    { name: 'Desarrollo',               n: 6,  items: ['m4', 'autoconf', 'readline', 'glib', 'pth', 'gettext-lib'] },
    { name: 'Fuentes X11',              n: 5,  items: ['libfontenc', 'freetype2', 'mkfontscale', 'mkfontdir', 'encodings'] },
    { name: 'Criptografía y red',       n: 3,  items: ['openssl 1.0.1g', 'tcp_wrappers', 'libidn'] },
    { name: 'Gestión de paquetes',      n: 2,  items: ['pkgin 0.6.4', 'pkg_install'] },
    { name: 'Otros',                    n: 2,  items: ['verilog', 'GutenMark-words'] },
  ],

  sources: [
    ['CPU y carga',          '/proc/cpuinfo, /proc/loadavg, uptime'],
    ['Memoria RAM',          '/proc/meminfo'],
    ['Disco',                'df, mount, /dev/c0*'],
    ['GPU y dispositivos',   '/proc/pci'],
    ['Red',                  'ifconfig -a'],
    ['Procesos y consumo',   'ps -ax, ps -axl'],
    ['Servicios y drivers',  'ls /service'],
    ['Programas instalados', 'pkg_info'],
  ],
};

const CPU_FLAGS = {
  fpu: 'Unidad de punto flotante integrada en el procesador.',
  apic: 'Controlador avanzado de interrupciones (APIC).',
  mmx: 'Instrucciones vectoriales con enteros (MMX).',
  sse: 'SSE: operaciones vectoriales de coma flotante.',
  sse2: 'SSE2: vectoriales con enteros y números de 64 bits.',
  pni: 'SSE3 (Prescott New Instructions).',
  ssse3: 'SSSE3: instrucciones vectoriales suplementarias.',
  sse4_1: 'SSE4.1: instrucciones vectoriales adicionales.',
  popcnt: 'Cuenta los bits en 1 de un valor con una sola instrucción.',
  xsave: 'Guarda y restaura el estado extendido de la CPU, como los registros vectoriales.',
  vmx: 'Intel VT-x: virtualización por hardware. La CPU física lo soporta y VirtualBox lo expone a la VM.',
  ht: 'Indicador de Hyper-Threading (varios hilos por núcleo). Es un valor heredado del anfitrión.',
};

const CAT = {
  user:    { label: 'Programas de usuario', short: 'Usuario',  color: 'var(--c-user)',    note: 'Sesiones, demonios y utilidades. Corren fuera de /service.' },
  service: { label: 'Servicios y drivers',  short: 'Servicios', color: 'var(--c-service)', note: 'Lanzados desde /service. Su padre es rs (PID 4).' },
  base:    { label: 'Servidores base',      short: 'Base',     color: 'var(--c-base)',    note: 'Procesos esenciales del sistema y init.' },
  kernel:  { label: 'Tareas del kernel',    short: 'Kernel',   color: 'var(--c-kernel)',  note: 'Lo único que corre dentro del núcleo. PID negativos, SZ 0.' },
};
const CAT_ORDER = ['kernel', 'base', 'service', 'user'];

const STATE = {
  W: { label: 'Esperando un mensaje', long: 'Espera un mensaje de cualquier proceso (RECV: ANY).' },
  S: { label: 'Dormido',              long: 'Bloqueado dentro de una llamada al sistema.' },
  R: { label: 'En ejecución o listo', long: 'Usando la CPU o esperando su turno.' },
};

/* Procesos identificados por nombre en el informe.
   sz en KiB (columna SZ de ps -axl). szNote: cómo se obtuvo si no es directo. */
function P(id, cat, label, o = {}) {
  return Object.assign({ id, cat, label, cmd: label, pid: null, state: null, sz: null, time: '0:00', wait: null, uid12: false, role: '', hw: null, hwKey: null }, o);
}

const PROCS = [
  // --- Tareas del kernel ---
  P('kernel', 'kernel', 'kernel', { state: 'W', sz: 0, role: 'Núcleo: interrupciones, paso de mensajes y cambio de contexto.' }),
  P('system', 'kernel', 'system', { state: 'W', sz: 0, role: 'Tarea del sistema: atiende las llamadas privilegiadas de servidores y drivers.' }),
  P('clock',  'kernel', 'clock',  { state: 'W', sz: 0, role: 'Tarea de reloj: temporizadores y alarmas.' }),
  P('idle',   'kernel', 'idle',   { state: 'W', sz: 0, role: 'Tarea inactiva: ocupa la CPU cuando no hay otro proceso listo.' }),
  P('asyncm', 'kernel', 'asyncm', { state: 'W', sz: 0, role: 'Tarea de mensajes asíncronos entre procesos.' }),

  // --- Servidores base ---
  P('rs',    'base', 'rs',    { pid: 4,  state: 'W', sz: 1200, role: 'Reincarnation Server: arranca y vigila servidores y drivers, y los reinicia si fallan.' }),
  P('ds',    'base', 'ds',    { state: 'W', role: 'Data Store: registro de nombres y valores compartido entre servidores.' }),
  P('pm',    'base', 'pm',    { state: 'W', role: 'Process Manager: crea y termina procesos, señales y esperas (wait).' }),
  P('sched', 'base', 'sched', { state: 'W', role: 'Planificador de procesos, ejecutado como servidor.' }),
  P('vfs',   'base', 'vfs',   { pid: 7,  state: 'W', sz: 1212, role: 'Virtual File System: coordina los sistemas de archivos y la E/S de los procesos.' }),
  P('vm',    'base', 'vm',    { pid: 11, state: 'W', sz: 5192, role: 'Memoria virtual: paginación y espacios de direcciones.' }),
  P('tty',   'base', 'tty',   { state: 'W', role: 'Driver de terminal y consolas.' }),
  P('memory','base', 'memory',{ state: 'W', role: 'Driver de dispositivos de memoria (como /dev/null).' }),
  P('pfs',   'base', 'pfs',   { state: 'W', role: 'Pipe File Server: tuberías y FIFOs.' }),
  P('init',  'base', 'init',  { state: 'S', role: 'Primer proceso de usuario: lanza las sesiones getty y el arranque.' }),

  // --- Servicios y drivers (/service) ---
  P('at_wini', 'service', 'at_wini', { pid: 32, state: 'W', time: '0:07', uid12: true, hw: 'Controlador IDE (PCI 0.1.1)', hwKey: 'pci-0.1.1',
    role: 'Driver del disco IDE. Es el mayor consumidor de CPU: lecturas desde el arranque y las instalaciones.' }),
  P('lance',   'service', 'lance',   { pid: 134, state: 'W', time: '0:01', hw: 'Tarjeta de red AMD Lance (PCI 0.3.0)', hwKey: 'pci-0.3.0',
    role: 'Driver de la tarjeta de red. Acumuló CPU por el tráfico de la sesión SSH.' }),
  P('inet',    'service', 'inet',    { pid: 139, state: 'W', sz: 1152, uid12: true, hw: 'Red (pila TCP/IP)', hwKey: 'pci-0.3.0',
    role: 'Servidor de red: implementa la pila TCP/IP sobre el driver lance.' }),
  P('mfs-root','service', 'mfs /',   { cmd: 'mfs /dev/c0d0p0s0 /',    pid: 49, state: 'W', sz: 5428,  uid12: true, hw: 'Partición raíz /', hwKey: 'disk-/',
    role: 'Servidor de archivos MFS de la raíz.' }),
  P('mfs-usr', 'service', 'mfs /usr',{ cmd: 'mfs /dev/c0d0p0s2 /usr', pid: 73, state: 'W', sz: 17728, uid12: true, hw: 'Partición /usr', hwKey: 'disk-/usr',
    role: 'Servidor de archivos MFS de /usr. Es el proceso que más memoria ocupa.' }),
  P('mfs-home','service', 'mfs /home',{ cmd: 'mfs /dev/c0d0p0s1 /home', pid: 76, state: 'W', sz: 324, szNote: 'derivado: 23,480 − 17,728 − 5,428', uid12: true, hw: 'Partición /home', hwKey: 'disk-/home',
    role: 'Servidor de archivos MFS de /home.' }),
  P('procfs',  'service', 'procfs',  { pid: 40, state: 'R', sz: 1208, role: 'Sistema de archivos /proc. Era el único proceso en ejecución: atendía la lectura de ps.' }),
  P('pci',     'service', 'pci',     { pid: 17, state: 'W', hw: 'Bus PCI', hwKey: 'pci-0.0.0', role: 'Servidor del bus PCI: enumera los dispositivos.' }),
  P('vbox',    'service', 'vbox',    { pid: 164, state: 'W', hw: 'Dispositivo VirtualBox (PCI 0.4.0)', hwKey: 'pci-0.4.0', role: 'Driver de integración con VirtualBox.' }),
  P('is',      'service', 'is',      { pid: 59, state: 'W', sz: 1460, role: 'Servidor de información: vuelca el estado interno del sistema.' }),
  P('pckbd',   'service', 'pckbd',   { pid: 21, state: 'W', hw: 'Teclado', role: 'Driver del teclado PC.' }),
  P('input',   'service', 'input',   { pid: 19, state: 'W', hw: 'Teclado', role: 'Servidor de entrada: reparte los eventos del teclado.' }),
  P('floppy',  'service', 'floppy',  { pid: 29, state: 'W', hw: 'Disquetera', role: 'Driver de la disquetera.' }),
  P('readclock','service','readclock.drv', { pid: 62, state: 'W', hw: 'Reloj de tiempo real', role: 'Driver que lee el reloj de tiempo real.' }),
  P('devman',  'service', 'devman',  { pid: 79, state: 'W', hw: 'Dispositivos dinámicos', role: 'Gestor de dispositivos (expone /sys).' }),
  P('pty',     'service', 'pty',     { state: 'W', uid12: true, role: 'Pseudo-terminales, usadas por las sesiones SSH.' }),
  P('random',  'service', 'random',  { state: 'W', uid12: true, role: 'Generador de números aleatorios.' }),
  P('log',     'service', 'log',     { state: 'W', uid12: true, role: 'Servidor de registro del kernel y los servicios.' }),

  // --- Programas de usuario y sesiones ---
  P('sshd',    'user', 'sshd',       { pid: 228, state: 'S', sz: 2032, wait: ['select', 'vfs'], role: 'Demonio SSH. Se ejecuta desde /usr/pkg/sbin y atiende el reenvío 2222 → 22.' }),
  P('sshd-r',  'user', 'sshd -R',    { pid: 235, state: 'S', sz: 2472, time: '0:01', wait: ['select', 'vfs'], role: 'Proceso de la sesión SSH: intercambio de claves y cifrado.' }),
  P('cron',    'user', 'cron',       { state: 'S', wait: ['sigsusp', 'pm'], role: 'Tareas programadas. Espera una señal.' }),
  P('syslogd', 'user', 'syslogd',    { state: 'S', wait: ['select', 'vfs'], role: 'Registro del sistema.' }),
  P('dhcpd',   'user', 'dhcpd',      { state: 'S', wait: ['select', 'vfs'], role: 'Cliente DHCP: configura la red.' }),
  P('nonamed', 'user', 'nonamed',    { state: 'S', wait: ['select', 'vfs'], role: 'Servidor de nombres (resolución DNS).' }),
  P('update',  'user', 'update',     { state: 'S', role: 'Vuelca periódicamente los buffers a disco.' }),
  P('devmand', 'user', 'devmand',    { pid: 107, role: 'Demonio que reacciona a los eventos de dispositivos.', hw: 'Dispositivos dinámicos' }),
  P('sh-co',   'user', '-sh (co)',   { state: 'S', wait: ['tty', 'vfs'], role: 'Shell de la consola.' }),
  P('sh-p0',   'user', '-sh (p0)',   { state: 'S', role: 'Shell de la sesión SSH. Con la consola forman los 2 usuarios de uptime.' }),
  P('getty1',  'user', 'getty c1',   { state: 'S', wait: ['tty', 'vfs'], role: 'Espera un inicio de sesión en la consola c1.' }),
  P('getty2',  'user', 'getty c2',   { state: 'S', wait: ['tty', 'vfs'], role: 'Espera un inicio de sesión en la consola c2.' }),
  P('getty3',  'user', 'getty c3',   { state: 'S', wait: ['tty', 'vfs'], role: 'Espera un inicio de sesión en la consola c3.' }),
  P('more',    'user', 'more',       { state: 'S', role: 'Paginador donde se leía el reporte.' }),
  P('ps',      'user', 'ps',         { state: 'W', role: 'El ps -axl del script: esperaba la respuesta de vfs.' }),
];

const BY_ID = Object.fromEntries(PROCS.map(p => [p.id, p]));
const MAX_SZ = Math.max(...PROCS.map(p => p.sz || 0));

/* ==========================================================================
   Utilidades
   ========================================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmtInt = n => n.toLocaleString('es-PE');
const fmt1 = n => n.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pagesToMiB = pages => pages * DATA.mem.page / 1048576;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

function svg(tag, props, ...kids) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null) continue;
      if (k === 'style') node.style.cssText = v;
      else node.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

const panel = (title, src, ...kids) =>
  h('section', { class: 'panel' },
    h('header', { class: 'panel-head' }, h('h2', null, title), src ? h('code', { class: 'src' }, src) : null),
    ...kids);

const bar = (pct, opts = {}) =>
  h('div', { class: `bar${opts.thick ? ' thick' : ''}${opts.warn ? ' warn' : ''}`, role: 'img', 'aria-label': opts.label || `${pct.toFixed(1)} %`, style: opts.color ? `--c:${opts.color}` : '' },
    h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` }));

function stackedBar(segments, thick = true) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return h('div', { class: `bar${thick ? ' thick' : ''}`, role: 'img', 'aria-label': segments.map(s => `${s.label}: ${s.text}`).join('; ') },
    segments.filter(s => s.value > 0).map(s => h('i', { style: `width:${s.value / total * 100}%;--c:${s.color}`, title: `${s.label}: ${s.text}` })));
}

function legend(items) {
  return h('ul', { class: 'legend' }, items.map(i =>
    h('li', null, h('span', { class: 'dot', style: `--c:${i.color}` }), i.text)));
}

function donut(segments, { size = 120, thick = 16, center = [] } = {}) {
  const c = size / 2, r = (size - thick) / 2, circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + s.value, 0);
  const root = svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, role: 'img', 'aria-label': segments.map(s => `${s.label}: ${s.text}`).join('; ') });
  root.append(svg('circle', { cx: c, cy: c, r, fill: 'none', style: `stroke:var(--line);stroke-width:${thick}` }));
  let offset = 0;
  for (const s of segments) {
    const len = circ * s.value / total;
    if (len <= 0) continue;
    root.append(svg('circle', {
      cx: c, cy: c, r, fill: 'none',
      style: `stroke:${s.color};stroke-width:${thick}`,
      'stroke-dasharray': `${len} ${circ - len}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${c} ${c})`,
    }, svg('title', null, `${s.label}: ${s.text}`)));
    offset += len;
  }
  center.forEach((t, i) => root.append(svg('text', {
    x: c, y: c + (center.length === 1 ? 6 : i === 0 ? 2 : 18),
    'text-anchor': 'middle',
    style: i === 0 ? 'font-size:22px;font-weight:600' : 'font-size:12px;opacity:.7',
  }, t)));
  return root;
}

function smoothScroll(el, block = 'center') {
  el.scrollIntoView({ block, behavior: reduceMotion() ? 'auto' : 'smooth' });
}

/* ==========================================================================
   Navegación entre pestañas y saltos hardware ↔ software
   ========================================================================== */

const TABS = ['resumen', 'hardware', 'procesos', 'software'];

function go(tab, { scroll = true } = {}) {
  if (!TABS.includes(tab)) tab = 'resumen';
  for (const id of TABS) {
    const on = id === tab;
    const btn = $('#tab-' + id);
    btn.setAttribute('aria-selected', on);
    btn.tabIndex = on ? 0 : -1;
    $('#view-' + id).hidden = !on;
  }
  if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
  if (scroll) window.scrollTo({ top: 0 });
}

function flash(key) {
  go('hardware', { scroll: false });
  const el = document.querySelector(`[data-key="${key}"]`);
  if (!el) return;
  smoothScroll(el);
  el.classList.remove('flash');
  void el.offsetWidth;          // reinicia la animación
  el.classList.add('flash');
}

function focusProcess(id) {
  go('procesos', { scroll: false });
  Object.assign(ps, { cat: 'all', st: 'all', q: '' });
  syncProcControls();
  renderProcs();
  select(id);
  const chip = document.querySelector(`.chip[data-id="${id}"]`);
  if (chip) smoothScroll(chip);
}

/* ==========================================================================
   RESUMEN
   ========================================================================== */

function renderResumen() {
  const m = DATA.mem;
  const used = m.total - m.free;
  const usedPct = used / m.total * 100;
  const usr = DATA.disk.parts.find(d => d.mount === '/usr');

  const load = panel('Carga de la CPU', '/proc/loadavg',
    h('p', { class: 'lead' }, 'Casi ociosa'),
    h('p', { class: 'sub' }, 'Promedio de procesos listos para ejecutarse. 1.00 equivale a una CPU ocupada.'),
    h('div', { style: 'margin-top:14px' },
      ['1 min', '5 min', '15 min'].map((lbl, i) => h('div', { class: 'load-row' },
        h('span', null, lbl), bar(DATA.sys.load[i] * 100, { color: 'var(--c-kernel)', label: `Carga a ${lbl}` }),
        h('b', null, DATA.sys.load[i].toFixed(2))))));

  const ram = panel('Memoria RAM', '/proc/meminfo',
    h('div', { class: 'donut-wrap' },
      donut([
        { label: 'Usada', value: used, text: `${fmt1(pagesToMiB(used))} MiB`, color: 'var(--c-base)' },
        { label: 'Libre', value: m.free, text: `${fmt1(pagesToMiB(m.free))} MiB`, color: 'var(--line)' },
      ], { center: [`${fmt1(usedPct)} %`, 'en uso'] }),
      h('div', null,
        h('p', { class: 'lead' }, `${fmt1(pagesToMiB(used))} MiB`),
        h('p', { class: 'sub' }, `de ${fmt1(pagesToMiB(m.total))} MiB totales`),
        h('p', { class: 'sub' }, `${fmt1(pagesToMiB(m.free))} MiB libres`))));

  const disk = panel('Disco: partición /usr', 'df',
    h('p', { class: 'lead' }, `${usr.pct} % ocupada`),
    h('p', { class: 'sub' }, `${fmt1(usr.avail)} MiB disponibles de ${fmt(usr.size)} MiB`),
    h('div', { style: 'margin:14px 0 10px' }, bar(usr.pct, { thick: true, warn: usr.pct >= 75, label: `/usr al ${usr.pct} %` })),
    usr.pct >= 75 ? h('span', { class: 'tag warn' }, 'Vigilar antes de instalar paquetes') : null);

  const T = DATA.totals;
  const procs = panel('Procesos', 'ps -ax',
    h('p', { class: 'lead' }, `${DATA.totalN} procesos`),
    h('p', { class: 'sub' }, 'Una sola CPU y un solo proceso en ejecución al momento de la captura.'),
    h('div', { style: 'margin:14px 0 10px' },
      stackedBar(CAT_ORDER.map(k => ({ label: CAT[k].label, value: T[k].n, text: `${T[k].n}`, color: CAT[k].color })))),
    legend(CAT_ORDER.map(k => ({ color: CAT[k].color, text: `${CAT[k].short} ${T[k].n}` }))));

  const findings = panel('Lectura rápida', null,
    h('ul', { class: 'list' },
      [
        ['Sistema ligero y ocioso: carga de 0.01, 8.4 % de la RAM en uso y un único proceso en ejecución.', 'procesos', 'Ver procesos'],
        ['El microkernel se ve a simple vista: solo 5 tareas viven en el kernel; servidores y drivers son procesos que rs supervisa.', 'procesos', 'Ver el mapa de capas'],
        ['La memoria la dominan los servidores de archivos: las tres instancias de mfs suman el 48.9 % del SZ total.', 'procesos', 'Ver consumo'],
        ['El disco fue lo más activo: at_wini acumuló 7 de los ≈ 9 s de CPU registrados.', 'procesos', 'Ver CPU por proceso'],
        ['El hardware es virtual: GPU, red, disco y audio son dispositivos emulados por VirtualBox.', 'hardware', 'Ver dispositivos'],
      ].map(([t, tab, cta]) => h('li', null, t, ' ', h('button', { class: 'link-btn', type: 'button', onclick: () => go(tab) }, cta)))),
    h('div', { class: 'callout', style: 'margin-top:12px' },
      h('b', null, 'A vigilar: '), `/usr está al ${usr.pct} % con ${fmt1(usr.avail)} MiB libres. Ahí se instalan los paquetes de pkgin.`));

  const sources = panel('De dónde sale cada dato', 'monitor.sh',
    h('div', { class: 'tbl-wrap' },
      h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, 'Dato'), h('th', null, 'Fuente en MINIX'))),
        h('tbody', null, DATA.sources.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, h('code', null, b))))))));

  $('#view-resumen').replaceChildren(
    h('div', { class: 'grid instruments' }, load, ram, disk, procs),
    h('div', { class: 'grid two' }, findings, sources));
}

const fmt = n => n.toLocaleString('es-PE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/* ==========================================================================
   HARDWARE
   ========================================================================== */

const hw = { unit: 'mib', kind: 'all', disk: 1, flag: null };

function renderHardware() {
  $('#view-hardware').replaceChildren(
    h('div', { class: 'grid two' }, cpuPanel(), memPanel()),
    h('div', { class: 'grid two' }, diskPanel(), netPanel()),
    pciPanel(),
    hwswPanel());
  renderMem();
  renderDiskDetail();
  renderPci();
}

/* --- CPU --- */
function cpuPanel() {
  const c = DATA.cpu;
  const desc = h('p', { class: 'flag-desc', 'aria-live': 'polite' }, 'Elige una extensión para ver qué es.');
  const flags = h('div', { class: 'flags' }, c.flags.map(f =>
    h('button', { class: 'flag', type: 'button', 'aria-pressed': 'false', onclick: e => {
      $$('.flag').forEach(b => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      desc.textContent = `${f}: ${CPU_FLAGS[f]}`;
    } }, f)));

  return panel('CPU', '/proc/cpuinfo · /proc/loadavg',
    h('dl', { class: 'kv' },
      h('dt', null, 'Procesadores'), h('dd', null, `${c.count} (processor: 0)`),
      h('dt', null, 'Fabricante'), h('dd', null, c.vendor),
      h('dt', null, 'Modelo'), h('dd', null, c.model),
      h('dt', null, 'Familia / modelo / stepping'), h('dd', null, `${c.family} / ${c.modelNo} / ${c.stepping}`),
      h('dt', null, 'Frecuencia'), h('dd', null, `${fmtInt(c.mhz)} MHz (≈ ${(c.mhz / 1000).toFixed(2)} GHz)`),
      h('dt', null, 'Carga (1, 5, 15 min)'), h('dd', null, DATA.sys.load.map(v => v.toFixed(2)).join(' / '))),
    h('p', { class: 'note', style: 'margin:14px 0 8px' }, 'Frecuencia y extensiones las hereda de la CPU física del anfitrión.'),
    flags, desc);
}

/* --- Memoria --- */
function memPanel() {
  return panel('Memoria RAM', '/proc/meminfo',
    h('div', { class: 'tools', style: 'margin-bottom:14px' },
      h('span', { class: 'note' }, 'Unidad'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Unidad de memoria' },
        [['mib', 'MiB'], ['pages', 'Páginas'], ['bytes', 'Bytes']].map(([k, l]) =>
          h('button', { type: 'button', 'data-unit': k, 'aria-pressed': String(hw.unit === k), onclick: () => { hw.unit = k; renderMem(); } }, l)))),
    h('div', { id: 'mem-body' }));
}

function renderMem() {
  const m = DATA.mem, used = m.total - m.free;
  const val = pages => hw.unit === 'mib' ? `${fmt1(pagesToMiB(pages))} MiB`
                     : hw.unit === 'pages' ? fmtInt(pages)
                     : fmtInt(pages * m.page);
  $$('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === hw.unit)));

  const rows = [
    ['Total', m.total, 'var(--ink)', 'RAM asignada a la VM'],
    ['Usada (total − libre)', used, 'var(--c-base)', `${fmt1(used / m.total * 100)} % del total`],
    ['Libre', m.free, 'var(--c-kernel)', `${fmt1(m.free / m.total * 100)} % del total`],
    ['Mayor bloque contiguo libre', m.largest, 'var(--c-service)', `${fmt1(m.largest / m.free * 100)} % de la memoria libre: poca fragmentación`],
    ['En caché', m.cache, 'var(--c-user)', 'Páginas usadas como caché de bloques de disco'],
  ];

  $('#mem-body').replaceChildren(
    stackedBar([
      { label: 'Usada', value: used, text: val(used), color: 'var(--c-base)' },
      { label: 'Libre', value: m.free, text: val(m.free), color: 'var(--c-kernel)' },
    ]),
    h('div', { class: 'tbl-wrap', style: 'margin-top:8px' },
      h('table', { class: 'tbl' },
        h('tbody', null,
          h('tr', null, h('td', null, 'Tamaño de página'), h('td', { class: 'num' }, hw.unit === 'mib' ? '4 KiB' : '4,096 bytes'), h('td', { class: 'note' }, 'Unidad de asignación de la memoria')),
          rows.map(([name, v, color, note]) => h('tr', null,
            h('td', null, h('span', { class: 'dot-name' }, h('span', { class: 'dot', style: `--c:${color}` }), name)),
            h('td', { class: 'num' }, val(v)),
            h('td', { class: 'note' }, note)))))));
}

/* --- Disco --- */
function diskPanel() {
  return panel('Disco', 'df · mount · /dev/c0*',
    h('p', { class: 'note', style: 'margin-bottom:8px' },
      `Un solo disco virtual (c0d0) de ≈ 2.0 GiB: ${fmtInt(DATA.disk.blocks512)} bloques de 512 bytes en tres particiones MFS.`),
    h('div', { id: 'disk-rows' }, DATA.disk.parts.map((d, i) => {
      const warn = d.pct >= 75;
      return h('button', { class: 'disk-row', type: 'button', 'data-key': `disk-${d.mount}`, 'aria-pressed': String(i === hw.disk), onclick: () => { hw.disk = i; $$('.disk-row').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i))); renderDiskDetail(); } },
        h('div', { class: 'disk-top' },
          h('b', null, d.mount),
          h('span', { class: 'note' }, `${d.dev} · ${d.fs}`),
          h('span', null, `${d.pct} %`, warn ? h('span', { class: 'tag warn', style: 'margin-left:8px' }, 'Casi lleno') : null)),
        bar(d.pct, { warn, thick: true, label: `${d.mount} al ${d.pct} %` }),
        h('div', { class: 'note', style: 'margin-top:5px' }, `${fmt(d.used)} MiB usados de ${fmt(d.size)} MiB · ${fmt(d.avail)} MiB disponibles`));
    })),
    h('div', { id: 'disk-detail', style: 'margin-top:12px' }));
}

function renderDiskDetail() {
  const d = DATA.disk.parts[hw.disk];
  const m = d.dev.split('/').pop().match(/^c(\d+)d(\d+)p(\d+)s(\d+)$/);
  const parts = m ? [
    [`c${m[1]}`, 'controlador'], [`d${m[2]}`, 'disco'], [`p${m[3]}`, 'partición primaria'], [`s${m[4]}`, 'subpartición'],
  ] : [];
  $('#disk-detail').replaceChildren(
    h('p', { class: 'note' }, `Nombre del dispositivo ${d.dev.split('/').pop()}:`),
    h('div', { class: 'parts' }, parts.map(([a, b]) => h('div', { class: 'part' }, h('code', null, a), h('span', null, b)))),
    h('p', { class: 'note', style: 'margin-top:10px' }, 'Lo atiende el proceso ',
      h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess(d.proc) }, `${BY_ID[d.proc].cmd} (PID ${BY_ID[d.proc].pid})`), '.'));
}

/* --- Red --- */
function netPanel() {
  const n = DATA.net;
  return panel('Red', 'ifconfig -a',
    h('dl', { class: 'kv' },
      h('dt', null, 'Interfaz'), h('dd', null, h('code', null, n.iface)),
      h('dt', null, 'Dirección'), h('dd', null, h('code', null, `${n.ip}/24`), ` · máscara ${n.mask}`),
      h('dt', null, 'MTU'), h('dd', null, fmtInt(n.mtu)),
      h('dt', null, 'Modo'), h('dd', null, n.mode),
      h('dt', null, 'Driver'), h('dd', null, n.driver),
      h('dt', null, 'Pila'), h('dd', null, n.stack),
      h('dt', null, 'Reenvío'), h('dd', null, n.forward)),
    h('p', { class: 'note', style: 'margin-top:12px' },
      'dhcpd configura la red por DHCP y nonamed resuelve nombres. Los procesos sshd existen por el reenvío de puertos.'),
    h('div', { style: 'margin-top:12px', class: 'tools' },
      h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess('lance') }, 'Ver driver lance'),
      h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess('inet') }, 'Ver servidor inet')));
}

/* --- PCI --- */
const PCI_KINDS = [['all', 'Todos'], ['video', 'Video'], ['disk', 'Disco'], ['net', 'Red'], ['chipset', 'Chipset'], ['vbox', 'VirtualBox'], ['io', 'Audio y USB']];

function pciPanel() {
  return panel('Dispositivos PCI y GPU', '/proc/pci',
    h('p', { class: 'note', style: 'margin-bottom:12px' },
      'No hay una tarjeta gráfica física: el dispositivo 0.2.0 es la GPU virtual de VirtualBox (fabricante 80EE) y MINIX usa la consola en modo texto. /proc/pci no le da nombre, por eso se identifica por su clase 3/0/0.'),
    h('div', { class: 'filters', style: 'margin-bottom:12px', role: 'group', 'aria-label': 'Filtrar dispositivos' },
      PCI_KINDS.map(([k, l]) => h('button', { class: 'pill', type: 'button', 'data-kind': k, 'aria-pressed': String(hw.kind === k), onclick: () => { hw.kind = k; renderPci(); } }, l))),
    h('div', { class: 'tbl-wrap', id: 'pci-body' }));
}

function renderPci() {
  $$('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === hw.kind)));
  const list = DATA.pci.filter(d => hw.kind === 'all' || d.kind === hw.kind);
  $('#pci-body').replaceChildren(
    h('table', { class: 'tbl' },
      h('thead', null, h('tr', null,
        ['Bus', 'Clase', 'ID', 'Nombre', 'Función', 'Gestionado por'].map(t => h('th', null, t)))),
      h('tbody', null, list.map(d => h('tr', { 'data-key': `pci-${d.bus}` },
        h('td', null, h('code', null, d.bus)),
        h('td', null, h('code', null, d.cls)),
        h('td', null, h('code', null, d.id)),
        h('td', null, d.name || h('span', { class: 'note' }, '(sin nombre)')),
        h('td', null, d.fn, d.gpu ? [' ', h('span', { class: 'tag gpu' }, 'GPU virtual')] : null),
        h('td', null, d.proc
          ? h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess(d.proc) }, `${BY_ID[d.proc].label} (PID ${BY_ID[d.proc].pid})`)
          : h('span', { class: 'note' }, '—')))))));
}

/* --- Relación hardware ↔ software --- */
function hwswPanel() {
  return panel('Hardware y el proceso que lo atiende', 'Tabla 11 del informe',
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'En un microkernel cada dispositivo tiene su propio proceso. Elige uno para ver su detalle.'),
    h('div', { class: 'tbl-wrap' },
      h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, 'Recurso'), h('th', null, 'Procesos'))),
        h('tbody', null, DATA.hwsw.map(r => h('tr', null,
          h('td', null, r.key
            ? h('button', { class: 'link-btn', type: 'button', onclick: () => flash(r.key) }, r.hw)
            : r.hw),
          h('td', null, h('div', { class: 'tools' }, r.procs.map(id =>
            h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess(id) }, `${BY_ID[id].cmd} (${BY_ID[id].pid})`))))))))));
}

/* ==========================================================================
   PROCESOS
   ========================================================================== */

const ps = { cat: 'all', st: 'all', q: '', sel: 'at_wini', sortKey: 'sz', sortDir: -1 };

const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
const matches = p => {
  if (ps.cat !== 'all' && p.cat !== ps.cat) return false;
  if (ps.st !== 'all' && p.state !== ps.st) return false;
  if (ps.q) {
    const hay = `${p.label} ${p.cmd} ${p.pid ?? ''} ${p.role}`.toLowerCase();
    if (!hay.includes(ps.q.toLowerCase())) return false;
  }
  return true;
};

function renderProcesos() {
  const named = PROCS.length;
  $('#view-procesos').replaceChildren(
    h('div', { class: 'tools' },
      h('input', { class: 'field', id: 'ps-q', type: 'search', placeholder: 'Buscar por nombre, PID o función', 'aria-label': 'Buscar procesos', oninput: e => { ps.q = e.target.value.trim(); renderProcs(); } }),
      h('div', { class: 'filters', role: 'group', 'aria-label': 'Filtrar por capa', id: 'ps-cats' },
        [['all', 'Todas'], ...['user', 'service', 'base', 'kernel'].map(k => [k, CAT[k].short])].map(([k, l]) =>
          h('button', { class: 'pill', type: 'button', 'data-cat': k, 'aria-pressed': String(ps.cat === k), onclick: () => { ps.cat = k; syncProcControls(); renderProcs(); } }, l))),
      h('label', { class: 'note' }, 'Estado ',
        h('select', { class: 'field', id: 'ps-st', onchange: e => { ps.st = e.target.value; renderProcs(); } },
          h('option', { value: 'all' }, 'Todos'),
          Object.entries(STATE).map(([k, v]) => h('option', { value: k }, `${k} · ${v.label}`))))),
    h('p', { class: 'note' },
      `El informe identifica por nombre ${named} de los ${DATA.totalN} procesos; los ${DATA.totalN - named} restantes solo cuentan en los totales. Los tamaños son la columna SZ de ps -axl, en KiB.`),
    h('div', { class: 'grid split' },
      h('div', null,
        h('div', { id: 'map' }),
        h('div', { class: 'panel', style: 'margin-top:16px' },
          h('div', { class: 'panel-head' }, h('h2', null, 'Tabla de procesos'), h('code', { class: 'src' }, 'ps -axl')),
          h('div', { class: 'tbl-wrap', id: 'ps-table' }))),
      h('aside', { class: 'panel detail', id: 'detail', 'aria-live': 'polite' })),
    h('div', { class: 'grid two' }, memByCatPanel(), topPanel(), statePanel(), cpuTimePanel()));

  renderProcs();
  renderDetail();
}

function syncProcControls() {
  $$('#ps-cats [data-cat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === ps.cat)));
  const q = $('#ps-q'); if (q) q.value = ps.q;
  const st = $('#ps-st'); if (st) st.value = ps.st;
}

function renderProcs() {
  renderMap();
  renderPsTable();
  paintSelection();
}

/* --- Mapa de capas --- */
function renderMap() {
  const T = DATA.totals;
  $('#map').replaceChildren(...['user', 'service', 'base', 'kernel'].map(cat => {
    const list = PROCS.filter(p => p.cat === cat);
    const missing = T[cat].n - list.length;
    return h('section', { class: 'band', style: `--c:${CAT[cat].color}` },
      h('div', { class: 'band-head' },
        h('h3', null, CAT[cat].label),
        h('p', null, h('span', { class: 'n' }, `${T[cat].n} procesos`), ` · ${fmtInt(T[cat].sz)} KiB · ${fmt1(T[cat].sz / DATA.totalSz * 100)} %`),
        h('p', null, CAT[cat].note)),
      h('div', { class: 'chips' },
        list.map(p => h('button', { class: `chip${matches(p) ? '' : ' is-dim'}`, type: 'button', 'data-id': p.id, 'aria-pressed': 'false', onclick: () => select(p.id) },
          h('span', { class: 'chip-name' }, p.label),
          h('span', { class: 'chip-meta' }, p.pid != null ? `PID ${p.pid}` : cat === 'kernel' ? 'tarea' : 'PID —'),
          p.sz ? h('span', { class: 'chip-bar' }, h('i', { style: `width:${Math.max(4, p.sz / MAX_SZ * 100)}%` })) : null)),
        missing > 0 ? h('div', { class: 'chip ghost' }, `+${missing} sin detallar`) : null));
  }));
}

/* --- Selección --- */
function select(id) {
  ps.sel = id;
  paintSelection();
  renderDetail();
}

function paintSelection() {
  $$('.chip[data-id]').forEach(c => {
    const on = c.dataset.id === ps.sel;
    c.classList.toggle('is-sel', on);
    c.setAttribute('aria-pressed', String(on));
  });
  $$('#ps-table tr[data-id]').forEach(r => r.classList.toggle('is-sel', r.dataset.id === ps.sel));
}

/* --- Detalle --- */
function renderDetail() {
  const p = BY_ID[ps.sel];
  const box = $('#detail');
  if (!p) { box.replaceChildren(h('p', { class: 'note' }, 'Elige un proceso del mapa o de la tabla.')); return; }
  box.style.setProperty('--c', CAT[p.cat].color);

  const szText = p.sz == null ? 'No detallado individualmente'
    : p.sz === 0 ? '0 KiB (sin espacio de direcciones de usuario)'
    : `${fmtInt(p.sz)} KiB · ${fmt1(p.sz / DATA.totalSz * 100)} % del total${p.szNote ? ` (${p.szNote})` : ''}`;
  const waitText = p.wait ? `En ${p.wait[0]}, atendido por ${p.wait[1]}` : p.state === 'W' ? 'Un mensaje de cualquier proceso (RECV: ANY)' : null;

  box.replaceChildren(
    h('h2', null, p.cmd),
    h('span', { class: 'badge' }, CAT[p.cat].label),
    p.role ? h('p', { class: 'role' }, p.role) : null,
    h('dl', { class: 'kv' },
      h('dt', null, 'PID'), h('dd', null, p.pid != null ? String(p.pid) : p.cat === 'kernel' ? 'Negativo (tarea del kernel)' : 'No detallado'),
      h('dt', null, 'Estado'), h('dd', null, p.state ? `${p.state} · ${STATE[p.state].label}` : 'No detallado'),
      waitText ? [h('dt', null, 'Espera'), h('dd', null, waitText)] : null,
      h('dt', null, 'Memoria (SZ)'), h('dd', null, szText),
      h('dt', null, 'CPU acumulada'), h('dd', null, p.time === '0:00' ? 'Menos de 1 s' : p.time),
      p.cat === 'service' ? [h('dt', null, 'Padre'), h('dd', null, 'rs (PID 4), que puede reiniciarlo si falla')] : null,
      p.uid12 ? [h('dt', null, 'Privilegios'), h('dd', null, 'UID 12: no corre como root')] : null,
      p.hw ? [h('dt', null, 'Hardware'), h('dd', null, p.hw)] : null),
    p.sz ? h('div', { style: 'margin-top:14px' }, bar(p.sz / MAX_SZ * 100, { color: CAT[p.cat].color, label: 'Tamaño relativo al proceso más grande' }),
      h('p', { class: 'note', style: 'margin-top:4px' }, 'Tamaño relativo a mfs /usr, el mayor.')) : null,
    p.hwKey ? h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: () => flash(p.hwKey) }, 'Ver el dispositivo')) : null);
}

/* --- Tabla ordenable --- */
const COLS = [
  ['label', 'Proceso', false], ['pid', 'PID', true], ['cat', 'Capa', false],
  ['state', 'Estado', false], ['sz', 'SZ (KiB)', true], ['pct', '% del total', true], ['time', 'CPU', true],
];

function sortVal(p, k) {
  if (k === 'cat') return CAT_ORDER.indexOf(p.cat);
  if (k === 'pct') return p.sz == null ? null : p.sz / DATA.totalSz * 100;
  if (k === 'time') return secs(p.time);
  return p[k];
}

function renderPsTable() {
  const rows = PROCS.filter(matches).sort((a, b) => {
    const x = sortVal(a, ps.sortKey), y = sortVal(b, ps.sortKey);
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    return ps.sortDir * (typeof x === 'string' ? x.localeCompare(y, 'es') : x - y);
  });

  $('#ps-table').replaceChildren(
    h('table', { class: 'tbl' },
      h('thead', null, h('tr', null, COLS.map(([k, l, num]) =>
        h('th', { class: num ? 'num' : '', 'aria-sort': ps.sortKey === k ? (ps.sortDir > 0 ? 'ascending' : 'descending') : 'none' },
          h('button', { class: 'th-btn', type: 'button', onclick: () => {
            if (ps.sortKey === k) ps.sortDir *= -1; else { ps.sortKey = k; ps.sortDir = (k === 'sz' || k === 'pct' || k === 'time') ? -1 : 1; }
            renderPsTable(); paintSelection();
          } }, l))))),
      h('tbody', null,
        rows.length ? rows.map(p => h('tr', { 'data-id': p.id },
          h('td', null, h('button', { class: 'link-btn dot-name', type: 'button', style: `--c:${CAT[p.cat].color}`, onclick: () => select(p.id) },
            h('span', { class: 'dot' }), p.label)),
          h('td', { class: 'num' }, p.pid ?? '—'),
          h('td', null, CAT[p.cat].short),
          h('td', null, p.state ?? '—'),
          h('td', { class: 'num' }, p.sz == null ? '—' : (p.szNote ? '≈ ' : '') + fmtInt(p.sz)),
          h('td', { class: 'num' }, p.sz == null ? '—' : fmt1(p.sz / DATA.totalSz * 100) + ' %'),
          h('td', { class: 'num' }, p.time)))
        : h('tr', null, h('td', { colspan: COLS.length, class: 'note' }, 'Ningún proceso coincide con el filtro.')))));
}

/* --- Gráficos de procesos --- */
function memByCatPanel() {
  const T = DATA.totals;
  return panel('Memoria por capa', 'ps -axl · SZ',
    stackedBar(CAT_ORDER.filter(k => T[k].sz > 0).map(k => ({ label: CAT[k].label, value: T[k].sz, text: `${fmtInt(T[k].sz)} KiB`, color: CAT[k].color }))),
    h('div', { class: 'tbl-wrap', style: 'margin-top:8px' },
      h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, 'Capa'), h('th', { class: 'num' }, 'Procesos'), h('th', { class: 'num' }, 'SZ (KiB)'), h('th', { class: 'num' }, '%'))),
        h('tbody', null,
          CAT_ORDER.map(k => h('tr', null,
            h('td', null, h('span', { class: 'dot-name' }, h('span', { class: 'dot', style: `--c:${CAT[k].color}` }), CAT[k].label)),
            h('td', { class: 'num' }, T[k].n), h('td', { class: 'num' }, fmtInt(T[k].sz)), h('td', { class: 'num' }, fmt1(T[k].sz / DATA.totalSz * 100)))),
          h('tr', null, h('td', null, h('b', null, 'Total')), h('td', { class: 'num' }, h('b', null, DATA.totalN)), h('td', { class: 'num' }, h('b', null, fmtInt(DATA.totalSz))), h('td', { class: 'num' }, h('b', null, '100.0')))))),
    h('p', { class: 'note', style: 'margin-top:8px' }, `Suma ≈ ${fmt1(DATA.totalSz / 1024)} MiB, del mismo orden que los 43.2 MiB usados en /proc/meminfo.`));
}

function topPanel() {
  const top = PROCS.filter(p => p.sz > 0).sort((a, b) => b.sz - a.sz).slice(0, 10);
  return panel('Los 10 procesos con más memoria', 'ps -axl · SZ',
    h('div', { class: 'hbars' }, top.map(p => h('div', { class: 'hbar' },
      h('button', { class: 'link-btn lbl', type: 'button', style: 'text-align:left;text-decoration:none', title: p.cmd, onclick: () => focusProcess(p.id) }, p.label),
      bar(p.sz / top[0].sz * 100, { color: CAT[p.cat].color, label: `${p.label}: ${fmtInt(p.sz)} KiB` }),
      h('span', { class: 'val' }, fmtInt(p.sz))))),
    h('p', { class: 'note', style: 'margin-top:10px' }, 'Las tres instancias de mfs suman 23,480 KiB: el 48.9 % de la memoria de todos los procesos.'));
}

function statePanel() {
  const S = DATA.states;
  const colors = { W: 'var(--c-kernel)', S: 'var(--c-service)', R: 'var(--c-user)' };
  const total = S.W + S.S + S.R;
  return panel('Estados de los procesos', 'ps -axl',
    h('div', { class: 'donut-wrap' },
      donut(Object.keys(S).map(k => ({ label: STATE[k].label, value: S[k], text: String(S[k]), color: colors[k] })), { center: [String(total), 'procesos'] }),
      h('ul', { class: 'legend', style: 'flex-direction:column' },
        Object.keys(S).map(k => h('li', null, h('span', { class: 'dot', style: `--c:${colors[k]}` }), h('span', null, h('b', null, `${k} · ${S[k]} `), STATE[k].label))))),
    h('p', { class: 'note', style: 'margin-top:10px' }, 'Un solo proceso en R (procfs, atendiendo a ps): la CPU estuvo libre casi todo el tiempo, igual que indica la carga de 0.01.'));
}

function cpuTimePanel() {
  const rows = [['at_wini', 'at_wini (PID 32)', 7], ['lance', 'lance (PID 134)', 1], ['sshd-r', 'sshd -R (PID 235)', 1]];
  return panel('CPU acumulada por proceso', 'ps -axl · TIME',
    h('div', { class: 'hbars' }, rows.map(([id, name, s]) => h('div', { class: 'hbar' },
      h('button', { class: 'link-btn lbl', type: 'button', style: 'text-align:left;text-decoration:none', onclick: () => focusProcess(id) }, name),
      bar(s / 7 * 100, { color: CAT[BY_ID[id].cat].color, label: `${name}: ${s} s` }),
      h('span', { class: 'val' }, `${s} s`)))),
    h('p', { class: 'note', style: 'margin-top:10px' }, 'En unos 10 minutos el sistema sumó ≈ 9 s de CPU (≈ 1.5 %). Los demás procesos quedaron por debajo de 1 s.'));
}

/* ==========================================================================
   SOFTWARE
   ========================================================================== */

const sw = { pkg: 0 };

function renderSoftware() {
  $('#view-software').replaceChildren(
    h('div', { class: 'grid two' }, pkgPanel(), servicePanel()),
    runningPanel());
  renderPkgDetail();
}

const PKG_COLORS = ['var(--c-user)', 'var(--c-service)', 'var(--c-base)', 'var(--c-kernel)', 'var(--ink)', 'var(--muted)'];

function pkgPanel() {
  const total = DATA.packages.reduce((a, p) => a + p.n, 0);
  return panel('Paquetes instalados', 'pkg_info',
    h('div', { class: 'donut-wrap' },
      donut(DATA.packages.map((p, i) => ({ label: p.name, value: p.n, text: String(p.n), color: PKG_COLORS[i] })), { size: 130, center: [String(total), 'paquetes'] }),
      h('p', { class: 'note', style: 'flex:1;min-width:180px' }, 'pkg_info mostró 30 paquetes: el script limita la salida a esa cantidad (head -30), así que la lista puede no ser completa.')),
    h('div', { class: 'pkg-groups', role: 'group', 'aria-label': 'Grupos de paquetes' },
      DATA.packages.map((p, i) => h('button', { class: 'pill', type: 'button', 'data-pkg': i, 'aria-pressed': String(sw.pkg === i), onclick: () => { sw.pkg = i; renderPkgDetail(); } }, `${p.name} · ${p.n}`))),
    h('div', { id: 'pkg-detail' }));
}

function renderPkgDetail() {
  $$('[data-pkg]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.pkg) === sw.pkg)));
  const p = DATA.packages[sw.pkg];
  $('#pkg-detail').replaceChildren(
    h('div', { class: 'pkg-list' }, p.items.map(i => h('span', null, i))));
}

function servicePanel() {
  const s = DATA.services;
  return panel('Servicios y drivers disponibles', 'ls /service',
    h('p', { class: 'lead' }, `${s.running} en ejecución de ${s.available}`),
    h('p', { class: 'sub' }, 'MINIX carga solo los drivers que corresponden al hardware de la VM.'),
    h('div', { style: 'margin:14px 0 8px' }, bar(s.running / s.available * 100, { thick: true, color: 'var(--c-service)', label: `${s.running} de ${s.available} en ejecución` })),
    h('p', { class: 'note', style: 'margin:12px 0 6px' }, 'Disponibles pero sin cargar (ejemplos):'),
    h('div', { class: 'pkg-list' }, s.notLoaded.map(n => h('span', null, n))));
}

function runningPanel() {
  const users = PROCS.filter(p => p.cat === 'user');
  return panel('Programas en ejecución', 'ps -ax',
    h('p', { class: 'note', style: 'margin-bottom:8px' }, 'Programas de usuario y sesiones. Elige uno para ver su detalle en Procesos.'),
    h('div', { class: 'tbl-wrap' },
      h('table', { class: 'tbl' },
        h('thead', null, h('tr', null, h('th', null, 'Programa'), h('th', null, 'Para qué sirve'), h('th', null, 'Estado'))),
        h('tbody', null, users.map(p => h('tr', null,
          h('td', null, h('button', { class: 'link-btn', type: 'button', onclick: () => focusProcess(p.id) }, p.cmd)),
          h('td', null, p.role),
          h('td', null, p.state ? `${p.state} · ${STATE[p.state].label}` : '—')))))));
}

/* ==========================================================================
   Arranque
   ========================================================================== */

function renderMeta() {
  const s = DATA.sys;
  $('#meta').textContent =
    `${s.os} · ${s.arch} · ${s.platform} · captura del ${s.capture} · activo ${s.uptimeMin} min · ${s.users} usuarios (${s.usersDetail})`;
}

function initTabs() {
  TABS.forEach((id, i) => {
    const btn = $('#tab-' + id);
    btn.addEventListener('click', () => go(id));
    btn.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = TABS[(i + d + TABS.length) % TABS.length];
      go(next, { scroll: false });
      $('#tab-' + next).focus();
    });
  });
  addEventListener('hashchange', () => go(location.hash.slice(1), { scroll: false }));
}

function initTheme() {
  const btn = $('#theme-btn');
  let saved = null;
  try { saved = localStorage.getItem('minix-theme'); } catch (e) { /* almacenamiento no disponible */ }
  if (saved) document.documentElement.dataset.theme = saved;
  const current = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  btn.setAttribute('aria-pressed', String(current() === 'dark'));
  btn.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    btn.setAttribute('aria-pressed', String(next === 'dark'));
    try { localStorage.setItem('minix-theme', next); } catch (e) { /* ignorar */ }
  });
}

renderMeta();
renderResumen();
renderHardware();
renderProcesos();
renderSoftware();
initTabs();
initTheme();
go(location.hash.slice(1), { scroll: false });