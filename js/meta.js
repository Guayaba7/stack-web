// META y DECKBUILDER en la pagina (Stack 0.9.0).
// META: los archivos meta/*.json que publica el job diario (MTGO, MTGTop8, MTGGoldfish, TopDeck.gg, EDHREC).
// DECKBUILDER: los decks viven en la cuenta de Stack (cifrados, como los inventarios: el dueno del servidor no los puede
// leer) y son los mismos de la app. Las reglas de cada carta salen de oraculo.json; las recomendaciones, de EDHREC.
import { DATOS_URL } from "./config.js";
import { datos, aPesos, yenAPesos, cargarUniverso } from "./datos.js";
import { t, pesos } from "./i18n.js";
import * as cuenta from "./cuenta.js";
import { svgMtg, FONDO, RAREZA_COLOR } from "./filtros.js";
import { idiomaActual } from "./i18n.js";

const pesos2 = (v) => (v == null || Number.isNaN(v) ? "—" : new Intl.NumberFormat(idiomaActual() === "en" ? "en-US" : "es-MX",
  { style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v));
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
    const caras = [];                                   // "X // Y" tambien se encuentra por "X", pero sin pisar a una carta que se llama "X" (las Art Series son "X // X")
    for (const n of datos().buscar?.nombres || []) { porNombre.set(n[0], n); if (n[0].includes(" // ")) caras.push(n); }
    for (const n of caras) { const f = n[0].split(" // ")[0]; if (!porNombre.has(f)) porNombre.set(f, n); }
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
function precioCartaW(c, tienda) {                 // la version elegida (si el deck la trae y tiene precio) o la mas barata
  if (c.sid) { const g = nombres().get(c.n), L = ACAB_L[c.acab || "nonfoil"] || "n"; let otra = null;
    if (g) for (const i of g[2]) { const f = datos().buscar.imp[i]; if (String(f[0]).startsWith(c.sid)) { const v = precioImp(f, tienda); if (v == null) continue; if (f[3] === L) return v; if (otra == null) otra = v; } }
    if (otra != null) return otra; }
  return precioNombre(c.n, tienda);
}
function precioNombre(n, tienda) {                  // la impresion mas barata de esa carta en esa tienda (pesos)
  const g = nombres().get(n); if (!g) return null;
  let mejor = null;
  for (const i of g[2]) { const v = precioImp(datos().buscar.imp[i], tienda); if (v != null && (mejor == null || v < mejor)) mejor = v; }
  return mejor;
}
const ACAB_L = { nonfoil: "n", foil: "f", etched: "e" }, ACAB_DE = { n: "nonfoil", f: "foil", e: "etched" };
const vDe = (c) => (c && c.sid ? `${c.sid}|${c.acab || "nonfoil"}` : "");      // "" = sin version elegida (la mas barata)
const impDe = (c) => {                                // la fila de buscar.json de la version de una linea
  if (!c || !c.sid) return null; const g = nombres().get(c.n), L = ACAB_L[c.acab || "nonfoil"] || "n";
  if (g) for (const i of g[2]) { const f = datos().buscar.imp[i]; if (f && String(f[0]).startsWith(c.sid) && f[3] === L) return f; }
  return null;
};
const etVer = (c) => { const f = impDe(c); return f ? `${String(f[1]).toUpperCase()} #${f[2]}${f[3] !== "n" ? " ★" : ""}` : ""; };
// nombres en otros idiomas (buscar.json trae "nombre|alias|..." ya normalizado): "relampago" encuentra Lightning Bolt
let ALIAS_W = null;
const aliasLista = (n) => { if (!ALIAS_W) { ALIAS_W = new Map(); for (const x of datos().buscar?.nombres || []) if (x[1]) ALIAS_W.set(x[0], x[1].split("|")); } return ALIAS_W.get(n) || []; };
const aliasDe = (n) => aliasLista(n).join(" ");
const rangoNombre = (o, nq) => {                    // 0 = el nombre (o su traduccion) es justo eso, 1 = empieza asi, 2 = lo demas
  if (!nq) return 2; const al = aliasLista(o.n);
  if (o.nn === nq || al.includes(nq)) return 0;
  return o.nn.startsWith(nq) || al.some((a) => a.startsWith(nq)) ? 1 : 2;
};
const deckNombres = (cartas) => [...new Set(cartas.map((c) => c.n))];
export async function asegurarNombres(cartas) { await cargarUniverso(deckNombres(cartas)); }
function preciosDeck(cartas, tengo) {
  const enDeck = cartas.filter((c) => c.z !== "quizas");
  const out = { tiendas: {}, eco: 0, ecoSin: 0, falta: 0, faltaN: 0, faltan: [] };
  for (const [tk] of TIENDAS) {
    let s = 0, sin = 0;
    for (const c of enDeck) { const v = precioCartaW(c, tk); if (v == null) sin += c.q; else s += v * c.q; }
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
      pareja: x[9], sid: x[10], pt: x[11], rar: (x[12] || "").slice(0, 1), rank: x[13] ?? 999999, nn: normal(x[0]) }));
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
  const tots = TIENDAS.map(([tk, et]) => `<button type="button" class="dktot${tk === tienda ? " on" : ""}" data-tienda="${tk}">${et} <b class="num">${pesos2(P.tiendas[tk].total)}</b>${P.tiendas[tk].sin ? `<sup>${P.tiendas[tk].sin}</sup>` : ""}</button>`).join("");
  const cur = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const c of deck.cartas) { if (c.z !== "main" && c.z !== "cmd") continue; const o = oraDe(c.n); if (!o || o.tipo.split(" // ")[0].includes("Land")) continue; cur[Math.min(7, Math.floor(o.cmc))] += c.q; }
  const mx = Math.max(1, ...cur);
  const curva = ORA ? `<div class="dkcurva">${cur.map((n, i) => `<span title="${i === 7 ? "7+" : i}: ${n}"><i style="height:${Math.round((100 * n) / mx)}%"></i><em>${i === 7 ? "7+" : i}</em></span>`).join("")}</div>` : "";
  const gc = deck.cartas.filter((c) => c.z !== "quizas" && oraDe(c.n)?.gc).length;
  const br = esCmd(deck.formato) && ORA ? `<span class="dkbr" title="${esc(t("dk.bracket_ayuda"))}">BRACKET ${gc === 0 ? "1–2" : gc <= 3 ? "3" : "4"}</span>` : "";
  const prob = op.editable ? problemas(deck) : [];
  let h = "";
  const linea = (c) => {
    const o = oraDe(c.n), v = precioCartaW(c, tienda), tg = op.tengo ? op.tengo[c.n] || 0 : null;
    const mal = op.editable && o && ["b", "-"].includes(legal(o, deck.formato));
    const ev = etVer(c);
    return `<li class="dkl${mal ? " ilegal" : ""}" data-n="${esc(c.n)}" data-z="${c.z}" data-v="${esc(vDe(c))}"><span class="q num">${c.q}</span><button type="button" class="n dk-nbtn" data-carta title="${esc(t("dk.ver_carta"))}">${esc(c.n)}${ev ? ` <i class="dk-vet">◆ ${esc(ev)}</i>` : ""}</button><span class="c">${coste(o?.coste)}</span>` +
      `<span class="r num">${v == null ? "—" : pesos2(v * c.q)}</span>${tg != null && !BASICAS.has(c.n) ? `<span class="tg ${tg >= c.q ? "ok" : tg ? "medio" : "no"}">${tg >= c.q ? "✓" : `${tg}/${c.q}`}</span>` : `<span class="tg"></span>`}` +
      `${op.editable ? `<span class="dkb"><button type="button" data-q="-1" aria-label="−">−</button><button type="button" data-q="1" aria-label="+">+</button><button type="button" class="dk-x" data-x="1" aria-label="${esc(t("dk.quitar_todas"))}" title="${esc(t("dk.quitar_todas"))}">✕</button></span>` : ""}</li>`;
  };
  const zona = (z, titulo) => { const cs = deck.cartas.filter((c) => c.z === z); if (!cs.length) return ""; return `<h3 class="dkg">${esc(titulo)} <span class="tenue">${cs.reduce((s, c) => s + c.q, 0)}</span></h3><ul class="dklista">${cs.map(linea).join("")}</ul>`; };
  if (!op.editable) h += zona("cmd", t("dk.comandante"));      // en el editor el comandante tiene su propio lugar arriba
  const main = deck.cartas.filter((c) => c.z === "main"), grupos = new Map();
  for (const c of main) { const g = grupoDe(c.n); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(c); }
  for (const [, g] of GRUPOS) {
    const cs = grupos.get(g); if (!cs) continue;
    cs.sort((a, b) => (oraDe(a.n)?.cmc ?? 0) - (oraDe(b.n)?.cmc ?? 0) || a.n.localeCompare(b.n));
    h += `<h3 class="dkg">${esc(t(g))} <span class="tenue">${cs.reduce((s, c) => s + c.q, 0)}</span></h3><ul class="dklista">${cs.map(linea).join("")}</ul>`;
  }
  h += zona("side", t("dk.side")) + zona("quizas", t("dk.quizas"));
  const gal = vistaDk() === "galeria";
  if (gal) h = htmlGaleria(deck, op);
  const seg = `<span class="seg-web dk-vista"><button type="button" class="${gal ? "" : "activo"}" data-dkvista="lista">☰ ${esc(t("dk.lista"))}</button><button type="button" class="${gal ? "activo" : ""}" data-dkvista="galeria">▦ ${esc(t("dk.galeria"))}</button></span>`;
  return `<div class="dkres"><div class="dktots">${tots}</div>
      <p class="tenue">${esc(t("dk.economica"))} <b class="num ambar">${pesos2(P.eco)}</b>${P.ecoSin ? ` · ${esc(t("dk.sin_precio", { n: P.ecoSin }))}` : ""}</p>
      ${op.tengo ? `<p class="tenue">${esc(t("dk.te_falta"))} <b class="num ambar">${P.faltaN}</b> · <b class="num ambar">${pesos2(P.falta)}</b>${P.faltaN ? ` <button type="button" class="enlace" data-faltan>${esc(t("dk.copiar_faltan"))}</button>` : ""}</p>` : ""}
      <div class="dkstats">${curva}${br}${seg}</div>
      ${prob.length ? `<ul class="dkprob">${prob.slice(0, 8).map((p) => `<li>⚠ ${esc(p)}</li>`).join("")}${prob.length > 8 ? `<li>…</li>` : ""}</ul>` : ""}</div>${h || `<p class="tenue">${esc(t("dk.vacio"))}</p>`}`;
}
// ---- lista o galeria (se recuerda en este navegador)
const vistaDk = () => { try { return localStorage.getItem("stack.dk_vista") === "galeria" ? "galeria" : "lista"; } catch { return "lista"; } };
const ponerVistaDk = (v) => { try { localStorage.setItem("stack.dk_vista", v); } catch { /* sin almacenamiento */ } };
// galeria estilo Arena / MTGO: columnas por coste, cartas encimadas (se ve la parte de arriba; tocar = la carta completa y sus versiones)
function htmlGaleria(deck, op = {}) {
  const tierra = (c) => (oraDe(c.n)?.tipo || "").split(" // ")[0].includes("Land"), cmc = (c) => Math.floor(oraDe(c.n)?.cmc || 0);
  const orden = (a, b) => (oraDe(a.n)?.cmc ?? 0) - (oraDe(b.n)?.cmc ?? 0) || a.n.localeCompare(b.n);
  const main = deck.cartas.filter((c) => c.z === "main"), noT = main.filter((c) => !tierra(c));
  const cols = [...(op.editable ? [] : [[t("dk.comandante"), deck.cartas.filter((c) => c.z === "cmd")]]),
    ["0–1", noT.filter((c) => cmc(c) <= 1)], ["2", noT.filter((c) => cmc(c) === 2)], ["3", noT.filter((c) => cmc(c) === 3)], ["4", noT.filter((c) => cmc(c) === 4)],
    ["5", noT.filter((c) => cmc(c) === 5)], ["6+", noT.filter((c) => cmc(c) >= 6)], [t("dk.g_tierras"), main.filter(tierra)],
    [t("dk.side"), deck.cartas.filter((c) => c.z === "side")], [t("dk.quizas"), deck.cartas.filter((c) => c.z === "quizas")]];
  const carta = (c) => {
    const o = oraDe(c.n), sid = c.sid || o?.sid, tg = op.tengo ? op.tengo[c.n] || 0 : null;
    const est = tg == null || BASICAS.has(c.n) ? "" : tg >= c.q ? " ok" : tg ? " medio" : " no";
    const mal = op.editable && o && ["b", "-"].includes(legal(o, deck.formato));
    return `<button type="button" class="dk-gc${est}${mal ? " ilegal" : ""}" data-carta data-n="${esc(c.n)}" data-z="${c.z}" data-v="${esc(vDe(c))}" title="${c.q} × ${esc(c.n)}${c.sid ? " · " + esc(etVer(c)) : ""}">` +
      `${sid ? `<img src="${esc(imgCarta(sid, "normal"))}" alt="" loading="lazy">` : ""}<span class="dk-gn">${esc(c.n)}</span>${c.q > 1 ? `<b class="num">×${c.q}</b>` : ""}</button>`;
  };
  const h = cols.filter(([, xs]) => xs.length).map(([et, xs]) => `<div class="dk-gcol"><h4>${esc(et)} <span class="tenue num">${xs.reduce((s_, c) => s_ + c.q, 0)}</span></h4>` +
    `<div class="dk-pila">${xs.sort(orden).map(carta).join("")}</div></div>`).join("");
  return `<div class="dk-gal">${h}</div>`;
}
// ---- hoja de una carta del deck: la imagen completa, cuantas, y sus versiones (elegir una = la que usa el deck)
async function abrirHojaCarta(deck, n, z, op = {}, v0 = "") {
  let hoja = document.getElementById("dk-hoja");
  if (!hoja) { hoja = document.createElement("div"); hoja.id = "dk-hoja"; hoja.className = "dk-hoja"; document.body.appendChild(hoja); }
  hoja.hidden = false; document.body.classList.add("con-hoja");
  await asegurarNombres([{ n }]);
  let linea = deck.cartas.find((x) => x.n === n && x.z === z && vDe(x) === v0) || deck.cartas.find((x) => x.n === n && x.z === z) || null;
  const pintar = () => {
    if (linea && !deck.cartas.includes(linea)) linea = deck.cartas.find((x) => x.n === n && x.z === z) || null;
    const c = linea || { n, q: 0, z }, o = oraDe(n), tienda = op.tienda || "tcg";
    const g = nombres().get(o ? o.n : n) || nombres().get(n), L = ACAB_L[c.acab || "nonfoil"] || "n";
    const vers = g ? g[2].map((i) => datos().buscar.imp[i]).filter(Boolean).map((f) => ({ f, sid: String(f[0]).split(":")[0], v: precioImp(f, tienda) }))
      .sort((a, b) => (a.v ?? 1e12) - (b.v ?? 1e12)).slice(0, 80) : [];
    const sidVer = c.sid || o?.sid, usada = (x) => c.sid ? x.sid === c.sid && x.f[3] === L : false;
    hoja.innerHTML = `<div class="dk-hoja-c" role="dialog" aria-label="${esc(n)}"><div class="dk-hoja-cab"><h2>${esc(o ? o.n : n)}</h2><button type="button" class="cerrar" data-h="cerrar" aria-label="${esc(t("ajustes.cerrar"))}">✕</button></div>
      <div class="dk-hoja-top">${sidVer ? `<img class="dk-hoja-img" src="${esc(imgCarta(sidVer, "normal"))}" alt="">` : ""}
        <div class="dk-hoja-dat"><p>${coste(o?.coste)} <span class="tenue">${esc(o?.tipo || "")}</span></p>
        ${op.editable ? `<div class="dk-hoja-q"><button type="button" class="chip-acab" data-h="menos" aria-label="−">−</button><b class="num">${c.q}</b><button type="button" class="chip-acab" data-h="mas" aria-label="+">+</button>
          <button type="button" class="chip-acab" data-h="quitar">${esc(t("dk.quitar_todas"))}</button></div>` : ""}
        <p class="tenue">${esc(op.editable ? t("dk.ver_ayuda") : t("dk.ver_ayuda_meta"))}</p></div></div>
      <h3 class="dkg">${esc(t("dk.versiones"))} <span class="tenue">${vers.length}</span></h3>
      <div class="dk-vers">${vers.map((x) => { const qv = deck.cartas.filter((y) => y.n === n && y.sid === x.sid && ACAB_L[y.acab || "nonfoil"] === x.f[3]).reduce((t_, y) => t_ + y.q, 0);
        return `<div class="dk-verw"><button type="button" class="dk-ver${usada(x) ? " activo" : ""}" data-sid="${esc(x.sid)}" data-acab="${esc(x.f[3])}"${op.editable ? "" : " disabled"}>` +
        `<img src="${esc(imgCarta(x.sid, "small"))}" alt="" loading="lazy">${qv ? `<em class="num">×${qv}</em>` : ""}<span>${esc(String(x.f[1]).toUpperCase())} #${esc(x.f[2])}</span><span class="tenue">${esc(t("acabado." + x.f[3]))}</span><b class="num">${pesos2(x.v)}</b></button>` +
        `${op.editable ? `<button type="button" class="dk-veradd" data-veradd="${esc(x.sid)}" data-acab="${esc(x.f[3])}" title="${esc(t("dk.ver_mas"))}" aria-label="${esc(t("dk.ver_mas"))}">+1</button>` : ""}</div>`; }).join("") || `<p class="tenue">${esc(t("dk.sin_versiones"))}</p>`}</div></div>`;
  };
  pintar();
  hoja.onclick = (e) => {
    if (e.target === hoja || e.target.closest('[data-h="cerrar"]')) { hoja.hidden = true; hoja.innerHTML = ""; document.body.classList.remove("con-hoja"); return; }
    if (!op.editable) return;
    const b = e.target.closest("[data-h]");
    if (b) { if (!linea) { if (b.dataset.h === "mas") { op.cambiar(n, z, 1); linea = deck.cartas.find((x) => x.n === n && x.z === z) || null; pintar(); } return; }
      const dq = b.dataset.h === "mas" ? 1 : b.dataset.h === "menos" ? -1 : -linea.q;
      op.cambiarLinea(linea, dq); if (!deck.cartas.includes(linea)) { hoja.hidden = true; hoja.innerHTML = ""; document.body.classList.remove("con-hoja"); } else pintar(); return; }
    const va = e.target.closest("[data-veradd]");
    if (va) { const zz = z === "cmd" ? "main" : z; op.cambiar(n, zz, 1, { sid: va.dataset.veradd, acab: ACAB_DE[va.dataset.acab] || "nonfoil" }); pintar(); return; }
    const v = e.target.closest("[data-sid]");
    if (v) { const c = linea;
      if (!c) { const ex = { sid: v.dataset.sid, acab: ACAB_DE[v.dataset.acab] || "nonfoil" }; op.cambiar(n, z === "cmd" ? "main" : z, 1, ex);   // aun no esta en el deck: entra con esa version
        linea = deck.cartas.find((y) => y.n === n && vDe(y) === `${ex.sid}|${ex.acab}`) || null; pintar(); return; }
      c.sid = v.dataset.sid; c.acab = ACAB_DE[v.dataset.acab] || "nonfoil";
      const igual = deck.cartas.find((y) => y !== c && y.n === c.n && y.z === c.z && vDe(y) === vDe(c));      // ya habia una linea con esa version: se juntan
      if (igual) { igual.q += c.q; deck.cartas.splice(deck.cartas.indexOf(c), 1); linea = igual; }
      op.cambiado(); pintar(); }
  };
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

// ---- carta firma de un arquetipo (como MTGGoldfish): la clave de MTGGoldfish si la hay; si no, la carta mas propia del arquetipo
const artCarta = (sid) => (sid ? `https://cards.scryfall.io/art_crop/front/${sid[0]}/${sid[1]}/${sid}.jpg` : "");
function coloresDeck(d) {                        // colores de las cartas (sin tierras) del main y comandante, como la app
  const col = new Set();
  for (const c of d.cartas) { if (c.z !== "main" && c.z !== "cmd") continue; const o = oraDe(c.n); if (!o || o.tipo.split(" // ")[0].includes("Land")) continue; for (const x of o.col || "") col.add(x); }
  return [..."WUBRG"].filter((c) => col.has(c)).join("");
}
function firmaArq(F, a, fmt, R) {
  M.firmas = M.firmas || new Map();
  const k = fmt + "|" + a.nombre; if (M.firmas.has(k)) return M.firmas.get(k);
  const ds = (F?.decks || []).filter((d) => d.arquetipo === a.nombre);
  const listas = ds.length ? ds.map((d) => d.main || []) : F?.tipicas?.[a.nombre] ? [Object.entries(F.tipicas[a.nombre].main || {})] : [];
  const cuenta = new Map(), col = new Set();
  for (const main of listas) for (const [nom] of main) {
    const o = oraDe(nom); if (!o || o.tipo.split(" // ")[0].includes("Land")) continue;
    cuenta.set(o.n, (cuenta.get(o.n) || 0) + 1); for (const c of o.col || "") col.add(c);
  }
  let n = null;
  for (const c of a.claves || []) { const o = oraDe(c); if (o) { n = o.n; break; } }
  if (!n) {
    let mejor = -1e9;
    for (const [nom, c] of cuenta) {
      const o = oraDe(nom), propia = c / Math.max(1, listas.length), general = ((((R.cartas || {})[nom] || {})[fmt] || [0])[0] || 0) / 100;
      const pts = propia - general + Math.min(6, o.cmc || 0) * 0.01 + (/Creature|Planeswalker/.test(o.tipo) ? 0.05 : 0);
      if (pts > mejor) { mejor = pts; n = nom; }
    }
  }
  const r = { n, col: [..."WUBRG"].filter((c) => col.has(c)).join("") };
  M.firmas.set(k, r); return r;
}
const OTROS_ARQ = new Set(["Otros", "Others", "Other", "Rogue"]);
function tierDe(x) { if (OTROS_ARQ.has(x.nombre) || !x.n) return 3; return x.pct >= 5 ? 0 : x.pct >= 2 ? 1 : 2; }

export async function vistaMeta(app, fmtRuta) {
  document.body.classList.remove("en-portada");
  document.body.classList.add("ancho");
  const fmt = FMT_META.includes(fmtRuta) ? fmtRuta : "modern";
  app.innerHTML = `<h1 class="titulo-vista">META</h1><p class="tenue">${esc(t("meta.cargando"))}</p>`;
  let R;
  try { R = await cargarResumen(); } catch { R = null; }
  if (!R) { app.innerHTML = `<h1 class="titulo-vista">META</h1><p class="tenue">${esc(t("meta.sin_datos"))}</p>`; return; }
  let F;
  try { [F] = await Promise.all([cargarFormato(fmt), cargarOraculo().catch(() => null)]); } catch { F = null; }
  const tengo = await cargarTengo();
  const S = R.formatos[fmt] || {};
  const fmts = FMT_META.map((f) => `<a class="boton-fmt${f === fmt ? " activo" : ""}" href="#/meta/${f}">${esc(NOMBRE_FMT[f])}${R.formatos[f]?.decks_n != null ? ` <small>${R.formatos[f].decks_n}</small>` : ""}</a>`).join("");
  const vistas = fmt === "commander" ? [] : [["arq", "meta.arquetipos"], ["decks", "meta.decks"], ["staples", "meta.staples"], ["termo", "meta.termometro"]];
  if (fmt === "commander") M.vista = "arq"; else if (!vistas.some((v) => v[0] === M.vista)) M.vista = "arq";
  const tiendas = TIENDAS.map(([tk, et]) => `<button type="button" class="${tk === M.tienda ? "activo" : ""}" data-mt="${tk}">${et}</button>`).join("");
  const pintar = async () => {
    let filas = [];
    const lista = app.querySelector("#meta-lista"), det = app.querySelector("#meta-det");
    if (fmt === "commander") filas = (F?.comandantes || []).map((c) => ({ tipo: "cmd", ...c }));
    else if (M.vista === "arq") filas = (S.arquetipos || []).map((a) => ({ tipo: "arq", ...a })).sort((a, b) => tierDe(a) - tierDe(b) || (b.pct || 0) - (a.pct || 0));
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
    const galeria = M.vista === "arq" || fmt === "commander";
    lista.classList.toggle("meta-gal", galeria);
    if (galeria) {
      const TIERS = ["meta.tier1", "meta.tier2", "meta.tier3", "meta.sin_clasificar"];
      let h = "", tierAnt = -1;
      filas.slice(0, 150).forEach((x, i) => {
        const d = deckDe(x), P = d ? preciosDeck(d.cartas, tengo) : null;
        if (x.tipo === "arq") { const tr = tierDe(x); if (tr !== tierAnt) { tierAnt = tr; h += `<h3 class="meta-tier">${esc(t(TIERS[tr]))}</h3>`; } }
        else if (i === 0) h += `<h3 class="meta-tier">${esc(t("meta.top_cmd"))}</h3>`;
        else if (i === 12) h += `<h3 class="meta-tier">${esc(t("meta.mas_cmd"))}</h3>`;
        let arte, col, l1;
        if (x.tipo === "cmd") { const o = oraDe(x.nombre); arte = o?.sid; col = o?.id || ""; l1 = `<span>#${x.rango} · <b>${(x.n_decks || 0).toLocaleString()}</b> decks</span>${tend(x.tendencia == null ? null : Math.max(-9.9, Math.min(9.9, x.tendencia / 3)))}`; }
        else { const fz = firmaArq(F, x, fmt, R), o = oraDe(fz.n); arte = o?.sid; x._firma = fz.n;
          col = d ? coloresDeck(d) : x.colores || fz.col;               // los mismos colores que la lista del deck que se muestra
          l1 = `<span>META <b>${x.n ? x.pct.toFixed(1) + "%" : "—"}</b>${x.n ? ` <i class="tenue">(${x.n})</i>` : ""}</span>${tend(x.tend)}`; }
        const l2 = `<span>${TIENDAS.find((z) => z[0] === M.tienda)[1]} <b class="num">${P ? pesos2(P.tiendas[M.tienda].total) : "—"}</b></span>${P && tengo ? `<span>${esc(t("dk.falta_corto"))} <b class="num ${P.falta ? "" : "sube"}">${P.falta ? pesos2(P.falta) : "✓"}</b></span>` : ""}`;
        h += `<button type="button" class="meta-tar${M.sel === i ? " activo" : ""}" data-i="${i}"><span class="meta-arte"${arte ? ` style="background-image:url('${artCarta(arte)}')"` : ""}>` +
          `<span class="meta-pips">${col ? pips(col) : ""}</span>${x._firma ? `<span class="meta-firma">${esc(x._firma)}</span>` : ""}</span>` +
          `<span class="meta-nom">${esc(x.nombre)}</span><span class="meta-dat">${l1}</span><span class="meta-dat">${l2}</span></button>`;
      });
      lista.innerHTML = h || `<p class="tenue">${esc(t("meta.vacio"))}</p>`;
    } else {
      lista.innerHTML = filas.length ? filas.slice(0, 150).map((x, i) => {
        const d = deckDe(x), P = d ? preciosDeck(d.cartas, tengo) : null;
        const precio = P ? pesos2(P.tiendas[M.tienda].total) : x.nombre ? pesos2(precioNombre(x.nombre, M.tienda)) : "—";
        const sub = x.tipo === "deck" ? `${esc(x.fecha)} · ${x.puesto ? x.puesto + "°" : esc(x.resultado || "")} · ${esc(x.evento || "")} · ${esc(FUENTE[x.fuente] || x.fuente)}`
          : `${x.pct.toFixed(1)}% · ${x.tipo === "staple" ? `${x.copias} ${esc(t("meta.copias"))} · ` : ""}${tend(x.tend)}`;
        return `<button type="button" class="meta-fila${M.sel === i ? " activo" : ""}" data-i="${i}"><span class="medio"><span class="titulo">${esc(x.nombre || x.arquetipo)}</span><span class="sub">${sub}</span></span>` +
          `<span class="der"><span class="precio num">${precio}</span>${P && tengo ? `<span class="tenue num">${esc(t("dk.falta_corto"))} ${pesos2(P.falta)}</span>` : tengo && x.nombre ? `<span class="tenue">${esc(t("dk.tienes"))} ${tengo[x.nombre] || 0}</span>` : ""}</span></button>`;
      }).join("") : `<p class="tenue">${esc(t("meta.vacio"))}</p>`;
    }
    const verDet = (i, mover) => {
      M.sel = i;
      lista.querySelectorAll("[data-i]").forEach((b) => b.classList.toggle("activo", Number(b.dataset.i) === i));
      const x = filas[i], d = x && deckDe(x);
      if (!d) {
        if (x && x.nombre) {
          const fm = (R.cartas || {})[x.nombre] || {};
          det.innerHTML = `<h2>${esc(x.nombre)}</h2><ul class="meta-fmts">${Object.entries(fm).map(([f, [p, tn]]) => `<li><span>${esc(NOMBRE_FMT[f] || f)}</span><span>${p.toFixed(1)}% · ${tend(tn)}</span></li>`).join("")}</ul>` +
            `<ul class="meta-fmts">${TIENDAS.map(([tk, et]) => `<li><span>${et}</span><span class="num">${pesos2(precioNombre(x.nombre, tk))}</span></li>`).join("")}</ul>`;
        } else det.innerHTML = "";
        return;
      }
      const inf = d.info || {};
      det.innerHTML = `<h2>${esc(d.nombre)}</h2><p class="tenue">${esc(NOMBRE_FMT[d.formato] || d.formato)}${inf.evento ? " · " + esc(inf.evento) : ""}${inf.puesto ? ` · ${inf.puesto}°` : ""}${inf.jugador ? " · " + esc(inf.jugador) : ""}` +
        `${inf.fuente ? ` · <a href="${esc(inf.url || "#")}" target="_blank" rel="noopener">${esc(FUENTE[inf.fuente] || inf.fuente)}</a>` : ""}${inf.promedio ? " · " + esc(t("meta.promedio")) : ""}</p>
        <div class="acciones-deck"><button type="button" class="primario" data-copiar-deck>${esc(t("meta.a_mis_decks"))}</button><button type="button" class="boton-fmt" data-texto>${esc(t("meta.copiar_lista"))}</button></div>
        <p id="meta-msg" class="tenue" role="status"></p>${htmlDeck(d, { tienda: M.tienda, tengo })}`;
      det.dataset.deck = JSON.stringify({ nombre: d.nombre, formato: d.formato, cartas: d.cartas, origen: d.origen || null });
      if (mover && matchMedia("(max-width: 899px)").matches) det.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    lista.onclick = (e) => { const b = e.target.closest("[data-i]"); if (b) verDet(Number(b.dataset.i), true); };
    if (M.sel != null && filas[M.sel]) verDet(M.sel); else if (filas.length && matchMedia("(min-width: 900px)").matches) verDet(0); else det.innerHTML = "";
  };
  app.innerHTML = `<h1 class="titulo-vista">META</h1>
    <nav class="botones-fmt">${fmts}</nav>
    <div class="meta-barra">${vistas.length ? `<span class="seg-web">${vistas.map(([v, k]) => `<button type="button" class="${v === M.vista ? "activo" : ""}" data-mv="${v}">${esc(t(k))}</button>`).join("")}</span>` : ""}
      <span class="meta-tiendas"><span class="tenue">${esc(t("meta.precios_de"))}</span><span class="seg-web">${tiendas}</span></span></div>
    <p class="tenue meta-nota">${esc(t("meta.ventana", { dias: R.ventana_dias, dia: R.dia }))}${S.decks_n != null ? " · " + esc(t("meta.n_decks", { n: S.decks_n, s: S.semana_n })) : ""}</p>
    <div class="meta-cuerpo"><div id="meta-lista" class="meta-lista"></div><section id="meta-det" class="meta-det"></section></div>
    <p class="nota">${esc(t("meta.creditos"))} <a href="https://topdeck.gg" target="_blank" rel="noopener">TopDeck.gg</a>.</p>`;
  app.onclick = async (e) => {
    const v = e.target.closest("[data-mv]"); if (v) { M.vista = v.dataset.mv; M.sel = null; vistaMeta(app, fmt); return; }
    const dv = e.target.closest("[data-dkvista]"); if (dv) { ponerVistaDk(dv.dataset.dkvista); pintar(); return; }
    const vc = e.target.closest("[data-carta]"); if (vc) { const l = vc.closest("[data-n]"), d = JSON.parse(app.querySelector("#meta-det").dataset.deck || "null"); if (d && l) abrirHojaCarta(d, l.dataset.n, l.dataset.z, { tienda: M.tienda }); return; }
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
  try { await cargarOraculo().catch(() => null); ds = await listarDecks(); } catch { app.innerHTML += `<p class="error">${esc(t("dk.err_leer"))}</p>`; return; }
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1>
    <div class="acciones-deck"><button type="button" class="primario" data-nuevo>${esc(t("dk.nuevo"))}</button><a class="chip-acab" href="#/meta">META</a></div>
    <div class="dk-mios meta-gal">${ds.length ? ds.map((d) => { const cmd = d.cartas.find((c) => c.z === "cmd"), o = cmd ? oraDe(cmd.n) : d.cartas.map((c) => oraDe(c.n)).find((x) => x && !x.tipo.includes("Land"));
      const id_ = identidad(d); return `<a class="meta-tar" href="#/decks/${esc(d.id)}"><span class="meta-arte"${o?.sid ? ` style="background-image:url('${artCarta(cmd?.sid || o.sid)}')"` : ""}><span class="meta-pips">${id_ != null ? pips(id_) : ""}</span><span class="meta-firma">${esc(NOMBRE_FMT[d.formato] || d.formato)}</span></span>` +
      `<span class="meta-nom">${esc(d.nombre)}</span><span class="meta-dat"><span>${d.cartas.reduce((s, c) => s + (c.z === "quizas" ? 0 : c.q), 0)} ${esc(t("dk.cartas"))}</span></span></a>`; }).join("") : `<p class="tenue">${esc(t("dk.sin_decks"))}</p>`}</div>`;
  app.onclick = async (e) => {
    if (e.target.closest("[data-nuevo]")) {
      try { const nid = await crearDeck({ nombre: t("dk.deck_nuevo"), formato: "commander", cartas: [] }); location.hash = `#/decks/${nid}`; }
      catch { toastMsg(app, t("dk.err_guardar")); }
    }
  };
}
const toastMsg = (app, m) => { const p = app.querySelector("#dk-msg"); if (p) p.textContent = m; };

// ---- editor (0.9.2): el deck primero, comandante facil, filtros con los iconos de Stack, quitar con la misma facilidad que agregar
const E = { deck: null, q: "", qcmd: "", cols: new Set(), tipos: new Set(), rar: new Set(), cmc: null, res: [], pest: "deck", edh: null, t: null, guardando: false, sucio: false, tienda: "tcg" };
const TIPOS_W = [["Land", "land", "tog.tierra"], ["Creature", "creature", "tog.criatura"], ["Instant", "instant", "tog.instantaneo"], ["Sorcery", "sorcery", "tog.conjuro"],
  ["Artifact", "artifact", "tog.artefacto"], ["Enchantment", "enchantment", "tog.encantamiento"], ["Planeswalker", "planeswalker", "tog.planeswalker"], ["Battle", "battle", "tog.batalla"]];
const RAREZAS_W = [["c", "tog.comun"], ["u", "tog.infrecuente"], ["r", "tog.rara"], ["m", "tog.mitica"]];
const COLORES_W = [["W", "tog.blanco"], ["U", "tog.azul"], ["B", "tog.negro"], ["R", "tog.rojo"], ["G", "tog.verde"], ["C", "tog.incoloro"]];
async function editor(app, id) {
  app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="tenue">${esc(t("dk.cargando"))}</p>`;
  try {
    await cargarOraculo();
    const docs = await cuenta.listar(), d = docs.find((x) => x.tipo === `deck:${id}`);
    if (!d) { app.innerHTML = `<h1 class="titulo-vista">${esc(t("dk.titulo"))}</h1><p class="error">${esc(t("dk.no_existe"))}</p><a class="boton-vacio" href="#/decks">${esc(t("dk.mis_decks"))}</a>`; return; }
    E.deck = { ...(await cuenta.leer(d.tipo, d.version)), id };
    cuenta.fijarVersion(d.tipo, d.version);
  } catch { app.innerHTML += `<p class="error">${esc(t("dk.err_leer"))}</p>`; return; }
  Object.assign(E, { edh: null, q: "", qcmd: "", cols: new Set(), tipos: new Set(), rar: new Set(), cmc: null, pest: "deck" });
  const tengo = await cargarTengo();
  await asegurarNombres(E.deck.cartas);
  app.innerHTML = `<nav class="dk-migas"><a href="#/decks">‹ ${esc(t("dk.mis_decks"))}</a><span id="dk-estado" class="tenue" role="status"></span></nav>
    <div class="dk-cab"><input id="dk-nombre" class="dk-nombre" maxlength="60" value="${esc(E.deck.nombre)}" aria-label="${esc(t("dk.nombre"))}">
      <select id="dk-fmt" aria-label="${esc(t("dk.formato"))}">${FMT_DECK.map((f) => `<option value="${f}"${f === E.deck.formato ? " selected" : ""}>${esc(NOMBRE_FMT[f])}</option>`).join("")}</select></div>
    <nav class="seg-web dk-pest" id="dk-pest"></nav>
    <div class="dk-cuerpo"><section id="dk-deck" class="dk-deck"></section><section id="dk-busca" class="dk-busca"></section></div>
    <div class="acciones-deck"><button type="button" class="boton-fmt" data-acc="copiar">${esc(t("meta.copiar_lista"))}</button><button type="button" class="boton-fmt" data-acc="compartir">${esc(t("dk.compartir"))}</button>
      <button type="button" class="boton-fmt" data-acc="importar">${esc(t("dk.importar"))}</button><button type="button" class="boton-fmt peligro" data-acc="vaciar">${esc(t("dk.vaciar"))}</button><button type="button" class="boton-fmt peligro" data-acc="borrar">${esc(t("dk.borrar"))}</button></div>
    <p id="dk-msg" class="tenue" role="status"></p>`;
  const busca = app.querySelector("#dk-busca"), panel = app.querySelector("#dk-deck"), estado = app.querySelector("#dk-estado"), msg = app.querySelector("#dk-msg");
  const nCartas = () => E.deck.cartas.filter((c) => c.z !== "quizas").reduce((s, c) => s + c.q, 0);
  const pintarPest = () => {                         // EDHREC solo en los formatos de comandante
    const ps = ["deck", "buscar", ...(esCmd(E.deck.formato) ? ["edhrec"] : [])];
    if (!ps.includes(E.pest)) E.pest = "deck";
    app.querySelector("#dk-pest").innerHTML = ps.map((p) => `<button type="button" class="${p === E.pest ? "activo" : ""}" data-pest="${p}">${esc(t("dk.p_" + p))}${p === "deck" ? ` (${nCartas()})` : ""}</button>`).join("");
    app.querySelector(".dk-cuerpo").dataset.ver = E.pest;
  };
  // ---- comandante: un lugar fijo arriba del deck, con su propio buscador de comandantes legales
  const htmlComandante = () => {
    if (!esCmd(E.deck.formato)) return "";
    const cmds = E.deck.cartas.filter((c) => c.z === "cmd"), id_ = identidad(E.deck);
    const elegidos = cmds.map((c) => { const o = oraDe(c.n); return `<div class="dk-cmd-carta">${o?.sid ? `<img src="${esc(imgCarta(c.sid || o.sid, "normal"))}" alt="${esc(c.n)}" loading="lazy">` : ""}` +
      `<span class="n">${esc(c.n)}</span><button type="button" class="dk-x" data-quitar-cmd="${esc(c.n)}" aria-label="${esc(t("dk.quitar"))}" title="${esc(t("dk.quitar"))}">✕</button></div>`; }).join("");
    const pareja = cmds.length === 1 && oraDe(cmds[0].n)?.pareja;
    const buscador = !cmds.length || pareja ? `<input id="dk-qcmd" type="search" class="dk-q" placeholder="${esc(t(cmds.length ? "dk.buscar_pareja" : "dk.buscar_cmd"))}" autocomplete="off" spellcheck="false" value="${esc(E.qcmd)}"><div id="dk-cmd-res" class="dk-cmd-res"></div>` : "";
    return `<div class="dk-cmd"><div class="dk-cmd-cab"><b>${esc(t("dk.comandante"))}</b>${id_ != null ? `<span class="dk-ident">${pips(id_)}</span>` : ""}</div>${elegidos ? `<div class="dk-cmd-lista">${elegidos}</div>` : ""}${buscador}</div>`;
  };
  const pintarCmdRes = () => {
    const box = app.querySelector("#dk-cmd-res"); if (!box) return;
    const toks = normal(E.qcmd).split(" ").filter(Boolean); if (!toks.length) { box.innerHTML = ""; return; }
    const out = []; for (const o of ORA.filas) { if (!o.cmd) continue; const l = legal(o, E.deck.formato); if (l === "-" || l === "b" || l == null) continue; const h = o.nn + " " + aliasDe(o.n); if (toks.every((tk) => h.includes(tk))) out.push(o); if (out.length > 40) break; }
    out.sort((a, b) => a.rank - b.rank);
    box.innerHTML = out.slice(0, 8).map((o) => `<button type="button" class="dk-cmd-op" data-poner-cmd="${esc(o.n)}">${o.sid ? `<img src="${esc(imgCarta(o.sid, "small"))}" alt="" loading="lazy">` : ""}<span>${esc(o.n)}</span><span class="dk-ident">${pips(o.id)}</span></button>`).join("") || `<p class="tenue">${esc(t("dk.sin_res"))}</p>`;
  };
  const pintarDeck = () => {
    const vacio = !E.deck.cartas.some((c) => c.z !== "cmd");
    panel.innerHTML = htmlComandante() + (vacio ? `<div class="dk-vacio"><p>${esc(t("dk.vacio_deck"))}</p><button type="button" class="primario" data-pest="buscar">${esc(t("dk.ir_buscar"))}</button></div>`
      : htmlDeck(E.deck, { tienda: E.tienda, tengo, editable: true }));
    if (E.qcmd) pintarCmdRes();
    pintarPest();
  };
  let SETS_W = null;
  const setsW = () => SETS_W || (SETS_W = new Set((datos().buscar?.imp || []).map((f) => String(f[1]).toLowerCase())));
  const versionW = (o, num, sets) => {                // la impresion con ese numero y/o set (la mas barata si hay varias)
    const g = nombres().get(o.n); let mej = null, mv = Infinity;
    if (g) for (const i of g[2]) { const f = datos().buscar.imp[i]; if (!f) continue; const fn = String(f[2]).toLowerCase();
      if (num && fn !== num && fn.replace(/[^0-9]/g, "") !== num) continue;
      if (sets.length && !sets.includes(String(f[1]).toLowerCase())) continue;
      const v = precioImp(f, E.tienda) ?? 1e12; if (!mej || v < mv || (num && fn === num && String(mej[2]).toLowerCase() !== num)) { mej = f; mv = v; } }
    return mej;
  };
  const buscar = async () => {
    E.resVer = new Map();
    const todos = String(E.q || "").toLowerCase().split(/\s+/).filter(Boolean), numTok = todos.find((x) => /^#\S+$/.test(x)), num = numTok ? numTok.slice(1) : null;
    const D = E.deck, fmt = D.formato, toks = normal(todos.filter((x) => x !== numTok).join(" ")).split(" ").filter(Boolean), id_ = esCmd(fmt) ? identidad(D) : null;
    const out = [], setsDe = new Map();
    for (const o of ORA.filas) {
      const l = legal(o, fmt); if (l == null || l === "-" || l === "b") continue;
      if (id_ != null && [...o.id].some((x) => !id_.includes(x))) continue;
      if (E.cols.size) { if (!o.col) { if (!E.cols.has("C")) continue; } else if (![...o.col].every((x) => E.cols.has(x))) continue; }
      if (E.tipos.size && ![...E.tipos].some((tp) => o.tipo.includes(tp))) continue;
      if (E.rar.size && !E.rar.has(o.rar)) continue;
      if (E.cmc != null && (E.cmc === 7 ? o.cmc < 7 : Math.floor(o.cmc) !== E.cmc)) continue;
      if (toks.length) { const h = o.nn + " " + normal(o.tipo) + " " + aliasDe(o.n), no = toks.filter((tk) => !h.includes(tk));
        if (no.length) { if (!no.every((tk) => setsW().has(tk))) continue; setsDe.set(o, no); } }      // lo que no esta en el nombre puede ser el set
      out.push(o);
      if (!toks.length && out.length >= 600) break;
    }
    const nq = toks.filter((tk) => !setsW().has(tk) || ORA.filas.some((o) => o.nn === tk)).join(" ");
    out.sort((a, b) => rangoNombre(a, nq) - rangoNombre(b, nq) || a.rank - b.rank);
    if (num || setsDe.size) {                         // con numero o set: solo las que tienen esa impresion (se cargan todas sus versiones)
      const cand = out.filter((o) => num || setsDe.has(o)).slice(0, 150);
      await asegurarNombres(cand.map((o) => ({ n: o.n })));
      const ok = [];
      for (const o of out) { const sets = setsDe.get(o) || []; if (!num && !sets.length) { ok.push(o); continue; } if (!cand.includes(o)) continue;
        const f = versionW(o, num, sets); if (f) { E.resVer.set(o, f); ok.push(o); } }
      E.res = ok.slice(0, 120); return;
    }
    E.res = out.slice(0, 120);
  };
  const enDeck = (n) => E.deck.cartas.filter((c) => c.n === n && c.z !== "cmd").reduce((s, c) => s + c.q, 0);
  const tileHTML = (o, extra = "") => {
    const q = enDeck(o.n), cmd = esCmd(E.deck.formato), fv = E.resVer && E.resVer.get(o), sid = fv ? String(fv[0]).split(":")[0] : o.sid;
    if (fv) extra = `<span class="dk-tver">${esc(String(fv[1]).toUpperCase())} #${esc(fv[2])}</span>` + extra;
    return `<div class="dk-tile${q ? " en" : ""}" data-n="${esc(o.n)}"${fv ? ` data-ver="${esc(String(fv[0]).split(":")[0])}:${esc(fv[3])}"` : ""}><button type="button" class="dk-img" data-add="main" aria-label="${esc(t("dk.agregar", { n: o.n }))}">` +
      `<img src="${esc(imgCarta(sid, "normal"))}" alt="${esc(o.n)}" loading="lazy">${q ? `<b class="dk-en">×${q}</b>` : ""}</button>` +
      `${q ? `<button type="button" class="dk-menos" data-menos="1" aria-label="${esc(t("dk.quitar"))}" title="${esc(t("dk.quitar"))}">−</button>` : ""}` +
      `<div class="dk-tile-pie"><span class="num">${pesos2(fv ? precioImp(fv, E.tienda) : precioNombre(o.n, E.tienda))}</span>${extra}` +
      `<button type="button" class="dk-tvers" data-vers title="${esc(t("dk.elegir_version"))}" aria-label="${esc(t("dk.elegir_version"))}">◆</button>` +
      `${cmd && o.cmd ? `<button type="button" data-add="cmd" title="${esc(t("dk.hacer_cmd"))}">CMD</button>` : cmd ? "" : `<button type="button" data-add="side" title="${esc(t("dk.al_side"))}">SB</button>`}</div></div>`;
  };
  const filtrosHTML = () => {
    const id_ = esCmd(E.deck.formato) ? identidad(E.deck) : null;
    const tg = (on, attr, v, tit, ico, extra = "") => `<button type="button" class="tg${on ? " on" : ""}${extra}" data-${attr}="${v}" aria-pressed="${on}" title="${esc(tit)}" aria-label="${esc(tit)}">${ico}</button>`;
    const cols = COLORES_W.map(([c, k]) => { const fuera = id_ != null && c !== "C" && !id_.includes(c), on = id_ != null ? !fuera : E.cols.has(c);
      return tg(on, "col", c, t(k), `<span class="tgmana" style="background:${FONDO[c]}">${svgMtg(c.toLowerCase())}</span>`, fuera ? " fuera" : ""); }).join("");
    const tipos = TIPOS_W.map(([tp, ico, k]) => tg(E.tipos.has(tp), "tp", tp, t(k), svgMtg(ico, "tgtipo"))).join("");
    const rar = RAREZAS_W.map(([r, k]) => tg(E.rar.has(r), "rar", r, t(k), `<span style="color:${RAREZA_COLOR[r]}">${svgMtg("rarity")}</span>`)).join("");
    const activos = E.tipos.size || E.rar.size || E.cmc != null || (id_ == null && E.cols.size);
    const cmcs = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => `<button type="button" class="${E.cmc === n ? "activo" : ""}" data-cmc="${n}">${n === 7 ? "7+" : n}</button>`).join("");
    return `<div class="toggles dk-toggles">${cols}<span class="tgsep"></span>${tipos}<span class="tgsep"></span>${rar}${activos ? `<button type="button" class="tg tgx" data-limpiar="1" title="${esc(t("tog.quitar"))}">✕</button>` : ""}</div>` +
      `<div class="dk-cmc"><span class="tenue">CMC</span><span class="seg-web">${cmcs}</span></div>`;
  };
  const pintarBusca = async () => {
    if (E.pest === "edhrec") { await pintarEdh(); return; }
    if (!busca.querySelector("#dk-q")) busca.innerHTML = `<div class="dk-qfila"><input id="dk-q" type="search" class="dk-q" placeholder="${esc(t("dk.buscar"))}" autocomplete="off" spellcheck="false" value="${esc(E.q)}">` +
      `${datos().manifest?.vision ? `<a class="camara dk-cam" href="#/escaner/deck/${esc(encodeURIComponent(E.deck.id))}" aria-label="${esc(t("dk.escanear"))}" title="${esc(t("dk.escanear"))}"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><rect x="8.5" y="7" width="7" height="10" rx="1"/></svg></a>` : ""}</div><div id="dk-filtros"></div><div class="dk-grid" id="dk-grid"></div>`;
    busca.querySelector("#dk-filtros").innerHTML = filtrosHTML();
    const yo = (E.nb = (E.nb || 0) + 1); await buscar(); if (yo !== E.nb) return;      // si se escribio otra cosa mientras, gana la ultima
    await asegurarNombres(E.res.map((o) => ({ n: o.n })));
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
    await asegurarNombres(E.edh.cats.flatMap((c) => c.cartas.map((x) => ({ n: x.n }))));
    busca.innerHTML = `<p class="tenue">${(E.edh.n || 0).toLocaleString()} decks · <a href="https://edhrec.com/commanders/${esc(slug)}" target="_blank" rel="noopener">EDHREC</a></p>` +
      E.edh.cats.map((c) => `<h3 class="dkg">${esc(c.titulo)}</h3><div class="dk-grid">${c.cartas.map((x) => { const o = oraDe(x.n); return o ? tileHTML(o, `<span class="tenue">${x.p != null ? Math.round(x.p * 100) + "%" : ""}${x.s != null ? ` · ${x.s > 0 ? "+" : ""}${Math.round(x.s * 100)}` : ""}</span>`) : ""; }).join("")}</div>`).join("");
  };
  const guardar = async () => {
    clearTimeout(E.t);
    if (!E.sucio || E.guardando) return;
    E.guardando = true; estado.textContent = t("dk.guardando");
    try { await cuenta.guardar(`deck:${E.deck.id}`, limpio(E.deck)); E.sucio = false; estado.textContent = t("dk.guardado"); }
    catch (er) { estado.textContent = er.estado === 409 ? t("dk.conflicto") : t("dk.err_guardar"); }
    E.guardando = false;
    if (E.sucio) E.t = setTimeout(guardar, 1200);
  };
  const actualizarTiles = (nombre) => busca.querySelectorAll(`.dk-tile[data-n="${CSS.escape(nombre)}"]`).forEach((tl) => {
    const o = oraDe(nombre) || { n: nombre, sid: null }; const tmp = document.createElement("div"); tmp.innerHTML = tileHTML(o, tl.querySelector(".dk-tile-pie .tenue")?.outerHTML || ""); tl.replaceWith(tmp.firstElementChild);
  });
  const sucio = () => { E.sucio = true; estado.textContent = t("dk.sin_guardar"); clearTimeout(E.t); E.t = setTimeout(guardar, 1000); };
  const cambiarLinea = (c, dq) => {                   // suma dq copias a ESA linea (esa version)
    const D = E.deck; if (!c) return;
    c.q = Math.max(0, Math.min(c.z === "cmd" ? 1 : 999, c.q + dq));
    D.cartas = D.cartas.filter((x) => x.q > 0); sucio();
    if (c.z === "cmd") { E.qcmd = ""; E.edh = null; }
    pintarDeck(); if (c.z === "cmd") { busca.innerHTML = ""; pintarBusca(); } else actualizarTiles(c.n);
  };
  const lineaDe = (el) => E.deck.cartas.find((y) => y.n === el.dataset.n && y.z === el.dataset.z && vDe(y) === (el.dataset.v || "")) || E.deck.cartas.find((y) => y.n === el.dataset.n && y.z === el.dataset.z);
  const cambiar = (n, z, dq, extra) => {              // con extra.sid: de esa version, en su propia linea
    const o = oraDe(n), nombre = o ? o.n : n, D = E.deck;
    if (z === "cmd" && dq > 0) {
      const cs = D.cartas.filter((c) => c.z === "cmd"), par = cs.length === 1 && (o?.pareja || oraDe(cs[0].n)?.pareja);
      if (cs.length >= (par ? 2 : 1)) cs.forEach((c) => { c.z = "main"; });
      D.cartas = D.cartas.filter((c) => !(c.n === nombre && c.z === "main" && c.q === 1));
    }
    const v = extra && extra.sid ? `${extra.sid}|${extra.acab || "nonfoil"}` : null;
    let c = v ? D.cartas.find((x) => x.n === nombre && x.z === z && vDe(x) === v)
      : D.cartas.find((x) => x.n === nombre && x.z === z && !x.sid) || D.cartas.find((x) => x.n === nombre && x.z === z);
    if (!c && dq > 0) { c = { n: nombre, q: 0, z, ...(v ? { sid: extra.sid, acab: extra.acab || "nonfoil" } : {}) }; D.cartas.push(c); }
    if (!c) return;
    c.q = Math.max(0, Math.min(z === "cmd" ? 1 : 999, c.q + dq));
    D.cartas = D.cartas.filter((x) => x.q > 0);
    E.sucio = true; estado.textContent = t("dk.sin_guardar"); clearTimeout(E.t); E.t = setTimeout(guardar, 1000);
    if (z === "cmd") { E.qcmd = ""; E.edh = null; }
    pintarDeck();
    if (z === "cmd") { busca.innerHTML = ""; if (E.pest !== "deck") pintarBusca(); else pintarBusca(); } else actualizarTiles(nombre);
  };
  pintarDeck(); pintarBusca();
  app.oninput = (e) => {
    if (e.target.id === "dk-q") { E.q = e.target.value; pintarBusca(); }
    else if (e.target.id === "dk-qcmd") { E.qcmd = e.target.value; pintarCmdRes(); }
    else if (e.target.id === "dk-nombre") { E.deck.nombre = e.target.value || "Deck"; E.sucio = true; clearTimeout(E.t); E.t = setTimeout(guardar, 1000); }
  };
  app.onchange = (e) => { if (e.target.id === "dk-fmt") { E.deck.formato = e.target.value; E.sucio = true; E.edh = null; E.cols.clear(); guardar(); pintarDeck(); busca.innerHTML = ""; pintarBusca(); } };
  app.onclick = async (e) => {
    const p = e.target.closest("button[data-pest]"); if (p) { E.pest = p.dataset.pest; pintarPest(); if (E.pest !== "deck") { busca.innerHTML = ""; pintarBusca(); } if (matchMedia("(max-width: 899px)").matches) app.querySelector("#dk-pest").scrollIntoView({ block: "start" }); return; }
    const pc = e.target.closest("[data-poner-cmd]"); if (pc) { cambiar(pc.dataset.ponerCmd, "cmd", 1); return; }
    const qc = e.target.closest("[data-quitar-cmd]"); if (qc) { cambiar(qc.dataset.quitarCmd, "cmd", -1); return; }
    const mn = e.target.closest("[data-menos]"); if (mn) { const n = mn.closest(".dk-tile").dataset.n, c = E.deck.cartas.find((x) => x.n === (oraDe(n)?.n || n) && x.z === "main") || E.deck.cartas.find((x) => x.n === (oraDe(n)?.n || n) && x.z !== "cmd"); if (c) cambiar(c.n, c.z, -1); return; }
    const vs = e.target.closest(".dk-tile [data-vers]"); if (vs) { const n = vs.closest(".dk-tile").dataset.n;      // elegir la version antes de agregarla
      abrirHojaCarta(E.deck, oraDe(n)?.n || n, "main", { editable: true, tienda: E.tienda, cambiar, cambiarLinea,
        cambiado: () => { sucio(); pintarDeck(); } }); return; }
    const a = e.target.closest("[data-add]"); if (a) { const tl = a.closest(".dk-tile"), [sid, ac] = (tl.dataset.ver || "").split(":"); cambiar(tl.dataset.n, a.dataset.add, 1, sid ? { sid, acab: ACAB_DE[ac] || "nonfoil" } : undefined); return; }
    const x = e.target.closest(".dkl [data-x]"); if (x) { const c = lineaDe(x.closest(".dkl")); if (c) cambiarLinea(c, -c.q); return; }
    const q = e.target.closest(".dkl [data-q]"); if (q) { const c = lineaDe(q.closest(".dkl")); if (c) cambiarLinea(c, Number(q.dataset.q)); return; }
    const col = e.target.closest("[data-col]"); if (col) { if (esCmd(E.deck.formato) && identidad(E.deck) != null) return; const v = col.dataset.col; E.cols.has(v) ? E.cols.delete(v) : E.cols.add(v); pintarBusca(); return; }
    const tp = e.target.closest("[data-tp]"); if (tp) { const v = tp.dataset.tp; E.tipos.has(v) ? E.tipos.delete(v) : E.tipos.add(v); pintarBusca(); return; }
    const rz = e.target.closest("[data-rar]"); if (rz) { const v = rz.dataset.rar; E.rar.has(v) ? E.rar.delete(v) : E.rar.add(v); pintarBusca(); return; }
    if (e.target.closest("[data-limpiar]")) { E.tipos.clear(); E.rar.clear(); E.cmc = null; E.cols.clear(); pintarBusca(); return; }
    const cm = e.target.closest("[data-cmc]"); if (cm) { const v = Number(cm.dataset.cmc); E.cmc = E.cmc === v ? null : v; pintarBusca(); return; }
    const tk = e.target.closest("[data-tienda]"); if (tk) { E.tienda = tk.dataset.tienda; pintarDeck(); return; }
    const dv = e.target.closest("[data-dkvista]"); if (dv) { ponerVistaDk(dv.dataset.dkvista); pintarDeck(); return; }
    const vc = e.target.closest("[data-carta]"); if (vc) { const l = vc.closest("[data-n]");
      if (l) abrirHojaCarta(E.deck, l.dataset.n, l.dataset.z, { editable: true, tienda: E.tienda, cambiar, cambiarLinea,
        cambiado: () => { E.sucio = true; estado.textContent = t("dk.sin_guardar"); clearTimeout(E.t); E.t = setTimeout(guardar, 1000); pintarDeck(); } }, l.dataset.v || ""); return; }
    if (e.target.closest("[data-faltan]")) { const P = preciosDeck(E.deck.cartas, tengo); msg.textContent = (await copiar(P.faltan.map(([n, q_]) => `${q_} ${n}`).join("\n"))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    const ac = e.target.closest("[data-acc]"); if (!ac) return;
    if (ac.dataset.acc === "copiar") { msg.textContent = (await copiar(textoDeck(E.deck))) ? t("meta.copiada") : t("meta.no_copiada"); }
    else if (ac.dataset.acc === "vaciar") {
      const n = E.deck.cartas.filter((c) => c.z !== "cmd").reduce((s_, c) => s_ + c.q, 0); if (!n) { msg.textContent = t("dk.ya_vacio"); return; }
      if (ac.dataset.seguro !== "1") { ac.dataset.seguro = "1"; ac.textContent = t("dk.vaciar_seguro", { n }); setTimeout(() => { ac.dataset.seguro = ""; ac.textContent = t("dk.vaciar"); }, 4000); return; }
      E.deshacer = structuredClone(E.deck.cartas); E.deck.cartas = E.deck.cartas.filter((c) => c.z === "cmd"); ac.dataset.seguro = ""; ac.textContent = t("dk.vaciar");
      sucio(); pintarDeck(); busca.innerHTML = ""; pintarBusca();
      msg.innerHTML = `${esc(t("dk.vaciado", { n }))} <button type="button" class="enlace" data-deshacer>${esc(t("dk.deshacer"))}</button>`;
    }
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
      E.pest = "buscar"; pintarPest();
      busca.innerHTML = `<textarea id="dk-imp" class="dk-imp" placeholder="1 Sol Ring&#10;..."></textarea><div class="acciones-deck"><button type="button" class="primario" data-imp>${esc(t("dk.importar"))}</button></div>`;
    }
  };
  app.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-copiar-txt]"); if (c) { msg.textContent = (await copiar(c.dataset.copiarTxt)) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-deshacer]") && E.deshacer) { E.deck.cartas = E.deshacer; E.deshacer = null; sucio(); pintarDeck(); busca.innerHTML = ""; pintarBusca(); msg.textContent = t("dk.regresadas"); return; }
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
      E.sucio = true; await asegurarNombres(E.deck.cartas); await guardar(); busca.innerHTML = ""; E.pest = "deck"; pintarDeck(); pintarBusca(); msg.textContent = t("dk.importadas", { n });
    }
  });
}

// ---------------------------------------------------------------- lo escaneado desde un deck (#/escaner/deck/ID)
async function leerDeck(id) {
  const d = (await cuenta.listar()).find((x) => x.tipo === `deck:${id}`); if (!d) throw new Error("no_existe");
  const deck = await cuenta.leer(d.tipo, d.version); cuenta.fijarVersion(d.tipo, d.version); return { ...deck, id };
}
export async function nombreDeck(id) { return (await leerDeck(id)).nombre || ""; }
export async function agregarAlDeck(id, cartas) {            // [{n, sid, acab, q}] al main, con la version exacta que se escaneo
  const deck = await leerDeck(id);
  for (const c of cartas) {
    const ya = deck.cartas.find((x) => x.n === c.n && x.z === "main" && (x.sid || null) === (c.sid || null) && (x.acab || "nonfoil") === c.acab)
      || deck.cartas.find((x) => x.n === c.n && x.z === "main" && !x.sid);
    if (ya) { ya.q += c.q; if (!ya.sid) { ya.sid = c.sid; ya.acab = c.acab; } } else deck.cartas.push({ n: c.n, q: c.q, z: "main", sid: c.sid, acab: c.acab });
  }
  await cuenta.guardar(`deck:${id}`, limpio(deck));
}

// ---------------------------------------------------------------- un deck recibido por codigo (#/s/CODIGO)
export async function guardarDeckRecibido(deck) {
  return crearDeck({ ...deck, id: null });
}
