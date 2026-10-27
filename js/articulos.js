// Articulos: los publica herramientas/publicar_articulos.py en articulos/ (indice.json + una carpeta por articulo).
// Rutas: #/articulos (todos) y #/a/<slug> (uno). En la portada salen los mas recientes.
import { datos, filaDe, precioFila } from "./datos.js";
import { normalizar } from "./buscar.js";
import { fuentePreferida, NOMBRE_FUENTE } from "./ajustes.js";
import { t, pesos, fechaLarga, idiomaActual } from "./i18n.js";

const BASE = "articulos/";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const imgCarta = (k, tam = "small") => { const s = k.split(":")[0]; return `https://cards.scryfall.io/${tam}/front/${s[0]}/${s[1]}/${s}.jpg`; };
let indice = null, pidiendo = null;

export async function cargarIndice() {
  if (indice) return indice;
  if (!pidiendo) {
    pidiendo = fetch(`${BASE}indice.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : { articulos: [] }))
      .then((j) => { indice = (j.articulos || []).filter((a) => !a.borrador); return indice; })
      .catch(() => { pidiendo = null; return []; });
  }
  return pidiendo;
}

const urlDe = (slug, archivo) => `${BASE}${encodeURIComponent(slug)}/${encodeURIComponent(archivo)}`;

function tarjeta(a, grande = false) {
  const otroIdioma = a.idioma && a.idioma !== idiomaActual() ? `<span class="chip">${esc(a.idioma.toUpperCase())}</span>` : "";
  return `<a class="art-tarjeta${grande ? " grande" : ""}" href="#/a/${encodeURIComponent(a.slug)}">
      <div class="art-portada"><img loading="lazy" src="${urlDe(a.slug, a.portada)}" alt=""></div>
      <div class="art-texto">
        <div class="art-meta">${esc(fechaLarga(a.fecha))} · ${esc(t("art.minutos", { n: a.minutos }))} ${otroIdioma}</div>
        <h3>${esc(a.titulo)}</h3>
        <p>${esc(a.resumen)}</p>
      </div></a>`;
}

// Seccion de la portada: el destacado mas reciente en grande y los siguientes dos
export async function seccionPortada(caja) {
  const arts = await cargarIndice();
  if (!caja || !document.body.contains(caja) || !arts.length) return;
  const orden = [...arts].sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0) || b.fecha.localeCompare(a.fecha));
  const [primero, ...resto] = orden;
  caja.innerHTML = `<div class="sec-cabeza"><h2>${esc(t("art.titulo"))}</h2>${arts.length > 3 ? `<a href="#/articulos">${esc(t("art.ver_todos"))} ›</a>` : ""}</div>
    <div class="art-portada-lista">${tarjeta(primero, true)}${resto.slice(0, 2).map((a) => tarjeta(a)).join("")}</div>`;
}

export async function vistaArticulos(app) {
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("art.titulo"))}</h1><div class="cargando"></div>`;
  const arts = await cargarIndice();
  if (!location.hash.startsWith("#/articulos")) return;
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("art.titulo"))}</h1>` +
    (arts.length ? `<div class="art-lista">${arts.map((a) => tarjeta(a)).join("")}</div>` : `<div class="vacio">${esc(t("art.vacio"))}</div>`);
}

// [[Carta]] -> la impresion del set (y numero) si se dio; si no, la mas barata en ingles y normal ("desde"),
// con su precio en la fuente preferida
function buscarCarta(nombre, set, num) {
  const b = datos().buscar;
  if (!b) return null;
  const n = normalizar(nombre);
  const g = b.nombres.find((x) => normalizar(x[0]) === n) || b.nombres.find((x) => x[1].split("|").includes(n));
  if (!g) return null;
  const filas = g[2].map((i) => b.imp[i]);
  if (set) {
    const f = filas.find((x) => x[1] === set && (!num || String(x[2]) === String(num))) || filas.find((x) => x[1] === set);
    if (f) return { fila: f, nombre: g[0], desde: false };
  }
  const base = filas.filter((x) => x[3] === "n" && x[4] === "en");
  const f = (base.length ? base : filas).reduce((a, b) => (b[5] < a[5] ? b : a));
  return { fila: f, nombre: g[0], desde: filas.length > 1 };
}

function enriquecer(cont) {
  for (const el of cont.querySelectorAll("[data-carta]")) {
    const r = buscarCarta(el.dataset.carta, el.dataset.set, el.dataset.num);
    if (!r) { el.classList.add("sin-dato"); el.removeAttribute("href"); continue; }
    const k = r.fila[0], p = precioFila(r.fila, fuentePreferida());
    el.href = `#/c/${encodeURIComponent(k)}`;
    if (el.classList.contains("carta-tarjeta")) {
      el.innerHTML = `<img loading="lazy" src="${imgCarta(k, "normal")}" alt="${esc(r.nombre)}">
        <span class="ct-nombre">${esc(r.nombre)}</span><span class="ct-set num">${esc(r.fila[1].toUpperCase())} #${esc(r.fila[2])}</span>
        <span class="ct-precio num">${r.desde ? `<small>${esc(t("art.desde"))}</small> ` : ""}${pesos(p.mxn)} <small>${NOMBRE_FUENTE[p.fuente]}</small></span>`;
    } else {
      el.insertAdjacentHTML("beforeend", ` <span class="ref-precio num">${r.desde ? `${esc(t("art.desde"))} ` : ""}${pesos(p.mxn)}</span>`);
      el.dataset.img = imgCarta(k, "normal");
    }
  }
  // vista previa de la carta al pasar el cursor (en computadora)
  let previa = null;
  cont.addEventListener("pointerover", (e) => {
    const a = e.target.closest(".carta-ref[data-img]");
    if (!a || e.pointerType === "touch") return;
    previa?.remove();
    previa = Object.assign(document.createElement("img"), { className: "ref-previa", src: a.dataset.img, alt: "" });
    document.body.appendChild(previa);
    const r = a.getBoundingClientRect();
    previa.style.left = `${Math.min(window.innerWidth - 240, Math.max(8, r.left))}px`;
    previa.style.top = `${r.bottom + 8 + 335 > window.innerHeight ? r.top - 343 : r.bottom + 8}px`;
  });
  cont.addEventListener("pointerout", (e) => { if (e.target.closest(".carta-ref")) { previa?.remove(); previa = null; } });
  window.addEventListener("hashchange", () => { previa?.remove(); previa = null; }, { once: true });
}

export async function vistaArticulo(app, slug) {
  app.innerHTML = `<a class="volver" href="#/articulos" data-atras>${esc(t("ficha.atras"))}</a><div class="cargando"></div>`;
  let a = null;
  try { const r = await fetch(urlDe(slug, "articulo.json"), { cache: "no-cache" }); if (r.ok) a = await r.json(); } catch { a = null; }
  if (location.hash !== `#/a/${encodeURIComponent(slug)}` && location.hash !== `#/a/${slug}`) return;
  if (!a) { app.innerHTML = `<a class="volver" href="#/articulos">${esc(t("ficha.atras"))}</a><div class="vacio">${esc(t("art.no_existe"))}</div>`; return; }
  document.title = `${a.titulo} · Stack`;
  app.innerHTML = `<a class="volver" href="#/articulos" data-atras>${esc(t("ficha.atras"))}</a>
    <article class="articulo">
      <header class="art-cabeza">
        <img class="art-heroe" src="${urlDe(a.slug, a.portada)}" alt="">
        ${a.etiquetas?.length ? `<div class="art-etiquetas">${a.etiquetas.map((e) => `<span class="chip">${esc(e)}</span>`).join("")}</div>` : ""}
        <h1>${esc(a.titulo)}</h1>
        <p class="art-resumen">${esc(a.resumen)}</p>
        <div class="art-meta">${esc(a.autor)} · ${esc(fechaLarga(a.fecha))} · ${esc(t("art.minutos", { n: a.minutos }))}</div>
      </header>
      <div class="art-cuerpo" id="art-cuerpo">${a.html}</div>
    </article>`;
  const cuerpo = app.querySelector("#art-cuerpo");
  for (const img of cuerpo.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    if (!/^https?:/.test(src)) img.src = urlDe(a.slug, src);
  }
  enriquecer(cuerpo);
}
