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
// ---- varias versiones de una carta (0.9.6): una fila por carta y zona con su total; cada version es una linea del deck
function agrupar(cartas) {
  const m = new Map();
  for (const c of cartas) { const k = c.z + "\u0001" + c.n; let g = m.get(k); if (!g) { g = { n: c.n, z: c.z, q: 0, lineas: [] }; m.set(k, g); } g.q += c.q; g.lineas.push(c); }
  return [...m.values()];
}
const precioGrupo = (g, tienda) => { let s = 0, hay = false; for (const c of g.lineas) { const v = precioCartaW(c, tienda); if (v != null) { s += v * c.q; hay = true; } } return hay ? s : null; };
const lineaMayor = (g) => g.lineas.slice().sort((a, b) => b.q - a.q || (b.sid ? 1 : 0) - (a.sid ? 1 : 0))[0];
const nVersiones = (g) => g.lineas.length;
function repartoTexto(g) {                            // "2 ◆ M11 #146 · 2 ◆ 2XM #117" (las sin version: "la mas barata")
  if (!g.lineas.some((c) => c.sid)) return "";
  if (g.lineas.length === 1) return "◆ " + etVer(g.lineas[0]);
  return g.lineas.slice().sort((a, b) => b.q - a.q).map((c) => `${c.q} ${c.sid ? "◆ " + etVer(c) : t("dk.mas_barata")}`).join(" · ");
}
// las operaciones del reparto (sobre el deck, sin pintar)
function sumarV(D, n, z, v, d) {                     // suma d copias a la linea de esa version ("" = sin version)
  let c = D.cartas.find((x) => x.n === n && x.z === z && vDe(x) === v);
  if (!c) { if (d <= 0) return false; const [sid, acab] = v ? v.split("|") : []; c = { n, q: 0, z, ...(sid ? { sid, acab: acab || "nonfoil" } : {}) }; D.cartas.push(c); }
  if (d < 0 && c.q <= 0) return false;
  c.q = Math.max(0, Math.min(z === "cmd" ? 1 : 999, c.q + d)); D.cartas = D.cartas.filter((x) => x.q > 0); return true;
}
function grupoMas(D, n, z, d) {                       // el total: + va a la linea sin version (o a la unica que hay); - sale primero de la sin version
  for (let i = 0; i < Math.abs(d); i++) {
    const ls = D.cartas.filter((x) => x.n === n && x.z === z);
    if (d > 0) { if (z === "cmd" && ls.length) break; sumarV(D, n, z, ls.length === 1 ? vDe(ls[0]) : "", 1); }
    else { if (!ls.length) break; const c = ls.find((x) => !x.sid) || ls.slice().sort((a, b) => a.q - b.q)[0]; sumarV(D, n, z, vDe(c), -1); }
  }
}
function pasarCopia(D, n, z, v) {                     // + de una version: le pasa una copia de otra (primero de la sin version); el total no cambia
  const otras = D.cartas.filter((x) => x.n === n && x.z === z && vDe(x) !== v);
  const src = otras.find((x) => !x.sid) || otras.sort((a, b) => b.q - a.q)[0];
  if (src) sumarV(D, n, z, vDe(src), -1);
  else if (z === "cmd" && D.cartas.some((x) => x.n === n && x.z === z)) return false;
  sumarV(D, n, z, v, 1); return true;
}
function regresarCopia(D, n, z, v) {                  // - de una version: esa copia regresa a la sin version (la mas barata)
  if (!v || !sumarV(D, n, z, v, -1)) return false;
  sumarV(D, n, z, "", 1); return true;
}
// ---- cartas de dos caras: el boton de voltear voltea la imagen (Delver of Secrets, las MDFC...)
const LAYOUT_2CARAS = new Set(["transform", "modal_dfc", "reversible_card", "double_faced_token"]);
export function dosCaras(n) {
  const o = oraDe(n); if (!o) return false;
  if (o.lay != null && o.lay !== "") return LAYOUT_2CARAS.has(o.lay);
  if (!o.n.includes(" // ")) return false;                 // sin la columna layout (datos viejos): por el nombre, el coste y el tipo
  if (!String(o.coste || "").includes(" // ")) return true;
  return !/Adventure|Room|Omen/.test(o.tipo) && !o.tipo.split(" // ").every((x) => /^(Instant|Sorcery)/.test(x.trim()));
}
export const ICO_VOLTEAR = `<svg viewBox="0 0 12 12" width="15" height="15" aria-hidden="true"><path d="M2.2 5.3A3.9 3.9 0 0 1 9.3 3.4M9.6 1.3v2.4H7.2M9.8 6.7A3.9 3.9 0 0 1 2.7 8.6M2.4 10.7V8.3h2.4" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const btnVoltear = (n, tag = "button") => dosCaras(n) ? `<${tag}${tag === "button" ? ' type="button"' : ' role="button" tabindex="0"'} class="gflip" data-flip title="${esc(t("dk.voltear"))}" aria-label="${esc(t("dk.voltear"))}">${ICO_VOLTEAR}</${tag}>` : "";
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
      pareja: x[9], sid: x[10], pt: x[11], rar: (x[12] || "").slice(0, 1), rank: x[13] ?? 999999, lay: x[14] ?? null, nn: normal(x[0]) }));
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
  const linea = (g) => {                              // una fila por carta: su total, el reparto entre versiones y la suma de sus precios
    const o = oraDe(g.n), v = precioGrupo(g, tienda), tg = op.tengo ? op.tengo[g.n] || 0 : null;
    const mal = op.editable && o && ["b", "-"].includes(legal(o, deck.formato));
    const rp = repartoTexto(g);
    return `<li class="dkl${mal ? " ilegal" : ""}" data-n="${esc(g.n)}" data-z="${g.z}"><span class="q num">${g.q}</span><button type="button" class="n dk-nbtn" data-carta title="${esc(t("dk.ver_carta"))}">${esc(g.n)}${rp ? ` <i class="dk-vet">${esc(rp)}</i>` : ""}</button><span class="c">${coste(o?.coste)}</span>` +
      `<span class="r num">${v == null ? "—" : pesos2(v)}</span>${tg != null && !BASICAS.has(g.n) ? `<span class="tg ${tg >= g.q ? "ok" : tg ? "medio" : "no"}">${tg >= g.q ? "✓" : `${tg}/${g.q}`}</span>` : `<span class="tg"></span>`}` +
      `${op.editable ? `<span class="dkb"><button type="button" data-q="-1" aria-label="−">−</button><button type="button" data-q="1" aria-label="+">+</button><button type="button" class="dk-x" data-x="1" aria-label="${esc(t("dk.quitar_todas"))}" title="${esc(t("dk.quitar_todas"))}">✕</button></span>` : ""}</li>`;
  };
  const zona = (z, titulo) => { const cs = agrupar(deck.cartas.filter((c) => c.z === z)); if (!cs.length) return ""; return `<h3 class="dkg">${esc(titulo)} <span class="tenue">${cs.reduce((s, c) => s + c.q, 0)}</span></h3><ul class="dklista">${cs.map(linea).join("")}</ul>`; };
  if (!op.editable) h += zona("cmd", t("dk.comandante"));      // en el editor el comandante tiene su propio lugar arriba
  const main = agrupar(deck.cartas.filter((c) => c.z === "main")), grupos = new Map();
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
  const main = agrupar(deck.cartas.filter((c) => c.z === "main")), noT = main.filter((c) => !tierra(c));
  const deZona = (z) => agrupar(deck.cartas.filter((c) => c.z === z));
  const cols = [...(op.editable ? [] : [[t("dk.comandante"), deZona("cmd")]]),
    ["0–1", noT.filter((c) => cmc(c) <= 1)], ["2", noT.filter((c) => cmc(c) === 2)], ["3", noT.filter((c) => cmc(c) === 3)], ["4", noT.filter((c) => cmc(c) === 4)],
    ["5", noT.filter((c) => cmc(c) === 5)], ["6+", noT.filter((c) => cmc(c) >= 6)], [t("dk.g_tierras"), main.filter(tierra)],
    [t("dk.side"), deZona("side")], [t("dk.quizas"), deZona("quizas")]];
  const carta = (c) => {                             // c = la carta agrupada: se ve la version con mas copias
    const o = oraDe(c.n), may = lineaMayor(c), sid = may.sid || o?.sid, tg = op.tengo ? op.tengo[c.n] || 0 : null, nv = nVersiones(c), rp = repartoTexto(c);
    const est = tg == null || BASICAS.has(c.n) ? "" : tg >= c.q ? " ok" : tg ? " medio" : " no";
    const mal = op.editable && o && ["b", "-"].includes(legal(o, deck.formato));
    return `<button type="button" class="dk-gc flipw${est}${mal ? " ilegal" : ""}" data-carta data-n="${esc(c.n)}" data-z="${c.z}" title="${c.q} × ${esc(c.n)}${rp ? " · " + esc(rp) : ""}">` +
      `${sid ? `<img src="${esc(imgCarta(sid, "normal"))}" alt="" loading="lazy">` : ""}<span class="dk-gn">${esc(c.n)}</span>${c.q > 1 ? `<b class="num">×${c.q}</b>` : ""}` +
      `${nv > 1 ? `<span class="dk-gnv">${esc(t("dk.n_versiones", { n: nv }))}</span>` : ""}${btnVoltear(c.n, "span")}</button>`;
  };
  const h = cols.filter(([, xs]) => xs.length).map(([et, xs]) => `<div class="dk-gcol"><h4>${esc(et)} <span class="tenue num">${xs.reduce((s_, c) => s_ + c.q, 0)}</span></h4>` +
    `<div class="dk-pila">${xs.sort(orden).map(carta).join("")}</div></div>`).join("");
  return `<div class="dk-gal">${h}</div>`;
}
// ---- hoja de una carta del deck (0.9.6): la imagen completa, el total y el reparto entre versiones.
// Total −/+: copias de la carta (el + va a la mas barata). Cada version −/q/+: + le pasa una copia de otra version (primero de la
// mas barata), − la regresa a la mas barata; tocar la imagen de una version = +. Sirve igual para el comandante (cambia su version).
function cerrarHoja() { const h = document.getElementById("dk-hoja"); if (h) { h.hidden = true; h.innerHTML = ""; } document.body.classList.remove("con-hoja"); }
async function abrirHojaCarta(deck, n, z, op = {}) {
  let hoja = document.getElementById("dk-hoja");
  if (!hoja) { hoja = document.createElement("div"); hoja.id = "dk-hoja"; hoja.className = "dk-hoja"; document.body.appendChild(hoja); }
  hoja.hidden = false; document.body.classList.add("con-hoja");
  await asegurarNombres([{ n }]);
  const o0 = oraDe(n); if (o0) n = deck.cartas.some((x) => x.n === n) ? n : o0.n;
  let orden = null;                                   // el orden de las versiones queda fijo mientras la hoja esta abierta (el + no las mueve)
  const pintar = () => {
    const ls = deck.cartas.filter((x) => x.n === n && x.z === z), total = ls.reduce((s_, x) => s_ + x.q, 0);
    const o = oraDe(n), tienda = op.tienda || "tcg", g = nombres().get(o ? o.n : n) || nombres().get(n);
    const qDe = (sid, L) => ls.filter((y) => y.sid === sid && (ACAB_L[y.acab || "nonfoil"] || "n") === L).reduce((t_, y) => t_ + y.q, 0);
    const todas = g ? g[2].map((i) => datos().buscar.imp[i]).filter(Boolean).map((f) => ({ f, sid: String(f[0]).split(":")[0], v: precioImp(f, tienda) })) : [];
    if (!orden) { const por = todas.slice().sort((a, b) => (a.v ?? 1e12) - (b.v ?? 1e12)); orden = por.slice(0, 80); for (const x of por.slice(80)) if (qDe(x.sid, x.f[3])) orden.push(x); }
    const vers = orden, sinV = ls.filter((x) => !x.sid).reduce((s_, x) => s_ + x.q, 0);
    const may = ls.length ? lineaMayor({ lineas: ls }) : null, sidVer = may?.sid || o?.sid;
    const ed = op.editable;
    hoja.innerHTML = `<div class="dk-hoja-c" role="dialog" aria-label="${esc(n)}"><div class="dk-hoja-cab"><h2>${esc(o ? o.n : n)}</h2><button type="button" class="cerrar" data-h="cerrar" aria-label="${esc(t("ajustes.cerrar"))}">✕</button></div>
      <div class="dk-hoja-top">${sidVer ? `<span class="dk-hoja-imgw flipw"><img class="dk-hoja-img" src="${esc(imgCarta(sidVer, "normal"))}" alt="">${btnVoltear(n)}</span>` : ""}
        <div class="dk-hoja-dat"><p>${coste(o?.coste)} <span class="tenue">${esc(o?.tipo || "")}</span></p>
        ${ed ? `<div class="dk-hoja-q"><button type="button" class="chip-acab" data-h="menos" aria-label="−">−</button><b class="num">${total}</b><button type="button" class="chip-acab" data-h="mas" aria-label="+">+</button>
          ${total ? `<button type="button" class="chip-acab" data-h="quitar">${esc(t("dk.quitar_todas"))}</button>` : ""}</div>` : `<p class="num"><b>${total}</b> ${esc(t("dk.cartas"))}</p>`}
        ${total && ls.some((x) => x.sid) ? `<p class="dk-rep-res">${esc(repartoTexto({ lineas: ls }))}</p>` : sinV ? `<p class="tenue">${esc(t("dk.rep_todas_baratas", { n: sinV }))}</p>` : ""}
        <p class="tenue">${esc(ed ? (z === "cmd" ? t("dk.rep_ayuda_cmd") : t("dk.rep_ayuda")) : t("dk.ver_ayuda_meta"))}</p></div></div>
      <h3 class="dkg">${esc(t("dk.versiones"))} <span class="tenue">${todas.length}</span></h3>
      <div class="dk-vers">${vers.map((x) => { const qv = qDe(x.sid, x.f[3]), v = `${x.sid}|${ACAB_DE[x.f[3]] || "nonfoil"}`;
        return `<div class="dk-verw${qv ? " en" : ""}" data-v="${esc(v)}"><button type="button" class="dk-ver${qv ? " activo" : ""}" data-pasar${ed ? "" : " disabled"}>` +
          `<img src="${esc(imgCarta(x.sid, "small"))}" alt="" loading="lazy">${qv ? `<em class="num">×${qv}</em>` : ""}<span>${esc(String(x.f[1]).toUpperCase())} #${esc(x.f[2])}</span><span class="tenue">${esc(t("acabado." + x.f[3]))}</span><b class="num">${pesos2(x.v)}</b></button>` +
          `${ed ? `<div class="dk-vq"><button type="button" data-regresar${qv ? "" : " disabled"} aria-label="−">−</button><b class="num">${qv}</b><button type="button" data-pasar aria-label="+" title="${esc(t("dk.ver_mas"))}">+</button></div>` : ""}</div>`; }).join("") || `<p class="tenue">${esc(t("dk.sin_versiones"))}</p>`}</div></div>`;
  };
  pintar();
  hoja.onclick = (e) => {
    if (e.target.closest("[data-flip]")) return;
    if (e.target === hoja || e.target.closest('[data-h="cerrar"]')) { cerrarHoja(); return; }
    if (!op.editable) return;
    const b = e.target.closest("[data-h]"), D = deck;
    if (b) {
      if (b.dataset.h === "quitar") { D.cartas = D.cartas.filter((x) => !(x.n === n && x.z === z)); op.cambiado(n, z); cerrarHoja(); return; }
      grupoMas(D, n, z, b.dataset.h === "mas" ? 1 : -1); op.cambiado(n, z); pintar(); return;
    }
    const w = e.target.closest(".dk-verw[data-v]"); if (!w) return;
    if (e.target.closest("[data-regresar]")) { if (regresarCopia(D, n, z, w.dataset.v)) { op.cambiado(n, z); pintar(); } return; }
    if (e.target.closest("[data-pasar]")) { if (pasarCopia(D, n, z, w.dataset.v)) { op.cambiado(n, z); pintar(); } }
  };
}
const textoDeck = (d) => {
  const ver = (c) => { const f = impDe(c); return f ? ` (${String(f[1]).toUpperCase()}) ${f[2]}${f[3] === "f" ? " *F*" : f[3] === "e" ? " *E*" : ""}` : ""; };
  const z = (zn) => agrupar(d.cartas.filter((c) => c.z === zn)).flatMap((g) => g.lineas).map((c) => `${c.q} ${c.n}${ver(c)}`).join("\n");      // las versiones de una carta, juntas
  const p = [];
  if (d.cartas.some((c) => c.z === "cmd")) p.push("Commander\n" + z("cmd"));
  p.push((p.length ? "Deck\n" : "") + z("main"));
  if (d.cartas.some((c) => c.z === "side")) p.push("Sideboard\n" + z("side"));
  return p.join("\n\n");
};
async function copiar(texto) { try { await navigator.clipboard.writeText(texto); return true; } catch { return false; } }
// ---- link para ver un deck (#/d/...): el deck va comprimido en el propio link; no usa servidor y no caduca (igual que la app)
const ZC = { main: "m", side: "s", cmd: "c", quizas: "q" }, ZD = { m: "main", s: "side", c: "cmd", q: "quizas" };
export async function linkDeck(d) {
  const dat = { v: 1, n: d.nombre || "Deck", f: d.formato || "", c: d.cartas.filter((c) => c.q > 0).map((c) => [c.q, c.n, ZC[c.z] || "m", ...(c.sid ? [c.sid, ACAB_L[c.acab || "nonfoil"] || "n"] : [])]) };
  const b = new Uint8Array(await new Response(new Blob([JSON.stringify(dat)]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  let bin = ""; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `${location.origin}${location.pathname}#/d/${btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
async function leerLinkDeck(txt) {
  const b64 = String(txt).replace(/-/g, "+").replace(/_/g, "/"), bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const u8 = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  const j = JSON.parse(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text());
  if (!j || !Array.isArray(j.c)) throw new Error("link");
  return { nombre: String(j.n || "Deck").slice(0, 60), formato: String(j.f || ""), cartas: j.c.filter((x) => Array.isArray(x) && x[1] && x[0] > 0).slice(0, 400)
    .map(([q, n, zc, sid, L]) => ({ n: String(n), q: Math.min(999, Number(q) || 1), z: ZD[zc] || "main", ...(sid && /^[0-9a-f-]{36}$/i.test(sid) ? { sid, acab: ACAB_DE[L] || "nonfoil" } : {}) })) };
}
async function compartirLink(d, msg) {
  if (!d || !d.cartas?.length) { if (msg) msg.textContent = t("dk.vacio"); return; }
  try {
    const u = await linkDeck(d);
    if (await copiar(u)) { if (msg) msg.textContent = t("dk.link_copiado"); }
    else if (msg) msg.innerHTML = `${esc(t("dk.link_aqui"))} <input class="dk-linktxt" readonly value="${esc(u)}" onfocus="this.select()">`;
  } catch { if (msg) msg.textContent = t("dk.link_error"); }
}

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
        <div class="acciones-deck"><button type="button" class="primario" data-copiar-deck>${esc(t("meta.a_mis_decks"))}</button><button type="button" class="boton-fmt" data-texto>${esc(t("meta.copiar_lista"))}</button><button type="button" class="boton-fmt" data-link title="${esc(t("dk.link_ayuda"))}">${esc(t("dk.link"))}</button></div>
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
    if (e.target.closest("[data-link]")) { await compartirLink(JSON.parse(det.dataset.deck || "null"), msg); return; }
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
    <div class="acciones-deck"><button type="button" class="boton-fmt" data-acc="copiar">${esc(t("meta.copiar_lista"))}</button><button type="button" class="boton-fmt" data-acc="link" title="${esc(t("dk.link_ayuda"))}">${esc(t("dk.link"))}</button><button type="button" class="boton-fmt" data-acc="compartir">${esc(t("dk.compartir"))}</button>
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
    const elegidos = cmds.map((c) => { const o = oraDe(c.n); return `<div class="dk-cmd-carta">${o?.sid ? `<button type="button" class="dk-cmd-img flipw" data-carta data-n="${esc(c.n)}" data-z="cmd" title="${esc(t("dk.cmd_version"))}"><img src="${esc(imgCarta(c.sid || o.sid, "normal"))}" alt="${esc(c.n)}" loading="lazy">${c.sid ? `<i class="dk-cmd-ver">◆ ${esc(etVer(c))}</i>` : ""}${btnVoltear(c.n, "span")}</button>` : ""}` +
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
    return `<div class="dk-tile flipw${q ? " en" : ""}" data-n="${esc(o.n)}"${fv ? ` data-ver="${esc(String(fv[0]).split(":")[0])}:${esc(fv[3])}"` : ""}><button type="button" class="dk-img" data-add="main" aria-label="${esc(t("dk.agregar", { n: o.n }))}">` +
      `<img src="${esc(imgCarta(sid, "normal"))}" alt="${esc(o.n)}" loading="lazy">${q ? `<b class="dk-en">×${q}</b>` : ""}${btnVoltear(o.n, "span")}</button>` +
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
  const trasReparto = (n, z) => {                    // despues de cambiar la hoja o una fila: guardar y repintar
    sucio();
    if (z === "cmd" && !E.deck.cartas.some((x) => x.z === "cmd" && x.n === n)) { E.qcmd = ""; E.edh = null; pintarDeck(); busca.innerHTML = ""; pintarBusca(); return; }
    pintarDeck(); actualizarTiles(n);
  };
  const hojaDe = (n, z) => abrirHojaCarta(E.deck, n, z, { editable: true, tienda: E.tienda, cambiado: trasReparto });
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
    const vs = e.target.closest(".dk-tile [data-vers]"); if (vs) { const n = vs.closest(".dk-tile").dataset.n; hojaDe(oraDe(n)?.n || n, "main"); return; }      // elegir la version antes de agregarla
    const a = e.target.closest("[data-add]"); if (a) { const tl = a.closest(".dk-tile"), [sid, ac] = (tl.dataset.ver || "").split(":"); cambiar(tl.dataset.n, a.dataset.add, 1, sid ? { sid, acab: ACAB_DE[ac] || "nonfoil" } : undefined); return; }
    const x = e.target.closest(".dkl [data-x]"); if (x) { const l = x.closest(".dkl"); E.deck.cartas = E.deck.cartas.filter((y) => !(y.n === l.dataset.n && y.z === l.dataset.z)); trasReparto(l.dataset.n, l.dataset.z); return; }
    const q = e.target.closest(".dkl [data-q]"); if (q) { const l = q.closest(".dkl"); grupoMas(E.deck, l.dataset.n, l.dataset.z, Number(q.dataset.q)); trasReparto(l.dataset.n, l.dataset.z); return; }
    const col = e.target.closest("[data-col]"); if (col) { if (esCmd(E.deck.formato) && identidad(E.deck) != null) return; const v = col.dataset.col; E.cols.has(v) ? E.cols.delete(v) : E.cols.add(v); pintarBusca(); return; }
    const tp = e.target.closest("[data-tp]"); if (tp) { const v = tp.dataset.tp; E.tipos.has(v) ? E.tipos.delete(v) : E.tipos.add(v); pintarBusca(); return; }
    const rz = e.target.closest("[data-rar]"); if (rz) { const v = rz.dataset.rar; E.rar.has(v) ? E.rar.delete(v) : E.rar.add(v); pintarBusca(); return; }
    if (e.target.closest("[data-limpiar]")) { E.tipos.clear(); E.rar.clear(); E.cmc = null; E.cols.clear(); pintarBusca(); return; }
    const cm = e.target.closest("[data-cmc]"); if (cm) { const v = Number(cm.dataset.cmc); E.cmc = E.cmc === v ? null : v; pintarBusca(); return; }
    const tk = e.target.closest("[data-tienda]"); if (tk) { E.tienda = tk.dataset.tienda; pintarDeck(); return; }
    const dv = e.target.closest("[data-dkvista]"); if (dv) { ponerVistaDk(dv.dataset.dkvista); pintarDeck(); return; }
    const vc = e.target.closest("[data-carta]"); if (vc) { const l = vc.closest("[data-n]"); if (l) hojaDe(l.dataset.n, l.dataset.z); return; }
    if (e.target.closest("[data-faltan]")) { const P = preciosDeck(E.deck.cartas, tengo); msg.textContent = (await copiar(P.faltan.map(([n, q_]) => `${q_} ${n}`).join("\n"))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    const ac = e.target.closest("[data-acc]"); if (!ac) return;
    if (ac.dataset.acc === "copiar") { msg.textContent = (await copiar(textoDeck(E.deck))) ? t("meta.copiada") : t("meta.no_copiada"); }
    else if (ac.dataset.acc === "link") await compartirLink(E.deck, msg);
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
  if (app._dkClic) app.removeEventListener("click", app._dkClic);      // al abrir otro deck no se juntan dos (importar contaba doble)
  app.addEventListener("click", app._dkClic = async (e) => {
    const c = e.target.closest("[data-copiar-txt]"); if (c) { msg.textContent = (await copiar(c.dataset.copiarTxt)) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-deshacer]") && E.deshacer) { E.deck.cartas = E.deshacer; E.deshacer = null; sucio(); pintarDeck(); busca.innerHTML = ""; pintarBusca(); msg.textContent = t("dk.regresadas"); return; }
    if (e.target.closest("[data-imp]")) {
      const txt = app.querySelector("#dk-imp").value; let z = "main", n = 0; const leidas = [];
      for (const raw of txt.replace(/\r/g, "").split("\n")) {
        const l = raw.trim(); if (!l) { if (leidas.length) z = "side"; continue; }
        const h = l.toLowerCase().replace(/[:\s]+$/, "");
        if (/^(commander|comandante)$/.test(h)) { z = "cmd"; continue; } if (/^(sideboard|side)$/.test(h)) { z = "side"; continue; } if (/^(deck|main|mainboard)$/.test(h)) { z = "main"; continue; }
        const m = l.match(/^(?:SB:\s*)?(\d+)\s*x?\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+([\w★-]+))?)?(?:\s+\*([FE])\*)?$/i);
        const nombre = m ? m[2] : l, o = oraDe(nombre);
        leidas.push({ n: o ? o.n : nombre, q: m ? Number(m[1]) : 1, z, set: m && m[3] ? m[3].toLowerCase() : null, num: m && m[4] ? m[4].toLowerCase() : null, L: m && m[5] ? m[5].toLowerCase() : "n" });
      }
      await asegurarNombres(leidas);
      for (const x of leidas) {
        let ver = null;                                 // la impresion exacta si la lista la trae
        if (x.set) { const g = nombres().get(x.n), fs = g ? g[2].map((i) => datos().buscar.imp[i]).filter((f) => f && String(f[1]).toLowerCase() === x.set && (!x.num || String(f[2]).toLowerCase() === x.num)) : [];
          const f = fs.find((y) => y[3] === x.L) || fs[0]; if (f) ver = { sid: String(f[0]).split(":")[0], acab: ACAB_DE[f[3]] || "nonfoil" }; }
        const v = ver ? `${ver.sid}|${ver.acab}` : "", ya = E.deck.cartas.find((y) => y.n === x.n && y.z === x.z && vDe(y) === v);
        if (ya) ya.q += x.q; else E.deck.cartas.push({ n: x.n, q: x.q, z: x.z, ...(ver || {}) }); n++;
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

// ---------------------------------------------------------------- un deck abierto por link (#/d/...): cualquiera lo ve, sin cuenta
// Precio total por tienda, la lista por tipo de carta (cantidad, nombre, coste, precio) o la galeria; tocar una carta = sus versiones.
export async function vistaDeckLink(app, dato) {
  document.body.classList.remove("en-portada");
  document.body.classList.add("ancho");
  app.innerHTML = `<p class="tenue">${esc(t("dk.cargando"))}</p>`;
  let d;
  try { d = await leerLinkDeck(dato); } catch { app.innerHTML = `<h1 class="titulo-vista">Deck</h1><p class="error">${esc(t("dk.link_malo"))}</p><a class="boton-vacio" href="#/meta">META</a>`; return; }
  await cargarOraculo().catch(() => null);
  await asegurarNombres(d.cartas);
  const tengo = await cargarTengo();
  document.title = `${d.nombre} · Stack`;
  const st = { tienda: "tcg" };
  const nC = d.cartas.filter((c) => c.z !== "quizas").reduce((s_, c) => s_ + c.q, 0);
  const pintar = () => {
    app.innerHTML = `<article class="dk-pub"><h1 class="titulo-vista">${esc(d.nombre)}</h1>
      <p class="tenue">${esc(NOMBRE_FMT[d.formato] || d.formato || "")}${d.formato ? " · " : ""}${nC} ${esc(t("dk.cartas"))} · ${esc(t("dk.link_nota"))}</p>
      <div class="acciones-deck"><button type="button" class="primario" data-guardar>${esc(t("dk.link_guardar"))}</button><button type="button" class="boton-fmt" data-texto>${esc(t("meta.copiar_lista"))}</button><button type="button" class="boton-fmt" data-link>${esc(t("dk.link"))}</button></div>
      <p id="dk-msg" class="tenue" role="status"></p>
      <section class="meta-det">${htmlDeck(d, { tienda: st.tienda, tengo })}</section></article>`;
  };
  pintar();
  app.onclick = async (e) => {
    const msg = app.querySelector("#dk-msg");
    const tk = e.target.closest("[data-tienda]"); if (tk) { st.tienda = tk.dataset.tienda; pintar(); return; }
    const dv = e.target.closest("[data-dkvista]"); if (dv) { ponerVistaDk(dv.dataset.dkvista); pintar(); return; }
    const vc = e.target.closest("[data-carta]"); if (vc) { const l = vc.closest("[data-n]"); if (l) abrirHojaCarta(d, l.dataset.n, l.dataset.z, { tienda: st.tienda }); return; }
    if (e.target.closest("[data-texto]")) { msg.textContent = (await copiar(textoDeck(d))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-link]")) { await compartirLink(d, msg); return; }
    if (e.target.closest("[data-faltan]")) { const P = preciosDeck(d.cartas, tengo); msg.textContent = (await copiar(P.faltan.map(([n, q]) => `${q} ${n}`).join("\n"))) ? t("meta.copiada") : t("meta.no_copiada"); return; }
    if (e.target.closest("[data-guardar]")) {
      if (!cuenta.sesion()) { msg.innerHTML = `${esc(t("dk.entra"))} <a href="#/cuenta">${esc(t("cuenta.entrar"))}</a>`; return; }
      try { const id = await crearDeck({ ...d, origen: { tipo: "link" } }); location.hash = `#/decks/${id}`; } catch { msg.textContent = t("dk.err_guardar"); }
    }
  };
}
