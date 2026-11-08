// Datos de la carta que no son precios (texto, tipo, legalidad, rulings) directo de la API publica de Scryfall.
// Solo se piden al abrir una ficha (o en el respaldo del escaner) y se guardan en memoria mientras la pagina esta abierta.
const API = "https://api.scryfall.com";
const cartas = new Map();       // scryfall_id -> promesa de la carta
const rulings = new Map();      // scryfall_id -> promesa de rulings

async function pedir(url, opciones) {
  const r = await fetch(url, { headers: { Accept: "application/json" }, ...opciones });
  if (!r.ok) throw new Error(`scryfall ${r.status}`);
  return r.json();
}

export function carta(sid) {
  if (!cartas.has(sid)) cartas.set(sid, pedir(`${API}/cards/${sid}`).catch((e) => { cartas.delete(sid); throw e; }));
  return cartas.get(sid);
}

export function reglas(sid) {
  if (!rulings.has(sid)) rulings.set(sid, pedir(`${API}/cards/${sid}/rulings`).then((r) => r.data || []).catch((e) => { rulings.delete(sid); throw e; }));
  return rulings.get(sid);
}

// Varias cartas en una sola llamada (hasta 75), para el respaldo del escaner. Devuelve sid -> carta.
export async function varias(sids) {
  const faltan = sids.filter((s) => !cartas.has(s)).slice(0, 75);
  if (faltan.length) {
    const r = pedir(`${API}/cards/collection`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifiers: faltan.map((id) => ({ id })) }),
    });
    for (const s of faltan) cartas.set(s, r.then((d) => (d.data || []).find((c) => c.id === s) || Promise.reject(new Error("no"))));
    await r.catch(() => {});
  }
  const out = new Map();
  for (const s of sids) { try { out.set(s, await cartas.get(s)); } catch { /* sin dato */ } }
  return out;
}

// Texto de reglas completo (cartas de dos caras juntan ambas)
export function textoOracle(c) {
  if (!c) return "";
  if (c.oracle_text) return c.oracle_text;
  return (c.card_faces || []).map((f) => f.oracle_text || "").join("\n");
}

// Simbolo de cada set (para las ediciones del escaner). La lista de sets cambia poco: se guarda una semana en este navegador.
let sets = null;
export function simbolosSets() {
  if (sets) return sets;
  const LLAVE = "stack.sets", SEMANA = 7 * 864e5;
  try {
    const g = JSON.parse(localStorage.getItem(LLAVE) || "null");
    if (g && Date.now() - g.t < SEMANA && Array.isArray(g.s)) { sets = Promise.resolve(new Map(g.s.map(([c, i, n]) => [c, { icono: i, nombre: n }]))); return sets; }
  } catch { /* sin almacenamiento */ }
  sets = pedir(`${API}/sets`).then((d) => {
    const s = (d.data || []).map((x) => [x.code, x.icon_svg_uri || "", x.name || ""]);
    try { localStorage.setItem(LLAVE, JSON.stringify({ t: Date.now(), s })); } catch { /* lleno o bloqueado */ }
    return new Map(s.map(([c, i, n]) => [c, { icono: i, nombre: n }]));
  }).catch((e) => { sets = null; throw e; });
  return sets;
}
