// Textos de la pagina. Todo texto visible sale de textos/<idioma>.json; agregar un idioma = agregar un JSON.
const IDIOMAS = ["es", "en"];
let idioma = "es";
let textos = {};

function elegido() {
  try {
    const guardado = localStorage.getItem("stack.idioma");
    if (IDIOMAS.includes(guardado)) return guardado;
  } catch { /* sin almacenamiento: se usa el del navegador */ }
  const nav = (navigator.language || "es").slice(0, 2).toLowerCase();
  return IDIOMAS.includes(nav) ? nav : "es";
}

export async function cargarIdioma(cual = elegido()) {
  idioma = IDIOMAS.includes(cual) ? cual : "es";
  const r = await fetch(`textos/${idioma}.json`);
  textos = await r.json();
  document.documentElement.lang = idioma;
  try { localStorage.setItem("stack.idioma", idioma); } catch { /* nada */ }
  return idioma;
}

export function idiomaActual() { return idioma; }

// t("ficha.stock", {n: 3}) -> "Stock 3"
export function t(clave, valores = {}) {
  let s = textos[clave] ?? clave;
  for (const [k, v] of Object.entries(valores)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

export function pesos(valor) {
  if (valor == null || Number.isNaN(valor)) return "—";
  const decimales = valor < 100 ? 2 : 0;
  return new Intl.NumberFormat(idioma === "en" ? "en-US" : "es-MX", {
    style: "currency", currency: "MXN", currencyDisplay: "narrowSymbol",
    minimumFractionDigits: decimales, maximumFractionDigits: decimales,
  }).format(valor);
}

export function moneda(valor, codigo) {
  if (valor == null) return "—";
  return new Intl.NumberFormat(idioma === "en" ? "en-US" : "es-MX", {
    style: "currency", currency: codigo, currencyDisplay: codigo === "USD" ? "code" : "narrowSymbol",
    maximumFractionDigits: codigo === "JPY" ? 0 : 2,
  }).format(valor);
}

export function fecha(isoDia, conHora = null) {
  if (!isoDia) return "—";
  const [a, m, d] = isoDia.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d, 12));
  const txt = new Intl.DateTimeFormat(idioma === "en" ? "en-US" : "es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(f);
  if (!conHora) return txt;
  const hora = new Intl.DateTimeFormat(idioma === "en" ? "en-US" : "es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(conHora));
  return `${txt} · ${hora}`;
}

export function porcentaje(p) {
  if (p == null) return "";
  const signo = p > 0 ? "▲ +" : p < 0 ? "▼ " : "";
  return `${signo}${p.toFixed(1)} %`;
}
