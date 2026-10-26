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
