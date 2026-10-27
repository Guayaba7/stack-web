// Pantallas de la cuenta: entrar / crear / recuperar, ajustes de la cuenta, inventarios y watchlist (solo lectura).
// Los inventarios se valuan con los precios del dia. La app escribe todo; la pagina tambien puede añadir cartas a un inventario.
import * as cuenta from "./cuenta.js";
import { aplicarTema, temaGuardado } from "./temas.js";
import { datos, aPesos, filaDe, precioFila } from "./datos.js";
import { fuentePreferida, NOMBRE_FUENTE } from "./ajustes.js";
import { normalizar } from "./buscar.js";
import { t, pesos, fecha, idiomaActual } from "./i18n.js";
import { logoSvg } from "./logo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const miniatura = (sid) => `https://cards.scryfall.io/small/front/${sid[0]}/${sid[1]}/${sid}.jpg`;
const LETRA = { nonfoil: "n", foil: "f", etched: "e", n: "n", f: "f", e: "e" };
const NOMBRE_TEMA = {
  es: { GRN: "Verde", VLT: "Violeta", GRY: "Grises", RED: "Rojos", RNB: "Arcoíris", NVD: "Navidad", HLW: "Halloween", SNV: "San Valentín",
    ALG: "Algodón de azúcar", SOL: "Sol", DREAM: "Sueño", PLASMA: "Plasma", GRID: "Grid Shift", CONTOUR: "Contour", GALAXY: "Galaxy", PER: "Personalizado" },
  en: { GRN: "Green", VLT: "Violet", GRY: "Greys", RED: "Reds", RNB: "Rainbow", NVD: "Christmas", HLW: "Halloween", SNV: "Valentine's",
    ALG: "Cotton candy", SOL: "Sun", DREAM: "Dream", PLASMA: "Plasma", GRID: "Grid Shift", CONTOUR: "Contour", GALAXY: "Galaxy", PER: "Custom" },
};

let perfil = null, indiceDocs = null;
let precioDe = null;          // "sid:n" -> tcg_usd del dia

function precios() {
  if (precioDe) return precioDe;
  precioDe = new Map();
  for (const fila of datos().buscar?.imp || []) precioDe.set(fila[0], fila[5]);
  return precioDe;
}

const mensaje = (e) => t(`cuenta.err.${e?.message || "error"}`) !== `cuenta.err.${e?.message || "error"}` ? t(`cuenta.err.${e.message}`) : t("cuenta.err.error");

// ---------------------------------------------------------------- al abrir la pagina
export async function iniciarCuenta() {
  const g = temaGuardado();
  if (g) aplicarTema(g);                                   // el ultimo tema visto, mientras se confirma la sesion
  if (!cuenta.cargarSesion()) { if (g) aplicarTema(null); marcarBoton(); return; }
  await refrescar();
}

async function refrescar() {
  try {
    indiceDocs = await cuenta.listar();
    const p = indiceDocs.find((d) => d.tipo === "perfil");
    perfil = p ? await cuenta.leer("perfil", p.version) : null;
    aplicarTema(perfil);
  } catch (e) {
    if (!cuenta.sesion()) aplicarTema(null);               // la sesion ya no vale
  }
  marcarBoton();
}

export function marcarBoton() {
  const b = document.getElementById("abrir-cuenta");
  if (!b) return;
  b.hidden = !cuenta.disponible();
  b.classList.toggle("activo", !!cuenta.sesion());
  b.setAttribute("aria-label", cuenta.sesion() ? t("cuenta.mi_cuenta") : t("cuenta.entrar"));
}

// En la portada, con sesion abierta: accesos a inventarios y watchlist
export function accesosPortada() {
  if (!cuenta.sesion()) return "";
  return `<div class="accesos"><a href="#/inv">${esc(t("inv.titulo"))}</a><a href="#/watch">${esc(t("watch.titulo"))}</a></div>`;
}

// ---------------------------------------------------------------- entrar / crear / recuperar
let modo = "entrar";
let origen = "#/";                 // al entrar, se regresa a donde estaba la persona (no a la pantalla de cuenta)
export function recordarOrigen(viejaUrl, nuevoHash) {
  if (!nuevoHash.startsWith("#/cuenta")) return;
  const h = String(viejaUrl || "").includes("#") ? "#" + String(viejaUrl).split("#")[1] : "#/";
  if (!h.startsWith("#/cuenta")) origen = h;
}
function volverAlOrigen() { location.hash = origen && origen !== "#" ? origen : "#/"; }

function formulario() {
  const campos = {
    entrar: `<label>${esc(t("cuenta.usuario"))}<input name="usuario" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      <label>${esc(t("cuenta.clave"))}<input name="clave" type="password" autocomplete="current-password" required></label>
      <label class="check"><input type="checkbox" name="recordar" checked> ${esc(t("cuenta.recordar"))}</label>
      <button class="primario" type="submit">${esc(t("cuenta.entrar"))}</button>
      <button class="enlace" type="button" data-modo="recuperar">${esc(t("cuenta.olvide"))}</button>`,
    crear: `<label>${esc(t("cuenta.usuario"))}<input name="usuario" autocomplete="username" autocapitalize="off" spellcheck="false" required minlength="3" maxlength="32" pattern="[A-Za-z0-9._\\-]{3,32}"></label>
      <p class="nota">${esc(t("cuenta.usuario_ayuda"))}</p>
      <label>${esc(t("cuenta.clave"))}<input name="clave" type="password" autocomplete="new-password" required minlength="10"></label>
      <label>${esc(t("cuenta.clave2"))}<input name="clave2" type="password" autocomplete="new-password" required minlength="10"></label>
      <div class="aviso-cuenta">${esc(t("cuenta.aviso_privacidad"))}</div>
      <label class="check"><input type="checkbox" name="entiendo" required> ${esc(t("cuenta.entiendo"))}</label>
      <label class="check"><input type="checkbox" name="recordar" checked> ${esc(t("cuenta.recordar"))}</label>
      <button class="primario" type="submit">${esc(t("cuenta.crear"))}</button>`,
    recuperar: `<label>${esc(t("cuenta.usuario"))}<input name="usuario" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
      <label>${esc(t("cuenta.codigo"))}<input name="codigo" autocapitalize="characters" spellcheck="false" required placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"></label>
      <label>${esc(t("cuenta.clave_nueva"))}<input name="clave" type="password" autocomplete="new-password" required minlength="10"></label>
      <label>${esc(t("cuenta.clave2"))}<input name="clave2" type="password" autocomplete="new-password" required minlength="10"></label>
      <label class="check"><input type="checkbox" name="recordar" checked> ${esc(t("cuenta.recordar"))}</label>
      <button class="primario" type="submit">${esc(t("cuenta.recuperar"))}</button>`,
  };
  const pest = modo === "recuperar" ? ""
    : `<div class="segmentos pestanas-cuenta">${["entrar", "crear"].map((m) => `<button type="button" data-modo="${m}" class="${modo === m ? "activo" : ""}">${esc(t(`cuenta.${m}`))}</button>`).join("")}</div>`;
  return `${pest}<form class="form-cuenta" id="form-cuenta" data-forma="${modo}">${campos[modo]}<p class="error" id="cuenta-error" role="alert"></p></form>
    ${modo === "recuperar" ? `<button class="enlace" type="button" data-modo="entrar">${esc(t("cuenta.regresar"))}</button>` : ""}`;
}

function pantallaCodigo(app, codigo, despues) {
  app.innerHTML = `<section class="cuenta-codigo">
      <h1>${esc(t("cuenta.codigo_titulo"))}</h1>
      <p>${esc(t("cuenta.codigo_explica"))}</p>
      <div class="codigo num" id="codigo">${codigo.split("-").map((g) => `<span>${esc(g)}</span>`).join("-")}</div>
      <div class="enlaces"><button type="button" id="copiar">${esc(t("cuenta.copiar"))}</button><button type="button" id="descargar">${esc(t("cuenta.descargar"))}</button></div>
      <label class="check"><input type="checkbox" id="guardado"> ${esc(t("cuenta.ya_guarde"))}</label>
      <button class="primario" type="button" id="continuar" disabled>${esc(t("cuenta.continuar"))}</button>
    </section>`;
  app.querySelector("#copiar").onclick = async () => { try { await navigator.clipboard.writeText(codigo); app.querySelector("#copiar").textContent = t("cuenta.copiado"); } catch { /* sin portapapeles */ } };
  app.querySelector("#descargar").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`Stack · ${t("cuenta.codigo_titulo")}\n${t("cuenta.usuario")}: ${cuenta.sesion()?.usuario}\n\n${codigo}\n\n${t("cuenta.codigo_explica")}\n`], { type: "text/plain" }));
    a.download = "stack-codigo-de-recuperacion.txt"; a.click(); URL.revokeObjectURL(a.href);
  };
  app.querySelector("#guardado").onchange = (e) => { app.querySelector("#continuar").disabled = !e.target.checked; };
  app.querySelector("#continuar").onclick = despues;
}

export function vistaCuenta(app) {
  if (!cuenta.disponible()) { app.innerHTML = `<div class="vacio">${esc(t("cuenta.sin_servidor"))}</div>`; return; }
  if (cuenta.sesion()) return vistaMiCuenta(app);
  app.innerHTML = `<section class="cuenta tarjeta-cuenta">
      <div class="cuenta-cabeza">${logoSvg("logo-cuenta", 44)}<div><h1>${esc(t(modo === "recuperar" ? "cuenta.recuperar" : "cuenta.titulo"))}</h1>
        <p class="tenue">${esc(t(modo === "recuperar" ? "cuenta.recuperar_ayuda" : "cuenta.lema"))}</p></div></div>
      ${formulario()}
      <p class="nota candado">${esc(t("cuenta.privacidad_corta"))} <a href="#/privacidad">${esc(t("legal.privacidad"))}</a></p>
    </section>`;
  app.querySelectorAll("button[data-modo]").forEach((b) => b.addEventListener("click", () => { modo = b.dataset.modo; vistaCuenta(app); }));
  const f = app.querySelector("#form-cuenta"), err = app.querySelector("#cuenta-error");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f)), boton = f.querySelector("button[type=submit]");
    err.textContent = "";
    if (d.clave2 != null && d.clave !== d.clave2) { err.textContent = t("cuenta.err.no_coinciden"); return; }
    boton.disabled = true; const texto = boton.textContent; boton.textContent = t("cuenta.protegiendo");
    try {
      const recordar = !!d.recordar;
      if (modo === "entrar") { await cuenta.entrar(d.usuario, d.clave, recordar); await refrescar(); volverAlOrigen(); }
      else if (modo === "crear") { const codigo = await cuenta.crear(d.usuario, d.clave, recordar); marcarBoton(); pantallaCodigo(app, codigo, volverAlOrigen); }
      else { await cuenta.recuperar(d.usuario, d.codigo, d.clave, recordar); await refrescar(); modo = "entrar"; vistaMiCuenta(app, t("cuenta.recuperada")); }
    } catch (ex) {
      err.textContent = ex.datos?.error === "bloqueada" ? t("cuenta.err.bloqueada") : mensaje(ex);
      boton.disabled = false; boton.textContent = texto;
    }
  });
}

function vistaMiCuenta(app, aviso = "") {
  const s = cuenta.sesion(), tema = perfil?.paleta || "GRN";
  const nombres = NOMBRE_TEMA[idiomaActual()] || NOMBRE_TEMA.es;
  const nInv = (indiceDocs || []).filter((d) => d.tipo.startsWith("inv:")).length;
  const fila = (acc, texto, sub, cls = "") => `<button type="button" class="fila-accion ${cls}" data-acc="${acc}"><span><b>${esc(texto)}</b><small>${esc(sub)}</small></span><i>›</i></button>`;
  app.innerHTML = `<section class="cuenta mi-cuenta">
      ${aviso ? `<div class="aviso">${esc(aviso)}</div>` : ""}
      <div class="perfil-cabeza">
        <div class="avatar">${esc(s.usuario.slice(0, 1).toUpperCase())}</div>
        <div><h1>${esc(s.usuario)}</h1><p class="tenue"><span class="chip">${esc(nombres[tema] || tema)}</span> ${esc(t(perfil ? "cuenta.tema_app" : "cuenta.tema_sin"))}</p></div>
      </div>
      <div class="tiles">
        <a class="tile" href="#/inv"><span class="tenue">${esc(t("inv.titulo"))}</span><b class="num">${nInv}</b><i>›</i></a>
        <a class="tile" href="#/watch"><span class="tenue">${esc(t("watch.titulo"))}</span><b>${esc(t("cuenta.ver"))}</b><i>›</i></a>
      </div>
      <h2>${esc(t("cuenta.seguridad"))}</h2>
      <div class="grupo-acciones">
        ${fila("clave", t("cuenta.cambiar_clave"), t("cuenta.cambiar_clave_sub"))}
        ${fila("codigo", t("cuenta.codigo_nuevo"), t("cuenta.codigo_nuevo_sub"))}
        ${fila("salir", t("cuenta.salir"), t("cuenta.salir_sub"))}
      </div>
      <div id="acc-zona"></div>
      <h2>${esc(t("cuenta.zona_peligro"))}</h2>
      <div class="grupo-acciones">${fila("borrar", t("cuenta.borrar"), t("cuenta.borrar_sub"), "peligro")}</div>
      <p class="nota candado">${esc(t("cuenta.privacidad_corta"))}</p>
    </section>`;
  const zona = app.querySelector("#acc-zona");
  app.querySelectorAll("[data-acc]").forEach((b) => b.addEventListener("click", async () => {
    const acc = b.dataset.acc;
    if (acc === "salir") { await cuenta.salir(); perfil = null; aplicarTema(null); marcarBoton(); location.hash = "#/"; return; }
    if (acc === "codigo") {
      if (!confirm(t("cuenta.codigo_nuevo_confirma"))) return;
      try { const c = await cuenta.codigoNuevo(); pantallaCodigo(app, c, () => vistaMiCuenta(app, t("cuenta.codigo_cambiado"))); }
      catch (e) { zona.innerHTML = `<p class="error">${esc(mensaje(e))}</p>`; }
      return;
    }
    if (acc === "clave") {
      zona.innerHTML = `<form class="form-cuenta" id="f-clave">
          <label>${esc(t("cuenta.clave_nueva"))}<input name="clave" type="password" autocomplete="new-password" required minlength="10"></label>
          <label>${esc(t("cuenta.clave2"))}<input name="clave2" type="password" autocomplete="new-password" required minlength="10"></label>
          <button class="primario" type="submit">${esc(t("cuenta.guardar_clave"))}</button><p class="error" role="alert"></p></form>`;
      const f = zona.querySelector("form");
      f.onsubmit = async (e) => {
        e.preventDefault(); const d = Object.fromEntries(new FormData(f)), er = f.querySelector(".error");
        if (d.clave !== d.clave2) { er.textContent = t("cuenta.err.no_coinciden"); return; }
        f.querySelector("button").textContent = t("cuenta.protegiendo");
        try { await cuenta.cambiarClave(d.clave); vistaMiCuenta(app, t("cuenta.clave_cambiada")); } catch (ex) { er.textContent = mensaje(ex); }
      };
      return;
    }
    if (acc === "borrar") {
      zona.innerHTML = `<form class="form-cuenta" id="f-borrar"><p class="error">${esc(t("cuenta.borrar_aviso"))}</p>
          <label>${esc(t("cuenta.borrar_escribe", { usuario: s.usuario }))}<input name="u" autocapitalize="off" required></label>
          <button class="primario peligro" type="submit">${esc(t("cuenta.borrar"))}</button></form>`;
      const f = zona.querySelector("form");
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (new FormData(f).get("u").trim().toLowerCase() !== s.usuario) return;
        try { await cuenta.borrarCuenta(); perfil = null; aplicarTema(null); marcarBoton(); location.hash = "#/"; } catch (ex) { zona.insertAdjacentHTML("beforeend", `<p class="error">${esc(mensaje(ex))}</p>`); }
      };
    }
  }));
}

// ---------------------------------------------------------------- inventarios
function requiereSesion(app) {
  if (cuenta.sesion()) return false;
  app.innerHTML = `<div class="vacio"><div class="grande">${esc(t("cuenta.necesitas"))}</div><a class="boton-vacio" href="#/cuenta">${esc(t("cuenta.entrar"))}</a></div>`;
  return true;
}

function valuar(piezas) {
  const P = precios();
  let valor = 0, costo = 0, sinPrecio = 0, cartas = 0;
  for (const p of piezas || []) {
    const mxn = precioFila(filaDe(`${p.sid}:${LETRA[p.acab] || "n"}`), fuentePreferida()).mxn, n = Number(p.cantidad) || 0;
    cartas += n;
    if (mxn != null) valor += mxn * n; else sinPrecio += n;
    if (p.costo_prom != null) costo += p.costo_prom * n;
  }
  return { valor, costo, sinPrecio, cartas };
}

async function inventarios() {
  indiceDocs = await cuenta.listar();
  const tipos = indiceDocs.filter((d) => d.tipo.startsWith("inv:"));
  const invs = await Promise.all(tipos.map(async (d) => ({ tipo: d.tipo, actualizado: d.actualizado, ...(await cuenta.leer(d.tipo, d.version)) })));
  return invs.sort((a, b) => (b.es_default ? 1 : 0) - (a.es_default ? 1 : 0) || String(a.nombre).localeCompare(String(b.nombre)));
}

export async function vistaInventarios(app) {
  if (requiereSesion(app)) return;
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("inv.titulo"))}</h1><div class="cargando"></div>`;
  let invs;
  try { invs = await inventarios(); } catch (e) { app.innerHTML = `<div class="vacio">${esc(mensaje(e))}</div>`; return; }
  if (!location.hash.startsWith("#/inv")) return;
  if (!invs.length) { app.innerHTML = `<h1 class="titulo-vista">${esc(t("inv.titulo"))}</h1><div class="vacio"><div class="grande">${esc(t("inv.vacio"))}</div>${esc(t("inv.vacio_ayuda"))}</div>`; return; }
  const total = valuar(invs.flatMap((i) => i.piezas || []));
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("inv.titulo"))}</h1>
    <div class="resumen num"><div><span class="tenue">${esc(t("inv.valor_hoy"))}</span><b>${pesos(total.valor)}</b></div>
      <div><span class="tenue">${esc(t("inv.costo"))}</span><b>${pesos(total.costo)}</b></div>
      <div><span class="tenue">${esc(t("inv.cartas"))}</span><b>${total.cartas.toLocaleString()}</b></div></div>
    <ul class="lista">${invs.map((i) => {
      const v = valuar(i.piezas);
      return `<li><a class="fila" href="#/inv/${encodeURIComponent(i.tipo.slice(4))}">
        <div class="medio"><div class="titulo">${esc(i.nombre === "(default)" ? t("inv.default") : i.nombre)}</div>
        <div class="sub">${esc(t("inv.n_cartas", { n: v.cartas.toLocaleString() }))} · ${esc(t("inv.actualizado", { dia: fecha(String(i.actualizado || "").slice(0, 10)) }))}</div></div>
        <div class="der"><div class="precio num">${pesos(v.valor)}</div><div class="sub num">${esc(t("inv.costo"))} ${pesos(v.costo)}</div></div></a></li>`;
    }).join("")}</ul>`;
}

export async function vistaInventario(app, id) {
  if (requiereSesion(app)) return;
  app.innerHTML = `<a class="volver" href="#/inv">${esc(t("ficha.atras"))}</a><div class="cargando"></div>`;
  let inv;
  try { inv = await cuenta.leer(`inv:${id}`); } catch (e) { app.innerHTML = `<div class="vacio">${esc(mensaje(e))}</div>`; return; }
  if (!inv) { app.innerHTML = `<a class="volver" href="#/inv">${esc(t("ficha.atras"))}</a><div class="vacio">${esc(t("inv.no_existe"))}</div>`; return; }
  const filas = (inv.piezas || []).map((p) => {
    const n = Number(p.cantidad) || 0, unit = precioFila(filaDe(`${p.sid}:${LETRA[p.acab] || "n"}`), fuentePreferida()).mxn;
    return { ...p, n, unit, valor: unit != null ? unit * n : null, texto: normalizar(`${p.nombre} ${p.set} ${p.numero}`) };
  }).sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const v = valuar(inv.piezas);
  app.innerHTML = `<a class="volver" href="#/inv">${esc(t("ficha.atras"))}</a>
    <h1 class="titulo-vista">${esc(inv.nombre === "(default)" ? t("inv.default") : inv.nombre)}</h1>
    <div class="resumen num"><div><span class="tenue">${esc(t("inv.valor_hoy"))}</span><b>${pesos(v.valor)}</b></div>
      <div><span class="tenue">${esc(t("inv.costo"))}</span><b>${pesos(v.costo)}</b></div>
      <div><span class="tenue">${esc(t("inv.cartas"))}</span><b>${v.cartas.toLocaleString()}</b></div></div>
    ${v.sinPrecio ? `<p class="nota">${esc(t("inv.sin_precio", { n: v.sinPrecio }))}</p>` : ""}
    <div class="buscador"><input id="filtro-inv" type="text" placeholder="${esc(t("inv.filtrar"))}" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <ul class="lista" id="lista-inv"></ul>`;
  const lista = app.querySelector("#lista-inv");
  const pintar = (q) => {
    const partes = normalizar(q).split(" ").filter(Boolean);
    const vis = filas.filter((f) => partes.every((p) => f.texto.includes(p))).slice(0, 400);
    lista.innerHTML = vis.map((f) => `<li><a class="fila" href="#/c/${encodeURIComponent(`${f.sid}:${LETRA[f.acab] || "n"}`)}">
        <img loading="lazy" alt="" src="${miniatura(f.sid)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sin-img'}))">
        <div class="medio"><div class="titulo">${esc(f.nombre)}</div><div class="sub">${esc(String(f.set || "").toUpperCase())} #${esc(f.numero)} · ${esc(t(`acabado.${LETRA[f.acab] || "n"}`))} · ×${f.n}</div></div>
        <div class="der"><div class="precio num">${f.valor != null ? pesos(f.valor) : "—"}</div><div class="sub num">${f.unit != null ? `${pesos(f.unit)} c/u` : esc(t("inv.sin_precio_corto"))}</div></div></a></li>`).join("")
      || `<li class="vacio">${esc(t("resultados.sin", { q }))}</li>`;
  };
  pintar("");
  app.querySelector("#filtro-inv").addEventListener("input", (e) => pintar(e.target.value));
}

// ---------------------------------------------------------------- watchlist
export async function vistaWatchlist(app) {
  if (requiereSesion(app)) return;
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("watch.titulo"))}</h1><div class="cargando"></div>`;
  let w;
  try { w = await cuenta.leer("watchlist"); } catch (e) { app.innerHTML = `<div class="vacio">${esc(mensaje(e))}</div>`; return; }
  if (!location.hash.startsWith("#/watch")) return;
  const cartas = w?.cartas || [];
  if (!cartas.length) { app.innerHTML = `<h1 class="titulo-vista">${esc(t("watch.titulo"))}</h1><div class="vacio"><div class="grande">${esc(t("watch.vacio"))}</div>${esc(t("inv.vacio_ayuda"))}</div>`; return; }
  const P = precios();
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("watch.titulo"))}</h1><ul class="lista">${cartas.map((c) => {
    const k = `${c.sid}:${LETRA[c.acab] || "n"}`, usd = P.get(k), tcgMxn = usd != null ? aPesos(usd) : null;
    const pref = precioFila(filaDe(k), fuentePreferida()), mxn = pref.mxn;
    let alerta = "";
    if (c.alerta_precio != null) {
      const actual = c.alerta_moneda === "USD" ? usd : tcgMxn;      // las alertas de la app son sobre TCG
      const objetivo = c.alerta_moneda === "USD" ? `USD ${Number(c.alerta_precio).toFixed(2)}` : pesos(c.alerta_precio);
      alerta = actual != null && actual <= c.alerta_precio ? `<span class="sube">${esc(t("watch.alcanzo", { objetivo }))}</span>` : esc(t("watch.objetivo", { objetivo }));
    }
    return `<li><a class="fila" href="#/c/${encodeURIComponent(k)}">
      <img loading="lazy" alt="" src="${miniatura(c.sid)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sin-img'}))">
      <div class="medio"><div class="titulo">${esc(c.nombre)}</div><div class="sub">${esc(String(c.set || "").toUpperCase())} #${esc(c.numero)} · ${esc(t(`acabado.${LETRA[c.acab] || "n"}`))}${alerta ? ` · ${alerta}` : ""}</div></div>
      <div class="der"><div class="precio num">${mxn != null ? pesos(mxn) : "—"}</div><div class="tiendas">${NOMBRE_FUENTE[pref.fuente]}</div></div></a></li>`;
  }).join("")}</ul>`;
}

// ---------------------------------------------------------------- añadir a inventario (desde la ficha de la carta)
// La pagina tambien escribe: lee el inventario mas reciente de la nube, le suma la carta y lo guarda. Si otro dispositivo
// guardo en ese momento (409), vuelve a leer y lo intenta otra vez, asi nunca se pisa lo que el otro acaba de guardar.
// La app lo ve en su siguiente revision (al abrir y cada minuto).
const ACAB_APP = { n: "nonfoil", f: "foil", e: "etched" };

export function bloqueAgregar() {
  if (!cuenta.disponible()) return "";
  return `<section class="agregar" id="agregar" aria-live="polite"></section>`;
}

export async function montarAgregar(f) {
  const caja = document.getElementById("agregar");
  if (!caja) return;
  if (!cuenta.sesion()) {
    caja.innerHTML = `<h2>${esc(t("inv.agregar_titulo"))}</h2><p class="tenue">${esc(t("inv.agregar_entra"))}</p>
      <a class="boton-vacio" href="#/cuenta">${esc(t("cuenta.entrar"))}</a>`;
    return;
  }
  caja.innerHTML = `<h2>${esc(t("inv.agregar_titulo"))}</h2><div class="cargando"></div>`;
  let invs;
  try { invs = await inventarios(); } catch (e) { caja.innerHTML = `<h2>${esc(t("inv.agregar_titulo"))}</h2><p class="error">${esc(mensaje(e))}</p>`; return; }
  if (!document.body.contains(caja)) return;
  const acab = ACAB_APP[f.acab] || "nonfoil";
  const tengo = (i) => (i.piezas || []).filter((p) => p.sid === f.sid && (p.acab || "nonfoil") === acab).reduce((s, p) => s + (Number(p.cantidad) || 0), 0);
  const opciones = invs.length
    ? invs.map((i) => `<option value="${esc(i.tipo)}">${esc(i.nombre === "(default)" ? t("inv.default") : i.nombre)}${tengo(i) ? ` · ${esc(t("inv.ya_tienes", { n: tengo(i) }))}` : ""}</option>`).join("")
    : `<option value="">${esc(t("inv.default"))}</option>`;
  caja.innerHTML = `<h2>${esc(t("inv.agregar_titulo"))}</h2>
    <form class="form-cuenta form-agregar" id="form-agregar">
      <label>${esc(t("inv.inventario"))}<select name="inv">${opciones}</select></label>
      <div class="agregar-fila">
        <label>${esc(t("inv.cantidad"))}<input name="cantidad" type="number" inputmode="numeric" min="1" max="999" step="1" value="1" required></label>
        <label>${esc(t("inv.costo_unit"))}<input name="costo" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t("inv.opcional"))}"></label>
      </div>
      <button class="primario" type="submit">${esc(t("inv.agregar"))}</button>
      <p class="tenue agregar-msg" id="agregar-msg" role="status"></p>
    </form>`;
  const forma = caja.querySelector("form");
  forma.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const q = Math.floor(Number(forma.cantidad.value));
    const c = forma.costo.value === "" ? null : Math.max(0, Number(forma.costo.value));
    const msg = caja.querySelector("#agregar-msg"), boton = forma.querySelector("button");
    if (!(q >= 1 && q <= 999) || (c != null && !isFinite(c))) { msg.className = "error agregar-msg"; msg.textContent = t("inv.cantidad_mal"); return; }
    boton.disabled = true; msg.className = "tenue agregar-msg"; msg.textContent = t("inv.agregando");
    try {
      const nombreInv = await agregarPieza(forma.inv.value, f, acab, q, c);
      msg.className = "ok agregar-msg";
      msg.textContent = t("inv.agregado", { n: q, nombre: f.nombre, inv: nombreInv === "(default)" ? t("inv.default") : nombreInv });
      const sel = forma.inv.value;
      await montarAgregar(f);                                 // se vuelve a pintar con lo que ya tienes
      const f2 = document.getElementById("form-agregar");
      if (f2) { if (sel) f2.inv.value = sel; const m2 = document.getElementById("agregar-msg"); m2.className = msg.className; m2.textContent = msg.textContent; }
    } catch (e) {
      boton.disabled = false; msg.className = "error agregar-msg"; msg.textContent = mensaje(e);
    }
  });
}

async function agregarPieza(tipo, f, acab, q, costo) {
  for (let intento = 0; intento < 4; intento++) {
    const lista = await cuenta.listar();
    let destino = tipo, actual = null;
    if (!destino) {                                           // la cuenta no tiene inventarios: se crea el de siempre
      const existente = [];
      for (const d of lista.filter((x) => x.tipo.startsWith("inv:"))) existente.push({ tipo: d.tipo, ...(await cuenta.leer(d.tipo, d.version)) });
      const def = existente.find((i) => i.es_default);
      if (def) destino = def.tipo;
      else {
        const rid = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
        destino = `inv:${rid}`;
        actual = { esquema: 1, id: rid, nombre: "(default)", es_default: true, piezas: [] };
      }
    }
    const info = lista.find((d) => d.tipo === destino);
    if (!actual) {
      if (!info) throw new Error("no_existe");
      actual = structuredClone(await cuenta.leer(destino, info.version));
    }
    cuenta.fijarVersion(destino, info ? info.version : 0);
    const piezas = actual.piezas || (actual.piezas = []);
    const p = piezas.find((x) => x.sid === f.sid && (x.acab || "nonfoil") === acab);
    if (p) {
      const antes = Number(p.cantidad) || 0;
      if (costo != null) p.costo_prom = p.costo_prom == null ? costo : Math.round(((p.costo_prom * antes) + costo * q) / (antes + q) * 100) / 100;
      p.cantidad = antes + q;
      p.agregada = new Date().toISOString().slice(0, 19) + "+00:00";
    } else {
      piezas.push({ sid: f.sid, acab, nombre: f.nombre, set: f.set, numero: f.num, cantidad: q, costo_prom: costo,
        agregada: new Date().toISOString().slice(0, 19) + "+00:00" });
    }
    actual.actualizado = new Date().toISOString().slice(0, 19) + "+00:00";
    try {
      await cuenta.guardar(destino, actual);
      return actual.nombre;
    } catch (e) {
      if (e.estado !== 409) throw e;                          // otro dispositivo guardo justo antes: se reintenta
    }
  }
  throw new Error("error");
}
