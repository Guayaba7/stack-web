// Temas de Stack en la web. El tema se elige en la app (perk de la app) y viaja cifrado en la cuenta; aqui solo se APLICA.
// Lo que sigue esta copiado de la app (S-0.6.7-BETA) para que se vea y se mueva igual: colores del tema personalizado
// (PER) y fondos animados de pantalla completa (GALAXY, PLASMA, CONTOUR, GRID).
export const PALETAS = ["GRN", "VLT", "GRY", "RED", "RNB", "NVD", "HLW", "SNV", "ALG", "SOL", "DREAM", "PLASMA", "GRID", "CONTOUR", "GALAXY", "CRT", "FLUJO", "CIRCUITO", "LAVA", "CONSTELACION", "BRASAS", "ALBERCA", "LLUVIA", "RETRO", "MANA", "PERG", "PER"];
const CLARO = { ALG: "#fff4fa", DREAM: "#fcf6fb", PERG: "#efe4cc" };
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
// ---- temas animados de 0.9.2: FLUJO, CIRCUITO, LAVA, CONSTELACION, BRASAS, ALBERCA, LLUVIA, RETRO y MANA.
// Cada uno: init(W, H) -> estado, draw(cx, W, H, t (s), E, dt (s)), y opcional ui(t, E) -> variables de color de la app que
// siguen al efecto (como GALAXY). escala < 1 = se dibuja en un lienzo chico y se estira (efectos con desenfoque: mucho mas ligero).
const FONDOS_092 = (() => {
  const R = (a, b) => a + Math.random() * (b - a), TAU = Math.PI * 2;
  const hsl3 = (h, s, l) => { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return [f(0) * 255, f(8) * 255, f(4) * 255]; };
  const cuantos = (W, H, por, min, max) => Math.max(min, Math.min(max, Math.round(W * H / por)));
  const D = {
    FLUJO: {                                         // particulas que siguen corrientes y dejan trazos de colores
      init(W, H) { return {p: Array.from({length: cuantos(W, H, 220, 300, 2200)}, () => [R(0, W), R(0, H)])}; },
      draw(x, W, H, t, E, dt) {
        x.fillStyle = "rgba(5,5,8,.06)"; x.fillRect(0, 0, W, H);
        for (const q of E.p) {
          const a = Math.sin(q[0] * .006 + t * .3) * 2 + Math.cos(q[1] * .008 - t * .2) * 2, nx = q[0] + Math.cos(a) * 55 * dt, ny = q[1] + Math.sin(a) * 55 * dt;
          x.strokeStyle = `hsla(${(a * 60 + t * 20 + 720) % 360},90%,65%,.5)`; x.beginPath(); x.moveTo(q[0], q[1]); x.lineTo(nx, ny); x.stroke(); q[0] = nx; q[1] = ny;
          if (nx < 0 || nx > W || ny < 0 || ny > H || Math.random() < .004) { q[0] = R(0, W); q[1] = R(0, H); }
        }
      }},
    CIRCUITO: {                                      // pistas de cobre con pulsos cian
      init(W, H) {
        const rutas = [], s = 14;
        for (let i = 0; i < cuantos(W, H, 9000, 20, 140); i++) {
          let px = Math.round(R(0, W) / s) * s, py = Math.round(R(0, H) / s) * s; const pts = [[px, py]];
          for (let k = 0; k < 8; k++) { if (k % 2) px += (Math.random() < .5 ? -1 : 1) * s * (1 + (Math.random() * 7 | 0)); else py += (Math.random() < .5 ? -1 : 1) * s * (1 + (Math.random() * 5 | 0)); pts.push([px, py]); }
          let L = 0; for (let k = 1; k < pts.length; k++) L += Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]);
          rutas.push({pts, L, f: R(0, 1), v: R(.12, .35)});
        }
        return {rutas};
      },
      draw(x, W, H, t, E, dt) {
        x.fillStyle = "#03080d"; x.fillRect(0, 0, W, H); x.lineWidth = 2;
        for (const r of E.rutas) {
          x.strokeStyle = "rgba(190,130,60,.42)"; x.beginPath(); r.pts.forEach(([a, b], k) => k ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke();
          x.fillStyle = "rgba(220,160,80,.7)"; for (const [a, b] of [r.pts[0], r.pts[r.pts.length - 1]]) { x.beginPath(); x.arc(a, b, 3, 0, TAU); x.fill(); }
          r.f = (r.f + r.v * dt) % 1; let d = r.f * r.L, p = null;
          for (let k = 1; k < r.pts.length; k++) { const [a, b] = r.pts[k - 1], [c, e] = r.pts[k], s = Math.abs(c - a) + Math.abs(e - b); if (d <= s) { const q = s ? d / s : 0; p = [a + (c - a) * q, b + (e - b) * q]; break; } d -= s; }
          if (p) { const g = x.createRadialGradient(p[0], p[1], 0, p[0], p[1], 11); g.addColorStop(0, "rgba(120,255,240,1)"); g.addColorStop(1, "rgba(60,240,230,0)"); x.fillStyle = g; x.beginPath(); x.arc(p[0], p[1], 11, 0, TAU); x.fill(); }
        }
        x.lineWidth = 1;
      }},
    LAVA: {                                          // lampara de lava: burbujas que suben, bajan y se funden
      escala: .25,
      init() { return {b: Array.from({length: 10}, (_, i) => ({x: R(.08, .92), f: R(.12, .3), ph: R(0, 6), r: R(.07, .14), c: i % 2}))}; },
      draw(x, W, H, t, E) {
        x.fillStyle = "#0e0410"; x.fillRect(0, 0, W, H); x.filter = `blur(${Math.max(3, W * .012)}px)`; x.globalCompositeOperation = "lighter";
        for (const b of E.b) { const y = H * (.5 + .45 * Math.sin(t * b.f + b.ph)), xx = W * b.x + Math.sin(t * .5 + b.ph) * W * .06; x.fillStyle = b.c ? "rgba(255,80,170,.85)" : "rgba(255,150,40,.85)"; x.beginPath(); x.arc(xx, y, b.r * Math.min(W, H) * .85, 0, TAU); x.fill(); }
        x.filter = "none"; x.globalCompositeOperation = "source-over";
      }},
    CONSTELACION: {                                  // estrellas que flotan y se unen con lineas doradas al acercarse
      init(W, H) { return {n: Array.from({length: cuantos(W, H, 14000, 40, 150)}, () => ({x: R(0, W), y: R(0, H), vx: R(-14, 14), vy: R(-14, 14)}))}; },
      draw(x, W, H, t, E, dt) {
        const g = x.createRadialGradient(W * .6, H * .4, 0, W * .6, H * .4, W); g.addColorStop(0, "#151040"); g.addColorStop(1, "#03020f"); x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (const a of E.n) { a.x += a.vx * dt; a.y += a.vy * dt; if (a.x < 0 || a.x > W) a.vx *= -1; if (a.y < 0 || a.y > H) a.vy *= -1; }
        const L = 110;
        for (let i = 0; i < E.n.length; i++) for (let j = i + 1; j < E.n.length; j++) { const a = E.n[i], b = E.n[j], dx = a.x - b.x, dy = a.y - b.y; if (Math.abs(dx) > L || Math.abs(dy) > L) continue; const d = Math.hypot(dx, dy);
          if (d < L) { x.strokeStyle = `rgba(255,215,140,${(1 - d / L) * .55})`; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
        x.fillStyle = "#fff4d8"; for (const a of E.n) { x.beginPath(); x.arc(a.x, a.y, 1.7, 0, TAU); x.fill(); }
      }},
    BRASAS: {                                        // chispas que suben desde un fuego abajo
      init(W, H) { return {p: Array.from({length: cuantos(W, H, 4500, 120, 500)}, () => ({x: R(0, W), y: R(0, H), v: R(25, 85), s: R(.6, 2.6), f: R(0, 6)}))}; },
      draw(x, W, H, t, E, dt) {
        x.fillStyle = "rgba(9,3,3,.35)"; x.fillRect(0, 0, W, H);
        const g = x.createRadialGradient(W / 2, H * 1.15, 10, W / 2, H * 1.15, H * .95); g.addColorStop(0, `rgba(255,90,20,${.35 + .08 * Math.sin(t * 3)})`); g.addColorStop(1, "rgba(255,60,10,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = "lighter";
        for (const p of E.p) { p.y -= p.v * dt; p.x += Math.sin(t * 1.5 + p.f) * .6; if (p.y < -5) { p.y = H + 5; p.x = R(0, W); }
          const a = Math.max(0, p.y / H) * (.6 + .4 * Math.sin(t * 8 + p.f)); x.fillStyle = `rgba(255,${120 + (p.f * 20 | 0)},40,${a})`; x.beginPath(); x.arc(p.x, p.y, p.s, 0, TAU); x.fill(); }
        x.globalCompositeOperation = "source-over";
      }},
    ALBERCA: {                                       // reflejos de luz del fondo de una alberca
      escala: .08,
      init() { return {}; },
      draw(x, w, h, t) {
        const img = x.createImageData(w, h), d = img.data, s = t * .35, z = 96 / w;
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const u = i * z * .13, v = j * z * .13, c = Math.abs(Math.sin(u + Math.sin(v + s) * 1.3 + s) + Math.sin(v * 1.2 + Math.sin(u * .8 - s) * 1.4 - s * .7));
          const l = Math.pow(Math.max(0, 1 - c * .6), 4) * .5, k = (j * w + i) * 4; d[k] = 3 + l * 90; d[k + 1] = 22 + l * 200; d[k + 2] = 28 + l * 200; d[k + 3] = 255;
        }
        x.putImageData(img, 0, 0);
      }},
    LLUVIA: {                                        // columnas de simbolos que caen, azul hielo
      init(W, H) { const c = 14; return {c, cols: Array.from({length: Math.ceil(W / c)}, () => ({y: R(-H, 0), v: R(45, 130)}))}; },
      draw(x, W, H, t, E, dt) {
        x.fillStyle = "rgba(2,6,12,.18)"; x.fillRect(0, 0, W, H); x.font = "13px monospace";
        const G = "WUBRG0123456789ABCDEFΣΔΛ✦◇";
        E.cols.forEach((c, i) => { c.y += c.v * dt; if (c.y > H + 60) { c.y = R(-80, 0); c.v = R(45, 130); }
          x.fillStyle = "#e8f8ff"; x.fillText(G[(Math.random() * G.length) | 0], i * E.c, c.y); x.fillStyle = "rgba(90,180,255,.7)"; x.fillText(G[(Math.random() * G.length) | 0], i * E.c, c.y - 14); });
      }},
    RETRO: {                                         // sol de rayas, montanas y palmeras (los nombres ciclan por el atardecer con CSS)
      init() { return {}; },
      draw(x, W, H, t) {
        const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#12052a"); g.addColorStop(.55, "#6b1a5c"); g.addColorStop(.75, "#ff6f61"); g.addColorStop(1, "#2a0a2a"); x.fillStyle = g; x.fillRect(0, 0, W, H);
        const r = H * .26, sy = H * .6 + Math.sin(t * .2) * 10, sg = x.createLinearGradient(0, sy - r, 0, sy + r); sg.addColorStop(0, "#ffe66b"); sg.addColorStop(1, "#ff3d8a"); x.fillStyle = sg; x.beginPath(); x.arc(W * .5, sy, r, 0, TAU); x.fill();
        x.save(); x.beginPath(); x.arc(W * .5, sy, r, 0, TAU); x.clip(); x.fillStyle = "#3a0c3e";   // rayas recortadas al sol; bajan sin brincos
        const N = 9, fa = (t * .05) % 1, y0 = sy - r * .3, alto = r * 1.3;
        for (let k = 0; k < N; k++) { const u = (k + fa) / N, yy = y0 + u * alto, g2 = 1.5 + u * r * .13; x.globalAlpha = Math.min(1, u * 6); x.fillRect(W * .5 - r, yy - g2 / 2, r * 2, g2); }
        x.restore();
        x.fillStyle = "#1a0620"; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 12) x.lineTo(i, H * .78 - Math.abs(Math.sin(i * .006)) * H * .12 - Math.abs(Math.sin(i * .017)) * H * .05); x.lineTo(W, H); x.fill();
        x.strokeStyle = "#0b0310"; x.lineWidth = 4;
        for (const px of [W * .1, W * .88]) { const top = H * .5; x.beginPath(); x.moveTo(px, H); x.quadraticCurveTo(px + 10, H * .7, px + 18, top); x.stroke();
          for (let k = 0; k < 7; k++) { const a = k * .95 + Math.sin(t + k) * .08; x.beginPath(); x.moveTo(px + 18, top); x.quadraticCurveTo(px + 18 + Math.cos(a) * 40, top + Math.sin(a) * 16 - 12, px + 18 + Math.cos(a) * 64, top + Math.abs(Math.sin(a)) * 30); x.stroke(); } }
        x.lineWidth = 1;
      }},
    MANA: {                                          // ciclo de mana: domina un color y toda la app se pinta de el
      init(W, H) { return {p: Array.from({length: cuantos(W, H, 9000, 80, 260)}, () => ({x: R(0, W), y: R(0, H), r: R(1, 3.2), v: R(12, 36)})), c: [250, 240, 200]}; },
      draw(x, W, H, t, E, dt) {
        const C = [[250, 240, 200], [80, 160, 255], [170, 110, 200], [255, 90, 60], [80, 210, 120]], f = (t / 7) % 5, i = Math.floor(f), a = C[i], b = C[(i + 1) % 5];
        const k = Math.max(0, (f - i - .8) * 5); E.c = a.map((v, j) => v + (b[j] - v) * k);
        const c = E.c.map(Math.round).join(",");
        x.fillStyle = "rgba(7,6,9,.25)"; x.fillRect(0, 0, W, H);
        const g = x.createRadialGradient(W * .5, H * 1.1, 0, W * .5, H * 1.1, H * 1.2); g.addColorStop(0, `rgba(${c},.35)`); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = "lighter"; x.fillStyle = `rgba(${c},.6)`;
        for (const p of E.p) { p.y -= p.v * dt; if (p.y < 0) { p.y = H; p.x = R(0, W); } x.beginPath(); x.arc(p.x, p.y, p.r, 0, TAU); x.fill(); }
        x.globalCompositeOperation = "source-over";
      },
      ui(t, E) { const c = E.c.map(Math.round).join(","); return {acc: `rgb(${c})`, ani: `rgb(${c})`, sel: `rgba(${c},.22)`, line: `rgba(${c},.36)`, selline: `rgba(${c},.6)`, sel2: `rgba(${c},.12)`}; }},
  };
  void hsl3;
  // adaptador al motor de fondos de Stack (FONDOS: iniciar / medir / dibujar)
  const out = {};
  for (const [k, d] of Object.entries(D)) out[k] = {
    iniciar(F) { return {tp: null}; },
    medir(F, est) {
      if (d.escala) { est.cv = est.cv || document.createElement("canvas"); est.cv.width = Math.max(8, Math.round(F.w * d.escala)); est.cv.height = Math.max(8, Math.round(F.h * d.escala)); est.cx = est.cv.getContext("2d"); }
      est.W = d.escala ? est.cv.width : F.w; est.H = d.escala ? est.cv.height : F.h; est.E = d.init(est.W, est.H);
      F.cx.fillStyle = "#000"; F.cx.fillRect(0, 0, F.w, F.h);
    },
    dibujar(F, est, ms) {
      const t = ms / 1000, dt = est.tp == null ? .05 : Math.max(0, Math.min(.1, t - est.tp)); est.tp = t;
      if (d.escala) { d.draw(est.cx, est.W, est.H, t, est.E, dt); F.cx.imageSmoothingEnabled = true; F.cx.drawImage(est.cv, 0, 0, F.w, F.h); }
      else d.draw(F.cx, F.w, F.h, t, est.E, dt);
      if (d.ui) { const u = d.ui(t, est.E), st = document.body.style; for (const v in u) st.setProperty("--" + v, u[v]); FONDO.uiVars = Object.keys(u); }
    },
  };
  return out;
})();
Object.assign(FONDOS, FONDOS_092);

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
  document.body.classList.toggle("lienzo", !!tema && !!FONDOS_092[tema]);
  if (F.uiVars && F.tema !== tema) { for (const v of F.uiVars) if (document.body.dataset.tema !== "PER" || v === "ani") document.body.style.removeProperty("--" + v); F.uiVars = null; }
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
