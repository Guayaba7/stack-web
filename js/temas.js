// Temas de Stack en la web. El tema se elige en la app (perk de la app) y viaja cifrado en la cuenta; aqui solo se APLICA.
// Lo que sigue esta copiado de la app (S-0.6.7-BETA) para que se vea y se mueva igual: colores del tema personalizado
// (PER) y fondos animados de pantalla completa (GALAXY, PLASMA, CONTOUR, GRID).
export const PALETAS = ["GRN", "VLT", "GRY", "RED", "RNB", "NVD", "HLW", "SNV", "ALG", "SOL", "DREAM", "PLASMA", "GRID", "CONTOUR", "GALAXY", "PER"];
const CLARO = { ALG: "#fff4fa", DREAM: "#fcf6fb" };
let cfg = { tema_personal: null };

// ---------------------------------------------------------------- de la app: tema personalizado
const PER_DEF = {bg: "#0a0e0b", panel: "#0e1410", txt: "#c9d6c6", dim: "#6f8572", acc: "#3ddc84", amb: "#f0b429",
  line: "#24352a", sel: "#13301f", bueno: "#3ddc84", malo: "#ff6b6b"};
const PER_CAMPOS = [["bg", "Fondo"], ["panel", "Paneles y ventanas"], ["txt", "Texto"], ["dim", "Texto secundario"], ["acc", "Acento"],
  ["amb", "Destacado"], ["line", "Líneas y bordes"], ["sel", "Selección"], ["bueno", "Más barato / sube"], ["malo", "Más caro / baja"]];
const esHex = v => /^#[0-9a-f]{6}$/i.test(String(v || ""));
const temaPersonal = () => { const t = cfg.tema_personal || {}; return Object.fromEntries(PER_CAMPOS.map(([c]) => [c, esHex(t[c]) ? t[c].toLowerCase() : PER_DEF[c]])); };
function mezcla(a, b, t) {                          // a*t + b*(1-t), en hex
  const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = n(a), y = n(b);
  return "#" + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, "0")).join("");
}
const claro = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return 0.299 * r + 0.587 * g + 0.114 * b > 140; };
function aplicarPersonal(activo, t) {
  const st = document.body.style, vars = ["bg", "panel", "txt", "hi", "dim", "acc", "amb", "line", "sel", "err", "bueno", "malo", "foil", "etched", "har", "grid", "sel2", "selline", "edit"];
  if (!activo) { vars.forEach(v => st.removeProperty("--" + v)); return; }
  const c = {...temaPersonal(), ...(t || {})};
  const val = {...c, hi: mezcla(c.txt, claro(c.bg) ? "#000000" : "#ffffff", 0.7), err: c.malo,
    foil: mezcla(c.acc, c.txt, 0.55), etched: mezcla(c.amb, c.txt, 0.55), har: mezcla(c.malo, c.txt, 0.45),
    grid: mezcla(c.line, c.bg, 0.5), sel2: mezcla(c.sel, c.bg, 0.6), selline: mezcla(c.acc, c.bg, 0.5), edit: c.panel};
  vars.forEach(v => st.setProperty("--" + v, val[v]));
}


// ---------------------------------------------------------------- de la app: fondos animados
// ================================================================ fondos animados de pantalla completa (temas PLASMA y GRID SHIFT)
// Un solo <canvas id="fondo"> detras de toda la interfaz. Se activa solo con esos temas; al cambiar de tema se detiene y se
// libera. Maximo ~30 fps, pausa con la ventana oculta, y con animaciones apagadas (VIDEO o 'reducir movimiento' de Windows)
// queda un fotograma fijo.
const FONDO = {tema: null, raf: 0, ultimo: 0, t0: 0, cv: null, cx: null, w: 0, h: 0, est: null, animar: false};
const FONDOS = {
  GALAXY: {
    // Espacio profundo: degradado de fondo, nebulosas (manchas radiales que derivan lento, mezcla aditiva), estrellas en
    // 3 capas con paralaje y titileo, y de vez en cuando una estrella fugaz. Todo con canvas 2D: sin imagenes.
    iniciar() {
      const r = (a, b) => a + Math.random() * (b - a);
      const neb = [[268, .55], [235, .45], [290, .40], [215, .35], [315, .30], [255, .38]].map(([h, a]) => ({h, a, x: r(.05, .95), y: r(.05, .95),
        rr: r(.28, .55), vx: r(-1, 1), vy: r(-1, 1), f: r(.6, 1.4), ph: r(0, 6.28)}));
      const capas = [[.004, .6, 1], [.009, .85, 1.4], [.018, 1, 2]].map(([v, b, sz], i) => ({v, b, sz, est: Array.from({length: [520, 260, 90][i]},
        () => ({x: Math.random(), y: Math.random(), f: r(.5, 2.2), ph: r(0, 6.28), c: Math.random() < .15 ? r(200, 300) : null}))}));
      return {neb, capas, fugaz: null, prox: 4000};
    },
    medir() {},
    dibujar(F, E, t) {
      const c = F.cx, W = F.w, H = F.h, s = t / 1000;
      const g = c.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#04020b"); g.addColorStop(.55, "#0a0520"); g.addColorStop(1, "#03040f");
      c.globalCompositeOperation = "source-over"; c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = "lighter";
      const M = Math.max(W, H);
      for (const n of E.neb) {
        const x = (n.x + .06 * Math.sin(s * .05 * n.f + n.ph) + .015 * n.vx * Math.sin(s * .02)) * W, y = (n.y + .05 * Math.cos(s * .04 * n.f + n.ph)) * H;
        const rad = n.rr * M * (1 + .06 * Math.sin(s * .07 + n.ph)), gr = c.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `hsla(${n.h},80%,45%,${.16 * n.a})`); gr.addColorStop(.45, `hsla(${n.h + 15},75%,30%,${.08 * n.a})`); gr.addColorStop(1, "hsla(0,0%,0%,0)");
        c.fillStyle = gr; c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (const cap of E.capas) {
        for (const e of cap.est) {
          const x = ((e.x - s * cap.v) % 1 + 1) % 1 * W, y = e.y * H, a = cap.b * (.45 + .55 * (.5 + .5 * Math.sin(s * e.f + e.ph)));
          c.fillStyle = e.c ? `hsla(${e.c},80%,82%,${a})` : `rgba(235,232,255,${a})`;
          c.fillRect(x, y, cap.sz, cap.sz);
        }
      }
      if (!E.fugaz && t > E.prox) E.fugaz = {x: Math.random() * W, y: Math.random() * H * .5, t0: t, dx: (Math.random() < .5 ? -1 : 1) * W * .35, dy: H * .22};
      if (E.fugaz) {
        const k = (t - E.fugaz.t0) / 900;
        if (k >= 1) { E.fugaz = null; E.prox = t + 6000 + Math.random() * 9000; }
        else {
          const x = E.fugaz.x + E.fugaz.dx * k, y = E.fugaz.y + E.fugaz.dy * k, lg = c.createLinearGradient(x, y, x - E.fugaz.dx * .18, y - E.fugaz.dy * .18);
          lg.addColorStop(0, `rgba(255,255,255,${.85 * (1 - k)})`); lg.addColorStop(1, "rgba(180,140,255,0)");
          c.strokeStyle = lg; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x - E.fugaz.dx * .18, y - E.fugaz.dy * .18); c.stroke();
        }
      }
      c.globalCompositeOperation = "source-over";
    },
  },
  PLASMA: {
    iniciar(F) {                                      // el plasma se calcula a baja resolucion y se escala (suave y barato)
      const off = document.createElement("canvas"), lut = new Uint8ClampedArray(256 * 3);
      const paradas = [[0, 5, 3, 14], [.16, 22, 10, 70], [.30, 38, 70, 205], [.44, 104, 40, 214], [.56, 176, 38, 170], [.64, 205, 52, 104],
        [.72, 120, 26, 150], [.82, 40, 22, 96], [.90, 22, 120, 110], [1, 5, 3, 14]];   // negro, azul, violeta, magenta, rojo y verde leves
      for (let i = 0; i < 256; i++) {
        const t = i / 255, k = paradas.findIndex(p => p[0] >= t), a = paradas[Math.max(0, k - 1)], b = paradas[k], f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
        for (let c = 0; c < 3; c++) lut[i * 3 + c] = (a[c + 1] + (b[c + 1] - a[c + 1]) * f) * .5;   // atenuado: el texto se sigue leyendo
      }
      return {off, octx: off.getContext("2d"), lut, img: null};
    },
    medir(F, E) {
      const ow = Math.max(80, Math.round(F.w / 8)), oh = Math.max(45, Math.round(F.h / 8));
      E.off.width = ow; E.off.height = oh; E.img = E.octx.createImageData(ow, oh);
    },
    dibujar(F, E, t) {
      const {img, lut} = E, d = img.data, W = img.width, H = img.height, s = t * .00035;
      const c1x = W * (.5 + .35 * Math.sin(s * .9)), c1y = H * (.5 + .35 * Math.cos(s * 1.1));
      const c2x = W * (.5 + .4 * Math.cos(s * .7 + 1)), c2y = H * (.5 + .3 * Math.sin(s * 1.3 + 2));
      const kx = 9 / W, ky = 9 / H;
      let p = 0;
      for (let y = 0; y < H; y++) {
        const yy = y * ky, sy = Math.sin(yy * 1.1 + s * 1.7), dy1 = (y - c1y) * ky, dy2 = (y - c2y) * ky;
        for (let x = 0; x < W; x++) {
          const xx = x * kx, dx1 = (x - c1x) * kx, dx2 = (x - c2x) * kx;
          const v = Math.sin(xx * .9 + s * 1.3) + sy + Math.sin((xx + yy) * .55 - s) +
                    Math.sin(Math.sqrt(dx1 * dx1 + dy1 * dy1) * 1.6 - s * 2.1) + Math.sin(Math.sqrt(dx2 * dx2 + dy2 * dy2) * 1.25 + s * 1.4);
          const i = (((v + 5) * 25.6 + s * 18) & 255) * 3;
          d[p] = lut[i]; d[p + 1] = lut[i + 1]; d[p + 2] = lut[i + 2]; d[p + 3] = 255; p += 4;
        }
      }
      E.octx.putImageData(img, 0, 0);
      F.cx.imageSmoothingEnabled = true; F.cx.imageSmoothingQuality = "high";
      F.cx.drawImage(E.off, 0, 0, F.w, F.h);
    },
  },
  CONTOUR: {
    // Mapa topografico: un campo de "elevacion" (suma de ondas de varias escalas que se mueven a ritmos distintos) se muestrea
    // en una malla gruesa y se trazan sus curvas de nivel con marching squares (interpolacion lineal en cada celda).
    iniciar() { return {celda: 14, cols: 0, filas: 0, v: null}; },
    medir(F, E) {
      E.celda = F.w * F.h > 2.5e6 ? 18 : 14;
      E.cols = Math.ceil(F.w / E.celda) + 1; E.filas = Math.ceil(F.h / E.celda) + 1;
      E.v = new Float32Array(E.cols * E.filas);
    },
    dibujar(F, E, t) {
      const {cx, w, h} = F, {cols, filas, celda, v} = E, s = t * .0015;
      const g = cx.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .45, Math.max(w, h) * .75);
      g.addColorStop(0, "#03101a"); g.addColorStop(1, "#010409");
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      // campo: escalas amplias lentas + escalas chicas un poco mas rapidas, cada una con su direccion y velocidad
      const k = 1 / 420;
      for (let j = 0, p = 0; j < filas; j++) {
        const y = j * celda * k;
        for (let i = 0; i < cols; i++, p++) {
          const x = i * celda * k;
          v[p] = Math.sin(x * 1.1 + s * .045) * Math.cos(y * 1.3 - s * .035) * 1.0
               + Math.sin((x * .7 - y * .9) * 1.6 + s * .06) * .55
               + Math.cos(Math.hypot(x - 1.8 - Math.sin(s * .02), y - 1.1 - Math.cos(s * .017)) * 2.4 - s * .08) * .5
               + Math.sin(x * 3.1 + Math.cos(y * 2.3 + s * .05) * 1.4 + s * .11) * .22
               + Math.cos(y * 3.7 - Math.sin(x * 2.9 - s * .07) * 1.2 - s * .09) * .18;
        }
      }
      const NIV = 22, MIN = -2.3, PASO = 4.6 / NIV;
      const principal = new Path2D(), secundaria = new Path2D();
      for (let j = 0; j < filas - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const p = j * cols + i, a = v[p], b = v[p + 1], c = v[p + cols + 1], d = v[p + cols];
          const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
          const x0 = i * celda, y0 = j * celda;
          for (let n = Math.ceil((lo - MIN) / PASO); n * PASO + MIN <= hi && n <= NIV; n++) {
            if (n < 0) continue;
            const L = n * PASO + MIN, idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            // puntos de corte en los cuatro lados (arriba, derecha, abajo, izquierda)
            const T = () => [x0 + celda * (L - a) / (b - a), y0], R = () => [x0 + celda, y0 + celda * (L - b) / (c - b)];
            const B = () => [x0 + celda * (L - d) / (c - d), y0 + celda], Iz = () => [x0, y0 + celda * (L - a) / (d - a)];
            const ruta = n % 4 === 0 ? principal : secundaria;
            const seg = (P, Q) => { ruta.moveTo(P[0], P[1]); ruta.lineTo(Q[0], Q[1]); };
            switch (idx) {
              case 1: case 14: seg(Iz(), B()); break;
              case 2: case 13: seg(B(), R()); break;
              case 3: case 12: seg(Iz(), R()); break;
              case 4: case 11: seg(T(), R()); break;
              case 6: case 9: seg(T(), B()); break;
              case 7: case 8: seg(Iz(), T()); break;
              case 5: seg(Iz(), T()); seg(B(), R()); break;
              case 10: seg(T(), R()); seg(Iz(), B()); break;
            }
          }
        }
      }
      cx.lineCap = "round"; cx.lineJoin = "round";
      cx.strokeStyle = "rgba(0,170,200,.17)"; cx.lineWidth = 1; cx.stroke(secundaria);
      cx.strokeStyle = "rgba(0,229,255,.10)"; cx.lineWidth = 5; cx.stroke(principal);      // brillo discreto
      cx.strokeStyle = "rgba(60,235,255,.48)"; cx.lineWidth = 1.2; cx.stroke(principal);
    },
  },
  GRID: {
    iniciar() { return {}; },
    medir() {},
    dibujar(F, E, t) {
      const {cx, w, h} = F, hz = h * .42, vx = w / 2, fase = (t * .00045) % 1;
      const g = cx.createLinearGradient(0, 0, 0, h);                 // cielo y suelo azul marino muy oscuro, horizonte apenas iluminado
      g.addColorStop(0, "#01020a"); g.addColorStop(.38, "#030a24"); g.addColorStop(.42, "#0a2a6e"); g.addColorStop(.47, "#030a22"); g.addColorStop(1, "#010309");
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
      const lado = (dir, alfa) => {                                  // dir 1 = suelo, -1 = techo (mas tenue)
        const alto = dir > 0 ? h - hz : hz;
        for (let i = 0; i < 26; i++) {                                // transversales: avanzan hacia la camara
          const z = (i + 1 - fase) / 26, y = hz + dir * alto * Math.pow(1 - z, 2.4);
          if (Math.abs(y - hz) < 1) continue;
          const a = alfa * Math.pow(1 - z, .9);
          cx.strokeStyle = `rgba(40,120,255,${a * .35})`; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke();
          cx.strokeStyle = `rgba(110,185,255,${a})`; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(w, y); cx.stroke();
        }
        const fondoY = dir > 0 ? h : 0;
        for (let k = -22; k <= 22; k++) {                             // radiales: convergen en el horizonte
          const xb = vx + k * w * .09, princ = k % 4 === 0;
          cx.strokeStyle = princ ? `rgba(60,150,255,${alfa * .9})` : `rgba(35,95,200,${alfa * .55})`;
          cx.lineWidth = princ ? 1.4 : 1; cx.beginPath(); cx.moveTo(vx, hz); cx.lineTo(xb, fondoY); cx.stroke();
        }
      };
      lado(1, .62); lado(-1, .22);
      cx.strokeStyle = "rgba(120,200,255,.55)"; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(0, hz); cx.lineTo(w, hz); cx.stroke();
    },
  },
};
function animacionPermitida() {
  return document.body.dataset.anim !== "NO" && !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function medirFondo() {
  const F = FONDO; if (!F.cv) return;
  F.w = Math.max(1, Math.round(window.innerWidth)); F.h = Math.max(1, Math.round(window.innerHeight));
  F.cv.width = F.w; F.cv.height = F.h;                 // 1 pixel por pixel de la ventana (sin DPR: mas ligero)
  FONDOS[F.tema].medir(F, F.est);
}
function cuadroFondo(ahora) {
  const F = FONDO; F.raf = 0;
  if (!F.tema) return;
  if (ahora - F.ultimo >= 48) {                        // tope ~20 fps (antes 30: un tercio menos de CPU, se ve igual)
    F.ultimo = ahora;
    FONDOS[F.tema].dibujar(F, F.est, ahora - F.t0);
  }
  if (F.animar && !document.hidden) F.raf = requestAnimationFrame(cuadroFondo);
}
function actualizarFondo() {
  const F = FONDO, tema = FONDOS[document.body.dataset.tema] ? document.body.dataset.tema : null;
  if (F.raf) { cancelAnimationFrame(F.raf); F.raf = 0; }
  if (!tema) {                                         // otro tema: se libera todo
    if (F.cv) { F.cv.width = F.cv.height = 0; F.cv.style.display = "none"; }
    F.tema = null; F.est = null; return;
  }
  if (!F.cv) { F.cv = document.getElementById("fondo"); F.cx = F.cv.getContext("2d", {alpha: false}); F.t0 = performance.now(); }
  if (F.tema !== tema) { F.tema = tema; F.est = FONDOS[tema].iniciar(F); medirFondo(); }
  F.cv.style.display = "block";
  F.animar = animacionPermitida();
  F.ultimo = -1e9; cuadroFondo(performance.now());     // con animaciones apagadas queda este fotograma fijo
}
let tMedirFondo = 0;
window.addEventListener("resize", () => {              // ventana / maximizada / pantalla completa
  if (!FONDO.tema) return;
  clearTimeout(tMedirFondo);
  tMedirFondo = setTimeout(() => { medirFondo(); FONDO.ultimo = -1e9; if (!FONDO.raf) cuadroFondo(performance.now()); }, 80);
});
document.addEventListener("visibilitychange", () => { if (FONDO.tema && !document.hidden && FONDO.animar && !FONDO.raf) FONDO.raf = requestAnimationFrame(cuadroFondo); });
if (window.matchMedia) matchMedia("(prefers-reduced-motion: reduce)").addEventListener?.("change", actualizarFondo);
new MutationObserver(actualizarFondo).observe(document.body, {attributes: true, attributeFilter: ["data-tema", "data-anim"]});

// ---------------------------------------------------------------- aplicar el tema de la cuenta
// perfil = {paleta, tema_personal, animaciones} (lo escribe la app). Sin perfil: el de siempre (verde).
export function aplicarTema(perfil) {
  const p = perfil && PALETAS.includes(perfil.paleta) ? perfil.paleta : "GRN";
  cfg = { tema_personal: perfil?.tema_personal || null };
  aplicarPersonal(p === "PER");
  document.body.dataset.tema = p;
  document.body.dataset.anim = perfil?.animaciones === "NO" ? "NO" : "SI";
  // el fondo de toda la pagina (tambien lo que queda debajo del contenido y el rebote al hacer scroll) sigue al tema
  // con temas animados el body es transparente (se ve el lienzo): el html toma el color base del tema, nunca blanco
  const cs = getComputedStyle(document.body), bgTema = cs.getPropertyValue("--bg").trim();
  document.documentElement.style.background = bgTema || (cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : "#0a0e0b");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = p === "PER" ? temaPersonal().bg : (CLARO[p] || getComputedStyle(document.body).getPropertyValue("--bg").trim() || "#0a0e0b");
  try {
    if (perfil) localStorage.setItem("stack.tema", JSON.stringify({ paleta: p, tema_personal: cfg.tema_personal, animaciones: document.body.dataset.anim }));
    else localStorage.removeItem("stack.tema");
  } catch { /* sin almacenamiento */ }
}

// Al abrir: el ultimo tema visto (para que no parpadee en verde mientras se entra a la cuenta).
export function temaGuardado() {
  try { return JSON.parse(localStorage.getItem("stack.tema") || "null"); } catch { return null; }
}
