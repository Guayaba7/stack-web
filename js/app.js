// Arranque, rutas y pantallas. Rutas: #/ (inicio), #/?q=texto (resultados), #/c/<clave> (ficha).
import { POR_GRUPO, ZONA, DATOS_URL } from "./config.js";
import { cargar, datos, aPesos, yenAPesos, impresion, filaDe as filaImp, precioFila, cargarUniverso, universoListo } from "./datos.js";
import { prepararIndice, buscar } from "./buscar.js";
import { cargarIdioma, idiomaActual, t, pesos, moneda, fecha, fechaLarga, porcentaje } from "./i18n.js";
import { leerAjustes, guardarAjustes, usdMxn, fuentePreferida, FUENTES_PREF, NOMBRE_FUENTE } from "./ajustes.js";
import { logoSvg } from "./logo.js";
import { vistaLegal } from "./legal.js";
import * as art from "./articulos.js";
import * as escaner from "./escaner.js";
import * as scry from "./scryfall.js";
import * as cv from "./cuenta_vistas.js";
import * as meta from "./meta.js";
import { vistaApp } from "./descarga.js";
import { nuevoTog, togActivo, alternarTog, pasaFila, barraToggles } from "./filtros.js";

const app = document.getElementById("app");
const FUENTES = [["tcg", "TCG"], ["har", "HAR"], ["har_jp", "HAR JP"], ["scg", "SCG"], ["ck", "CK"]];
const LETRAS = { H: "HAR", J: "HAR JP", S: "SCG", C: "CK" };
let listo = false;
let navegoDentro = false;             // si se llego a la ficha desde la pagina, "Atras" regresa a donde estaba
let pestanaMovers = "suben";
let moversAbiertos = false;          // en la portada los movers van plegados
const abiertos = new Set();          // grupos con "Ver mas" abierto
const TOGR = nuevoTog();             // toggles de color / tipo / acabado / rareza de los resultados
// controles de los resultados: panel de filtros (cerrado), orden y rango de precio (en pesos, con la fuente preferida)
const CTL = { panel: false, orden: "rel", min: null, max: null };
const precioDe = (fila) => precioFila(fila, fuentePreferida()).mxn;
const pasaPrecio = (fila) => {
  if (CTL.min == null && CTL.max == null) return true;
  const v = precioDe(fila);
  return v != null && (CTL.min == null || v >= CTL.min) && (CTL.max == null || v <= CTL.max);
};
const nFiltros = () => TOGR.c.size + TOGR.t.size + TOGR.a.size + TOGR.r.size;
function controles() {
  const n = nFiltros();
  return `<div class="controles">
      <button type="button" class="ctl-filtros${CTL.panel ? " abierto" : ""}${n ? " activo" : ""}" data-ctl="panel" aria-expanded="${CTL.panel}">
        ${esc(t("ctl.filtros"))}${n ? ` <b class="num">${n}</b>` : ""} <span aria-hidden="true">${CTL.panel ? "▴" : "▾"}</span></button>
      <select class="ctl-orden" data-ctl="orden" aria-label="${esc(t("ctl.orden"))}">
        ${[["rel", "ctl.relevancia"], ["barata", "ctl.barata"], ["cara", "ctl.cara"]].map(([v, k]) => `<option value="${v}"${CTL.orden === v ? " selected" : ""}>${esc(t(k))}</option>`).join("")}
      </select>
      <span class="ctl-precio"><input type="number" inputmode="decimal" min="0" step="any" data-ctl="min" placeholder="${esc(t("ctl.desde"))}" value="${CTL.min ?? ""}" aria-label="${esc(t("ctl.desde"))}">
        <span class="tenue">–</span><input type="number" inputmode="decimal" min="0" step="any" data-ctl="max" placeholder="${esc(t("ctl.hasta"))}" value="${CTL.max ?? ""}" aria-label="${esc(t("ctl.hasta"))}"></span>
    </div>${CTL.panel ? barraToggles(TOGR, "r") : ""}`;
}
function pintarControles() { const c = document.getElementById("controles"); if (c) c.innerHTML = controles(); }

const ICONO_CAMARA = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="8.5" y="7" width="7" height="10" rx="1"/></svg>`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const miniatura = (k) => {
  const sid = k.split(":")[0];
  return `https://cards.scryfall.io/small/front/${sid[0]}/${sid[1]}/${sid}.jpg`;
};
const ICONO_LUPA = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>`;
// precio grande de una fila (fuente preferida; si esa tienda no tiene la carta, TCG)
function precioHtml(fila) {
  const p = precioFila(fila, fuentePreferida());
  return `<div class="precio num">${pesos(p.mxn)}</div><div class="tiendas${p.fuente !== fuentePreferida() ? " otra" : ""}">${NOMBRE_FUENTE[p.fuente]}</div>`;
}
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
      <span class="lupa">${ICONO_LUPA}</span>
      <input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false"
             value="${esc(q)}" aria-label="${esc(t("buscar.placeholder"))}">
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
    const pm = precioFila(filaImp(x.k) || [x.k, , , , , x.usd], fuentePreferida());
    const der = pestanaMovers === "nuevas"
      ? `<div class="precio num">${pesos(pm.mxn)}</div><div class="sub">${esc(t("movers.nuevas_dias", { n: x.dias }))}</div>`
      : `<div class="precio num">${pesos(pm.mxn)}</div><div class="sub num ${x.pct > 0 ? "sube" : "baja"}">${porcentaje(x.pct)}</div>`;
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
  // universo: las impresiones de menos de $2 de estos nombres llegan aparte; al llegar se vuelve a pintar
  const faltan = grupos.filter((g) => !universoListo(g.nombre)).map((g) => g.nombre);
  if (faltan.length) cargarUniverso(faltan).then(() => { const i = document.getElementById("q"); if (i && i.value === q) actualizarResultados(q); });
  const pasa = (i) => pasaFila(TOGR, b.imp[i]) && pasaPrecio(b.imp[i]);
  if (CTL.orden !== "rel") {                       // por precio: una sola lista con todas las impresiones de lo buscado
    const todas = [];
    for (const g of grupos) for (const i of g.imp) if (pasa(i)) todas.push([i, g.nombre, precioDe(b.imp[i])]);
    todas.sort((x, y) => (x[2] == null) - (y[2] == null) || (CTL.orden === "barata" ? x[2] - y[2] : y[2] - x[2]));
    if (!todas.length) return faltan.length ? `<div class="cargando"></div>` : `<div class="vacio">${esc(t("tog.nada"))}</div>`;
    return `<ul class="lista">${todas.slice(0, 150).map(([i, nombre]) => {
      const [k, set, num, acab, idioma] = b.imp[i];
      return filaDe(k, nombre, `${set.toUpperCase()} #${num} · ${t(`acabado.${acab}`)} · ${idioma.toUpperCase()}`, precioHtml(b.imp[i]));
    }).join("")}</ul>${todas.length > 150 ? `<p class="tenue centro">${esc(t("ctl.primeras", { n: 150, total: todas.length }))}</p>` : ""}${faltan.length ? `<div class="cargando"></div>` : ""}`;
  }
  const conFiltro = grupos.map((g) => ({ ...g, imp: g.imp.filter(pasa) })).filter((g) => g.imp.length || !universoListo(g.nombre));
  if (!conFiltro.length) return `<div class="vacio">${esc(t("tog.nada"))}</div>`;
  return conFiltro.map((g) => {
    if (!g.imp.length) return `<section class="grupo"><p class="grupo-nombre">${esc(g.nombre)}</p><div class="cargando"></div></section>`;
    const abierto = abiertos.has(g.nombre);
    const visibles = abierto ? g.imp : g.imp.slice(0, POR_GRUPO);
    const filas = visibles.map((i) => {
      const [k, set, num, acab, idioma, usd, fuentes] = b.imp[i];
      const tiendas = [...(fuentes || "")].map((l) => LETRAS[l]).join(" · ");
      const sub = `${set.toUpperCase()} #${num} · ${t(`acabado.${acab}`)} · ${idioma.toUpperCase()}`;
      return filaDe(k, sub, tiendas || " ", precioHtml(b.imp[i]));
    }).join("");
    const faltan = g.imp.length - visibles.length;
    const cuantas = g.imp.length === 1 ? t("resultados.impresion") : t("resultados.impresiones", { n: g.imp.length });
    return `<section class="grupo"><p class="grupo-nombre">${esc(g.nombre)} <span class="tenue">· ${esc(cuantas)}</span></p>
      <ul class="lista">${filas}</ul>
      ${faltan > 0 ? `<button type="button" class="mas" data-grupo="${esc(g.nombre)}">${esc(t("resultados.ver_mas", { n: faltan }))}</button>` : ""}</section>`;
  }).join("");
}

// ---------- Ficha de una impresion ----------
function filaPrecio(nombre, bloque, mxn, original, extra = "", clave = "") {
  const tr = `<tr${clave && clave === fuentePreferida() ? ' class="preferida"' : ""}>`;
  if (!bloque) return `${tr}<td class="fuente">${esc(nombre)}</td><td class="der tenue">${esc(t("ficha.sin_dato"))}</td></tr>`;
  if (bloque.estado === "sin_match") return `${tr}<td class="fuente">${esc(nombre)}</td><td class="der tenue">${esc(t("ficha.sin_match"))}</td></tr>`;
  const viejo = bloque.estado === "previo";
  const stock = bloque.stock == null ? "" : bloque.stock > 0 ? t("ficha.stock", { n: bloque.stock }) : `<span class="agotado">${esc(t("ficha.agotado"))}</span>`;
  const det = [stock, viejo ? `<span class="viejo">${esc(t("ficha.del", { dia: fecha(bloque.dia) }))}</span>` : "", extra].filter(Boolean).join(" · ");
  return `${tr}<td><div class="fuente">${esc(nombre)}</div>${det ? `<div class="detalle">${det}</div>` : ""}</td>
    <td class="der"><div class="mxn num ${viejo ? "viejo" : ""}">${pesos(mxn)}</div><div class="detalle num">${original}${bloque.cond ? ` ${esc(bloque.cond)}` : ""}</div></td></tr>`;
}

async function vistaFicha(k) {
  soltarVista();
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
          ${filaPrecio(t("ficha.tcg"), tcg, aPesos(tcg.usd), moneda(tcg.usd, "USD"), cambios, "tcg")}
          ${filaPrecio(t("ficha.har"), f.har, yenAPesos(f.har?.jpy), moneda(f.har?.jpy, "JPY"), "", "har")}
          ${f.har_jp ? filaPrecio(t("ficha.har_jp"), f.har_jp, yenAPesos(f.har_jp.jpy), moneda(f.har_jp.jpy, "JPY")) : ""}
          ${filaPrecio(t("ficha.scg"), f.scg, aPesos(f.scg?.usd), moneda(f.scg?.usd, "USD"), "", "scg")}
          ${filaPrecio(t("ficha.ck"), ck, aPesos(ck?.usd), moneda(ck?.usd, "USD"), compra, "ck")}
        </tbody>
      </table>
      <div class="pie num">${esc(t("ficha.cambio", { usd: `${usdMxn(m).valor ?? "—"}${usdMxn(m).propio ? ` (${t("ajustes.propio_corto")})` : ""}`, jpy: m.tc?.jpy_usd ?? "—" }))}<br>${esc(t("estado.datos_del", { dia: fecha(datos().diaUsado) }))}</div>
      ${enlaces ? `<div class="enlaces">${enlaces}</div>` : ""}
      ${cv.bloqueAgregar()}
      <section class="detalles" id="detalles" aria-live="polite"><div class="cargando"></div></section>
    </article>`;
  pintarDetalles(f.sid, k);
  cv.montarAgregar(f);
}

// ---------- Detalles de la carta (Scryfall): texto, legalidad, rulings ----------
const FORMATOS = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander", "premodern"];

function simbolos(texto) {
  // {2}{B}{B} -> iconos de Scryfall; el resto del texto escapado y con saltos de linea
  return esc(texto || "").replace(/\{([^}]+)\}/g, (_, sim) => {
    const archivo = sim.replace(/\//g, "").toUpperCase();
    return `<img class="sim" src="https://svgs.scryfall.io/card-symbols/${encodeURIComponent(archivo)}.svg" alt="{${esc(sim)}}" title="{${esc(sim)}}">`;
  }).replace(/\n/g, "<br>");
}

function cara(c) {
  const pt = c.power != null ? `${esc(c.power)}/${esc(c.toughness)}` : c.loyalty != null ? `${esc(t("detalles.lealtad"))} ${esc(c.loyalty)}` : c.defense != null ? `${esc(t("detalles.defensa"))} ${esc(c.defense)}` : "";
  return `<div class="cara">
      <div class="cara-cabeza"><span class="cara-nombre">${esc(c.name)}</span><span class="costo">${simbolos(c.mana_cost)}</span></div>
      <div class="tipo">${esc(c.type_line || "")}</div>
      ${c.oracle_text ? `<div class="oracle">${simbolos(c.oracle_text)}</div>` : ""}
      ${c.flavor_text ? `<div class="sabor">${esc(c.flavor_text).replace(/\n/g, "<br>")}</div>` : ""}
      ${pt ? `<div class="pt num">${pt}</div>` : ""}
    </div>`;
}

async function pintarDetalles(sid, k) {
  const caja = document.getElementById("detalles");
  if (!caja) return;
  let c;
  try { c = await scry.carta(sid); } catch {
    if (location.hash === `#/c/${encodeURIComponent(k)}`) caja.innerHTML = `<p class="tenue">${esc(t("detalles.sin_red"))}</p>`;
    return;
  }
  if (location.hash !== `#/c/${encodeURIComponent(k)}`) return;
  const caras = c.card_faces && !c.oracle_text ? c.card_faces : [c];
  const estados = { legal: ["legal", "detalles.legal"], not_legal: ["no", "detalles.no_legal"], banned: ["ban", "detalles.prohibida"], restricted: ["res", "detalles.restringida"] };
  const legal = FORMATOS.filter((f) => c.legalities?.[f]).map((f) => {
    const [clase, txt] = estados[c.legalities[f]] || ["no", "detalles.no_legal"];
    return `<div class="formato"><span>${esc(t(`formato.${f}`))}</span><span class="estado-legal ${clase}">${esc(t(txt))}</span></div>`;
  }).join("");
  const datosCarta = [
    c.artist ? [t("detalles.artista"), esc(c.artist)] : null,
    c.released_at ? [t("detalles.fecha"), esc(fechaLarga(c.released_at))] : null,
    c.set_name ? [t("detalles.edicion"), `${esc(c.set_name)} (${esc((c.set || "").toUpperCase())}) #${esc(c.collector_number)}`] : null,
    c.lang ? [t("detalles.idioma"), esc(c.lang.toUpperCase())] : null,
  ].filter(Boolean).map(([a, b]) => `<div class="dato"><span class="tenue">${esc(a)}</span><span>${b}</span></div>`).join("");
  caja.innerHTML = `<h2>${esc(t("detalles.titulo"))}</h2>
    ${caras.map(cara).join("")}
    <div class="datos-carta">${datosCarta}</div>
    <h2>${esc(t("detalles.legalidad"))}</h2>
    <div class="legalidad">${legal}</div>
    <h2>${esc(t("detalles.rulings"))}</h2>
    <div id="rulings"><div class="cargando"></div></div>`;
  try {
    const rs = await scry.reglas(sid);
    const zona = document.getElementById("rulings");
    if (!zona) return;
    if (!rs.length) { zona.innerHTML = `<p class="tenue">${esc(t("detalles.sin_rulings"))}</p>`; return; }
    const fila = (r) => `<li><span class="tenue num">${esc(fechaLarga(r.published_at))}</span> ${simbolos(r.comment)}</li>`;
    const corto = rs.slice(0, 3).map(fila).join(""), resto = rs.slice(3).map(fila).join("");
    zona.innerHTML = `<ul class="rulings">${corto}</ul>${resto ? `<details><summary>${esc(t("detalles.ver_todos", { n: rs.length }))}</summary><ul class="rulings">${resto}</ul></details>` : ""}`;
  } catch {
    const zona = document.getElementById("rulings");
    if (zona) zona.innerHTML = `<p class="tenue">${esc(t("detalles.sin_red"))}</p>`;
  }
}

// ---------- Rutas ----------
function leerRuta() {
  const h = location.hash.replace(/^#/, "") || "/";
  if (h.startsWith("/c/")) return { pantalla: "ficha", k: decodeURIComponent(h.slice(3)) };
  if (h.startsWith("/escaner/deck/")) return { pantalla: "escaner", deck: decodeURIComponent(h.slice(14)) };
  if (h.startsWith("/escaner")) return { pantalla: "escaner" };
  if (h.startsWith("/cuenta")) return { pantalla: "cuenta" };
  if (h.startsWith("/inv/")) return { pantalla: "inventario", id: decodeURIComponent(h.slice(5)) };
  if (h.startsWith("/inv")) return { pantalla: "inventarios" };
  if (h.startsWith("/watch")) return { pantalla: "watchlist" };
  if (h.startsWith("/privacidad")) return { pantalla: "privacidad" };
  if (h.startsWith("/stack")) return { pantalla: "stack" };
  if (h.startsWith("/s/")) return { pantalla: "stack", codigo: decodeURIComponent(h.slice(3)) };
  if (h.startsWith("/articulos")) return { pantalla: "articulos" };
  if (h.startsWith("/a/")) return { pantalla: "articulo", slug: decodeURIComponent(h.slice(3)) };
  if (h.startsWith("/terminos")) return { pantalla: "terminos" };
  if (h === "/app" || h.startsWith("/app/")) return { pantalla: "app" };
  if (h.startsWith("/meta")) return { pantalla: "meta", fmt: decodeURIComponent(h.split("/")[2] || "") };
  if (h.startsWith("/decks")) return { pantalla: "decks", id: decodeURIComponent(h.split("/")[2] || "") };
  const q = new URLSearchParams(h.split("?")[1] || "").get("q") || "";
  return { pantalla: "inicio", q };
}

// Sin busqueda: portada (logo grande, nombre, buscador). Con busqueda: buscador arriba y resultados.
const esPortada = (q) => q.trim().length < 2;

function vistaPortadaExtra() {
  const articulos = `<section class="art-seccion" id="art-portada"></section>`;
  if (!datos().movers) return articulos;
  return `<button type="button" class="ver-movers" data-ver-movers aria-expanded="${moversAbiertos}">${esc(t("movers.titulo"))} ${moversAbiertos ? "▴" : "▾"}</button>
    ${moversAbiertos ? `<div class="movers-portada">${vistaMovers()}</div>` : ""}${articulos}`;
}
const llenarArticulos = () => art.seccionPortada(document.getElementById("art-portada"));

function pintarInicio(q) {
  soltarVista();
  const portada = esPortada(q);
  document.body.classList.toggle("en-portada", portada);
  app.innerHTML = portada
    ? `<section class="portada">${logoSvg("logo-grande", 132)}<h1 class="nombre">Stack</h1>
        ${buscador(q)}${estadoDelDia()}${cv.accesosPortada()}</section><div id="contenido">${vistaPortadaExtra()}</div>`
    : `${buscador(q)}${estadoDelDia()}<div id="controles">${controles()}</div><div id="contenido">${vistaResultados(q)}</div>`;
  if (portada) llenarArticulos();
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
  if (esPortada(q)) llenarArticulos();
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

app.addEventListener("change", (e) => {
  const c = e.target.closest("[data-ctl='orden']");
  if (c) { CTL.orden = c.value; actualizarResultados(document.getElementById("q").value); }
});
app.addEventListener("input", (e) => {
  const c = e.target.closest("[data-ctl='min'], [data-ctl='max']");
  if (!c) return;
  const v = c.value.trim() === "" ? null : Number(c.value);
  CTL[c.dataset.ctl] = Number.isFinite(v) ? v : null;
  actualizarResultados(document.getElementById("q").value);
});
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
  const tg = e.target.closest(".toggles[data-tog-ns='r'] [data-tog]");
  if (tg) { alternarTog(TOGR, Number(tg.dataset.tog)); pintarControles(); actualizarResultados(document.getElementById("q").value); return; }
  if (e.target.closest("[data-ctl='panel']")) { CTL.panel = !CTL.panel; pintarControles(); return; }
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
// Pantallas de la cuenta (inventarios, watchlist, entrar/crear)
const soltarVista = () => { app.onclick = app.oninput = app.onchange = null; document.body.classList.remove("ancho"); };   // lo que dejan META / DECKS
function pantallaCuenta(r) {
  soltarVista();
  document.body.classList.remove("en-portada");
  document.body.classList.toggle("ancho", r.pantalla === "meta" || r.pantalla === "decks");
  if (r.pantalla === "cuenta") cv.vistaCuenta(app);
  else if (r.pantalla === "inventarios") cv.vistaInventarios(app);
  else if (r.pantalla === "stack") cv.vistaStack(app, r.codigo || "");
  else if (r.pantalla === "inventario") cv.vistaInventario(app, r.id);
  else if (r.pantalla === "watchlist") cv.vistaWatchlist(app);
  else if (r.pantalla === "privacidad" || r.pantalla === "terminos") vistaLegal(app, r.pantalla);
  else if (r.pantalla === "articulos") art.vistaArticulos(app);
  else if (r.pantalla === "articulo") art.vistaArticulo(app, r.slug);
  else if (r.pantalla === "meta") meta.vistaMeta(app, r.fmt);
  else if (r.pantalla === "decks") meta.vistaDecks(app, r.id);
  else if (r.pantalla === "app") vistaApp(app);
  else return false;
  return true;
}

window.addEventListener("hashchange", (ev) => {
  navegoDentro = true;
  cv.recordarOrigen(ev.oldURL, location.hash);
  document.title = "Stack";
  const r = leerRuta();
  if (r.pantalla !== "escaner") salirEscaner();
  if (r.pantalla === "escaner") vistaEscaner(r.deck);
  else if (pantallaCuenta(r)) { /* listo */ }
  else if (r.pantalla === "ficha" || !document.getElementById("q")) {
    if (r.pantalla === "inicio") pintarInicio(r.q); else vistaFicha(r.k);
  } else actualizarResultados(r.q);
  window.scrollTo(0, 0);
});

// ---------- Escaner ----------
// En cadena: cada carta que el escaner reconoce entra sola al LOTE (abajo, con el total). Al final, TERMINAR pregunta
// a donde mandarlas: a un inventario de la cuenta o a un codigo para compartir (se abre en la app o en esta pagina).
let escanerAbierto = false;
const LOTE_LLAVE = "stack.lote";
const ACAB_INV = { n: "nonfoil", f: "foil", e: "etched" };
let destinoDeck = null;               // {id, nombre}: el escaner se abrio desde un deck (#/escaner/deck/ID): lo escaneado va a ese deck
const llaveLote = () => (destinoDeck ? `${LOTE_LLAVE}.deck.${destinoDeck.id}` : LOTE_LLAVE);   // cada deck con su propio lote
let lote = leerLote();                // [{k, nombre, set, num, acab, idioma, q}]
let panelAbierto = false;             // el panel del escaner va compacto (una linea abajo); se abre tocando ▴
let enPanel = null;                   // {id, k}: la carta del panel y la entrada del lote que le toca

function leerLote() {
  try { const v = JSON.parse(localStorage.getItem(llaveLote()) || "[]"); return Array.isArray(v) ? v.filter((x) => x && x.k && x.q > 0) : []; }
  catch { return []; }
}
function guardarLote() { try { localStorage.setItem(llaveLote(), JSON.stringify(lote)); } catch { /* sin almacenamiento: vive mientras la pagina este abierta */ } }
function sumarAlLote(fila, nombre, n = 1) {
  const e = lote.find((x) => x.k === fila[0]);
  if (e) e.q += n;
  else if (n > 0) lote.push({ k: fila[0], nombre, set: fila[1], num: fila[2], acab: fila[3], idioma: fila[4], q: n });
  lote = lote.filter((x) => x.q > 0);
  guardarLote();
}
const nCartas = (n) => (n === 1 ? t("lote.una_carta") : t("lote.n_cartas", { n }));
const enLote = (k) => lote.find((x) => x.k === k)?.q || 0;
function totalLote() {
  let piezas = 0, mxn = 0, sin = 0;
  for (const e of lote) {
    piezas += e.q;
    const v = precioFila(filaImp(e.k), fuentePreferida()).mxn;
    if (v == null) sin += e.q; else mxn += v * e.q;
  }
  return { piezas, mxn, sin };
}

function salirEscaner() {
  if (!escanerAbierto) return;
  escanerAbierto = false;
  escaner.cerrarCamara();
  enPanel = null;
  document.body.classList.remove("en-escaner");
  document.getElementById("escaner")?.remove();
  if (destinoDeck) { destinoDeck = null; lote = leerLote(); }   // de vuelta al lote normal
}

function precioRapido(fila) {
  return pesos(precioFila(fila, fuentePreferida()).mxn);
}
const nombreDeFila = (fila) => datos().buscar.nombres.find((n) => n[2].some((i) => datos().buscar.imp[i] === fila))?.[0] || "";

function pintarBarraLote() {
  const cont = document.getElementById("escaner"), barra = document.getElementById("esc-lote");
  if (!cont || !barra) return;
  const tot = totalLote();
  cont.classList.toggle("con-lote", lote.length > 0);
  barra.hidden = !lote.length;
  barra.innerHTML = `<button type="button" class="lote-resumen" data-lote="ver"><span class="tenue">${esc(destinoDeck ? t("lote.titulo_deck", { deck: destinoDeck.nombre || "Deck" }) : t("lote.titulo"))}</span>
      <b class="num">${esc(nCartas(tot.piezas))} · ${pesos(tot.mxn)}</b></button>
    <button type="button" class="primario lote-terminar" data-lote="terminar">${esc(t("lote.terminar"))}</button>`;
}

async function pintarResultado(panel, res, elegido = null) {
  // fila elegida: la del acabado normal si existe; si no, la primera
  const filas = res.filas;
  if (!filas.length) { panel.innerHTML = `<div class="res-vacio">${esc(t("escaner.sin_precio"))}</div>`; panel.hidden = false; return; }
  const fila = elegido || filas.find((f) => f[3] === "n") || filas[0];
  const [k, set, num, acab] = fila;
  const nombre = nombreDeFila(fila);
  // en cadena: una carta nueva entra al lote; si en el panel se cambia el acabado o la edicion, se cambia la del lote
  if (!enPanel || enPanel.id !== res.id) { sumarAlLote(fila, nombre); enPanel = { id: res.id, k }; panelAbierto = false; }   // carta nueva: el panel vuelve a compacto
  else if (enPanel.k !== k) {
    const n = enLote(enPanel.k) ? 1 : 0;                         // si la quitaron del lote, sigue fuera
    if (n) sumarAlLote([enPanel.k], "", -1);
    sumarAlLote(fila, nombre, n);
    enPanel.k = k;
  }
  pintarBarraLote();
  const q = enLote(k);
  const acabados = filas.map((f) => `<button type="button" class="chip-acab ${f === fila ? "activo" : ""}" data-acab="${esc(f[0])}">${esc(t(`acabado.${f[3]}`))} · ${precioRapido(f)}</button>`).join("");
  // otras ediciones: pocas a la vista para no tapar la camara (todas si la edicion es dudosa o se pidio "mas")
  const visibles = res.dudosa || res.todasOtras ? res.otras : res.otras.slice(0, 5);
  const otras = res.otras.flat().length
    ? `<div class="res-otras-tit">${res.dudosa ? `<span class="aviso-ed">${esc(t("escaner.dudosa"))}</span>` : `<span class="tenue">${esc(t("escaner.otras"))}</span>`}</div>
      <div class="ed-rejilla">${visibles.map((fs) => celdaEdicion(fs[0])).join("")}${visibles.length < res.otras.length ? `<button type="button" class="ed-cel ed-mas" data-mas-ed>+${res.otras.length - visibles.length}</button>` : ""}</div>`
    : "";
  const abierto = panelAbierto;
  panel.innerHTML = `<div class="res-cab"><a class="res-fila" href="#/c/${encodeURIComponent(k)}">
      <img src="${miniatura(k)}" alt="">
      <div class="medio"><div class="titulo">${esc(nombre)}</div><div class="sub">${simboloSet(set)} #${esc(num)} · ${esc(t(`acabado.${acab}`))}<span class="ed-promo" data-promo="${esc(k.split(":")[0])}"></span></div></div>
      <div class="der"><div class="res-precio num">${precioRapido(fila)}</div><div class="tiendas">${NOMBRE_FUENTE[precioFila(fila, fuentePreferida()).fuente]}</div></div></a>
      <button type="button" class="res-abrir${res.dudosa && !abierto ? " aviso" : ""}" data-abrir aria-expanded="${abierto}" aria-label="${esc(t(abierto ? "escaner.cerrar_panel" : "escaner.abrir_panel"))}" title="${esc(t(abierto ? "escaner.cerrar_panel" : "escaner.abrir_panel"))}">${q ? `<span class="num">×${q}</span>` : ""}${res.dudosa && !abierto ? "⚠" : ""}<b>${abierto ? "▾" : "▴"}</b></button></div>
    <div class="res-tiendas num" id="res-tiendas"></div>
    <div class="res-lote">${q
      ? `<span class="ok">✓ ${esc(t("lote.en_lote", { n: q }))}</span><button type="button" class="chip-acab" data-q="-1" aria-label="${esc(t("lote.menos"))}">−</button><button type="button" class="chip-acab" data-q="1" aria-label="${esc(t("lote.mas"))}">+</button>`
      : `<span class="tenue">${esc(t("lote.quitada"))}</span><button type="button" class="chip-acab" data-q="1">${esc(t("lote.volver"))}</button>`}</div>
    <div class="res-acabados">${acabados}</div>${otras}`;
  panel.hidden = false;
  panel.classList.toggle("compacto", !abierto);
  adornarEdiciones(panel);
  panel.classList.remove("anterior");
  panel.onclick = (e) => {
    if (e.target.closest("[data-abrir]")) { e.preventDefault(); panelAbierto = !panelAbierto; pintarResultado(panel, res, fila); return; }
    const bq = e.target.closest("[data-q]");
    if (bq) { e.preventDefault(); sumarAlLote(fila, nombre, Number(bq.dataset.q)); pintarResultado(panel, res, fila); return; }
    const b = e.target.closest("[data-acab]");
    if (b) { e.preventDefault(); pintarResultado(panel, res, filas.find((f) => f[0] === b.dataset.acab)); return; }
    if (e.target.closest("[data-mas-ed]")) { e.preventDefault(); pintarResultado(panel, { ...res, todasOtras: true }, fila); return; }
    const o = e.target.closest("[data-otra]");
    if (o) {
      e.preventDefault();
      const sid = o.dataset.otra.split(":")[0];
      const grupo = res.otras.find((fs) => fs[0][0].startsWith(sid));
      const nuevo = { ...res, dudosa: false, filas: grupo, otras: [res.filas, ...res.otras.filter((fs) => fs !== grupo)] };
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

// ---- ediciones del escaner: simbolo del set en vez del codigo, numero, y marca de promo (con su año si lleva fecha)
const simboloSet = (set) => `<span class="ed-set" data-set="${esc(String(set).toLowerCase())}">${esc(String(set).toUpperCase())}</span>`;
function celdaEdicion(f) {
  return `<button type="button" class="ed-cel" data-otra="${esc(f[0])}">${simboloSet(f[1])}<span class="ed-num num">#${esc(f[2])}</span>
    <span class="ed-promo" data-promo="${esc(f[0].split(":")[0])}"></span>${f.u ? `<span class="ed-u">&lt;$2</span>` : ""}</button>`;
}
async function adornarEdiciones(panel) {
  const setsEl = [...panel.querySelectorAll(".ed-set[data-set]")], promos = [...panel.querySelectorAll(".ed-promo[data-promo]")];
  scry.simbolosSets().then((mapa) => {
    for (const el of setsEl) {
      const s = mapa.get(el.dataset.set);
      if (!s?.icono || !el.isConnected) continue;
      // el simbolo de Scryfall es negro: se usa como mascara para pintarlo del color del texto del tema
      el.innerHTML = `<i role="img" aria-label="${esc(el.dataset.set.toUpperCase())}" title="${esc(s.nombre)} (${esc(el.dataset.set.toUpperCase())})" style="--ico:url('${esc(s.icono)}')"></i>`;
      el.classList.add("con-icono");
    }
  }).catch(() => { /* sin internet a Scryfall: se queda el codigo del set */ });
  if (!promos.length) return;
  try {
    const cartas = await scry.varias([...new Set(promos.map((el) => el.dataset.promo))]);
    for (const el of promos) {
      const c = cartas.get(el.dataset.promo);
      if (!c || !el.isConnected) continue;
      const tipos = c.promo_types || [];
      if (!c.promo && !tipos.length) continue;
      const fecha = tipos.includes("datestamped") || tipos.includes("prerelease");
      el.textContent = fecha && c.released_at ? t("escaner.promo_fecha", { anio: c.released_at.slice(0, 4) }) : t("escaner.promo");
      el.title = tipos.join(", ");
      el.classList.add("hay");
    }
  } catch { /* sin datos de Scryfall: sin marca */ }
}

// ---- hojas del lote: VER (lista con cantidades) y TERMINAR (a un inventario o a un codigo)
function abrirHoja(cual) {
  const hoja = document.getElementById("esc-hoja");
  if (!hoja) return;
  escaner.pausar(true);
  hoja.hidden = false;
  hoja.dataset.cual = cual;
  if (cual === "ver") pintarHojaLote(hoja); else pintarTerminar(hoja);
}
function cerrarHoja() {
  const hoja = document.getElementById("esc-hoja");
  if (!hoja || hoja.hidden) return;
  hoja.hidden = true; hoja.innerHTML = "";
  escaner.pausar(false);
  pintarBarraLote();
  const panel = document.getElementById("esc-panel");
  if (panel && !lote.length) panel.hidden = true;
}
const cabezaHoja = (titulo) => `<div class="hoja-cabeza"><h2>${esc(titulo)}</h2><button type="button" class="cerrar" data-hoja="cerrar" aria-label="${esc(t("ajustes.cerrar"))}">✕</button></div>`;

function pintarHojaLote(hoja) {
  const tot = totalLote();
  if (!lote.length) { cerrarHoja(); return; }
  hoja.innerHTML = `<div class="hoja-cuerpo">${cabezaHoja(t("lote.titulo"))}
    <div class="lote-total num"><span>${esc(nCartas(tot.piezas))}</span><b>${pesos(tot.mxn)}</b></div>
    ${tot.sin ? `<p class="tenue">${esc(t("lote.sin_precio", { n: tot.sin }))}</p>` : ""}
    <ul class="lista lote-lista">${lote.map((e, i) => {
      const v = precioFila(filaImp(e.k), fuentePreferida()).mxn;
      return `<li class="fila"><img src="${miniatura(e.k)}" alt="" loading="lazy">
        <div class="medio"><div class="titulo">${esc(e.nombre)}</div><div class="sub">${esc(String(e.set).toUpperCase())} #${esc(e.num)} · ${esc(t(`acabado.${e.acab}`))} · ${pesos(v)}</div></div>
        <div class="lote-q"><button type="button" class="chip-acab" data-i="${i}" data-d="-1" aria-label="${esc(t("lote.menos"))}">−</button>
          <b class="num">${e.q}</b><button type="button" class="chip-acab" data-i="${i}" data-d="1" aria-label="${esc(t("lote.mas"))}">+</button>
          <button type="button" class="chip-acab" data-i="${i}" data-d="x" aria-label="${esc(t("lote.quitar"))}">✕</button></div></li>`;
    }).join("")}</ul>
    <button type="button" class="primario ancho" data-hoja="terminar">${esc(t("lote.terminar"))}</button>
    <button type="button" class="boton-vacio ancho" data-hoja="vaciar">${esc(t("lote.vaciar"))}</button></div>`;
}

async function pintarTerminar(hoja, aviso = "") {
  const tot = totalLote();
  if (!lote.length) { cerrarHoja(); return; }
  const conCuenta = cv.sesionActiva();
  hoja.innerHTML = `<div class="hoja-cuerpo">${cabezaHoja(t("lote.terminar_titulo"))}
    <p class="lote-total num"><span>${esc(nCartas(tot.piezas))}</span><b>${pesos(tot.mxn)}</b></p>
    ${aviso}
    ${destinoDeck ? `<section class="aj-grupo"><h3 class="aj-tit">${esc(t("lote.a_deck", { deck: destinoDeck.nombre || "Deck" }))}</h3>
      <button type="button" class="primario ancho" data-hoja="deck">${esc(t("lote.anadir_deck", { n: tot.piezas }))}</button><p class="tenue" id="lote-deck-msg" role="status"></p></section>` : ""}
    <section class="aj-grupo"><h3 class="aj-tit">${esc(t("lote.a_inventario"))}</h3><div id="lote-inv">${conCuenta ? `<div class="cargando"></div>`
      : `<p class="tenue">${esc(t("lote.entra"))}</p><a class="boton-vacio" href="#/cuenta">${esc(t("cuenta.entrar"))}</a>`}</div></section>
    <section class="aj-grupo"><h3 class="aj-tit">${esc(t("lote.compartir"))}</h3><div id="lote-cod">
      <p class="tenue">${esc(t("lote.compartir_ayuda"))}</p>
      <button type="button" class="primario ancho" data-hoja="codigo">${esc(t("lote.crear_codigo"))}</button></div></section>
    <button type="button" class="boton-vacio ancho" data-hoja="ver">${esc(t("lote.revisar"))}</button></div>`;
  if (!conCuenta) return;
  const caja = hoja.querySelector("#lote-inv");
  let invs;
  try { invs = await cv.inventariosCuenta(); } catch (e) { caja.innerHTML = `<p class="error">${esc(cv.mensajeCuenta(e))}</p>`; return; }
  if (!hoja.contains(caja)) return;
  const opciones = invs.length
    ? invs.map((i) => `<option value="${esc(i.tipo)}">${esc(i.nombre === "(default)" ? t("inv.default") : i.nombre)}</option>`).join("")
    : `<option value="">${esc(t("inv.default"))}</option>`;
  caja.innerHTML = `<label class="lote-sel">${esc(t("inv.inventario"))}<select id="lote-destino">${opciones}</select></label>
    <button type="button" class="primario ancho" data-hoja="inventario">${esc(tot.piezas === 1 ? t("lote.anadir_1") : t("lote.anadir", { n: tot.piezas }))}</button>
    <p class="tenue" id="lote-inv-msg" role="status"></p>`;
}

async function accionHoja(hoja, accion, boton) {
  if (accion === "cerrar") { cerrarHoja(); return; }
  if (accion === "ver") { hoja.dataset.cual = "ver"; pintarHojaLote(hoja); return; }
  if (accion === "terminar") { hoja.dataset.cual = "terminar"; pintarTerminar(hoja); return; }
  if (accion === "vaciar") {
    if (boton.dataset.seguro !== "1") { boton.dataset.seguro = "1"; boton.textContent = t("lote.vaciar_seguro"); return; }
    lote = []; guardarLote(); enPanel = null; cerrarHoja(); return;
  }
  if (accion === "deck" && destinoDeck) {
    const msg = hoja.querySelector("#lote-deck-msg"), id = destinoDeck.id;
    boton.disabled = true; msg.className = "tenue"; msg.textContent = t("inv.agregando");
    try {
      await meta.agregarAlDeck(id, lote.map((e) => ({ n: e.nombre, sid: e.k.split(":")[0], acab: ACAB_INV[e.acab] || "nonfoil", q: e.q })));
      lote = []; guardarLote(); enPanel = null;
      location.hash = `#/decks/${encodeURIComponent(id)}`;
    } catch (e) { boton.disabled = false; msg.className = "error"; msg.textContent = cv.mensajeCuenta(e); }
    return;
  }
  if (accion === "inventario") {
    const msg = hoja.querySelector("#lote-inv-msg"), sel = hoja.querySelector("#lote-destino");
    boton.disabled = true; msg.className = "tenue"; msg.textContent = t("inv.agregando");
    try {
      const lineas = lote.map((e) => ({ sid: e.k.split(":")[0], acab: ACAB_INV[e.acab] || "nonfoil", nombre: e.nombre, set: e.set, numero: e.num, cantidad: e.q }));
      const piezas = lote.reduce((s, e) => s + e.q, 0);
      const nombreInv = await cv.agregarVarias(sel.value, lineas);
      lote = []; guardarLote(); enPanel = null;
      const panel = document.getElementById("esc-panel"); if (panel) panel.hidden = true;
      hoja.innerHTML = `<div class="hoja-cuerpo">${cabezaHoja(t("lote.listo"))}
        <p class="ok">${esc(t("lote.anadidas", { n: piezas, inv: nombreInv === "(default)" ? t("inv.default") : nombreInv }))}</p>
        <button type="button" class="primario ancho" data-hoja="cerrar">${esc(t("lote.seguir"))}</button></div>`;
    } catch (e) {
      boton.disabled = false; msg.className = "error"; msg.textContent = cv.mensajeCuenta(e);
    }
    return;
  }
  if (accion === "codigo") {
    const caja = hoja.querySelector("#lote-cod");
    boton.disabled = true; boton.textContent = t("lote.creando");
    const m = datos().manifest;
    const doc = { esquema: 1, tipo: "inventario", nombre: t("lote.nombre_doc", { fecha: fecha(hoyMexico()) }), creado: new Date().toISOString().slice(0, 19) + "+00:00",
      app: "web", de: null, con_costos: false, fecha_precios: datos().diaUsado, tasa_usd_mxn: usdMxn(m).valor ?? null,
      piezas: lote.map((e) => ({ sid: e.k.split(":")[0], acab: ACAB_INV[e.acab] || "nonfoil", nombre: e.nombre, set: e.set, numero: e.num,
        idioma: e.idioma || null, cantidad: e.q, usd: filaImp(e.k)?.[5] ?? null })) };
    try {
      const r = await cv.crearCodigo(doc);
      const enlace = `${location.origin}${location.pathname}#/s/${r.codigo}`;
      caja.innerHTML = `<div class="lote-codigo num" id="lote-codigo">${esc(r.codigo)}</div>
        <p class="tenue">${esc(t("lote.codigo_ayuda", { fecha: fecha(String(r.expira || "").slice(0, 10)) }))}</p>
        <div class="lote-botones"><button type="button" class="boton-vacio" data-copiar="${esc(r.codigo)}">${esc(t("lote.copiar_codigo"))}</button>
          <button type="button" class="boton-vacio" data-copiar="${esc(enlace)}">${esc(t("lote.copiar_enlace"))}</button></div>
        <p class="tenue" id="lote-cod-msg" role="status"></p>`;
    } catch (e) {
      boton.disabled = false; boton.textContent = t("lote.crear_codigo");
      const p = document.createElement("p"); p.className = "error"; p.textContent = cv.mensajeCodigo(e); caja.appendChild(p);
    }
  }
}

async function vistaEscaner(deckId) {
  if (escanerAbierto) return;
  escanerAbierto = true;
  enPanel = null;
  destinoDeck = deckId ? { id: deckId, nombre: "" } : null;
  lote = leerLote();
  if (destinoDeck) meta.nombreDeck(deckId).then((n) => { if (destinoDeck && destinoDeck.id === deckId) { destinoDeck.nombre = n || ""; pintarBarraLote(); } }).catch(() => {});
  document.body.classList.add("en-escaner");
  const cont = document.createElement("section");
  cont.id = "escaner";
  cont.innerHTML = `<video playsinline muted autoplay></video>
    <div class="guia-capa"><div class="guia"></div></div>
    <a class="esc-cerrar" href="${destinoDeck ? `#/decks/${esc(encodeURIComponent(destinoDeck.id))}` : "#/"}" data-atras aria-label="${esc(t("ajustes.cerrar"))}">✕</a>
    <div class="esc-estado" id="esc-estado">${esc(t("escaner.preparando"))}</div>
    <div class="esc-panel" id="esc-panel" hidden></div>
    <div class="esc-lote" id="esc-lote" hidden></div>
    <div class="esc-hoja" id="esc-hoja" hidden></div>`;
  document.body.appendChild(cont);
  cont.querySelector("[data-atras]").addEventListener("click", (e) => {
    if (navegoDentro) { e.preventDefault(); history.back(); }
  });
  cont.querySelector("#esc-lote").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lote]");
    if (b) abrirHoja(b.dataset.lote);
  });
  const hoja = cont.querySelector("#esc-hoja");
  hoja.addEventListener("click", async (e) => {
    const cp = e.target.closest("[data-copiar]");
    if (cp) {
      const msg = hoja.querySelector("#lote-cod-msg");
      try { await navigator.clipboard.writeText(cp.dataset.copiar); if (msg) { msg.className = "ok"; msg.textContent = t("lote.copiado"); } }
      catch { if (msg) { msg.className = "error"; msg.textContent = t("lote.no_copiado"); } }
      return;
    }
    const q = e.target.closest("[data-i]");
    if (q) {
      const ent = lote[Number(q.dataset.i)];
      if (ent) { ent.q = q.dataset.d === "x" ? 0 : ent.q + Number(q.dataset.d); lote = lote.filter((x) => x.q > 0); guardarLote(); }
      pintarHojaLote(hoja);
      return;
    }
    const b = e.target.closest("[data-hoja]");
    if (b) accionHoja(hoja, b.dataset.hoja, b);
  });
  // el lote de otra vez (guardado en este navegador): sus impresiones de < $2 se bajan para tener precio
  if (lote.length) cargarUniverso([...new Set(lote.map((e) => e.nombre))]).then(pintarBarraLote);
  pintarBarraLote();
  const estado = cont.querySelector("#esc-estado"), panel = cont.querySelector("#esc-panel");
  const guia = cont.querySelector(".guia");
  const textos = { buscando: t("escaner.buscando"), leyendo: t("escaner.leyendo"), listo: t("escaner.listo"), dificil: t("escaner.dificil"), reflejo: t("escaner.reflejo") };
  try {
    await escaner.preparar((paso) => { estado.textContent = t(`escaner.cargando_${paso}`); });
    if (!escanerAbierto) return;
    await escaner.abrirCamara(cont.querySelector("video"), guia, {
      estado: (e) => { estado.textContent = textos[e] || ""; estado.dataset.estado = e; guia.dataset.estado = e; },
      resultado: (res) => { if (res) pintarResultado(panel, res); else panel.classList.add("anterior"); },
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
  cv.marcarBoton();
  const r = leerRuta();
  if (r.pantalla === "ficha") vistaFicha(r.k); else if (!pantallaCuenta(r)) pintarInicio(r.q);
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
      <section class="aj-grupo">
        <h3 class="aj-tit">${esc(t("ajustes.fuente"))}</h3>
        <div class="segmentos">${FUENTES_PREF.map((f) => `<label><input type="radio" name="fuente" value="${f}" ${fuentePreferida() === f ? "checked" : ""}><span>${esc(t(`ajustes.fuente_${f}`))}</span></label>`).join("")}</div>
        <div class="nota-ajuste"><p>${esc(t("ajustes.fuente_nota"))}</p><p>${esc(t("ajustes.fuente_nota2"))}</p></div>
      </section>
      <section class="aj-grupo">
        <h3 class="aj-tit">${esc(t("ajustes.usd_mxn"))}</h3>
        <label class="opcion"><input type="radio" name="modo" value="dia" ${a.usd_modo !== "propio" ? "checked" : ""}>
          <span>${esc(t("ajustes.del_dia"))}<span class="tenue num"> · ${delDia ?? "—"}${m?.tc?.dia ? ` (${esc(fecha(m.tc.dia))})` : ""}</span></span></label>
        <label class="opcion"><input type="radio" name="modo" value="propio" ${a.usd_modo === "propio" ? "checked" : ""}>
          <span>${esc(t("ajustes.propio"))}</span></label>
        <input class="valor num" name="propio" type="number" inputmode="decimal" step="0.01" min="1"
               placeholder="${delDia ?? "18.50"}" value="${a.usd_propio ?? ""}" aria-label="${esc(t("ajustes.propio"))}">
        <div class="nota-ajuste"><p>${esc(t("ajustes.nota_usd"))}</p><p>${esc(t("ajustes.nota_jpy", { jpy: m?.tc?.jpy_usd ?? "—" }))}</p></div>
      </section>
      <button type="submit" class="guardar">${esc(t("ajustes.guardar"))}</button>
      <div class="legales"><a href="#/privacidad" data-cerrar>${esc(t("legal.privacidad"))}</a><a href="#/terminos" data-cerrar>${esc(t("legal.terminos"))}</a></div>
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
  guardarAjustes({ usd_modo: modo, usd_propio: propio > 0 ? propio : null, fuente: f.get("fuente") || "tcg" });
  hoja.close();
  const r = leerRuta();
  if (r.pantalla === "ficha") vistaFicha(r.k); else if (!pantallaCuenta(r)) pintarInicio(r.q);
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
    await cv.iniciarCuenta();                     // tema de la cuenta (si hay sesion) antes de pintar
    const r = leerRuta();
    if (r.pantalla === "ficha") vistaFicha(r.k);
    else if (r.pantalla === "escaner") { pintarInicio(""); vistaEscaner(r.deck); }
    else if (pantallaCuenta(r)) { /* listo */ }
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
