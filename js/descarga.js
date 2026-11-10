// Pantalla APP (Stack 0.9.4): descarga del instalador de Windows sin salir de la pagina.
// La version, la fecha, el tamano y las novedades salen solos de la ultima version publicada en GitHub (Guayaba7/stack):
// el script de compilacion no cambia y nadie tiene que actualizar el enlace a mano. El archivo se baja directo de GitHub,
// pero la persona nunca deja esta pagina.
import { t, fecha } from "./i18n.js";
import { logoSvg } from "./logo.js";

const REPO = "Guayaba7/stack";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ICONO_BAJAR = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 20h16"/></svg>`;
let cache = null;                                   // la respuesta de GitHub (una vez por visita)

async function ultima() {
  if (cache) return cache;
  const r = await fetch(API, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  const exe = (j.assets || []).find((a) => /\.exe$/i.test(a.name)) || (j.assets || []).find((a) => /\.(msi|zip)$/i.test(a.name));
  cache = { version: String(j.tag_name || j.name || "").replace(/^v/i, ""), fecha: String(j.published_at || "").slice(0, 10), notas: j.body || "",
    exe: exe ? { nombre: exe.name, url: exe.browser_download_url, mb: exe.size / 1048576 } : null, pagina: j.html_url };
  return cache;
}
// las novedades: las primeras lineas con viñeta de las notas de la version (sin el formato de Markdown)
function novedades(md) {
  const ls = String(md).split(/\r?\n/).map((l) => l.trim()).filter((l) => /^[-*] /.test(l)).map((l) => l.slice(2).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
  return ls.slice(0, 6).map((l) => (l.length > 160 ? l.slice(0, 157) + "…" : l));
}
const esCelular = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (matchMedia("(pointer: coarse)").matches && innerWidth < 900);

export async function vistaApp(app) {
  document.body.classList.remove("en-portada");
  document.title = "Stack · App";
  const cel = esCelular();
  app.innerHTML = `<section class="app-desc">
    <div class="app-hero"><span class="app-logo">${logoSvg()}</span><div><h1>${esc(t("app.titulo"))}</h1><p class="app-ver" id="app-ver"><span class="tenue">${esc(t("app.buscando"))}</span></p></div></div>
    <div class="app-tarjeta" id="app-bajar">${cel
      ? `<p>${t("app.es_pc")}</p><div class="app-fila"><button type="button" class="boton-vacio" data-app="copiar">${esc(t("app.copiar"))}</button>${navigator.share ? `<button type="button" class="boton-vacio" data-app="compartir">${esc(t("app.compartir"))}</button>` : ""}</div><p class="tenue" id="app-msg" role="status"></p>`
      : `<div class="cargando"></div>`}</div>
    <div class="app-tarjeta" id="app-nuevo" hidden></div>
    <div class="app-tarjeta app-prox"><h2>ANDROID <span class="chip">${esc(t("app.proximamente"))}</span></h2><p>${esc(t("app.android"))}</p></div>
  </section>`;
  app.onclick = async (e) => {
    const b = e.target.closest("[data-app]"); if (!b) return;
    const msg = app.querySelector("#app-msg");
    const enlace = `${location.origin}${location.pathname}#/app`;
    if (b.dataset.app === "copiar") { try { await navigator.clipboard.writeText(enlace); if (msg) msg.textContent = "✓ " + t("app.copiado"); } catch { if (msg) msg.textContent = enlace; } }
    else if (b.dataset.app === "compartir") { try { await navigator.share({ title: "Stack", text: t("app.compartir_txt"), url: enlace }); } catch { /* cancelado */ } }
    else if (b.dataset.app === "bajar") {
      const barra = app.querySelector(".app-barrita"); if (barra) { barra.hidden = false; requestAnimationFrame(() => barra.firstElementChild.style.width = "100%"); }
      setTimeout(() => { const p = app.querySelector(".app-pasos"); if (p) p.hidden = false; b.classList.add("sec"); b.innerHTML = `↻ ${esc(t("app.otra_vez"))}`; }, 700);
    }
  };
  let R;
  try { R = await ultima(); } catch { R = null; }
  const ver = app.querySelector("#app-ver"), caja = app.querySelector("#app-bajar"), nuevo = app.querySelector("#app-nuevo");
  if (!ver) return;                                   // se fue a otra pantalla mientras cargaba
  if (!R || !R.exe) {
    ver.innerHTML = `<span class="tenue">${esc(t("app.sin_datos"))}</span>`;
    if (!cel) caja.innerHTML = `<p>${esc(t("app.sin_datos_largo"))}</p><a class="boton-vacio" href="https://github.com/${REPO}/releases/latest" target="_blank" rel="noopener">${esc(t("app.ir_github"))}</a>`;
    return;
  }
  ver.innerHTML = `${esc(R.version)}${R.fecha ? ` <span class="tenue">· ${esc(t("app.publicada", { fecha: fecha(R.fecha) }))}</span>` : ""}`;
  if (!cel) caja.innerHTML = `<div class="app-datos"><span>${esc(t("app.instalador"))} <b>${esc(R.exe.nombre)}</b></span><span>${esc(t("app.tamano"))} <b class="num">${R.exe.mb.toFixed(1)} MB</b></span><span>Windows <b>10 · 11 (64 bits)</b></span></div>
    <a class="primario app-boton" href="${esc(R.exe.url)}" download data-app="bajar">${ICONO_BAJAR}${esc(t("app.descargar"))}</a>
    <div class="app-barrita" hidden><i></i></div>
    <div class="app-pasos" hidden><p class="ok">✓ ${esc(t("app.empezo"))}</p>
      <div class="app-paso"><span>1</span><div>${t("app.paso1", { archivo: `<b>${esc(R.exe.nombre)}</b>` })}</div></div>
      <div class="app-paso"><span>2</span><div>${t("app.paso2")}<div class="app-aviso">${t("app.paso2_porque")}</div></div></div>
      <div class="app-paso"><span>3</span><div>${esc(t("app.paso3"))}</div></div></div>`;
  const ns = novedades(R.notas);
  if (ns.length) { nuevo.hidden = false; nuevo.innerHTML = `<details open><summary>${esc(t("app.nuevo", { v: R.version }))}</summary><ul>${ns.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></details>`; }
}
