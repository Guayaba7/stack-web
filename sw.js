// Cache por dia: los archivos de un dia (.../AAAA-MM-DD/...) nunca cambian, asi que se guardan y no se vuelven a bajar.
// manifest.json siempre se pregunta primero a la red (si no hay red, se usa el guardado).
// La pagina en si (html, css, js, textos) se muestra de la cache y se actualiza en segundo plano.
const PAGINA = "stack-pagina-v3";
const DATOS = "stack-datos";
const DIA = /\/(\d{4}-\d{2}-\d{2})\//;
const ARCHIVOS_PAGINA = ["./", "index.html", "css/app.css", "js/app.js", "js/config.js", "js/datos.js",
  "js/buscar.js", "js/i18n.js", "textos/es.json", "textos/en.json", "manifest.webmanifest", "iconos/icono-192.png", "iconos/logo.png", "favicon.ico"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGINA).then((c) => c.addAll(ARCHIVOS_PAGINA)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("stack-pagina-") && k !== PAGINA).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Borra de la cache los dias que el manifest ya no lista (se quedan solo hoy y el respaldo).
async function limpiarDias(manifest) {
  const vigentes = new Set([manifest.dia, manifest.ultimo_bueno, ...(manifest.dias || [])]);
  const c = await caches.open(DATOS);
  for (const req of await c.keys()) {
    const m = req.url.match(DIA);
    if (m && !vigentes.has(m[1])) await c.delete(req);
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("scryfall.io")) return;              // imagenes: las guarda el navegador por su cuenta

  if (url.pathname.endsWith("/manifest.json")) {
    e.respondWith((async () => {
      const c = await caches.open(DATOS);
      try {
        const r = await fetch(req, { cache: "no-cache" });
        if (r.ok) {
          await c.put(req, r.clone());
          r.clone().json().then(limpiarDias).catch(() => {});
        }
        return r;
      } catch {
        return (await c.match(req)) || Response.error();
      }
    })());
    return;
  }

  if (DIA.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(DATOS);
      const guardado = await c.match(req);
      if (guardado) return guardado;
      const r = await fetch(req);
      if (r.ok) await c.put(req, r.clone());
      return r;
    })());
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(PAGINA);
      const guardado = await c.match(req);
      const red = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => guardado);
      return guardado || red;
    })());
  }
});
