// Ajustes del usuario (se guardan solo en este navegador). Por ahora: el tipo de cambio USD -> MXN.
//   modo "dia"    -> el del paquete del dia (manifest.tc.usd_mxn)
//   modo "propio" -> el que escribe el usuario
// JPY -> USD siempre es el del dia (automatico), igual que en Stack escritorio.
const CLAVE = "stack.ajustes";
let ajustes = { usd_modo: "dia", usd_propio: null };

try {
  const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
  if (g && typeof g === "object") ajustes = { ...ajustes, ...g };
} catch { /* sin almacenamiento: se usan los valores por defecto */ }

export function leerAjustes() { return { ...ajustes }; }

export function guardarAjustes(nuevos) {
  ajustes = { ...ajustes, ...nuevos };
  try { localStorage.setItem(CLAVE, JSON.stringify(ajustes)); } catch { /* se queda solo en memoria */ }
}

// Tipo USD -> MXN que se usa en toda la pagina. Si el propio no es valido, se usa el del dia.
export function usdMxn(manifest) {
  const propio = Number(ajustes.usd_propio);
  if (ajustes.usd_modo === "propio" && propio > 0) return { valor: propio, propio: true };
  return { valor: manifest?.tc?.usd_mxn ?? null, propio: false };
}
