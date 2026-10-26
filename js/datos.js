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
  return trozos.get(xx)[k] || null;
}
