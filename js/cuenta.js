// Cuenta de Stack en la web. Todo el cifrado ocurre AQUI, en el navegador: el servidor solo recibe una huella del
// usuario, una llave derivada para entrar y bloques cifrados. Mismo protocolo que la app (cuenta_cliente.py):
//   uid = SHA-256("stack-cuenta-v1:" + usuario)
//   PBKDF2-SHA256(contrasena, sal, 600000) -> 64 bytes: auth (va al servidor) | kek (nunca sale)
//   llave maestra (MK) al azar, guardada envuelta con AES-256-GCM (kek), aad "stack-mk-v1"
//   codigo de recuperacion: 25 caracteres Crockford; PBKDF2 200000 -> rec_auth | rec_kek
//   mk_prueba = HMAC-SHA256(MK, "stack-mk-prueba-v1");  llave de documentos = HMAC-SHA256(MK, "stack-docs-v1")
//   documento = AES-256-GCM(llave_docs, gzip(JSON), aad "stack-doc-v1:" + tipo)
import { CUENTAS_URL } from "./config.js";

const ITER_CLAVE = 600000, ITER_CODIGO = 200000;
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const te = new TextEncoder(), td = new TextDecoder();
const sutil = crypto.subtle;

const b64 = (b) => { let s = ""; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const azar = (n) => crypto.getRandomValues(new Uint8Array(n));

export function normalizarUsuario(u) {
  const n = String(u || "").normalize("NFKC").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(n)) throw new Error("usuario_invalido");
  return n;
}
const uidDe = async (u) => hex(await sutil.digest("SHA-256", te.encode("stack-cuenta-v1:" + normalizarUsuario(u))));

async function derivar(secreto, salB64, iter) {
  const base = await sutil.importKey("raw", te.encode(String(secreto).normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await sutil.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64(salB64), iterations: iter }, base, 512));
  return { auth: b64(bits.slice(0, 32)), kek: bits.slice(32) };
}

async function aes(raw, uso) { return sutil.importKey("raw", raw, "AES-GCM", false, [uso]); }

async function envolver(kek, mk) {
  const iv = azar(12), ct = await sutil.encrypt({ name: "AES-GCM", iv, additionalData: te.encode("stack-mk-v1") }, await aes(kek, "encrypt"), mk);
  return b64(new Uint8Array([...iv, ...new Uint8Array(ct)]));
}
async function desenvolver(kek, envuelta) {
  const raw = unb64(envuelta);
  return new Uint8Array(await sutil.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: te.encode("stack-mk-v1") }, await aes(kek, "decrypt"), raw.slice(12)));
}

async function hmac(llave, texto) {
  const k = await sutil.importKey("raw", llave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await sutil.sign("HMAC", k, te.encode(texto)));
}
const mkPrueba = async (mk) => b64(await hmac(mk, "stack-mk-prueba-v1"));

export function nuevoCodigo() {
  const r = azar(25), c = [...r].map((x) => ALFABETO[x & 31]).join("");
  return c.match(/.{5}/g).join("-");
}
export const normalizarCodigo = (c) => String(c || "").toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1").split("").filter((x) => ALFABETO.includes(x)).join("");
const kdfNuevo = (iter) => ({ alg: "pbkdf2-sha256", iter, sal: b64(azar(16)) });

async function comprimir(texto) {
  const s = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function descomprimir(bytes) {
  const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(s).text();
}

async function cifrarDoc(mk, tipo, obj) {
  const iv = azar(12), k = await aes(await hmac(mk, "stack-docs-v1"), "encrypt");
  const ct = await sutil.encrypt({ name: "AES-GCM", iv, additionalData: te.encode("stack-doc-v1:" + tipo) }, k, await comprimir(JSON.stringify(obj)));
  return b64(new Uint8Array([...iv, ...new Uint8Array(ct)]));
}
async function descifrarDoc(mk, tipo, datos) {
  const raw = unb64(datos), k = await aes(await hmac(mk, "stack-docs-v1"), "decrypt");
  const pt = await sutil.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12), additionalData: te.encode("stack-doc-v1:" + tipo) }, k, raw.slice(12));
  return JSON.parse(await descomprimir(new Uint8Array(pt)));
}

// ---------------------------------------------------------------- sesion (en este navegador)
let ses = null;              // {usuario, token, mk: Uint8Array, recordar}
const docsCache = new Map(); // tipo -> {version, obj}

function guardarSesion() {
  const datos = ses ? JSON.stringify({ usuario: ses.usuario, token: ses.token, mk: b64(ses.mk) }) : null;
  for (const [alm, usar] of [[localStorage, ses?.recordar], [sessionStorage, ses && !ses.recordar]]) {
    try { if (usar) alm.setItem("stack.sesion", datos); else alm.removeItem("stack.sesion"); } catch { /* sin almacenamiento */ }
  }
}
export function cargarSesion() {
  for (const [alm, recordar] of [[sessionStorage, false], [localStorage, true]]) {
    try {
      const s = JSON.parse(alm.getItem("stack.sesion") || "null");
      if (s?.token && s?.mk) { ses = { usuario: s.usuario, token: s.token, mk: unb64(s.mk), recordar }; return true; }
    } catch { /* nada */ }
  }
  return false;
}
export const sesion = () => (ses ? { usuario: ses.usuario } : null);
export const disponible = () => !!CUENTAS_URL;

async function api(ruta, cuerpo, metodo = "POST") {
  if (!CUENTAS_URL) throw new Error("sin_servidor");
  let r;
  try {
    r = await fetch(CUENTAS_URL.replace(/\/$/, "") + ruta, {
      method: metodo, headers: { "Content-Type": "application/json", ...(ses?.token ? { Authorization: `Bearer ${ses.token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch { throw new Error("sin_red"); }
  const j = await r.json().catch(() => ({ ok: false, error: `http_${r.status}` }));
  if (r.status === 401 && j.error === "sesion") { salirLocal(); }
  if (!j.ok) { const e = new Error(j.error || "error"); e.datos = j; e.estado = r.status; throw e; }
  return j;
}

// ---------------------------------------------------------------- acciones de cuenta
export async function crear(usuario, clave, recordar) {
  const u = normalizarUsuario(usuario), uid = await uidDe(u), mk = azar(32), codigo = nuevoCodigo();
  const kdf = kdfNuevo(ITER_CLAVE), rk = kdfNuevo(ITER_CODIGO);
  const [p, r] = await Promise.all([derivar(clave, kdf.sal, kdf.iter), derivar(normalizarCodigo(codigo), rk.sal, rk.iter)]);
  const j = await api("/cuenta/crear", {
    uid, auth: p.auth, kdf, llave_pw: await envolver(p.kek, mk), mk_verif: await mkPrueba(mk),
    rec: { auth: r.auth, kdf: rk, llave: await envolver(r.kek, mk) },
  });
  ses = { usuario: u, token: j.token, mk, recordar }; docsCache.clear(); guardarSesion();
  return codigo;
}

export async function entrar(usuario, clave, recordar) {
  const u = normalizarUsuario(usuario), uid = await uidDe(u);
  const pre = await api("/cuenta/preparar", { uid });
  const { auth, kek } = await derivar(clave, pre.kdf.sal, pre.kdf.iter);
  const j = await api("/cuenta/entrar", { uid, auth });
  ses = { usuario: u, token: j.token, mk: await desenvolver(kek, j.llave_pw), recordar }; docsCache.clear(); guardarSesion();
}

export async function recuperar(usuario, codigo, claveNueva, recordar) {
  const u = normalizarUsuario(usuario), uid = await uidDe(u);
  const pre = await api("/cuenta/preparar", { uid });
  const r = await derivar(normalizarCodigo(codigo), pre.rec_kdf.sal, pre.rec_kdf.iter);
  const j1 = await api("/cuenta/recuperar/llave", { uid, rec_auth: r.auth });
  let mk;
  try { mk = await desenvolver(r.kek, j1.llave_rec); } catch { throw new Error("credenciales"); }
  const kdf = kdfNuevo(ITER_CLAVE), p = await derivar(claveNueva, kdf.sal, kdf.iter);
  const j = await api("/cuenta/recuperar", { uid, rec_auth: r.auth, mk_prueba: await mkPrueba(mk), nueva: { auth: p.auth, kdf, llave_pw: await envolver(p.kek, mk) } });
  ses = { usuario: u, token: j.token, mk, recordar }; docsCache.clear(); guardarSesion();
}

// Con la sesion abierta basta tener la llave maestra (sirve si se olvido la contrasena en otro dispositivo).
export async function cambiarClave(claveNueva) {
  const kdf = kdfNuevo(ITER_CLAVE), p = await derivar(claveNueva, kdf.sal, kdf.iter);
  await api("/cuenta/clave", { mk_prueba: await mkPrueba(ses.mk), nueva: { auth: p.auth, kdf, llave_pw: await envolver(p.kek, ses.mk) } });
}

export async function codigoNuevo() {
  const codigo = nuevoCodigo(), rk = kdfNuevo(ITER_CODIGO), r = await derivar(normalizarCodigo(codigo), rk.sal, rk.iter);
  await api("/cuenta/codigo", { mk_prueba: await mkPrueba(ses.mk), rec: { auth: r.auth, kdf: rk, llave: await envolver(r.kek, ses.mk) } });
  return codigo;
}

function salirLocal() { ses = null; docsCache.clear(); guardarSesion(); }
export async function salir() {
  try { await api("/cuenta/salir", {}); } catch { /* aunque no haya red, se cierra aqui */ }
  salirLocal();
}

export async function borrarCuenta() {
  await api("/cuenta/borrar", { mk_prueba: await mkPrueba(ses.mk) });
  salirLocal();
}

// ---------------------------------------------------------------- documentos (perfil, watchlist, inventarios)
export async function listar() {
  const j = await api("/docs", null, "GET");
  return j.docs;
}

export async function leer(tipo, version = null) {
  const c = docsCache.get(tipo);
  if (c && version != null && c.version === version) return c.obj;
  try {
    const j = await api(`/docs/${encodeURIComponent(tipo)}`, null, "GET");
    const obj = await descifrarDoc(ses.mk, tipo, j.datos);
    docsCache.set(tipo, { version: j.version, obj });
    return obj;
  } catch (e) {
    if (e.estado === 404) return null;
    throw e;
  }
}

// La web no edita (la app es la que escribe), pero queda listo para cuando haga falta.
export async function guardar(tipo, obj) {
  const v = docsCache.get(tipo)?.version ?? 0;
  const j = await api(`/docs/${encodeURIComponent(tipo)}`, { version: v, datos: await cifrarDoc(ses.mk, tipo, obj) }, "PUT");
  docsCache.set(tipo, { version: j.version, obj });
  return j.version;
}
