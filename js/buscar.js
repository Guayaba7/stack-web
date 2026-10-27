// Busqueda local en buscar.json. normalizar() es la misma regla que en nube.py (Python).
import { MAX_GRUPOS } from "./config.js";

export function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/æ/gi, "ae").replace(/œ/gi, "oe")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim().replace(/ +/g, " ");
}

let indice = null;   // [{nombre, palabras:[...], textos:[...], imp:[...]}]

export function prepararIndice(buscar) {
  indice = buscar.nombres.map(([nombre, texto, imp, ja]) => {
    const textos = texto.split("|");
    return { nombre, textos, palabras: [...new Set(textos.join(" ").split(" "))], imp, ja: ja ? ja.split("|") : [] };
  });
}

// Cada palabra buscada debe ser el inicio de alguna palabra del nombre o de un alias, en cualquier orden.
const JAPONES = /[\u3040-\u30ff\u3400-\u9fff]/;

export function buscar(q) {
  if (JAPONES.test(q || "") && indice) {                   // nombre en japones: se compara tal cual, sin espacios
    const c = String(q).normalize("NFKC").replace(/\s+/g, "");
    const res = [];
    for (const g of indice) {
      let rango = 3;
      for (const t of g.ja) { if (t === c) { rango = 0; break; } if (t.startsWith(c)) rango = Math.min(rango, 1); else if (t.includes(c)) rango = Math.min(rango, 2); }
      if (rango < 3) res.push({ g, rango });
    }
    res.sort((a, b) => a.rango - b.rango || a.g.nombre.localeCompare(b.g.nombre));
    return res.slice(0, MAX_GRUPOS).map((r) => r.g);
  }
  const consulta = normalizar(q);
  if (consulta.length < 2 || !indice) return [];
  const partes = consulta.split(" ");
  const res = [];
  for (const g of indice) {
    if (!partes.every((p) => g.palabras.some((w) => w.startsWith(p)))) continue;
    // 0 = nombre exacto, 1 = empieza con, 2 = contiene
    let rango = 2;
    for (const t of g.textos) {
      if (t === consulta) { rango = 0; break; }
      if (t.startsWith(consulta)) rango = Math.min(rango, 1);
    }
    res.push({ g, rango });
  }
  res.sort((a, b) => a.rango - b.rango || a.g.nombre.length - b.g.nombre.length || a.g.nombre.localeCompare(b.g.nombre));
  return res.slice(0, MAX_GRUPOS).map((r) => r.g);
}
