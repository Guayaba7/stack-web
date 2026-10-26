// Arranque, rutas y pantallas. Rutas: #/ (inicio), #/?q=texto (resultados), #/c/<clave> (ficha).
import { POR_GRUPO, ZONA, DATOS_URL } from "./config.js";
import { cargar, datos, aPesos, yenAPesos, impresion } from "./datos.js";
import { prepararIndice, buscar } from "./buscar.js";
import { cargarIdioma, idiomaActual, t, pesos, moneda, fecha, porcentaje } from "./i18n.js";
import { leerAjustes, guardarAjustes, usdMxn } from "./ajustes.js";
import * as escaner from "./escaner.js";

const app = document.getElementById("app");
const FUENTES = [["tcg", "TCG"], ["har", "HAR"], ["har_jp", "HAR JP"], ["scg", "SCG"], ["ck", "CK"]];
const LETRAS = { H: "HAR", J: "HAR JP", S: "SCG", C: "CK" };
let listo = false;
let navegoDentro = false;             // si se llego a la ficha desde la pagina, "Atras" regresa a donde estaba
let pestanaMovers = "suben";
let moversAbiertos = false;          // en la portada los movers van plegados
const abiertos = new Set();          // grupos con "Ver mas" abierto

const ICONO_CAMARA = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="8.5" y="7" width="7" height="10" rx="1"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const miniatura = (k) => {
  const sid = k.split(":")[0];
  return `https://cards.scryfall.io/small/front/${sid[0]}/${sid[1]}/${sid}.jpg`;
};
const hoyMexico = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
const diasEntre = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

// ---------- Estado del dia (semaforo) ----------
function estadoDelDia() {
  const { manifest: m, sinConexion, diaUsado } = datos();
  const atraso = diasEntre(diaUsado, hoyMexico());
  const chips = [];
  let color = atraso <= 0 ? "verde" : atraso === 1 ? "ambar" : "rojo";
  for (const [clave, corto] of FUENTES) {
    const f = m.fuentes?.[clave];
    if (!f || (clave === "har_jp" && f.estado === "falta")) continue;
    if (f.estado === "falta") { color = "rojo"; chips.push(`<span class="chip rojo">${esc(t("estado.fuente_falta", { fuente: corto }))}</span>`); }
    else if (f.estado === "vieja") {
      if (color === "verde") color = "ambar";
      chips.push(`<span class="chip ambar">${esc(t("estado.fuente_vieja", { fuente: corto, dia: fecha(f.dia) }))}</span>`);
    } else chips.push(`<span class="chip">${corto} ✓</span>`);
  }
  let texto = sinConexion ? t("estado.sin_conexion", { dia: fecha(diaUsado) })
    : t("estado.datos_del", { dia: fecha(diaUsado, diaUsado === m.dia ? m.generado_utc : null) });
  if (!sinConexion && atraso === 1) texto += ` · ${t("estado.de_ayer")}`;
  if (!sinConexion && atraso > 1) texto += ` · ${t("estado.de_hace", { n: atraso })}`;
  const aviso = diaUsado !== m.dia ? `<div class="aviso">${esc(t("estado.paquete_viejo", { dia: fecha(diaUsado) }))}</div>` : "";
  const tc = usdMxn(m);
  if (tc.propio) chips.push(`<span class="chip ambar">${esc(t("ajustes.chip", { usd: tc.valor }))}</span>`);
  return `${aviso}<div class="estado"><span class="punto ${color}"></span><span>${esc(texto)}</span><span class="chips">${chips.join("")}</span></div>`;
}

function buscador(q = "") {
  return `<form class="buscador" role="search" onsubmit="return false">
      <input id="q" type="text" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
             placeholder="${esc(t("buscar.placeholder"))}" value="${esc(q)}" aria-label="${esc(t("buscar.placeholder"))}">
      <button type="button" class="borrar" aria-label="${esc(t("buscar.borrar"))}" ${q ? "" : "hidden"}>✕</button>
      ${datos().manifest?.vision ? `<a class="camara" href="#/escaner" aria-label="${esc(t("escaner.abrir"))}">${ICONO_CAMARA}</a>` : ""}
    </form>`;
}

function filaDe(k, titulo, sub, derecha) {
  return `<li><a class="fila" href="#/c/${encodeURIComponent(k)}">
      <img loading="lazy" alt="" src="${miniatura(k)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'sin-img'}))">
      <div class="medio"><div class="titulo">${esc(titulo)}</div><div class="sub">${esc(sub)}</div></div>
      <div class="der">${derecha}</div></a></li>`;
}

// ---------- Inicio (sin busqueda): movers ----------
function vistaMovers() {
  const mv = datos().movers;
  if (!mv) return "";
  const pest = [["suben", "movers.suben"], ["bajan", "movers.bajan"], ["nuevas", "movers.nuevas"]]
    .filter(([c]) => (mv[c] || []).length || c !== "nuevas");
  const items = mv[pestanaMovers] || [];
  const filas = items.map((x) => {
    const sub = `${x.set.toUpperCase()} #${x.num} · ${t(`acabado.${x.acab}`)}`;
    const der = pestanaMovers === "nuevas"
      ? `<div class="precio num">${pesos(aPesos(x.usd))}</div><div class="sub">${esc(t("movers.nuevas_dias", { n: x.dias }))}</div>`
      : `<div class="precio num">${pesos(aPesos(x.usd))}</div><div class="sub num ${x.pct > 0 ? "sube" : "baja"}">${porcentaje(x.pct)}</div>`;
    return filaDe(x.k, x.nombre, sub, der);
  }).join("");
  return `<h2>${esc(t("movers.titulo"))}</h2>
    <div class="pestanas">${pest.map(([c, txt]) => `<button type="button" data-pestana="${c}" class="${c === pestanaMovers ? "activo" : ""}">${esc(t(txt))}</button>`).join("")}</div>
    ${filas ? `<ul class="lista">${filas}</ul>` : `<p class="vacio">${esc(t("movers.vacio"))}</p>`}`;
}

// ---------- Resultados ----------
function vistaResultados(q) {
  const grupos = buscar(q);
  if (!grupos.length) {
    return `<div class="vacio"><div class="grande">${esc(t("resultados.sin", { q }))}</div>${esc(t("resultados.sin_ayuda"))}</div>`;
  }
  const { buscar: b } = datos();
  return grupos.map((g) => {
    const abierto = abiertos.has(g.nombre);
    const visibles = abierto ? g.imp : g.imp.slice(0, POR_GRUPO);
    const filas = visibles.map((i) => {
      const [k, set, num, acab, idioma, usd, fuentes] = b.imp[i];
      const tiendas = [...(fuentes || "")].map((l) => LETRAS[l]).join(" · ");
      const sub = `${set.toUpperCase()} #${num} · ${t(`acabado.${acab}`)} · ${idioma.toUpperCase()}`;
      return filaDe(k, sub, tiendas || " ", `<div class="precio num">${pesos(aPesos(usd))}</div><div class="tiendas">TCG</div>`);
    }).join("");
    const faltan = g.imp.length - visibles.length;
    const cuantas = g.imp.length === 1 ? t("resultados.impresion") : t("resultados.impresiones", { n: g.imp.length });
    return `<section class="grupo"><p class="grupo-nombre">${esc(g.nombre)} <span class="tenue">· ${esc(cuantas)}</span></p>
      <ul class="lista">${filas}</ul>
      ${faltan > 0 ? `<button type="button" class="mas" data-grupo="${esc(g.nombre)}">${esc(t("resultados.ver_mas", { n: faltan }))}</button>` : ""}</section>`;
  }).join("");
}

// ---------- Ficha de una impresion ----------
function filaPrecio(nombre, bloque, mxn, original, extra = "") {
  if (!bloque) return `<tr><td class="fuente">${esc(nombre)}</td><td class="der tenue">${esc(t("ficha.sin_dato"))}</td></tr>`;
  if (bloque.estado === "sin_match") return `<tr><td class="fuente">${esc(nombre)}</td><td class="der tenue">${esc(t("ficha.sin_match"))}</td></tr>`;
  const viejo = bloque.estado === "previo";
  const stock = bloque.stock == null ? "" : bloque.stock > 0 ? t("ficha.stock", { n: bloque.stock }) : `<span class="agotado">${esc(t("ficha.agotado"))}</span>`;
  const det = [stock, viejo ? `<span class="viejo">${esc(t("ficha.del", { dia: fecha(bloque.dia) }))}</span>` : "", extra].filter(Boolean).join(" · ");
  return `<tr><td><div class="fuente">${esc(nombre)}</div>${det ? `<div class="detalle">${det}</div>` : ""}</td>
    <td class="der"><div class="mxn num ${viejo ? "viejo" : ""}">${pesos(mxn)}</div><div class="detalle num">${original}${bloque.cond ? ` ${esc(bloque.cond)}` : ""}</div></td></tr>`;
}

async function vistaFicha(k) {
  document.body.classList.remove("en-portada");
  app.innerHTML = `<a class="volver" href="#/" data-atras>${esc(t("ficha.atras"))}</a><div class="cargando"></div>`;
  let f = null;
  try { f = await impresion(k); } catch { f = null; }
  if (location.hash !== `#/c/${encodeURIComponent(k)}`) return;           // el usuario ya se fue a otra pantalla
  if (!f) {
    app.innerHTML = `<a class="volver" href="#/" data-atras>${esc(t("ficha.atras"))}</a><div class="vacio">${esc(t("ficha.no_encontrada"))}</div>`;
    return;
  }
  const { manifest: m } = datos();
  const tcg = f.tcg || {};
  const cambios = [tcg.d1 != null ? `1D <span class="${tcg.d1 > 0 ? "sube" : tcg.d1 < 0 ? "baja" : ""}">${porcentaje(tcg.d1)}</span>` : "",
    tcg.d7 != null ? `7D <span class="${tcg.d7 > 0 ? "sube" : tcg.d7 < 0 ? "baja" : ""}">${porcentaje(tcg.d7)}</span>` : ""].filter(Boolean).join(" · ");
  const ck = f.ck;
  const compra = ck && ck.estado !== "sin_match"
    ? (ck.compra_usd ? esc(t("ficha.compra", { precio: pesos(aPesos(ck.compra_usd)), n: ck.quiere ?? 0 })) : esc(t("ficha.no_compra")))
    : "";
  const otras = (f.otras || []).map((o) => `<a href="#/c/${encodeURIComponent(o)}">${esc(t(`acabado.${o.split(":")[1]}`))}</a>`).join("");
  const enlaces = [[f.url_scryfall, "Scryfall"], [f.scg?.url, "SCG"], [ck?.url, "Card Kingdom"]]
    .filter(([u]) => u).map(([u, s]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t("ficha.ver_en", { sitio: s }))}</a>`).join("");
  const img = f.img
    ? `<img class="ficha-img" src="${esc(f.img)}" alt="${esc(f.nombre)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'ficha-img sin-imagen',textContent:'${esc(t("ficha.sin_imagen"))}'}))">`
    : `<div class="ficha-img sin-imagen">${esc(f.nombre)}<br>${esc((f.set || "").toUpperCase())}</div>`;

  app.innerHTML = `<a class="volver" href="#/" data-atras>${esc(t("ficha.atras"))}</a>
    <article class="ficha">
      <div class="ficha-cabeza">${img}
        <div>
          <h1>${esc(f.nombre)}</h1>
          ${f.nombre_es && idiomaActual() === "es" ? `<div class="es">${esc(f.nombre_es)}</div>` : ""}
          <div class="datos">${esc(f.set_nombre || "")} (${esc((f.set || "").toUpperCase())}) · #${esc(f.num)}</div>
          <div class="datos">${esc(t(`acabado.${f.acab}`))} · ${esc((f.idioma || "").toUpperCase())}${f.rareza ? ` · ${esc(t(`rareza.${f.rareza}`))}` : ""}</div>
          ${otras ? `<div class="otras" aria-label="${esc(t("ficha.otras"))}">${otras}</div>` : ""}
        </div>
      </div>
      <table class="precios">
        <thead><tr><th>${esc(t("ficha.fuente"))}</th><th class="der">${esc(t("ficha.precio"))}</th></tr></thead>
        <tbody>
          ${filaPrecio(t("ficha.tcg"), tcg, aPesos(tcg.usd), moneda(tcg.usd, "USD"), cambios)}
          ${filaPrecio(t("ficha.har"), f.har, yenAPesos(f.har?.jpy), moneda(f.har?.jpy, "JPY"))}
          ${f.har_jp ? filaPrecio(t("ficha.har_jp"), f.har_jp, yenAPesos(f.har_jp.jpy), moneda(f.har_jp.jpy, "JPY")) : ""}
          ${filaPrecio(t("ficha.scg"), f.scg, aPesos(f.scg?.usd), moneda(f.scg?.usd, "USD"))}
          ${filaPrecio(t("ficha.ck"), ck, aPesos(ck?.usd), moneda(ck?.usd, "USD"), compra)}
        </tbody>
      </table>
      <div class="pie num">${esc(t("ficha.cambio", { usd: `${usdMxn(m).valor ?? "—"}${usdMxn(m).propio ? ` (${t("ajustes.propio_corto")})` : ""}`, jpy: m.tc?.jpy_usd ?? "—" }))}<br>${esc(t("estado.datos_del", { dia: fecha(datos().diaUsado) }))}</div>
      ${enlaces ? `<div class="enlaces">${enlaces}</div>` : ""}
    </article>`;
}

// ---------- Rutas ----------
function leerRuta() {
  const h = location.hash.replace(/^#/, "") || "/";
  if (h.startsWith("/c/")) return { pantalla: "ficha", k: decodeURIComponent(h.slice(3)) };
  if (h.startsWith("/escaner")) return { pantalla: "escaner" };
  const q = new URLSearchParams(h.split("?")[1] || "").get("q") || "";
  return { pantalla: "inicio", q };
}

// Sin busqueda: portada (logo grande, nombre, buscador). Con busqueda: buscador arriba y resultados.
const esPortada = (q) => q.trim().length < 2;

function vistaPortadaExtra() {
  if (!datos().movers) return "";
  return `<button type="button" class="ver-movers" data-ver-movers aria-expanded="${moversAbiertos}">${esc(t("movers.titulo"))} ${moversAbiertos ? "▴" : "▾"}</button>
    ${moversAbiertos ? `<div class="movers-portada">${vistaMovers()}</div>` : ""}`;
}

function pintarInicio(q) {
  const portada = esPortada(q);
  document.body.classList.toggle("en-portada", portada);
  app.innerHTML = portada
    ? `<section class="portada"><img class="logo-grande" src="iconos/logo-grande.png" alt=""><h1 class="nombre">Stack</h1>
        ${buscador(q)}${estadoDelDia()}</section><div id="contenido">${vistaPortadaExtra()}</div>`
    : `${buscador(q)}${estadoDelDia()}<div id="contenido">${vistaResultados(q)}</div>`;
  const input = document.getElementById("q");
  if (matchMedia("(min-width: 720px)").matches || q) {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function actualizarResultados(q) {
  // Al pasar de portada a resultados (o al reves) cambia el acomodo: se repinta todo y el cursor sigue en el buscador.
  if (esPortada(q) !== document.body.classList.contains("en-portada")) { pintarInicio(q); return; }
  const cont = document.getElementById("contenido");
  if (cont) cont.innerHTML = esPortada(q) ? vistaPortadaExtra() : vistaResultados(q);
  const borrar = document.querySelector(".borrar");
  if (borrar) borrar.hidden = !q;
}

function pintar() {
  if (!listo) return;
  const r = leerRuta();
  if (r.pantalla === "ficha") vistaFicha(r.k);
  else if (document.getElementById("q")) actualizarResultados(r.q);  // escribiendo: no se repinta el input
  else pintarInicio(r.q);
}

// La busqueda va en la URL (replaceState: no llena el historial con cada letra).
app.addEventListener("input", (e) => {
  if (e.target.id !== "q") return;
  const q = e.target.value;
  history.replaceState(null, "", q ? `#/?q=${encodeURIComponent(q)}` : "#/");
  actualizarResultados(q);
});

app.addEventListener("click", (e) => {
  if (e.target.closest("[data-ver-movers]")) { moversAbiertos = !moversAbiertos; actualizarResultados(""); return; }
  const p = e.target.closest("[data-pestana]");
  if (p) { pestanaMovers = p.dataset.pestana; actualizarResultados(""); return; }
  const mas = e.target.closest("[data-grupo]");
  if (mas) { abiertos.add(mas.dataset.grupo); actualizarResultados(document.getElementById("q").value); return; }
  if (e.target.closest(".borrar")) {
    const input = document.getElementById("q");
    input.value = ""; input.focus();
    history.replaceState(null, "", "#/");
    actualizarResultados("");
    return;
  }
  // "Atras" regresa a los resultados si se llego desde ahi
  if (e.target.closest("[data-atras]") && navegoDentro) {
    e.preventDefault();
    history.back();
  }
});

// Al cambiar de pantalla (ficha <-> inicio) se repinta completo.
window.addEventListener("hashchange", () => {
  navegoDentro = true;
  const r = leerRuta();
  if (r.pantalla !== "escaner") salirEscaner();
  if (r.pantalla === "escaner") vistaEscaner();
  else if (r.pantalla === "ficha" || !document.getElementById("q")) {
    if (r.pantalla === "inicio") pintarInicio(r.q); else vistaFicha(r.k);
  } else actualizarResultados(r.q);
  window.scrollTo(0, 0);
});

// ---------- Escaner ----------
let escanerAbierto = false;

function salirEscaner() {
  if (!escanerAbierto) return;
  escanerAbierto = false;
  escaner.cerrarCamara();
  document.body.classList.remove("en-escaner");
  document.getElementById("escaner")?.remove();
}

function precioRapido(fila) {
  const [, , , , , usd] = fila;
  return pesos(aPesos(usd));
}

async function pintarResultado(panel, res, elegido = null) {
  // fila elegida: la del acabado normal si existe; si no, la primera
  const filas = res.filas;
  if (!filas.length) { panel.innerHTML = `<div class="res-vacio">${esc(t("escaner.sin_precio"))}</div>`; panel.hidden = false; return; }
  const fila = elegido || filas.find((f) => f[3] === "n") || filas[0];
  const [k, set, num, acab] = fila;
  const nombre = datos().buscar.nombres.find((n) => n[2].some((i) => datos().buscar.imp[i] === fila))?.[0] || "";
  const acabados = filas.map((f) => `<button type="button" class="chip-acab ${f === fila ? "activo" : ""}" data-acab="${esc(f[0])}">${esc(t(`acabado.${f[3]}`))} · ${precioRapido(f)}</button>`).join("");
  const otras = res.otras.flat().length
    ? `<div class="res-otras"><span class="tenue">${esc(t("escaner.otras"))}</span> ${res.otras.map((fs) => `<button type="button" class="chip-acab" data-otra="${esc(fs[0][0])}">${esc(fs[0][1].toUpperCase())} #${esc(fs[0][2])}</button>`).join("")}</div>`
    : "";
  panel.innerHTML = `<a class="res-fila" href="#/c/${encodeURIComponent(k)}">
      <img src="${miniatura(k)}" alt="">
      <div class="medio"><div class="titulo">${esc(nombre)}</div><div class="sub">${esc(set.toUpperCase())} #${esc(num)} · ${esc(t(`acabado.${acab}`))}</div></div>
      <div class="der"><div class="res-precio num">${precioRapido(fila)}</div><div class="tiendas">TCG</div></div></a>
    <div class="res-tiendas num" id="res-tiendas"></div>
    <div class="res-acabados">${acabados}</div>${otras}`;
  panel.hidden = false;
  panel.onclick = (e) => {
    const b = e.target.closest("[data-acab]");
    if (b) { e.preventDefault(); pintarResultado(panel, res, filas.find((f) => f[0] === b.dataset.acab)); return; }
    const o = e.target.closest("[data-otra]");
    if (o) {
      e.preventDefault();
      const sid = o.dataset.otra.split(":")[0];
      const grupo = res.otras.find((fs) => fs[0][0].startsWith(sid));
      const nuevo = { ...res, filas: grupo, otras: [res.filas, ...res.otras.filter((fs) => fs !== grupo)] };
      pintarResultado(panel, nuevo);
    }
  };
  // precios de tiendas (del trozo del dia; normalmente ya esta en cache)
  try {
    const f = await impresion(k);
    const caja = panel.querySelector("#res-tiendas");
    if (!f || !caja) return;
    const partes = [];
    if (f.har?.jpy) partes.push(`HAR ${pesos(yenAPesos(f.har.jpy))}`);
    if (f.scg?.usd) partes.push(`SCG ${pesos(aPesos(f.scg.usd))}`);
    if (f.ck?.usd) partes.push(`CK ${pesos(aPesos(f.ck.usd))}`);
    if (f.ck?.compra_usd) partes.push(`<span class="sube">${esc(t("escaner.ck_compra", { precio: pesos(aPesos(f.ck.compra_usd)) }))}</span>`);
    caja.innerHTML = partes.join(" · ");
  } catch { /* sin precios de tienda: queda solo TCG */ }
}

async function vistaEscaner() {
  if (escanerAbierto) return;
  escanerAbierto = true;
  document.body.classList.add("en-escaner");
  const cont = document.createElement("section");
  cont.id = "escaner";
  cont.innerHTML = `<video playsinline muted autoplay></video>
    <div class="guia-capa"><div class="guia"></div></div>
    <a class="esc-cerrar" href="#/" data-atras aria-label="${esc(t("ajustes.cerrar"))}">✕</a>
    <div class="esc-estado" id="esc-estado">${esc(t("escaner.preparando"))}</div>
    <div class="esc-panel" id="esc-panel" hidden></div>`;
  document.body.appendChild(cont);
  cont.querySelector("[data-atras]").addEventListener("click", (e) => {
    if (navegoDentro) { e.preventDefault(); history.back(); }
  });
  const estado = cont.querySelector("#esc-estado"), panel = cont.querySelector("#esc-panel");
  const guia = cont.querySelector(".guia");
  const textos = { buscando: t("escaner.buscando"), leyendo: t("escaner.leyendo"), listo: t("escaner.listo") };
  try {
    await escaner.preparar((paso) => { estado.textContent = t(`escaner.cargando_${paso}`); });
    if (!escanerAbierto) return;
    await escaner.abrirCamara(cont.querySelector("video"), guia, {
      estado: (e) => { estado.textContent = textos[e] || ""; estado.dataset.estado = e; guia.dataset.estado = e; },
      resultado: (res) => pintarResultado(panel, res),
    });
  } catch (e) {
    const motivo = e?.name === "NotAllowedError" ? "escaner.sin_permiso" : e?.message === "sin_vision" ? "escaner.sin_indice" : "escaner.error";
    estado.textContent = t(motivo);
    estado.dataset.estado = "error";
  }
}

document.querySelector(".idiomas").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-idioma]");
  if (!b) return;
  await cargarIdioma(b.dataset.idioma);
  marcarIdioma();
  const r = leerRuta();
  if (r.pantalla === "ficha") vistaFicha(r.k); else pintarInicio(r.q);
});

// ---------- Ajustes (engrane) ----------
const hoja = document.getElementById("ajustes");

function pintarAjustes() {
  const a = leerAjustes();
  const m = datos().manifest;
  const delDia = m?.tc?.usd_mxn;
  hoja.innerHTML = `<form method="dialog" class="hoja-cuerpo">
      <div class="hoja-cabeza"><h2>${esc(t("ajustes.titulo"))}</h2>
        <button type="button" class="cerrar" data-cerrar aria-label="${esc(t("ajustes.cerrar"))}">✕</button></div>
      <fieldset>
        <legend>${esc(t("ajustes.usd_mxn"))}</legend>
        <label class="opcion"><input type="radio" name="modo" value="dia" ${a.usd_modo !== "propio" ? "checked" : ""}>
          <span>${esc(t("ajustes.del_dia"))}<span class="tenue num"> · ${delDia ?? "—"}${m?.tc?.dia ? ` (${esc(fecha(m.tc.dia))})` : ""}</span></span></label>
        <label class="opcion"><input type="radio" name="modo" value="propio" ${a.usd_modo === "propio" ? "checked" : ""}>
          <span>${esc(t("ajustes.propio"))}</span></label>
        <input class="valor num" name="propio" type="number" inputmode="decimal" step="0.01" min="1"
               placeholder="${delDia ?? "18.50"}" value="${a.usd_propio ?? ""}" aria-label="${esc(t("ajustes.propio"))}">
        <p class="tenue nota">${esc(t("ajustes.nota_jpy", { jpy: m?.tc?.jpy_usd ?? "—" }))}</p>
      </fieldset>
      <button type="submit" class="guardar">${esc(t("ajustes.guardar"))}</button>
    </form>`;
  const campo = hoja.querySelector("[name=propio]");
  const sync = () => { campo.disabled = hoja.querySelector("[name=modo]:checked").value !== "propio"; };
  hoja.querySelectorAll("[name=modo]").forEach((r) => r.addEventListener("change", () => { sync(); if (!campo.disabled) campo.focus(); }));
  sync();
}

document.getElementById("abrir-ajustes").addEventListener("click", () => {
  if (!listo) return;
  pintarAjustes();
  hoja.showModal();
});

hoja.addEventListener("click", (e) => {
  if (e.target === hoja || e.target.closest("[data-cerrar]")) hoja.close();     // tocar fuera o la X cierra sin guardar
});

hoja.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const modo = f.get("modo");
  const propio = Number(String(f.get("propio") || "").replace(",", "."));
  if (modo === "propio" && !(propio > 0)) { hoja.querySelector("[name=propio]").focus(); return; }
  guardarAjustes({ usd_modo: modo, usd_propio: propio > 0 ? propio : null });
  hoja.close();
  const r = leerRuta();
  if (r.pantalla === "ficha") vistaFicha(r.k); else pintarInicio(r.q);
});

function marcarIdioma() {
  document.querySelectorAll("[data-idioma]").forEach((b) => b.classList.toggle("activo", b.dataset.idioma === idiomaActual()));
}

async function iniciar() {
  await cargarIdioma();
  marcarIdioma();
  app.innerHTML = `${buscador()}<div class="estado tenue">${esc(t("estado.cargando"))}</div><div class="cargando"></div>`;
  try {
    const d = await cargar();
    prepararIndice(d.buscar);
    listo = true;
    const r = leerRuta();
    if (r.pantalla === "ficha") vistaFicha(r.k);
    else if (r.pantalla === "escaner") { pintarInicio(""); vistaEscaner(); }
    else pintarInicio(r.q);
  } catch {
    const enLinea = navigator.onLine !== false;          // con internet: el problema es que no estan los archivos
    const titulo = enLinea ? t("error.sin_datos") : t("error.sin_red");
    const ayuda = enLinea ? t("error.sin_datos_ayuda", { url: new URL(`${DATOS_URL}manifest.json`, location.href).href }) : t("error.sin_red_ayuda");
    app.innerHTML = `<div class="vacio"><div class="grande">${esc(titulo)}</div>${esc(ayuda)}
      <div><button type="button" onclick="location.reload()">${esc(t("error.reintentar"))}</button></div></div>`;
  }
}

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

iniciar();
