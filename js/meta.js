// META y DECKBUILDER en la pagina (Stack 0.9.0).
// META: los archivos meta/*.json que publica el job diario (MTGO, MTGTop8, MTGGoldfish, TopDeck.gg, EDHREC).
// DECKBUILDER: los decks viven en la cuenta de Stack (cifrados, como los inventarios: el dueno del servidor no los puede
// leer) y son los mismos de la app. Las reglas de cada carta salen de oraculo.json; las recomendaciones, de EDHREC.
import { DATOS_URL } from "./config.js";
import { datos, aPesos, yenAPesos, cargarUniverso } from "./datos.js";
import { t, pesos } from "./i18n.js";
import * as cuenta from "./cuenta.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SIMBOLOS = "https://svgs.scryfall.io/card-symbols/";
export const FMT_META = ["standard", "pioneer", "modern", "legacy", "pauper", "cedh", "commander"];
const FMT_DECK = ["commander", "cedh", "standard", "pioneer", "modern", "legacy", "vintage", "pauper", "premodern", "brawl", "oathbreaker", "duel", "paupercommander"];
const NOMBRE_FMT = { standard: "Standard", pioneer: "Pioneer", modern: "Modern", legacy: "Legacy", pauper: "Pauper", cedh: "cEDH", commander: "Commander",
  vintage: "Vintage", premodern: "Premodern", brawl: "Brawl", oathbreaker: "Oathbreaker", duel: "Duel Commander", paupercommander: "Pauper Commander" };
const TIENDAS = [["tcg", "TCG"], ["ck", "CK"], ["scg", "SCG"], ["har", "HAR"]];
const FUENTE = { mtgo: "MTGO", mtgtop8: "MTGTop8", mtggoldfish: "MTGGoldfish", topdeck: "TopDeck.gg", edhrec: "EDHREC" };
const esCmd = (f) => ["commander", "cedh", "brawl", "oathbreaker", "duel", "paupercommander"].includes(f);
const BASICAS = new Set(["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"].flatMap((b) => [b, "Snow-Covered " + b]));
const imgCarta = (sid, tam = "normal") => (sid ? `https://cards.scryfall.io/${tam}/front/${sid[0]}/${sid[1]}/${sid}.jpg` : "");
const coste = (c) => esc(String(c || "").split(" // ")[0]).replace(/\{([^}]+)\}/g, (_, s) => `<img class="simbolo" src="${SIMBOLOS}${encodeURIComponent(s.replace(/\//g, ""))}.svg" alt="{${esc(s)}}">`);
const pips = (id) => [..."WUBRG"].filter((c) => (id || "").includes(c)).map((c) => `<img class="simbolo" src="${SIMBOLOS}${c}.svg" alt="${c}">`).join("") || `<img class="simbolo" src="${SIMBOLOS}C.svg" alt="C">`;

async function json(ruta) {
  const r = await fetch(`${DATOS_URL}${datos().diaUsado}/${ruta}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

// ---------------------------------------------------------------- precios por nombre
let porNombre = null;
function nombres() {
  if (!porNombre) {
    porNombre = new Map();
    for (const n of datos().buscar?.nombres || []) { porNombre.set(n[0], n); if (n[0].includes(" // ")) porNombre.set(n[0].split(" // ")[0], n); }
  }
  return porNombre;
}
function precioImp(f, tienda) {
  if (!f) return null;
  if (tienda === "ck") return aPesos(f[9]);
  if (tienda === "scg") return aPesos(f[8]);
  if (tienda === "har") return yenAPesos(f[7]);
  return aPesos(f[5]);
}
function precioNombre(n, tienda) {                  // la impresion mas barata de esa carta en esa tienda (pesos)
  const g = nombres().get(n); if (!g) return null;
  let mejor = null;
  for (const i of g[2]) { const v = precioImp(datos().buscar.imp[i], tienda); if (v != null && (mejor == null || v < mejor)) mejor = v; }
  return mejor;
}
const deckNombres = (cartas) => [...new Set(cartas.map((c) => c.n))];
export async function asegurarNombres(cartas) { await cargarUniverso(deckNombres(cartas)); }
function preciosDeck(cartas, tengo) {
  const enDeck = cartas.filter((c) => c.z !== "quizas");
  const out = { tiendas: {}, eco: 0, ecoSin: 0, falta: 0, faltaN: 0, faltan: [] };
  for (const [tk] of TIENDAS) {
    let s = 0, sin = 0;
    for (const c of enDeck) { const v = precioNombre(c.n, tk); if (v == null) sin += c.q; else s += v * c.q; }
    out.tiendas[tk] = { total: s, sin };
  }
  const barata = (n) => { let m = null; for (const [tk] of TIENDAS) { const v = precioNombre(n, tk); if (v != null && (m == null || v < m)) m = v; } return m; };
  for (const c of enDeck) { const v = barata(c.n); if (v == null) out.ecoSin += c.q; else out.eco += v * c.q; }
  if (tengo) {
    const q = new Map(); for (const c of enDeck) q.set(c.n, (q.get(c.n) || 0) + c.q);
    for (const [n, n_] of q) {
      if (BASICAS.has(n)) continue;
      const f = Math.max(0, n_ - (tengo[n] || 0)); if (!f) continue;
      const v = barata(n); out.faltaN += f; out.faltan.push([n, f, v]); if (v != null) out.falta += v * f;
    }
  }
  return out;
}
let TENGO = null;
async function cargarTengo() {                       // piezas por nombre en los inventarios de la cuenta
  if (!cuenta.sesion()) return null;
  if (TENGO) return TENGO;
  try {
    const out = {};
    for (const d of (await cuenta.listar()).filter((x) => x.tipo.startsWith("inv:"))) {
      const inv = await cuenta.leer(d.tipo, d.version);
      for (const p of inv?.piezas || []) if (p.nombre) { out[p.nombre] = (out[p.nombre] || 0) + (Number(p.cantidad) || 0); if (p.nombre.includes(" // ")) { const f = p.nombre.split(" // ")[0]; out[f] = (out[f] || 0) + (Number(p.cantidad) || 0); } }
    }
    TENGO = out;
  } catch { TENGO = null; }
  return TENGO;
}

// ---------------------------------------------------------------- oraculo
let ORA = null, ORA_P = null;
const normal = (s) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s*\/+\s*/g, " / ").replace(/[^a-z0-9/ ]+/g, "").replace(/\s+/g, " ").trim();
async function cargarOraculo() {
  if (ORA) return ORA;
  if (!ORA_P) ORA_P = json("oraculo.json").then((d) => {
    const por = new Map(), filas = d.cartas.map((x) => ({ n: x[0], coste: x[1], cmc: x[2] || 0, tipo: x[3], id: x[4], col: x[5], leg: x[6], gc: x[7], cmd: x[8],
      pareja: x[9], sid: x[10], pt: x[11], rank: x[13] ?? 999999, nn: normal(x[0]) }));
    for (const o of filas) { por.set(o.n, o); por.set(o.nn, o); if (o.n.includes(" // ")) { const f = o.n.split(" // ")[0]; if (!por.has(f)) por.set(f, o); por.set(normal(f), o); } }
    ORA = { fmts: d.formatos, filas, por };
    return ORA;
  }).catch((e) => { ORA_P = null; throw e; });
  return ORA_P;
}
const oraDe = (n) => (ORA ? ORA.por.get(n) || ORA.por.get(normal(n)) || null : null);
const legal = (o, fmt) => { if (!o || !ORA) return null; const i = ORA.fmts.indexOf(fmt === "cedh" ? "commander" : fmt); return i < 0 ? null : o.leg[i]; };
const identidad = (deck) => { const cs = deck.cartas.filter((c) => c.z === "cmd").map((c) => oraDe(c.n)).filter(Boolean); return cs.length ? [..."WUBRG"].filter((c) => cs.some((o) => o.id.includes(c))).join("") : null; };
const GRUPOS = [["Creature", "dk.g_criaturas"], ["Planeswalker", "dk.g_planeswalkers"], ["Battle", "dk.g_batallas"], ["Instant", "dk.g_instantaneos"], ["Sorcery", "dk.g_conjuros"],
  ["Artifact", "dk.g_artefactos"], ["Enchantment", "dk.g_encantamientos"], ["Land", "dk.g_tierras"], ["", "dk.g_otras"]];
const grupoDe = (n) => { const tp = (oraDe(n)?.tipo || "").split(" // ")[0]; return (GRUPOS.find(([k]) => k && tp.includes(k)) || GRUPOS[GRUPOS.length - 1])[1]; };

function problemas(deck) {
  const out = []; if (!ORA) return out;
  const fmt = deck.formato, cmd = esCmd(fmt), id = identidad(deck), copias = new Map();
  let main = 0, side = 0, ncmd = 0;
  for (const c of deck.cartas) {
    if (c.z === "quizas") continue;
    if (c.z === "main") main += c.q; else if (c.z === "side") side += c.q; else if (c.z === "cmd") ncmd += c.q;
    const o = oraDe(c.n);
    if (!o) { out.push(t("dk.p_desconocida", { n: c.n })); continue; }
    const l = legal(o, fmt);
    if (l === "b") out.push(t("dk.p_prohibida", { n: o.n })); else if (l === "-") out.push(t("dk.p_no_legal", { n: o.n }));
    if (!BASICAS.has(o.n)) copias.set(o.n, (copias.get(o.n) || 0) + c.q);
    if (cmd && id != null && c.z !== "cmd" && [...o.id].some((x) => !id.includes(x))) out.push(t("dk.p_identidad", { n: o.n }));
  }
  const max = cmd ? 1 : 4;
  for (const [n, q] of copias) if (q > max) out.push(t("dk.p_copias", { n, q, max }));
  if (cmd) { const obj = fmt === "brawl" || fmt === "oathbreaker" ? 60 : 100; if (!ncmd) out.push(t("dk.p_sin_cmd")); if (main + ncmd !== obj) out.push(t("dk.p_tamano_cmd", { n: main + ncmd, obj })); }
  else { if (main < 60) out.push(t("dk.p_main", { n: main })); if (side > 15) out.push(t("dk.p_side", { n: side })); }
  return out;
}

// ---------------------------------------------------------------- lista de un deck (META y deckbuilder)
function htmlDeck(deck, op = {}) {
  const tienda = op.tienda || "tcg", P = preciosDeck(deck.cartas, op.tengo);
  const tots = TIENDAS.map(([tk, et]) => `<button type="button" class="dktot${tk === tienda ? " on" : ""}" data-tienda="${tk}">${et} <b class="num">${pesos(P.tiendas[tk].total)}</b>${P.tiendas[tk].sin ? `<sup>${P.tiendas[tk].sin}</sup>` : ""}</button>`).join("");
  const cur = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of deck.cartas) { if (c.z !== "main" && c.z !== "cmd") continue; const o = oraDe(c.n); if (!o || o.tipo.split(" // ")[0].includes("Land")) continue; cur[Math.min(7, Math.floor(o.cmc))] += c.q; }
  const mx = Math.max(1, ...cur);
  const curva = ORA ? `<div class="dkcurva">${cur.map((n, i) => `<span title="${i === 7 ? "7+" : i}: ${n}"><i style="height:${Math.round((100 * n) / mx)}%"></i><em>${i === 7 ? "7+" : i}</em></span>`).join("")}</div>` : "";
  const gc = deck.cartas.filter((c) => c.z !== "quizas" && oraDe(c.n)?.gc).length;
  const br = esCmd(deck.formato) && ORA ? `<span class="dkbr" title="${esc(t("dk.bracket_ayuda"))}">BRACKET ${gc === 0 ? "1–2" : gc <= 3 ? "3" : "4"}</span>` : "";
  const prob = op.editable ? problemas(deck) : [];
  let h = "";
  const linea = (c) => {
    const o = oraDe(c.n), v = precioNombre(c.n, tienda), tg = op.tengo ? op.tengo[c.n] || 0 : null;
    const mal = op.editable && o && ["b", "-"].includes(legal(o, deck.formato));
    return `<li class="dkl${mal ? " ilegal" : ""}" data-n="${esc(c.n)}" data-z="${c.z}"><span class="q num">${c.q}</span><span class="n">${esc(c.n)}</span><span class="c">${coste(o?.coste)}</span>` +
      `<span class="r num">${v == null ? "—" : pesos(v * c.q)}</span>${tg != null && !BASICAS.has(c.n) ? `<span class="tg ${tg >= c.q ? "ok" : tg ? "medio" : "no"}">${tg >= c.q ? "✓" : `${tg}/${c.q}`}</span>` : `<span class="tg"></span>`}` +
      `${op.editable ? `<span class="dkb"><button type="button" data-q="-1" aria-label="−">−</button><button type="button" data-q="1" aria-label="+">+</button></span>` : ""}</li>`;
  };
  const zona = (z, titulo) => { const cs = deck.cartas.filter((c) => c.z === z); if (!cs.length) return ""; return `<h3 class="dkg">${esc(titulo)} <span class="tenue">${cs.reduce((s, c) => s + c.q, 0)}</span></h3><ul class="dklista">${cs.map(linea).join("")}</ul>`; };
  h += zona("cmd", t("dk.comandante"));
  const main = deck.cartas.filter((c) => c.z === "main"), grupos = new Map();
  for (const c of main) { const g = grupoDe(c.n); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(c); }
  for (const [, g] of GRUPOS) {
    const cs = grupos.get(g); if (!cs) continue;
    cs.sort((a, b) => (oraDe(a.n)?.cmc ?? 0) - (oraDe(b.n)?.cmc ?? 0) || a.n.localeCompare(b.n));
    h += `<h3 class="dkg">${esc(t(g))} <span class="tenue">${cs.reduce((s, c) => s + c.q, 0)}</span></h3><ul class="dklista">${cs.map(linea).join("")}</ul>`;
  }
  h += zona("side", t("dk.side")) + zona("quizas", t("dk.quizas"));
  return `<div class="dkres"><div class="dktots">${tots}</div>
      <p class="tenue">${esc(t("dk.economica"))} <b class="num ambar">${pesos(P.eco)}</b>${P.ecoSin ? ` · ${esc(t("dk.sin_precio", { n: P.ecoSin }))}` : ""}</p>
      ${op.tengo ? `<p class="tenue">${esc(t("dk.te_falta"))} <b class="num ambar">${P.faltaN}</b> · <b class="num ambar">${pesos(P.falta)}</b>${P.faltaN ? ` <button type="button" class="enlace" data-faltan>${esc(t("dk.copiar_faltan"))}</button>` : ""}</p>` : ""}
      <div class="dkstats">${curva}${br}</div>
      ${prob.length ? `<ul class="dkprob">${prob.slice(0, 8).map((p) => `<li>⚠ ${esc(p)}</li>`).join("")}${prob.length > 8 ? `<li>…</li>` : ""}</ul>` : ""}</div>${h || `<p class="tenue">${esc(t("dk.vacio"))}</p>`}`;
}
const textoDeck = (d) => {
  const z = (zn) => d.cartas.filter((c) => c.z === zn).map((c) => `${c.q} ${c.n}`).join("\n");
  const p = [];
  if (d.cartas.some((c) => c.z === "cmd")) p.push("Commander\n" + z("cmd"));
  p.push((p.length ? "Deck\n" : "") + z("main"));
  if (d.cartas.some((c) => c.z === "side")) p.push("Sideboard\n" + z("side"));
  return p.join("\n\n");
};
async function copiar(texto) { try { await navigator.clipboard.writeText(texto); return true; } catch { return false; } }

// ---------------------------------------------------------------- META
const M = { res: null, fmt: {}, cmd: null, vista: "arq", tienda: "tcg", sel: null };
async function cargarResumen() {
  if (!datos().manifest?.meta) return null;
  if (!M.res) M.res = await json("meta/resumen.json");
  return M.res;
}
async function cargarFormato(fmt) {
  if (fmt === "commander") { if (!M.cmd) M.cmd = await json("meta/commander.json"); return M.cmd; }
  if (!M.fmt[fmt]) M.fmt[fmt] = await json(`meta/${fmt}.json`);
  return M.fmt[fmt];
}
const cartasDe = (main, side, cmd) => [...(cmd || []).map(([n, q]) => ({ n, q, z: "cmd" })), ...(main || []).map(([n, q]) => ({ n, q, z: "main" })), ...(side || []).map(([n, q]) => ({ n, q, z: "side" }))];
function deckDeArq(F, a, fmt) {
  const ds = F.decks.filter((d) => d.arquetipo === a.nombre).sort((x, y) => (y.fecha > x.fecha ? 1 : y.fecha < x.fecha ? -1 : (x.puesto || 99) - (y.puesto || 99)));
  if (ds.length) return { nombre: a.nombre, formato: fmt, cartas: cartasDe(ds[0].main, ds[0].side, ds[0].cmd), info: ds[0], origen: { tipo: "meta", fuente: ds[0].fuente, url: ds[0].url } };
  const tp = F.tipicas?.[a.nombre];
  if (tp) return { nombre: a.nombre, formato: fmt, cartas: cartasDe(Object.entries(tp.main || {}), Object.entries(tp.side || {})), info: { fuente: "mtggoldfish", url: a.url_gf }, origen: { tipo: "meta", fuente: "mtggoldfish", url: a.url_gf } };
  return null;
}
const tend = (v) => (v == null ? `<span class="tenue">—</span>` : `<span class="${v > 0.4 ? "sube" : v < -0.4 ? "baja" : "tenue"}">${v > 0 ? "▲" : v < 0 ? "▼" : "·"} ${Math.abs(v).toFixed(1)}</span>`);

export async function vistaMeta(app, fmtRuta) {
  document.body.classList.remove("en-portada");
  document.body.classList.add("ancho");
  const fmt = FMT_META.includes(fmtRuta) ? fmtRuta : "modern";
  app.innerHTML = `<h1 class="titulo-vista">META</h1><p class="tenue">${esc(t("meta.cargando"))}</p>`;
  let R;
  try { R = await cargarResumen(); } catch { R = null; }
  if (!R) { app.innerHTML = `<h1 class="titulo-vista">META</h1><p class="tenue">${esc(t("meta.sin_datos"))}</p>`; return; }
  let F;
  try { F = await cargarFormato(fmt); } catch { F = null; }
  const tengo = await cargarTengo();
  const S = R.formatos[fmt] || {};
  if (!ORA) cargarOraculo().then(() => { if (location.hash.startsWith("#/meta")) pintar(); }).catch(() => {});   // tipos y curva
  const fmts = FMT_META.map((f) => `<a class="chip${f === fmt ? " activo" : ""}" href="#/meta/${f}">${esc(NOMBRE_FMT[f])}${R.formatos[f]?.decks_n != null ? ` <span class="tenue">${R.formatos[f].decks_n}</span>` : ""}</a>`).join("");
  const vistas = fmt === "commander" ? [] : [["arq", "meta.arquetipos"], ["decks", "meta.decks"], ["staples", "meta.staples"], ["termo", "meta.termometro"]];
  if (fmt === "commander") M.vista = "arq"; else if (!vistas.some((v) => v[0] === M.vista)) M.vista = "arq";
  const tiendas = TIENDAS.map(([tk, et]) => `<button type="button" class="chip-acab${tk === M.tienda ? " activo" : ""}" data-mt="${tk}">${et}</button>`).join("");
  const pintar = async () => {
    let filas = [];
    const lista = app.querySelector("#meta-lista"), det = app.querySelector("#meta-det");
    if (fmt === "commander") {
      filas = (F?.comandantes || []).map((c) => ({ tipo: "cmd", ...c }));
    } else if (M.vista === "arq") filas = (S.arquetipos || []).map((a) => ({ tipo: "arq", ...a }));
    else if (M.vista === "decks") filas = (F?.decks || []).map((d) => ({ tipo: "deck", ...d }));
    else if (M.vista === "staples") filas = (S.staples || []).map((s) => ({ tipo: "staple", ...s }));
    else filas = Object.entries(R.cartas || {}).filter(([, fm]) => fm[fmt] && fm[fmt][1] != null).map(([n, fm]) => ({ tipo: "termo", nombre: n, pct: fm[fmt][0], tend: fm[fmt][1] }))
      .sort((a, b) => Math.abs(b.tend) - Math.abs(a.tend)).slice(0, 120);
    const deckDe = (x) => x.tipo === "arq" ? (F ? deckDeArq(F, x, fmt) : null)
      : x.tipo === "deck" ? { nombre: x.arquetipo, formato: fmt, cartas: cartasDe(x.main, x.side, x.cmd), info: x, origen: { tipo: "meta", fuente: x.fuente, url: x.url } }
        : x.tipo === "cmd" ? { nombre: x.nombre, formato: "commander", cartas: [{ n: x.nombre, q: 1, z: "cmd" }, ...((F?.promedio || {})[x.nombre] || []).filter(([n]) => n !== x.nombre).map(([n, q]) => ({ n, q, z: "main" }))],
          info: { fuente: "edhrec", url: `https://edhrec.com/average-decks/${x.slug}`, promedio: true }, origen: { tipo: "edhrec", url: `https://edhrec.com/average-decks/${x.slug}` } } : null;
    const todas = [];
    for (const x of filas.slice(0, 150)) { const d = deckDe(x); if (d) todas.push(...d.cartas); else if (x.nombre) todas.push({ n: x.nombre }); }
    await asegurarNombres(todas);
    lista.innerHTML = filas.length ? filas.slice(0, 150).map((x, i) => {
      const d = deckDe(x), P = d ? preciosDeck(d.cartas, tengo) : null;
      const precio = P ? pesos(P.tiendas[M.tienda].total) : x.nombre ? pesos(precioNombre(x.nombre, M.tienda)) : "—";
      const sub = x.tipo === "arq" ? `${x.n ? `${x.pct.toFixed(1)}% · ${x.n} decks` : "—"} · ${tend(x.tend)}${x.pct_gf != null ? ` · MTGGoldfish ${x.pct_gf}%` : ""}`
        : x.tipo === "deck" ? `${esc(x.fecha)} · ${x.puesto ? x.puesto + "°" : esc(x.resultado || "")} · ${esc(x.evento || "")} · ${esc(FUENTE[x.fuente] || x.fuente)}`
          : x.tipo === "cmd" ? `#${x.rango} · ${(x.n_decks || 0).toLocaleString()} decks` : `${x.pct.toFixed(1)}% · ${x.tipo === "staple" ? `${x.copias} ${esc(t("meta.copias"))} · ` : ""}${tend(x.tend)}`;
      return `<button type="button" class="meta-fila${M.sel === i ? " activo" : ""}" data-i="${i}"><span class="medio"><span class="titulo">${esc(x.nombre || x.arquetipo)}</span><span class="sub">${sub}</span></span>` +
        `<span class="der"><span class="precio num">${precio}</span>${P && tengo ? `<span class="tenue num">${esc(t("dk.falta_corto"))} ${pesos(P.falta)}</span>` : tengo && x.nombre ? `<span class="tenue">${esc(t("dk.tienes"))} ${tengo[x.nombre] || 0}</span>` : ""}</span></button>`;
    }).join("") : `<p class="tenue">${esc(t("meta.vacio"))}</p>`;
    const verDet = (i) => {
      M.sel = i;
      lista.querySelectorAll(".meta-fila").forEach((b) => b.classList.toggle("activo", Number(b.dataset.i) === i));
      const x = filas[i], d = x && deckDe(x);
      if (!d) {
        if (x && x.nombre) {
          const fm = (R.cartas || {})[x.nombre] || {};
          det.innerHTML = `<h2>${esc(x.nombre)}</h2><ul class="meta-fmts">${Object.entries(fm).map(([f, [p, tn]]) => `<li><span>${esc(NOMBRE_FMT[f] || f)}</span><span>${p.toFixed(1)}% · ${tend(tn)}</span></li>`).join("")}</ul>` +
            `<ul class="meta-fmts">${TIENDAS.map(([tk, et]) => `<li><span>${et}</span><span class="num">${pesos(precioNombre(x.nombre, tk))}</span></li>`).join("")}</ul>`;
        } else det.innerHTML = "";
        return;
      }
      const inf = d.info || {};
      det.innerHTML = `<h2>${esc(d.nombre)}</h2><p class="tenue">${esc(NOMBRE_FMT[d.formato] || d.formato)}${inf.evento ? " · " + esc(inf.evento) : ""}${inf.puesto ? ` · ${inf.puesto}°` : ""}${inf.jugador ? " · " + esc(inf.jugador) : ""}` +
        `${inf.fuente ? ` · <a href="${esc(inf.url || "#")}" target="_blank" rel="noopener">${esc(FUENTE[inf.fuente] || inf.fuente)}</a>` : ""}${inf.promedio ? " · " + esc(t("meta.promedio")) : ""}</p>
        <div class="acciones-deck"><button type="button" class="primario" data-copiar-deck>${esc(t("meta.a_mis_decks"))}</button><button type="button" class="chip-acab" data-texto>${esc(t("meta.copiar_lista"))}</button></div>
        <p id="meta-msg" class="tenue" role="status"></p>${htmlDeck(d, { tienda: M.tienda, tengo })}`;
      det.dataset.deck = JSON.stringify({ nombre: d.nombre, formato: d.formato, cartas: d.cartas, origen: d.origen || null });
      if (matchMedia("(max-width: 899px)").matches) det.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    lista.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) verDet(Number(b.dataset.i)); };
    if (M.sel != null && filas[M.sel]) verDet(M.sel); else if (filas.length && matchMedia("(min-width: 900px)").matches) verDet(0); else det.innerHTML = "";
  };
  app.innerHTML = `<h1 class="titulo-vista">META</h1>
    <nav class="chips meta-fmts-nav">${fmts}</nav>
    ${vistas.length ? `<nav class="chips">${vistas.map(([v, k]) => `<button type="button" class="chip-acab${v === M.vista ? " activo" : ""}" data-mv="${v}">${esc(t(k))}</button>`).join("")}</nav>` : ""}
    <div class="chips meta-tiendas"><span class="tenue">${esc(t("meta.precios_de"))}</span>${tiendas}</div>
    <p class="tenue">${esc(t("meta.ventana", { dias: R.ventana_dias, dia: R.dia }))}${S.decks_n != null ? " · " + esc(t("meta.n_decks", { n: S.decks_n, s: S.semana_n })) : ""}</p>
    <div class="meta-cuerpo"><div id="meta-lista" class="meta-lista"></div><section id="meta-det" class="meta-det"></section></div>
    <p class="nota">${esc(t("meta.creditos"))} <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.</p>`;
  app.onclick = async (e) => {
    const v = e.target.closest("[data-mv]"); if (v) { M.vista = v.dataset.mv; M.sel = null; vistaMeta(app, fmt); return; }
    const tk = e.target.closest("[data-mt], [data-tienda]"); if (tk) { M.tienda = tk.dataset.mt || tk.dataset.tienda; app.querySelectorAll("[data-mt]").forEach((b) => b.classList.toggle("activo", b.dataset.mt === M.tienda)); pintar(); return; }
    const det = app.querySelector("#meta-det"), msg = app.querySelector("#meta-msg");
    if (e.target.closest("[data-texto]")) { const d = JSON.parse(det.dataset.deck || "null"); if (d && msg) msg.textContent = (await copiar(textoDeck(d))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-faltan]")) {
      const d = JSON.parse(det.dataset.deck || "null"); if (!d) return;
      const P = preciosDeck(d.cartas, TENGO); if (msg) msg.textContent = (await copiar(P.faltan.map(([n, q]) => `${q} ${n}`).join("\n"))) ? t("meta.copiada") : t("meta.no_copiada"); return;
    }
    if (e.target.closest("[data-copiar-deck]")) {
      const d = JSON.parse(det.dataset.deck || "null"); if (!d) return;
      if (!cuenta.sesion()) { if (msg) msg.innerHTML = `${esc(t("dk.entra"))} <a href="#/cuenta">${esc(t("cuenta.entrar"))}</a>`; return; }
      try { const id = await crearDeck({ ...d, cartas: d.cartas.map(({ n, q, z }) => ({ n, q, z })) }); location.hash = `#/decks/${id}`; }
      catch (er) { if (msg) msg.textContent = t("dk.err_guardar"); }
    }
  };
  if (M.fmtVisto !== fmt) { M.sel = null; M.fmtVisto = fmt; }
  pintar();
}

// ---------------------------------------------------------------- decks en la cuenta
const nuevoId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const ahoraIso = () => new Date().toISOString().slice(0, 19) + "+00:00";
function limpio(d) {
  return { esquema: 1, id: d.id, nombre: String(d.nombre || "Deck").slice(0, 60), formato: d.formato || "commander",
    cartas: (d.cartas || []).filter((c) => c.n && c.q > 0).map((c) => ({ n: c.n, q: c.q, z: c.z || "main", ...(c.sid ? { sid: c.sid, acab: c.acab || "nonfoil" } : {}) })),
    notas: d.notas || "", origen: d.origen || null, creado: d.creado || ahoraIso(), modificado: ahoraIso() };
}
async function crearDeck(d) {
  const id = nuevoId();
  cuenta.fijarVersion(`deck:${id}`, 0);
  await cuenta.guardar(`deck:${id}`, limpio({ ...d, id }));
  return id;
}
async function listarDecks() {
  const docs = (await cuenta.listar()).filter((x) => x.tipo.startsWith("deck:"));
  const out = [];
  for (const d of docs) { const o = await cuenta.leer(d.tipo, d.version); if (o) out.push({ ...o, id: d.tipo.slice(5), version: d.version, actualizado: d.actualizado }); }
  return out.sort((a, b) => String(b.modificado || "").localeCompare(String(a.modificado || "")));
}

export async function vistaDecks(app, id) {
  document.body.classList.remove("en-portada");
  document.body.classList.add("ancho");
  if (!cuenta.sesion()) {
    app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="tenue">${esc(t("dk.entra"))}</p><a class="boton-vacio" href="#/cuenta">${esc(t("cuenta.entrar"))}</a>`;
    return;
  }
  if (id) { editor(app, id); return; }
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="tenue">${esc(t("dk.cargando"))}</p>`;
  let ds;
  try { ds = await listarDecks(); } catch { app.innerHTML += `<p class="error">${esc(t("dk.err_leer"))}</p>`; return; }
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1>
    <div class="acciones-deck"><button type="button" class="primario" data-nuevo>${esc(t("dk.nuevo"))}</button><a class="chip-acab" href="#/meta">META</a></div>
    <div class="dk-mios">${ds.length ? ds.map((d) => `<a class="meta-fila" href="#/decks/${esc(d.id)}"><span class="medio"><span class="titulo">${esc(d.nombre)}</span>` +
      `<span class="sub">${esc(NOMBRE_FMT[d.formato] || d.formato)} · ${d.cartas.reduce((s, c) => s + (c.z === "quizas" ? 0 : c.q), 0)} ${esc(t("dk.cartas"))}</span></span></a>`).join("") : `<p class="tenue">${esc(t("dk.sin_decks"))}</p>`}</div>`;
  app.onclick = async (e) => {
    if (e.target.closest("[data-nuevo]")) {
      try { const nid = await crearDeck({ nombre: t("dk.deck_nuevo"), formato: "commander", cartas: [] }); location.hash = `#/decks/${nid}`; }
      catch { toastMsg(app, t("dk.err_guardar")); }
    }
  };
}
const toastMsg = (app, m) => { const p = app.querySelector("#dk-msg"); if (p) p.textContent = m; };

// ---- editor estilo Arena: buscador con imagenes, el deck a un lado (o en otra pestana en el telefono)
const E = { deck: null, version: 0, q: "", tipos: new Set(), cmc: null, res: [], pest: "buscar", edh: null, t: null, guardando: false, sucio: false, tienda: "tcg" };
async function editor(app, id) {
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="tenue">${esc(t("dk.cargando"))}</p>`;
  try {
    await cargarOraculo();
    const docs = await cuenta.listar(), d = docs.find((x) => x.tipo === `deck:${id}`);
    if (!d) { app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="error">${esc(t("dk.no_existe"))}</p><a class="boton-vacio" href="#/decks">${esc(t("dk.mis_decks"))}</a>`; return; }
    E.deck = { ...(await cuenta.leer(d.tipo, d.version)), id };
    cuenta.fijarVersion(d.tipo, d.version);
  } catch { app.innerHTML += `<p class="error">${esc(t("dk.err_leer"))}</p>`; return; }
  E.edh = null; E.q = ""; E.tipos = new Set(); E.cmc = null; E.pest = "buscar";
  const tengo = await cargarTengo();
  await asegurarNombres(E.deck.cartas);
  app.innerHTML = `<div class="dk-cab"><a class="enlace" href="#/decks">← ${esc(t("dk.mis_decks"))}</a>
      <input id="dk-nombre" class="dk-nombre" maxlength="60" value="${esc(E.deck.nombre)}" aria-label="${esc(t("dk.nombre"))}">
      <select id="dk-fmt" aria-label="${esc(t("dk.formato"))}">${FMT_DECK.map((f) => `<option value="${f}"${f === E.deck.formato ? " selected" : ""}>${esc(NOMBRE_FMT[f])}</option>`).join("")}</select>
      <span id="dk-estado" class="tenue" role="status"></span></div>
    <nav class="chips dk-pest">${["buscar", "deck", "edhrec"].map((p) => `<button type="button" class="chip-acab${p === E.pest ? " activo" : ""}" data-pest="${p}">${esc(t("dk.p_" + p))}</button>`).join("")}</nav>
    <div class="dk-cuerpo"><section id="dk-busca" class="dk-busca"></section><section id="dk-deck" class="dk-deck"></section></div>
    <div class="acciones-deck"><button type="button" class="chip-acab" data-acc="copiar">${esc(t("meta.copiar_lista"))}</button><button type="button" class="chip-acab" data-acc="compartir">${esc(t("dk.compartir"))}</button>
      <button type="button" class="chip-acab" data-acc="importar">${esc(t("dk.importar"))}</button><button type="button" class="chip-acab peligro" data-acc="borrar">${esc(t("dk.borrar"))}</button></div>
    <p id="dk-msg" class="tenue" role="status"></p>`;
  const busca = app.querySelector("#dk-busca"), panel = app.querySelector("#dk-deck"), estado = app.querySelector("#dk-estado"), msg = app.querySelector("#dk-msg");
  const marcarPest = () => { app.querySelectorAll("[data-pest]").forEach((b) => b.classList.toggle("activo", b.dataset.pest === E.pest)); app.querySelector(".dk-cuerpo").dataset.ver = E.pest; };
  const pintarDeck = () => {
    const id_ = identidad(E.deck);
    panel.innerHTML = `${esCmd(E.deck.formato) ? `<p class="dk-ident">${esc(t("dk.identidad"))} ${id_ != null ? pips(id_) : `<span class="tenue">${esc(t("dk.marca_cmd"))}</span>`}</p>` : ""}${htmlDeck(E.deck, { tienda: E.tienda, tengo, editable: true })}`;
    const n = E.deck.cartas.filter((c) => c.z !== "quizas").reduce((s, c) => s + c.q, 0);
    const bd = app.querySelector("[data-pest='deck']"); if (bd) bd.textContent = `${t("dk.p_deck")} (${n})`;
  };
  const buscar = () => {
    const D = E.deck, fmt = D.formato, toks = normal(E.q).split(" ").filter(Boolean), id_ = esCmd(fmt) ? identidad(D) : null;
    const out = [];
    for (const o of ORA.filas) {
      const l = legal(o, fmt); if (l == null || l === "-" || l === "b") continue;
      if (id_ != null && [...o.id].some((x) => !id_.includes(x))) continue;
      if (E.tipos.size && ![...E.tipos].some((tp) => o.tipo.includes(tp))) continue;
      if (E.cmc != null && (E.cmc === 7 ? o.cmc < 7 : Math.floor(o.cmc) !== E.cmc)) continue;
      if (toks.length) { const h = o.nn + " " + normal(o.tipo); if (!toks.every((tk) => h.includes(tk))) continue; }
      out.push(o);
      if (!toks.length && out.length >= 600) break;
    }
    const nq = normal(E.q);
    out.sort((a, b) => (nq && a.nn.startsWith(nq) ? 0 : 1) - (nq && b.nn.startsWith(nq) ? 0 : 1) || a.rank - b.rank);
    E.res = out.slice(0, 120);
  };
  const enDeck = (n) => E.deck.cartas.filter((c) => c.n === n).reduce((s, c) => s + c.q, 0);
  const tileHTML = (o, extra = "") => `<div class="dk-tile" data-n="${esc(o.n)}"><button type="button" class="dk-img" data-add="main" aria-label="${esc(t("dk.agregar", { n: o.n }))}">` +
    `<img src="${esc(imgCarta(o.sid, "normal"))}" alt="${esc(o.n)}" loading="lazy">${enDeck(o.n) ? `<b class="dk-en">${enDeck(o.n)}</b>` : ""}</button>` +
    `<div class="dk-tile-pie"><span class="num">${pesos(precioNombre(o.n, E.tienda))}</span>${extra}` +
    `${esCmd(E.deck.formato) && o.cmd ? `<button type="button" data-add="cmd" title="${esc(t("dk.hacer_cmd"))}">CMD</button>` : esCmd(E.deck.formato) ? "" : `<button type="button" data-add="side" title="${esc(t("dk.al_side"))}">SB</button>`}</div></div>`;
  const pintarBusca = async () => {
    if (E.pest === "edhrec") { await pintarEdh(); return; }
    const tipos = [["Creature", "dk.t_criatura"], ["Instant", "dk.t_instantaneo"], ["Sorcery", "dk.t_conjuro"], ["Artifact", "dk.t_artefacto"], ["Enchantment", "dk.t_encantamiento"],
      ["Planeswalker", "dk.t_planeswalker"], ["Land", "dk.t_tierra"]].map(([tp, k]) => `<button type="button" class="chip-acab${E.tipos.has(tp) ? " activo" : ""}" data-tp="${tp}">${esc(t(k))}</button>`).join("");
    const cmcs = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="chip-acab${E.cmc === n ? " activo" : ""}" data-cmc="${n}">${n === 7 ? "7+" : n}</button>`).join("");
    if (!busca.querySelector("#dk-q")) {
      busca.innerHTML = `<input id="dk-q" type="search" class="dk-q" placeholder="${esc(t("dk.buscar"))}" autocomplete="off" spellcheck="false" value="${esc(E.q)}">
        <div class="chips dk-filtros" id="dk-filtros"></div><div class="dk-grid" id="dk-grid"></div>`;
    }
    busca.querySelector("#dk-filtros").innerHTML = tipos + `<span class="tenue">CMC</span>` + cmcs;
    buscar();
    const ns = E.res.map((o) => ({ n: o.n })); await asegurarNombres(ns);
    busca.querySelector("#dk-grid").innerHTML = E.res.length ? E.res.map((o) => tileHTML(o)).join("") : `<p class="tenue">${esc(t("dk.sin_res"))}</p>`;
  };
  const pintarEdh = async () => {
    const cmds = E.deck.cartas.filter((c) => c.z === "cmd").map((c) => c.n);
    if (!cmds.length) { busca.innerHTML = `<p class="tenue">${esc(t("dk.edh_sin_cmd"))}</p>`; return; }
    const slug = cmds.map((n) => n.split(" // ")[0]).sort().map((n) => n.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’,.!?:"]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")).join("-");
    if (!E.edh || E.edh.slug !== slug) {
      busca.innerHTML = `<p class="tenue">${esc(t("dk.edh_cargando"))}</p>`;
      try {
        const r = await fetch(`https://json.edhrec.com/pages/commanders/${slug}.json`);
        const j = r.ok ? await r.json() : null;
        E.edh = { slug, cats: (j?.container?.json_dict?.cardlists || []).map((cl) => ({ titulo: cl.header, cartas: (cl.cardviews || []).map((v) => ({ n: v.name, s: v.synergy, p: v.potential_decks ? v.num_decks / v.potential_decks : null })) })), n: j?.container?.json_dict?.card?.num_decks };
        if (!j) E.edh.error = true;
      } catch { E.edh = { slug, cats: [], error: true }; }
    }
    if (E.edh.error || !E.edh.cats.length) { busca.innerHTML = `<p class="tenue">${esc(t("dk.edh_no"))}</p>`; return; }
    const todas = E.edh.cats.flatMap((c) => c.cartas.map((x) => ({ n: x.n }))); await asegurarNombres(todas);
    busca.innerHTML = `<p class="tenue">${(E.edh.n || 0).toLocaleString()} decks · <a href="https://edhrec.com/commanders/${esc(slug)}" target="_blank" rel="noopener">EDHREC</a></p>` +
      E.edh.cats.map((c) => `<h3 class="dkg">${esc(c.titulo)}</h3><div class="dk-grid">${c.cartas.map((x) => { const o = oraDe(x.n); return o ? tileHTML(o, `<span class="tenue">${x.p != null ? Math.round(x.p * 100) + "%" : ""}${x.s != null ? ` · ${x.s > 0 ? "+" : ""}${Math.round(x.s * 100)}` : ""}</span>`) : ""; }).join("")}</div>`).join("");
  };
  const guardar = async () => {
    clearTimeout(E.t);
    if (!E.sucio || E.guardando) return;
    E.guardando = true; estado.textContent = t("dk.guardando");
    try { await cuenta.guardar(`deck:${E.deck.id}`, limpio(E.deck)); E.sucio = false; estado.textContent = t("dk.guardado"); }
    catch (er) {
      if (er.estado === 409) { estado.textContent = t("dk.conflicto"); }
      else estado.textContent = t("dk.err_guardar");
    }
    E.guardando = false;
    if (E.sucio) { E.t = setTimeout(guardar, 1200); }
  };
  const cambiar = (n, z, dq) => {
    const o = oraDe(n), nombre = o ? o.n : n, D = E.deck;
    if (z === "cmd" && dq > 0) { const cs = D.cartas.filter((c) => c.z === "cmd"); const par = cs.length === 1 && (o?.pareja || oraDe(cs[0].n)?.pareja); if (cs.length >= (par ? 2 : 1)) cs.forEach((c) => { c.z = "main"; }); }
    let c = D.cartas.find((x) => x.n === nombre && x.z === z);
    if (!c && dq > 0) { c = { n: nombre, q: 0, z }; D.cartas.push(c); }
    if (!c) return;
    c.q = Math.max(0, Math.min(z === "cmd" ? 1 : 999, c.q + dq));
    D.cartas = D.cartas.filter((x) => x.q > 0);
    E.sucio = true; estado.textContent = t("dk.sin_guardar"); clearTimeout(E.t); E.t = setTimeout(guardar, 1000);
    pintarDeck();
    if (z === "cmd") { E.edh = null; pintarBusca(); }
    else busca.querySelectorAll(`.dk-tile[data-n="${CSS.escape(nombre)}"] .dk-img`).forEach((b) => { const q = enDeck(nombre); let e_ = b.querySelector(".dk-en"); if (!q) e_?.remove(); else { if (!e_) { e_ = document.createElement("b"); e_.className = "dk-en"; b.appendChild(e_); } e_.textContent = q; } });
  };
  marcarPest(); pintarDeck(); pintarBusca();
  app.oninput = (e) => {
    if (e.target.id === "dk-q") { E.q = e.target.value; pintarBusca(); }
    else if (e.target.id === "dk-nombre") { E.deck.nombre = e.target.value || "Deck"; E.sucio = true; clearTimeout(E.t); E.t = setTimeout(guardar, 1000); }
  };
  app.onchange = (e) => { if (e.target.id === "dk-fmt") { E.deck.formato = e.target.value; E.sucio = true; E.edh = null; guardar(); pintarDeck(); pintarBusca(); } };
  app.onclick = async (e) => {
    const p = e.target.closest("button[data-pest]"); if (p) { E.pest = p.dataset.pest; marcarPest(); if (E.pest !== "deck") { busca.innerHTML = ""; pintarBusca(); } return; }
    const a = e.target.closest("[data-add]"); if (a) { const n = a.closest(".dk-tile").dataset.n; cambiar(n, a.dataset.add, 1); return; }
    const q = e.target.closest(".dkl [data-q]"); if (q) { const l = q.closest(".dkl"); cambiar(l.dataset.n, l.dataset.z, Number(q.dataset.q)); return; }
    const tp = e.target.closest("[data-tp]"); if (tp) { const v = tp.dataset.tp; E.tipos.has(v) ? E.tipos.delete(v) : E.tipos.add(v); pintarBusca(); return; }
    const cm = e.target.closest("[data-cmc]"); if (cm) { const v = Number(cm.dataset.cmc); E.cmc = E.cmc === v ? null : v; pintarBusca(); return; }
    const tk = e.target.closest("[data-tienda]"); if (tk) { E.tienda = tk.dataset.tienda; pintarDeck(); return; }
    if (e.target.closest("[data-faltan]")) { const P = preciosDeck(E.deck.cartas, tengo); msg.textContent = (await copiar(P.faltan.map(([n, q_]) => `${q_} ${n}`).join("\n"))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    const ac = e.target.closest("[data-acc]"); if (!ac) return;
    if (ac.dataset.acc === "copiar") { msg.textContent = (await copiar(textoDeck(E.deck))) ? t("meta.copiada") : t("meta.no_copiada"); }
    else if (ac.dataset.acc === "borrar") {
      if (ac.dataset.seguro !== "1") { ac.dataset.seguro = "1"; ac.textContent = t("dk.borrar_seguro"); return; }
      try { await cuenta.borrarDoc(`deck:${E.deck.id}`); location.hash = "#/decks"; } catch { msg.textContent = t("dk.err_guardar"); }
    } else if (ac.dataset.acc === "compartir") {
      await guardar();
      msg.textContent = t("dk.creando_codigo");
      try {
        const piezas = E.deck.cartas.filter((c) => c.z !== "quizas").map((c) => ({ sid: c.sid || oraDe(c.n)?.sid, acab: c.acab || "nonfoil", nombre: c.n, cantidad: c.q })).filter((x) => x.sid);
        const r = await cuenta.crearCompartido({ esquema: 1, tipo: "deck", nombre: E.deck.nombre, creado: ahoraIso(), app: "web", de: null, con_costos: false, piezas, deck: limpio(E.deck) });
        const enlace = `${location.origin}${location.pathname}#/s/${r.codigo}`;
        msg.innerHTML = `${esc(t("dk.codigo", { c: r.codigo }))} <button type="button" class="enlace" data-copiar-txt="${esc(enlace)}">${esc(t("lote.copiar_enlace"))}</button>`;
      } catch { msg.textContent = t("lote.err.codigo"); }
    } else if (ac.dataset.acc === "importar") {
      busca.innerHTML = `<textarea id="dk-imp" class="dk-imp" placeholder="1 Sol Ring&#10;..."></textarea><div class="acciones-deck"><button type="button" class="primario" data-imp>${esc(t("dk.importar"))}</button></div>`;
      E.pest = "buscar"; marcarPest();
    }
  };
  app.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-copiar-txt]"); if (c) { msg.textContent = (await copiar(c.dataset.copiarTxt)) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-imp]")) {
      const txt = app.querySelector("#dk-imp").value; let z = "main", n = 0;
      for (const raw of txt.replace(/\r/g, "").split("\n")) {
        const l = raw.trim(); if (!l) { if (n) z = "side"; continue; }
        const h = l.toLowerCase().replace(/[:\s]+$/, "");
        if (/^(commander|comandante)$/.test(h)) { z = "cmd"; continue; } if (/^(sideboard|side)$/.test(h)) { z = "side"; continue; } if (/^(deck|main|mainboard)$/.test(h)) { z = "main"; continue; }
        const m = l.match(/^(?:SB:\s*)?(\d+)\s*x?\s+(.+?)(?:\s+\([A-Za-z0-9]{2,6}\)(?:\s+[\w★-]+)?)?(?:\s+\*[FE]\*)?$/i);
        const nombre = m ? m[2] : l, q = m ? Number(m[1]) : 1, o = oraDe(nombre);
        const ya = E.deck.cartas.find((x) => x.n === (o ? o.n : nombre) && x.z === z);
        if (ya) ya.q += q; else E.deck.cartas.push({ n: o ? o.n : nombre, q, z }); n++;
      }
      E.sucio = true; await asegurarNombres(E.deck.cartas); await guardar(); busca.innerHTML = ""; pintarBusca(); pintarDeck(); msg.textContent = t("dk.importadas", { n });
    }
  });
}

// ---------------------------------------------------------------- un deck recibido por codigo (#/s/CODIGO)
export async function guardarDeckRecibido(deck) {
  return crearDeck({ ...deck, id: null });
}
