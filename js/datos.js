// Lectura de los archivos que publica el job diario. La pagina no calcula precios: solo lee y convierte a pesos.
import { DATOS_URL } from "./config.js";
import { usdMxn } from "./ajustes.js";

const trozos = new Map();          // "a3" -> filas de ese trozo (en memoria mientras la pagina esta abierta)
let estado = { manifest: null, buscar: null, movers: null, sinConexion: false, diaUsado: null };

async function json(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

function guardarManifest(m) {
  try { localStorage.setItem("stack.manifest", JSON.stringify(m)); } catch { /* sin almacenamiento */ }
}
function manifestGuardado() {
  try { return JSON.parse(localStorage.getItem("stack.manifest") || "null"); } catch { return null; }
}

// Dias a probar, del mas nuevo al mas viejo: el del manifest, el ultimo bueno y los guardados.
function rutasPosibles(m) {
  const dias = [m.ruta?.replace(/\/$/, ""), m.ultimo_bueno, ...(m.dias || [])].filter(Boolean);
  return [...new Set(dias)];
}

export async function cargar() {
  let m = null;
  try {
    m = await json(`${DATOS_URL}manifest.json`, { cache: "no-cache" });
    guardarManifest(m);
    estado.sinConexion = false;
  } catch {
    m = manifestGuardado();
    estado.sinConexion = true;
    if (!m) throw new Error("sin_datos");
  }
  estado.manifest = m;
  let ultimoError = null;
  for (const dia of rutasPosibles(m)) {
    try {
      estado.buscar = await json(`${DATOS_URL}${dia}/buscar.json`);
      estado.diaUsado = dia;
      estado.movers = await json(`${DATOS_URL}${dia}/movers.json`).catch(() => null);
      return estado;
    } catch (e) { ultimoError = e; }
  }
  throw ultimoError || new Error("sin_datos");
}

export function datos() { return estado; }

export function aPesos(usd) {
  const tc = usdMxn(estado.manifest).valor;
  return usd != null && tc ? usd * tc : null;
}
export function yenAPesos(jpy) {
  const jpyUsd = estado.manifest?.tc?.jpy_usd;
  const tc = usdMxn(estado.manifest).valor;
  return jpy != null && jpyUsd && tc ? jpy * jpyUsd * tc : null;
}

// Fila completa de una impresion (k = "<scryfall_id>:<n|f|e>"), del trozo p/xx.json.
export async function impresion(k) {
  const xx = k.slice(0, 2).toLowerCase();
  if (!trozos.has(xx)) {
    const t = await json(`${DATOS_URL}${estado.diaUsado}/p/${xx}.json`);
    trozos.set(xx, t.filas || {});
  }
  const f = trozos.get(xx)[k] || null;
  if (f && f.u && !f.img) {                         // universo (< $2): la imagen y el enlace salen del id de Scryfall
    f.img = `https://cards.scryfall.io/normal/front/${f.sid[0]}/${f.sid[1]}/${f.sid}.jpg`;
    f.url_scryfall = `https://scryfall.com/card/${f.set}/${encodeURIComponent(f.num)}`;
  }
  return f;
}

// Precio de una impresion (fila de buscar.json) en la fuente preferida, en pesos: {mxn, fuente}.
// Filas: [k, set, num, acab, idioma, tcg_usd, fuentes, har_jpy, scg_usd, ck_usd] (las 3 ultimas, desde el esquema con tiendas).
let porClave = null;
export function filaDe(k) {
  if (!porClave) { porClave = new Map(); for (const f of estado.buscar?.imp || []) porClave.set(f[0], f); }
  return porClave.get(k) || null;
}
export function precioFila(fila, fuente) {
  if (!fila) return { mxn: null, fuente: "tcg" };
  const v = fuente === "har" ? yenAPesos(fila[7]) : fuente === "scg" ? aPesos(fila[8]) : fuente === "ck" ? aPesos(fila[9]) : null;
  if (v != null && fuente !== "tcg") return { mxn: v, fuente };
  return { mxn: aPesos(fila[5]), fuente: "tcg" };
}

// ---- Universo (S-0.8.0): las impresiones de menos de $2 viven en u/xx.json y se bajan cuando hacen falta.
// Cada nombre de buscar.json trae en su 5a columna el numero de su trozo (si tiene impresiones baratas). Al llegar un trozo,
// sus impresiones se agregan a buscar.imp y a la lista del nombre: busqueda, filtros, inventarios y escaner las ven igual.
let porNombre = null;
const trozosU = new Map();               // numero de trozo -> {listo, p}
function mapaNombres() {
  if (!porNombre) { porNombre = new Map(); for (const n of estado.buscar?.nombres || []) porNombre.set(n[0], n); }
  return porNombre;
}
export function trozoUniverso(nombre) {
  const n = mapaNombres().get(nombre);
  return n && n.length > 4 && Number.isInteger(n[4]) ? n[4] : null;
}
export function universoListo(nombre) {
  const c = trozoUniverso(nombre);
  return c == null || !!trozosU.get(c)?.listo;
}
function unirUniverso(nombres) {
  filaDe("");                             // asegura el mapa por clave
  const b = estado.buscar;
  for (const [nombre, filas] of Object.entries(nombres || {})) {
    const g = mapaNombres().get(nombre);
    if (!g) continue;
    for (const f of filas) {
      if (porClave.has(f[0])) continue;
      f.u = 1;
      porClave.set(f[0], f);
      g[2].push(b.imp.length);
      b.imp.push(f);
    }
  }
}
// Baja (una vez) los trozos de esos nombres. Resuelve cuando estan todos (aunque alguno falle).
export function cargarUniverso(nombres) {
  const pendientes = [];
  for (const nombre of nombres) {
    const c = trozoUniverso(nombre);
    if (c == null) continue;
    let t = trozosU.get(c);
    if (!t) {
      t = { listo: false };
      t.p = json(`${DATOS_URL}${estado.diaUsado}/u/${c.toString(16).padStart(2, "0")}.json`)
        .then((d) => { unirUniverso(d.nombres); }).catch(() => {}).finally(() => { t.listo = true; });
      trozosU.set(c, t);
    }
    if (!t.listo) pendientes.push(t.p);
  }
  return Promise.all(pendientes);
}
