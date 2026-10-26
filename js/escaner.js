// Escaner de cartas: camara continua, sin boton de disparo.
// Cada cuadro: 1) busca las orillas de la carta dentro del recuadro, 2) la endereza, 3) saca su "huella" con un modelo
// pequeno que corre en el telefono, 4) la compara contra la huella de todas las impresiones del dia.
// Solo muestra resultado cuando esta seguro (varios cuadros de acuerdo); si no, sigue leyendo solo.
import { DATOS_URL } from "./config.js";
import { datos } from "./datos.js";

const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CW = 244, CH = 340;                         // carta enderezada
const ZONA = { x0: 0.05, x1: 0.95, y0: 0.04, y1: 0.96 };   // se ignora la orilla exterior (igual que el job)
const LADO_RED = 224;
const ALTO_GUIA = 420;                            // pixeles de trabajo del recuadro guia
const VENTANA = 3;                                // cuadros que se promedian
const MARGEN = 0.03;                              // diferencia minima entre 1o y 2o lugar para responder
const IGUALES = 0.012;                            // candidatos tan parecidos como el 1o = "otras ediciones"

let ort = null, sesion = null, indice = null;     // se cargan una sola vez
let corriendo = false, video = null, flujo = null;
let ventana = [], ultimo = null, alResultado = null, alEstado = null;
const lienzo = document.createElement("canvas");
const ctx = lienzo.getContext("2d", { willReadFrequently: true });
const lienzoCarta = document.createElement("canvas"); lienzoCarta.width = CW; lienzoCarta.height = CH;
const lienzoRed = document.createElement("canvas"); lienzoRed.width = LADO_RED; lienzoRed.height = LADO_RED;
const ctxRed = lienzoRed.getContext("2d", { willReadFrequently: true });
if (location.hostname === "localhost") window.__stackDepurar = { lienzo, lienzoCarta, lienzoRed, esquinasUltimas: null };

// ---------------------------------------------------------------- carga (modelo + indice del dia)
function cargarScript(src) {
  return new Promise((ok, mal) => {
    if (window.ort) return ok(window.ort);
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous"; s.onload = () => ok(window.ort); s.onerror = () => mal(new Error("ort"));
    document.head.appendChild(s);
  });
}

export async function preparar(progreso = () => {}) {
  if (sesion && indice) return;
  const d = datos();
  const v = d.manifest?.vision;
  if (!v) throw new Error("sin_vision");
  progreso("motor");
  ort = await cargarScript(`${ORT_URL}ort.min.js`);
  ort.env.wasm.wasmPaths = ORT_URL;
  ort.env.wasm.numThreads = 1;                      // GitHub Pages no permite hilos; con 1 va sobrado
  progreso("modelo");
  sesion = await ort.InferenceSession.create(`${DATOS_URL}${v.modelo}`, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  progreso("indice");
  const base = `${DATOS_URL}${d.diaUsado}/`;
  const [meta, bin] = await Promise.all([
    fetch(`${base}vision.json`).then((r) => r.json()),
    fetch(`${base}vision.bin`).then((r) => r.arrayBuffer()),
  ]);
  indice = { dims: meta.dims, ids: meta.ids, vec: new Int8Array(bin) };
  // scryfall_id -> claves de impresion (n/f/e) del buscador, para abrir la ficha correcta
  const porSid = new Map();
  for (const fila of d.buscar.imp) {
    const sid = fila[0].split(":")[0];
    if (!porSid.has(sid)) porSid.set(sid, []);
    porSid.get(sid).push(fila);
  }
  indice.porSid = porSid;
}

// ---------------------------------------------------------------- orillas (mismo algoritmo que orillas.py del job)
const AW = 160;
function grisChico(img, w, h) {
  const ah = Math.round(h * AW / w), g = new Float32Array(AW * ah);
  for (let y = 0; y < ah; y++) {
    const sy = Math.floor(y * h / ah);
    for (let x = 0; x < AW; x++) {
      const i = (sy * w + Math.floor(x * w / AW)) * 4;
      g[y * AW + x] = 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
    }
  }
  return { g, w: AW, h: ah };
}
function suavizar({ g, w, h }) {
  const k = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16], a = new Float32Array(g.length), b = new Float32Array(g.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0; for (let i = -2; i <= 2; i++) s += k[i + 2] * g[y * w + Math.min(w - 1, Math.max(0, x + i))]; a[y * w + x] = s;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0; for (let i = -2; i <= 2; i++) s += k[i + 2] * a[Math.min(h - 1, Math.max(0, y + i)) * w + x]; b[y * w + x] = s;
  }
  return { g: b, w, h };
}
function bordes({ g, w, h }, lado, hondo = 0.42, nlin = 40) {
  const pts = [];
  const vertical = lado === "izq" || lado === "der";
  const largo = vertical ? h : w, ancho = vertical ? w : h, lim = Math.floor(hondo * ancho);
  for (let k = 0; k < nlin; k++) {
    const t = Math.floor(0.12 * largo + (0.76 * largo) * k / (nlin - 1));
    const val = (i) => vertical ? g[t * w + i] : g[i * w + t];
    const d = new Float32Array(lim);
    let max = 0;
    for (let i = 0; i < lim; i++) {
      const a = (lado === "izq" || lado === "arr") ? i : ancho - 1 - i;
      const b = (lado === "izq" || lado === "arr") ? i + 1 : ancho - 2 - i;
      d[i] = Math.abs(val(b) - val(a)); if (d[i] > max) max = d[i];
    }
    if (max < 12) continue;
    const umbral = Math.max(12, 0.45 * max);
    let i = 0; while (d[i] < umbral) i++;
    const pos = (lado === "izq" || lado === "arr") ? i + 0.5 : (ancho - 1) - i - 0.5;
    pts.push([t, pos]);
  }
  return pts;
}
function ajustarRecta(pts) {
  let ok = pts.map(() => true), a = 0, b = 0;
  for (let it = 0; it < 3; it++) {
    let n = 0, st = 0, ss = 0, stt = 0, sts = 0;
    pts.forEach(([t, s], i) => { if (ok[i]) { n++; st += t; ss += s; stt += t * t; sts += t * s; } });
    if (n < 6) return null;
    const den = n * stt - st * st; if (Math.abs(den) < 1e-9) return null;
    a = (n * sts - st * ss) / den; b = (ss - a * st) / n;
    const r = pts.map(([t, s]) => Math.abs(s - (a * t + b)));
    const rs = r.filter((_, i) => ok[i]).sort((x, y) => x - y);
    const lim = Math.max(1.5, 2.5 * rs[Math.floor(rs.length / 2)]);
    ok = r.map((v) => v <= lim);
  }
  return { a, b, frac: ok.filter(Boolean).length / pts.length };
}
function esquinas(img, W, H) {
  const g = suavizar(grisChico(img, W, H)), esc = W / g.w, r = {};
  for (const lado of ["izq", "der", "arr", "aba"]) {
    const p = bordes(g, lado);
    if (p.length < 10) return null;
    const f = ajustarRecta(p);
    if (!f || f.frac < 0.5) return null;
    r[lado] = f;
  }
  const cruce = (v, hz) => { const y = (hz.a * v.b + hz.b) / (1 - v.a * hz.a); return [(v.a * y + v.b) * esc, y * esc]; };
  const c = [cruce(r.izq, r.arr), cruce(r.der, r.arr), cruce(r.der, r.aba), cruce(r.izq, r.aba)];
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const ancho = (dist(c[0], c[1]) + dist(c[3], c[2])) / 2, alto = (dist(c[0], c[3]) + dist(c[1], c[2])) / 2;
  if (!(alto > 0) || ancho / alto < 0.55 || ancho / alto > 0.9 || ancho * alto < 0.3 * W * H) return null;
  return c;
}

// Homografia destino (carta CWxCH) -> origen (foto), por eliminacion de Gauss en 8x8.
function homografia(dst) {
  const src = [[0, 0], [CW, 0], [CW, CH], [0, CH]], A = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; }
  }
  const h = A.map((f, i) => f[8] / f[i]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function enderezar(img, W, H, c) {
  const m = homografia(c || [[0, 0], [W, 0], [W, H], [0, H]]);
  const out = new ImageData(CW, CH), o = out.data;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const X = x + 0.5, Y = y + 0.5, z = m[6] * X + m[7] * Y + 1;
    let sx = (m[0] * X + m[1] * Y + m[2]) / z - 0.5, sy = (m[3] * X + m[4] * Y + m[5]) / z - 0.5;
    sx = Math.min(W - 1.001, Math.max(0, sx)); sy = Math.min(H - 1.001, Math.max(0, sy));
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, j = (y * CW + x) * 4;
    const i00 = (y0 * W + x0) * 4, i01 = i00 + 4, i10 = i00 + W * 4, i11 = i10 + 4;
    for (let k = 0; k < 3; k++) {
      o[j + k] = img[i00 + k] * (1 - fx) * (1 - fy) + img[i01 + k] * fx * (1 - fy) + img[i10 + k] * (1 - fx) * fy + img[i11 + k] * fx * fy;
    }
    o[j + 3] = 255;
  }
  return out;
}

// ---------------------------------------------------------------- huella y busqueda
async function huella(cartaImg) {
  lienzoCarta.getContext("2d").putImageData(cartaImg, 0, 0);
  ctxRed.imageSmoothingEnabled = true; ctxRed.imageSmoothingQuality = "high";
  ctxRed.drawImage(lienzoCarta, ZONA.x0 * CW, ZONA.y0 * CH, (ZONA.x1 - ZONA.x0) * CW, (ZONA.y1 - ZONA.y0) * CH, 0, 0, LADO_RED, LADO_RED);
  const px = ctxRed.getImageData(0, 0, LADO_RED, LADO_RED).data, n = LADO_RED * LADO_RED, t = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) t[k * n + i] = (px[i * 4 + k] / 255 - MEAN[k]) / STD[k];
  const salida = await sesion.run({ pixel_values: new ort.Tensor("float32", t, [1, 3, LADO_RED, LADO_RED]) });
  const v = Object.values(salida)[0].data;
  let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = 1 / Math.sqrt(s || 1);
  return Float32Array.from(v, (x) => x * s);
}

function puntajes(q) {
  const { dims, vec } = indice, n = vec.length / dims, out = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    let s = 0; const o = j * dims;
    for (let k = 0; k < dims; k++) s += q[k] * vec[o + k];
    out[j] = s / 127;
  }
  return out;
}

function mejores(s, cuantos = 6) {
  const top = [];
  for (let j = 0; j < s.length; j++) {
    if (top.length < cuantos || s[j] > top[top.length - 1][1]) {
      top.push([j, s[j]]); top.sort((a, b) => b[1] - a[1]); if (top.length > cuantos) top.pop();
    }
  }
  return top;
}

// ---------------------------------------------------------------- bucle de la camara
async function cuadro(guia) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return;
  // recuadro guia (en pixeles del video) -> lienzo de trabajo de ALTO_GUIA de alto
  const r = guia.getBoundingClientRect(), vr = video.getBoundingClientRect();
  const escala = Math.max(vr.width / vw, vr.height / vh);                       // object-fit: cover
  const ox = (vr.width - vw * escala) / 2, oy = (vr.height - vh * escala) / 2;
  const margen = 0.06;
  let gx = (r.left - vr.left - ox) / escala, gy = (r.top - vr.top - oy) / escala, gw = r.width / escala, gh = r.height / escala;
  gx -= gw * margen; gy -= gh * margen; gw *= 1 + 2 * margen; gh *= 1 + 2 * margen;
  const W = Math.round(ALTO_GUIA * gw / gh), H = ALTO_GUIA;
  lienzo.width = W; lienzo.height = H;
  ctx.drawImage(video, gx, gy, gw, gh, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H).data;
  const c = esquinas(img, W, H);
  if (window.__stackDepurar) window.__stackDepurar.esquinasUltimas = c;
  if (!c) { alEstado?.("buscando"); ventana = []; return; }
  const q = await huella(enderezar(img, W, H, c));
  ventana.push(puntajes(q)); if (ventana.length > VENTANA) ventana.shift();
  if (ventana.length < 2) { alEstado?.("leyendo"); return; }
  const prom = new Float32Array(ventana[0].length);
  for (const s of ventana) for (let j = 0; j < s.length; j++) prom[j] += s[j] / ventana.length;
  const top = mejores(prom);
  const margenTop = top[0][1] - top[1][1];
  const sid = indice.ids[top[0][0]];
  // "otras ediciones": casi igual de parecidas (misma ilustracion reimpresa)
  const parecidas = top.filter(([, s]) => top[0][1] - s < IGUALES).map(([j]) => indice.ids[j]);
  const seguro = margenTop >= MARGEN || (parecidas.length > 1 && top[0][1] - (top[parecidas.length]?.[1] ?? 0) >= MARGEN);
  if (!seguro) { alEstado?.("leyendo"); return; }
  if (ultimo && ultimo.sid === sid) { alEstado?.("listo"); return; }
  ultimo = { sid, parecidas };
  if (navigator.vibrate) navigator.vibrate(35);
  alEstado?.("listo");
  alResultado?.({ sid, parecidas, filas: indice.porSid.get(sid) || [], otras: parecidas.slice(1).map((p) => indice.porSid.get(p)).filter(Boolean) });
}

async function bucle(guia) {
  while (corriendo) {
    const t0 = performance.now();
    try { await cuadro(guia); } catch (e) { console.error(e); }
    const espera = Math.max(0, 90 - (performance.now() - t0));          // ~10 cuadros por segundo como maximo
    await new Promise((ok) => setTimeout(ok, espera));
  }
}

export async function abrirCamara(elVideo, guia, { resultado, estado }) {
  video = elVideo; alResultado = resultado; alEstado = estado; ventana = []; ultimo = null;
  flujo = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, focusMode: "continuous" },
  });
  video.srcObject = flujo;
  await video.play();
  corriendo = true;
  bucle(guia);
}

export function cerrarCamara() {
  corriendo = false;
  if (flujo) flujo.getTracks().forEach((t) => t.stop());
  flujo = null;
  if (video) video.srcObject = null;
}

export function olvidarUltimo() { ultimo = null; ventana = []; }

// Para pruebas: reconocer una imagen fija (ImageData del recuadro guia).
export async function reconocerImagen(img, W, H) {
  const c = esquinas(img.data, W, H);
  const s = puntajes(await huella(enderezar(img.data, W, H, c)));
  return mejores(s, 5).map(([j, p]) => [indice.ids[j], p]);
}
