// Escaner de cartas: camara continua, sin boton de disparo. Prioridad: velocidad, pero SOLO responde cuando esta seguro.
//
// Cada cuadro (~10 por segundo):
//   1) busca las orillas de la carta dentro del recuadro y la endereza;
//   2) saca su huella visual (modelo pequeno en el telefono) y la compara con todas las impresiones del dia
//      -> esto da candidatos rapidos, pero por si solo ya NO basta para responder.
// En paralelo, un lector de texto (OCR) en segundo plano:
//   3) lee la barra del NOMBRE y la empareja contra todos los nombres (ingles y espanol, tolerando errores);
//      el nombre confirma la carta y la huella visual solo elige la edicion entre las de ese nombre;
//   4) si el nombre no se deja leer (otro idioma, letra rara), lee la caja de TEXTO DE REGLAS y la compara con el
//      texto oficial de los candidatos visuales (de Scryfall); si dos cartas distintas empatan, no adivina.
// Una vez fijada una carta no cambia sola: solo cambia si se lee con seguridad otro nombre o si la carta sale del recuadro.
import { DATOS_URL } from "./config.js";
import { datos } from "./datos.js";
import { normalizar } from "./buscar.js";
import * as scry from "./scryfall.js";

const ORT_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
// Lector de texto: PP-OCRv5 "latin" (PaddleOCR) en ONNX. Lee ingles y espanol (acentos), letra clara u oscura, ~25 ms por linea.
const OCR = { modelo: "modelo/ocr-latin-1.onnx", dicc: "modelo/ocr-latin-1.txt", alto: 48 };
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CW = 244, CH = 340;                                  // carta enderezada (unidades de la homografia)
const ZONA = { x0: 0.05, x1: 0.95, y0: 0.04, y1: 0.96 };   // zona de la huella visual (igual que el job)
const BANDA_NOMBRE = { x0: 0.055, x1: 0.80, y0: 0.035, y1: 0.105 };
const CAJA_TEXTO = { x0: 0.08, x1: 0.92, y0: 0.625, y1: 0.90 };
// Linea de coleccion (cartas desde 2020): arriba "0107 R", abajo "DMU • EN". Sirve para elegir la edicion exacta.
const CODIGO = [{ x0: 0.03, x1: 0.30, y0: 0.935, y1: 0.961 }, { x0: 0.03, x1: 0.30, y0: 0.955, y1: 0.981 }];
const AVISO_DIFICIL_MS = 3000;                             // sin poder leer: sugerir acercar o buscar a mano
const LADO_RED = 224;
const ALTO_GUIA = 420;                                     // pixeles de trabajo del recuadro guia
const VENTANA = 4;                                         // cuadros visuales que se promedian
const IGUALES = 0.012;                                     // ediciones casi identicas -> "otras ediciones"
const NOMBRE_SEGURO = 0.86;                                // parecido minimo para fijar con UNA lectura
const NOMBRE_DOBLE = 0.72;                                 // ... o con DOS lecturas que coinciden
const LECTURAS_ANTES_DE_TEXTO = 3;                         // lecturas de nombre fallidas antes de leer las reglas
const SIN_CARTA_PARA_SOLTAR = 4;                           // cuadros seguidos sin carta para "soltar" la actual
const OTRA_CARTA = 0.55;                                   // parecido visual con la carta fijada por debajo = ya es otra
const SOLO_IMAGEN_MARGEN = 0.06;                           // ultimo recurso (sin texto legible): margen visual muy alto
const SOLO_IMAGEN_TRAS_MS = 2500;                          // ... y solo despues de este tiempo sin poder leer texto

let ort = null, sesion = null, indice = null, lector = null, letras = null, nombres = null;
let corriendo = false, video = null, flujo = null, alResultado = null, alEstado = null;
let estado = nuevoEstado();
const lienzo = document.createElement("canvas");
const ctx = lienzo.getContext("2d", { willReadFrequently: true });
const lienzoAlto = document.createElement("canvas");
const ctxAlto = lienzoAlto.getContext("2d", { willReadFrequently: true });
const lienzoCarta = document.createElement("canvas"); lienzoCarta.width = CW; lienzoCarta.height = CH;
const lienzoRed = document.createElement("canvas"); lienzoRed.width = LADO_RED; lienzoRed.height = LADO_RED;
const ctxRed = lienzoRed.getContext("2d", { willReadFrequently: true });
const lienzoOcr = document.createElement("canvas");
const depurar = location.hostname === "localhost";
if (depurar) window.__stackDepurar = { lienzo, lienzoCarta, lienzoOcr, eventos: [] };

function nuevoEstado() {
  return {
    ventana: [],            // puntajes visuales de los ultimos cuadros
    votos: new Map(),       // grupo de nombre -> {n, mejor}
    fallidas: 0,            // lecturas de nombre sin resultado para esta carta
    leyendo: false,         // OCR ocupado
    fijada: null,           // {grupo, sid, desde, q}
    sinCarta: 0,
    distinta: 0,            // cuadros seguidos en que la imagen ya no se parece a la fijada
    desde: performance.now(),
    ultimaQ: null,
  };
}

function anotar(...x) { if (depurar) window.__stackDepurar.eventos.push([Math.round(performance.now()), ...x]); }

// ---------------------------------------------------------------- carga (motor, modelo, indice, lector de texto)
function cargarScript(src, global) {
  return new Promise((ok, mal) => {
    if (window[global]) return ok(window[global]);
    const s = document.createElement("script");
    s.src = src; s.crossOrigin = "anonymous"; s.onload = () => ok(window[global]); s.onerror = () => mal(new Error(global));
    document.head.appendChild(s);
  });
}

async function prepararLector() {
  const [s, txt] = await Promise.all([
    ort.InferenceSession.create(OCR.modelo, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }),
    fetch(OCR.dicc).then((r) => r.text()),
  ]);
  letras = ["", ...txt.split("\n").filter((l, i, a) => i < a.length - 1 || l !== ""), " "];   // 0 = vacio (CTC), al final el espacio
  return s;
}

// Una linea de texto (ImageData en grises, ya de OCR.alto pixeles de alto) -> {texto, confianza}
async function leerLinea(im) {
  const w = im.width, h = im.height, n = w * h, x = new Float32Array(3 * n), d = im.data;
  for (let i = 0; i < n; i++) { const v = d[i * 4] / 127.5 - 1; x[i] = v; x[n + i] = v; x[2 * n + i] = v; }
  const out = Object.values(await lector.run({ x: new ort.Tensor("float32", x, [1, 3, h, w]) }))[0];
  const [, T, C] = out.dims, p = out.data;
  let texto = "", prev = 0, suma = 0, cuenta = 0;
  for (let t = 0; t < T; t++) {
    let m = 0, mv = -Infinity;
    for (let c = 0; c < C; c++) { const v = p[t * C + c]; if (v > mv) { mv = v; m = c; } }
    if (m !== 0 && m !== prev) { texto += letras[m] ?? ""; suma += mv; cuenta++; }
    prev = m;
  }
  return { texto, confianza: cuenta ? suma / cuenta : 0 };
}

// Diccionario de nombres para emparejar lo leido: nombre completo, cara frontal (cartas de dos caras) y alias en espanol.
function prepararNombres(buscar) {
  const lista = [];
  buscar.nombres.forEach(([nombre, texto], grupo) => {
    const vistos = new Set();
    const agregar = (t) => { if (t && t.length >= 3 && !vistos.has(t)) { vistos.add(t); lista.push({ t, grupo }); } };
    for (const parte of texto.split("|")) agregar(parte);
    if (nombre.includes(" // ")) agregar(normalizar(nombre.split(" // ")[0]));
  });
  return lista;
}

export async function preparar(progreso = () => {}) {
  if (sesion && indice && lector) return;
  const d = datos();
  const v = d.manifest?.vision;
  if (!v) throw new Error("sin_vision");
  progreso("motor");
  ort = await cargarScript(`${ORT_URL}ort.min.js`, "ort");
  ort.env.wasm.wasmPaths = ORT_URL;
  ort.env.wasm.numThreads = 1;
  const prometeLector = lector ? Promise.resolve(lector) : prepararLector();       // en paralelo con lo demas
  progreso("modelo");
  if (!sesion) sesion = await ort.InferenceSession.create(`${DATOS_URL}${v.modelo}`, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  progreso("indice");
  if (!indice) {
    const base = `${DATOS_URL}${d.diaUsado}/`;
    const [meta, bin] = await Promise.all([
      fetch(`${base}vision.json`).then((r) => r.json()),
      fetch(`${base}vision.bin`).then((r) => r.arrayBuffer()),
    ]);
    indice = { dims: meta.dims, ids: meta.ids, vec: new Int8Array(bin), pos: new Map(meta.ids.map((s, i) => [s, i])) };
    indice.porSid = new Map();
    indice.grupoDeSid = new Map();
    d.buscar.nombres.forEach(([, , imps], grupo) => {
      for (const i of imps) {
        const fila = d.buscar.imp[i], sid = fila[0].split(":")[0];
        if (!indice.porSid.has(sid)) indice.porSid.set(sid, []);
        indice.porSid.get(sid).push(fila);
        indice.grupoDeSid.set(sid, grupo);
      }
    });
    nombres = prepararNombres(d.buscar);
  }
  progreso("lector");
  lector = await prometeLector;
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
  // Con borde negro sobre mesa oscura, la orilla de abajo suele confundirse con el final de la caja de texto.
  // Arriba y los lados salen bien (ahi se lee el nombre): si la proporcion no es la de una carta (63x88 mm),
  // la orilla de abajo se reconstruye con el ancho de arriba siguiendo la direccion de los lados.
  if (Math.abs(ancho / alto - 63 / 88) > 0.025) {
    const arriba = dist(c[0], c[1]), largo = arriba * 88 / 63;
    const dir = (p, q) => { const L = dist(p, q) || 1; return [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; };
    const dI = dir(c[0], c[3]), dD = dir(c[1], c[2]);
    c[3] = [c[0][0] + dI[0] * largo, c[0][1] + dI[1] * largo];
    c[2] = [c[1][0] + dD[0] * largo, c[1][1] + dD[1] * largo];
  }
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

// Muestra una region de la carta (en fracciones) a una imagen de salida, desde la foto original.
function muestrear(img, W, H, c, r, outW, outH) {
  const m = homografia(c), out = new ImageData(outW, outH), o = out.data;
  for (let v = 0; v < outH; v++) for (let u = 0; u < outW; u++) {
    const X = (r.x0 + (u + 0.5) / outW * (r.x1 - r.x0)) * CW, Y = (r.y0 + (v + 0.5) / outH * (r.y1 - r.y0)) * CH;
    const z = m[6] * X + m[7] * Y + 1;
    let sx = (m[0] * X + m[1] * Y + m[2]) / z - 0.5, sy = (m[3] * X + m[4] * Y + m[5]) / z - 0.5;
    sx = Math.min(W - 1.001, Math.max(0, sx)); sy = Math.min(H - 1.001, Math.max(0, sy));
    const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0, j = (v * outW + u) * 4;
    const i00 = (y0 * W + x0) * 4, i01 = i00 + 4, i10 = i00 + W * 4, i11 = i10 + 4;
    let g = 0;
    for (let k = 0; k < 3; k++) {
      const val = img[i00 + k] * (1 - fx) * (1 - fy) + img[i01 + k] * fx * (1 - fy) + img[i10 + k] * (1 - fx) * fy + img[i11 + k] * fx * fy;
      g += val * (k === 0 ? 0.299 : k === 1 ? 0.587 : 0.114);
    }
    o[j] = o[j + 1] = o[j + 2] = g; o[j + 3] = 255;
  }
  // estirar contraste (1% - 99%) para que el OCR vea letras limpias con poca luz o reflejo
  const hist = new Uint32Array(256);
  for (let j = 0; j < o.length; j += 4) hist[o[j] | 0]++;
  const n = outW * outH; let a = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { a += hist[i]; if (a > n * 0.01) { lo = i; break; } }
  a = 0; for (let i = 255; i >= 0; i--) { a += hist[i]; if (a > n * 0.01) { hi = i; break; } }
  const esc = 255 / Math.max(1, hi - lo);
  for (let j = 0; j < o.length; j += 4) o[j] = o[j + 1] = o[j + 2] = Math.min(255, Math.max(0, (o[j] - lo) * esc));
  return out;
}

// ---------------------------------------------------------------- huella visual y busqueda
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

function promedio() {
  const v = estado.ventana;
  if (!v.length) return null;
  const p = new Float32Array(v[0].length);
  for (const s of v) for (let j = 0; j < s.length; j++) p[j] += s[j] / v.length;
  return p;
}

function mejores(s, cuantos) {
  const top = [];
  for (let j = 0; j < s.length; j++) {
    if (top.length < cuantos || s[j] > top[top.length - 1][1]) {
      top.push([j, s[j]]); top.sort((a, b) => b[1] - a[1]); if (top.length > cuantos) top.pop();
    }
  }
  return top;
}

// ---------------------------------------------------------------- emparejar texto leido
function distancia(a, b, tope) {
  // Levenshtein con corte: si ya no puede quedar <= tope, regresa tope + 1
  const n = a.length, m = b.length;
  if (Math.abs(n - m) > tope) return tope + 1;
  let prev = new Uint16Array(m + 1), cur = new Uint16Array(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i; let minFila = cur[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const c = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (cur[j] < minFila) minFila = cur[j];
    }
    if (minFila > tope) return tope + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[m];
}

function parecido(leido, nombre) {
  const tope = Math.floor(Math.max(leido.length, nombre.length) * 0.4);
  let mejor = 1 - distancia(leido, nombre, tope) / Math.max(leido.length, nombre.length);
  // el OCR a veces agrega basura al final (costo de mana) o corta el nombre: probar contra el inicio
  if (leido.length > nombre.length + 2) {
    const corto = leido.slice(0, nombre.length);
    mejor = Math.max(mejor, (1 - distancia(corto, nombre, tope) / nombre.length) - 0.04);
  }
  return mejor;
}

function emparejarNombre(texto) {
  const leido = normalizar(texto);
  if (leido.replace(/ /g, "").length < 3) return null;
  const porGrupo = new Map();                                   // mejor parecido por carta
  for (const { t, grupo } of nombres) {
    if (Math.abs(t.length - leido.length) > Math.max(6, leido.length * 0.5)) continue;
    const s = parecido(leido, t);
    if (s > 0.5 && s > (porGrupo.get(grupo) ?? 0)) porGrupo.set(grupo, s);
  }
  const orden = [...porGrupo].sort((x, y) => y[1] - x[1]);
  if (!orden.length) return null;
  const [g1, s1] = orden[0];
  // empate de nombre (p. ej. "Lightning Bolt" y "Emeritus of Conflict // Lightning Bolt"): decide la imagen
  const empatados = orden.filter(([, s]) => s1 - s < 0.04).map(([g]) => g);
  let grupo = g1;
  if (empatados.length > 1) {
    const p = promedio();
    const vis = (g) => {
      if (!p) return -1;
      let m = -1;
      for (const i of datos().buscar.nombres[g][2]) {
        const sid = datos().buscar.imp[i][0].split(":")[0];
        if (indice.pos.has(sid)) m = Math.max(m, p[indice.pos.get(sid)]);
      }
      return m;
    };
    const v = empatados.map((g) => [g, vis(g)]).sort((x, y) => y[1] - x[1]);
    // si la imagen tampoco decide, gana el nombre que coincide completo (no solo una cara)
    const exacto = empatados.find((g) => normalizar(datos().buscar.nombres[g][0]) === leido);
    grupo = v[0][1] - (v[1]?.[1] ?? -1) >= 0.03 ? v[0][0] : (exacto ?? v[0][0]);
  }
  const segundo = orden.find(([g]) => !empatados.includes(g))?.[1] ?? 0;
  return { grupo, s: porGrupo.get(grupo), segundo, leido };
}

// La edicion: entre las impresiones de ese nombre, la que mas se parece en imagen (promedio de los ultimos cuadros).
function elegirEdicion(grupo) {
  const d = datos(), imps = d.buscar.nombres[grupo][2];
  const sids = [...new Set(imps.map((i) => d.buscar.imp[i][0].split(":")[0]))];
  const p = promedio();
  const conPuntaje = sids.map((sid) => [sid, p && indice.pos.has(sid) ? p[indice.pos.get(sid)] : -1]).sort((x, y) => y[1] - x[1]);
  const top = conPuntaje[0];
  const parecidas = conPuntaje.filter(([, s]) => top[1] - s < IGUALES).map(([sid]) => sid);
  return { sid: top[0], parecidas, todas: conPuntaje.map(([sid]) => sid) };
}

function fijar(grupo, por) {
  const ed = elegirEdicion(grupo);
  estado.fijada = { grupo, sid: ed.sid, desde: performance.now(), por, q: null };   // referencia: el siguiente cuadro
  anotar("fijada", datos().buscar.nombres[grupo][0], ed.sid, por);
  if (navigator.vibrate) navigator.vibrate(35);
  alEstado?.("listo");
  publicar(ed);
}

function publicar(ed) {
  const otras = ed.todas.filter((s) => s !== ed.sid).slice(0, 8).map((s) => indice.porSid.get(s)).filter(Boolean);
  // primero las de imagen casi identica, luego el resto de ediciones del mismo nombre
  otras.sort((a, b) => (ed.parecidas.includes(b[0][0].split(":")[0]) ? 1 : 0) - (ed.parecidas.includes(a[0][0].split(":")[0]) ? 1 : 0));
  alResultado?.({ sid: ed.sid, filas: indice.porSid.get(ed.sid) || [], otras });
}

// ---------------------------------------------------------------- lecturas de texto (en segundo plano)
async function leerCodigo(foto) {
  const { img, W, H, c } = foto;
  let texto = "";
  for (const r of CODIGO) {
    const ancho = Math.round(OCR.alto * ((r.x1 - r.x0) * CW) / ((r.y1 - r.y0) * CH));
    const l = await leerLinea(muestrear(img, W, H, c, r, ancho, OCR.alto));
    if (l.confianza >= 0.4) texto += " " + l.texto;
  }
  anotar("ocr-codigo", texto.trim());
  return texto.toUpperCase();
}

// Con el codigo leido, entre las ediciones del nombre fijado: set (vale 2) y numero (vale 1). Solo si hay un ganador claro.
function edicionPorCodigo(texto, sids) {
  const fichas = new Set(texto.match(/[A-Z0-9]{2,5}/g) || []);
  const numeros = new Set((texto.match(/\d{1,4}/g) || []).map((n) => String(Number(n))));
  const d = datos(), puntos = [];
  for (const sid of sids) {
    const fila = indice.porSid.get(sid)?.[0]; if (!fila) continue;
    const set = fila[1].toUpperCase(), num = String(fila[2]).replace(/^0+/, "");
    const pts = (fichas.has(set) ? 2 : 0) + (numeros.has(num.replace(/\D+$/, "")) ? 1 : 0);
    if (pts) puntos.push([sid, pts]);
  }
  puntos.sort((a, b) => b[1] - a[1]);
  if (!puntos.length || puntos[0][1] < 2 || (puntos[1] && puntos[1][1] === puntos[0][1])) return null;
  return puntos[0][0];
}

async function leerNombre(foto) {
  const { img, W, H, c } = foto;
  const r = BANDA_NOMBRE, ancho = Math.round(OCR.alto * ((r.x1 - r.x0) * CW) / ((r.y1 - r.y0) * CH));
  const band = muestrear(img, W, H, c, r, ancho, OCR.alto);
  const t0 = performance.now();
  const { texto, confianza } = await leerLinea(band);
  anotar("ocr-nombre", Math.round(performance.now() - t0), texto, confianza.toFixed(2));
  if (depurar) { lienzoOcr.width = band.width; lienzoOcr.height = band.height; lienzoOcr.getContext("2d").putImageData(band, 0, 0); }
  return confianza >= 0.5 ? texto : "";
}

// Caja de reglas: se parte en renglones (por donde hay tinta) y se lee cada uno.
async function leerReglas(foto) {
  const { img, W, H, c } = foto;
  const cw = 640, ch = 300, caja = muestrear(img, W, H, c, CAJA_TEXTO, cw, ch), d = caja.data;
  // tinta por renglon: diferencia contra el fondo (sirve con letra oscura o clara)
  let fondo = 0; for (let j = 0; j < d.length; j += 4) fondo += d[j]; fondo /= cw * ch;
  const tinta = new Float32Array(ch);
  for (let y = 0; y < ch; y++) { let s = 0; for (let x = 0; x < cw; x++) s += Math.abs(d[(y * cw + x) * 4] - fondo) > 60 ? 1 : 0; tinta[y] = s / cw; }
  const renglones = []; let ini = -1;
  for (let y = 0; y <= ch; y++) {
    const hay = y < ch && tinta[y] > 0.02;
    if (hay && ini < 0) ini = y;
    if (!hay && ini >= 0) { if (y - ini >= 8) renglones.push([Math.max(0, ini - 3), Math.min(ch, y + 3)]); ini = -1; }
  }
  const lienzoC = document.createElement("canvas"); lienzoC.width = cw; lienzoC.height = ch; lienzoC.getContext("2d").putImageData(caja, 0, 0);
  const t0 = performance.now(); let texto = "";
  for (const [a, b] of renglones.slice(0, 9)) {
    const alto = b - a, ancho = Math.round(cw * OCR.alto / alto);
    const l = document.createElement("canvas"); l.width = ancho; l.height = OCR.alto;
    const lc = l.getContext("2d"); lc.drawImage(lienzoC, 0, a, cw, alto, 0, 0, ancho, OCR.alto);
    const r = await leerLinea(lc.getImageData(0, 0, ancho, OCR.alto));
    if (r.confianza >= 0.5) texto += " " + r.texto;
  }
  anotar("ocr-reglas", Math.round(performance.now() - t0), renglones.length, texto.trim().slice(0, 70));
  return texto;
}

function palabras(t) {
  return new Set(normalizar(t).split(" ").filter((w) => w.length >= 3));
}

// Respaldo: compara el texto de reglas leido contra el texto oficial de los candidatos visuales.
async function porReglas(foto) {
  const leido = palabras(await leerReglas(foto));
  if (leido.size < 4) return null;
  const p = promedio(); if (!p) return null;
  const top = mejores(p, 12).map(([j]) => indice.ids[j]);
  const cartas = await scry.varias(top);
  const res = [];
  for (const sid of top) {
    const c = cartas.get(sid); if (!c) continue;
    const oficial = palabras(scry.textoOracle(c));
    if (!oficial.size) continue;
    let comunes = 0; for (const w of leido) if (oficial.has(w)) comunes++;
    res.push({ sid, s: comunes / Math.min(leido.size, oficial.size) });
  }
  res.sort((a, b) => b.s - a.s);
  anotar("reglas", res.slice(0, 3).map((r) => [r.sid.slice(0, 8), r.s.toFixed(2)]));
  if (!res.length || res[0].s < 0.5) return null;
  const g0 = indice.grupoDeSid.get(res[0].sid);
  const otro = res.find((r) => indice.grupoDeSid.get(r.sid) !== g0);
  if (otro && res[0].s - otro.s < 0.2) return null;              // dos cartas distintas con texto parecido: no adivinar
  return g0;
}

async function leer(foto) {
  const est = estado;                                             // si sueltan la carta mientras leemos, se descarta
  est.leyendo = true;
  try {
    if (estado.fallidas >= LECTURAS_ANTES_DE_TEXTO && !estado.fijada) {
      const g = await porReglas(foto);
      if (!corriendo || est !== estado) return;
      if (g != null) { fijar(g, "reglas"); return; }
      // ultimo recurso (carta en japones, texto ilegible): solo imagen y con margen muy alto
      if (performance.now() - estado.desde > SOLO_IMAGEN_TRAS_MS) {
        const p = promedio(), top = p && mejores(p, 8);
        if (top) {
          const g0 = indice.grupoDeSid.get(indice.ids[top[0][0]]);
          const otro = top.find(([j]) => indice.grupoDeSid.get(indice.ids[j]) !== g0);
          if (estado.ventana.length >= VENTANA && top[0][1] - (otro?.[1] ?? 0) >= SOLO_IMAGEN_MARGEN) { fijar(g0, "imagen"); return; }
        }
      }
      estado.fallidas = 0;                                        // vuelve a intentar con el nombre
      return;
    }
    // ya hay carta y tiene varias ediciones: leer el codigo de coleccion (hasta 4 intentos) para elegir la exacta
    const f0 = estado.fijada;
    if (f0 && !f0.porCodigo && (f0.intentosCodigo ?? 0) < 4) {
      const ed = elegirEdicion(f0.grupo);
      if (ed.todas.length > 1) {
        f0.intentosCodigo = (f0.intentosCodigo ?? 0) + 1;
        const sid = edicionPorCodigo(await leerCodigo(foto), ed.todas);
        if (!corriendo || est !== estado) return;
        if (sid) {
          f0.porCodigo = true;
          anotar("edicion-por-codigo", sid);
          if (sid !== f0.sid) { f0.sid = sid; publicar({ ...ed, sid, todas: [sid, ...ed.todas.filter((x) => x !== sid)] }); }
        }
        if (f0.intentosCodigo % 2 === 1) return;                 // alterna: codigo, nombre, codigo, nombre...
      }
    }
    const r = emparejarNombre(await leerNombre(foto));
    if (!corriendo || est !== estado) return;
    const fallo = () => { estado.fallidas++; };
    if (!r) { fallo(); return; }
    anotar("nombre", datos().buscar.nombres[r.grupo][0], r.s.toFixed(2), r.segundo.toFixed(2));
    const f = estado.fijada;
    if (f && f.grupo === r.grupo) {
      // misma carta: durante el primer segundo se permite afinar la edicion con mas cuadros; despues queda fija
      if (!f.porCodigo && performance.now() - f.desde < 900) {
        const ed = elegirEdicion(r.grupo);
        if (ed.sid !== f.sid) { f.sid = ed.sid; publicar(ed); }
      }
      return;
    }
    const v = estado.votos.get(r.grupo) || { n: 0, mejor: 0 };
    v.n++; v.mejor = Math.max(v.mejor, r.s); estado.votos.set(r.grupo, v);
    const claro = r.s - r.segundo >= 0.08;
    if ((r.s >= NOMBRE_SEGURO && claro) || (v.n >= 2 && v.mejor >= NOMBRE_DOBLE)) fijar(r.grupo, "nombre");
    else if (r.s < NOMBRE_DOBLE) fallo();
  } catch (e) {
    console.error(e);
  } finally {
    est.leyendo = false; estado.leyendo = false;
  }
}

// ---------------------------------------------------------------- bucle de la camara
function capturar(guia) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw) return null;
  const r = guia.getBoundingClientRect(), vr = video.getBoundingClientRect();
  const escala = Math.max(vr.width / vw, vr.height / vh);                       // object-fit: cover
  const ox = (vr.width - vw * escala) / 2, oy = (vr.height - vh * escala) / 2;
  const margen = 0.06;
  let gx = (r.left - vr.left - ox) / escala, gy = (r.top - vr.top - oy) / escala, gw = r.width / escala, gh = r.height / escala;
  gx -= gw * margen; gy -= gh * margen; gw *= 1 + 2 * margen; gh *= 1 + 2 * margen;
  return { gx, gy, gw, gh };
}

// Deja lista la siguiente carta. El resultado anterior se queda en pantalla, atenuado, hasta que haya uno nuevo.
function soltar(motivo) {
  const leyendo = estado.leyendo, habia = !!estado.fijada;
  estado = nuevoEstado(); estado.leyendo = leyendo;
  anotar("suelta", motivo);
  if (habia) alResultado?.(null);
}

async function cuadro(guia) {
  const g = capturar(guia);
  if (!g) return;
  const W = Math.round(ALTO_GUIA * g.gw / g.gh), H = ALTO_GUIA;
  lienzo.width = W; lienzo.height = H;
  ctx.drawImage(video, g.gx, g.gy, g.gw, g.gh, 0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H).data;
  const c = esquinas(img, W, H);
  if (!c) {
    estado.ventana = [];
    if (++estado.sinCarta >= SIN_CARTA_PARA_SOLTAR && (estado.fijada || estado.votos.size)) soltar("sin carta");
    if (!estado.fijada) alEstado?.("buscando");
    return;
  }
  estado.sinCarta = 0;
  const q = await huella(enderezar(img, W, H, c));
  const f = estado.fijada;
  if (f && !f.q) f.q = q;
  else if (f) {
    let sim = 0; for (let i = 0; i < q.length; i++) sim += q[i] * f.q[i];
    estado.distinta = sim < OTRA_CARTA ? estado.distinta + 1 : 0;
    if (estado.distinta >= 2) { soltar("imagen"); return; }        // pusieron otra carta encima sin retirar la anterior
  }
  // si este cuadro ya no se parece al anterior, es otra carta: no mezclar sus cuadros para elegir la edicion
  if (estado.ultimaQ && estado.ventana.length) {
    let sim = 0; for (let i = 0; i < q.length; i++) sim += q[i] * estado.ultimaQ[i];
    if (sim < OTRA_CARTA) estado.ventana = [];
  }
  estado.ultimaQ = q;
  estado.ventana.push(puntajes(q));
  if (estado.ventana.length > VENTANA) estado.ventana.shift();
  if (!estado.fijada) alEstado?.(performance.now() - estado.desde > AVISO_DIFICIL_MS ? "dificil" : "leyendo");
  // lectura de texto: con la foto a resolucion completa (las letras se ven mejor), sin frenar el bucle
  if (!estado.leyendo && lector) {
    const Wa = Math.min(1100, Math.round(g.gw)), Ha = Math.round(Wa * g.gh / g.gw);
    lienzoAlto.width = Wa; lienzoAlto.height = Ha;
    ctxAlto.drawImage(video, g.gx, g.gy, g.gw, g.gh, 0, 0, Wa, Ha);
    const k = Wa / W;
    leer({ img: ctxAlto.getImageData(0, 0, Wa, Ha).data, W: Wa, H: Ha, c: c.map(([x, y]) => [x * k, y * k]) });
  }
}

async function bucle(guia) {
  while (corriendo) {
    const t0 = performance.now();
    try { await cuadro(guia); } catch (e) { console.error(e); }
    const espera = Math.max(0, 90 - (performance.now() - t0));
    await new Promise((ok) => setTimeout(ok, espera));
  }
}

export async function abrirCamara(elVideo, guia, { resultado, estado: alCambiarEstado }) {
  video = elVideo; alResultado = resultado; alEstado = alCambiarEstado; estado = nuevoEstado();
  flujo = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
