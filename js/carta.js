// Detalles, legalidad y rulings de una impresion, leidos directo de la API publica de Scryfall al abrir la ficha.
// No pasa por el job diario: asi siempre estan al dia (cambios de prohibidas, rulings nuevos).
import { t, fecha } from "./i18n.js";

const API = "https://api.scryfall.com";
const SIMBOLOS = "https://svgs.scryfall.io/card-symbols/";
const FORMATOS = ["standard", "pioneer", "modern", "legacy", "vintage", "pauper", "commander", "premodern"];
const cache = new Map();            // scryfall_id -> {carta, rulings} mientras la pagina esta abierta

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// "{2}{R}" -> iconos de mana; dentro del texto de reglas tambien ({T}, {W/U}, ...)
function conSimbolos(texto) {
  return esc(texto).replace(/\{([^}]+)\}/g, (_, s) =>
    `<img class="simbolo" src="${SIMBOLOS}${encodeURIComponent(s.replace(/\//g, ""))}.svg" alt="{${esc(s)}}">`);
}

async function json(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export async function cargarCarta(sid) {
  if (cache.has(sid)) return cache.get(sid);
  const carta = await json(`${API}/cards/${sid}`);
  let rulings = [];
  try { rulings = (await json(carta.rulings_uri || `${API}/cards/${sid}/rulings`)).data || []; } catch { rulings = null; }
  const d = { carta, rulings };
  cache.set(sid, d);
  return d;
}

function cara(c) {
  const pt = c.power != null ? `${c.power}/${c.toughness}` : c.loyalty != null ? t("carta.lealtad", { n: c.loyalty }) : c.defense != null ? t("carta.defensa", { n: c.defense }) : "";
  return `<div class="cara">
      <div class="cara-cabeza"><span class="cara-nombre">${esc(c.name)}</span><span class="coste">${conSimbolos(c.mana_cost || "")}</span></div>
      <div class="tipo">${esc(c.type_line || "")}</div>
      ${c.oracle_text ? `<div class="oracle">${c.oracle_text.split("\n").map((p) => `<p>${conSimbolos(p)}</p>`).join("")}</div>` : ""}
      ${c.flavor_text ? `<p class="flavor">${esc(c.flavor_text)}</p>` : ""}
      ${pt ? `<div class="pt num">${esc(pt)}</div>` : ""}
    </div>`;
}

export function htmlDetalles(carta) {
  const caras = carta.card_faces && !carta.oracle_text ? carta.card_faces : [carta];
  const filas = [
    [t("carta.artista"), carta.artist || carta.card_faces?.[0]?.artist],
    [t("carta.edicion"), `${carta.set_name} (${(carta.set || "").toUpperCase()}) · #${carta.collector_number}`],
    [t("carta.salida"), carta.released_at ? fecha(carta.released_at) + " " + carta.released_at.slice(0, 4) : ""],
    [t("carta.idioma"), (carta.lang || "").toUpperCase()],
    [t("carta.marco"), [carta.frame, carta.border_color, ...(carta.frame_effects || [])].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v);
  return `<section class="bloque"><h2>${esc(t("carta.detalles"))}</h2>
      ${caras.map(cara).join("")}
      <dl class="datos-carta">${filas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    </section>`;
}

export function htmlLegalidad(carta) {
  const L = carta.legalities || {};
  const celdas = FORMATOS.map((f) => {
    const e = L[f] || "not_legal";
    return `<div class="formato"><span>${esc(t(`formato.${f}`))}</span><span class="leg leg-${e}">${esc(t(`legal.${e}`))}</span></div>`;
  }).join("");
  return `<section class="bloque"><h2>${esc(t("carta.legalidad"))}</h2><div class="formatos">${celdas}</div></section>`;
}

export function htmlRulings(rulings, abiertos = false) {
  if (rulings === null) return `<section class="bloque"><h2>${esc(t("carta.rulings"))}</h2><p class="tenue">${esc(t("carta.sin_red"))}</p></section>`;
  if (!rulings.length) return `<section class="bloque"><h2>${esc(t("carta.rulings"))}</h2><p class="tenue">${esc(t("carta.sin_rulings"))}</p></section>`;
  const orden = [...rulings].sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  const visibles = abiertos ? orden : orden.slice(0, 4);
  return `<section class="bloque" id="rulings"><h2>${esc(t("carta.rulings"))} <span class="tenue">· ${orden.length}</span></h2>
      <ul class="rulings">${visibles.map((r) => `<li><div class="ruling-fecha tenue">${esc(r.published_at || "")}</div><div>${conSimbolos(r.comment)}</div></li>`).join("")}</ul>
      ${orden.length > visibles.length ? `<button type="button" class="mas" data-rulings>${esc(t("resultados.ver_mas", { n: orden.length - visibles.length }))}</button>` : ""}
      <p class="tenue nota-idioma">${esc(t("carta.en_ingles"))}</p>
    </section>`;
}
