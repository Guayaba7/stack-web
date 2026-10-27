"""Publica los articulos de Stack.

Cada articulo es una carpeta con un archivo `articulo.md` y sus fotos:

    articulos/                         <- carpeta de trabajo (FUENTE), en tu computadora
        2026-10-27-guia-de-precios/
            articulo.md
            portada.jpg
            foto-1.png

Este programa lee esa carpeta, revisa cada articulo, convierte el texto a una pagina, achica las fotos y deja todo listo
en la pagina de Stack (DESTINO = stack-web/articulos). Despues solo subes la carpeta stack-web/articulos a GitHub.

Uso (desde la carpeta donde esta este archivo, o con las rutas completas):
    python publicar_articulos.py                 revisa y publica todo
    python publicar_articulos.py --revisar       solo revisa (no escribe nada)
    python publicar_articulos.py --ver           publica y abre la pagina en tu navegador para verla antes de subirla
    python publicar_articulos.py --fuente D:\\MTG\\articulos --destino D:\\MTG\\stack-web\\articulos

Formato completo y ejemplos: MANUAL_ARTICULOS.md. Solo usa la libreria estandar de Python; si tienes Pillow
(pip install pillow) tambien achica y comprime las fotos.
"""
import argparse
import html
import json
import re
import shutil
import sys
import unicodedata
from datetime import date, datetime, timezone
from pathlib import Path

AQUI = Path(__file__).resolve().parent
FUENTE = AQUI.parent.parent / "articulos" if (AQUI.parent.name == "stack-web") else AQUI / "articulos"
DESTINO = AQUI.parent / "articulos" if (AQUI.parent.name == "stack-web") else AQUI / "stack-web" / "articulos"

CAMPOS = {"titulo": True, "resumen": True, "autor": True, "fecha": True, "portada": True, "etiquetas": False,
          "idioma": False, "destacado": False, "borrador": False}
FOTOS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ANCHO_MAX = 1600            # pixeles: mas que esto no se ve mejor en ninguna pantalla y pesa mas
PESO_AVISO = 900_000        # bytes: arriba de esto se avisa que la foto es pesada
CALLOUTS = {"nota": "Nota", "consejo": "Consejo", "aviso": "Aviso", "dato": "Dato"}


class Problema(Exception):
    pass


# ---------------------------------------------------------------- utilidades
def slug_de(texto):
    t = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:80] or "articulo"


def leer_cabecera(texto, ruta):
    """El bloque entre --- y --- al inicio del archivo: una linea por campo, 'campo: valor'."""
    texto = texto.lstrip("\ufeff")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", texto, re.S)
    if not m:
        raise Problema(f"{ruta}: falta la cabecera (las lineas entre --- y --- al inicio).")
    datos = {}
    for n, linea in enumerate(m.group(1).splitlines(), 2):
        if not linea.strip() or linea.strip().startswith("#"):
            continue
        if ":" not in linea:
            raise Problema(f"{ruta}, linea {n}: se esperaba 'campo: valor' y dice {linea!r}.")
        k, v = linea.split(":", 1)
        datos[k.strip().lower()] = v.strip().strip('"').strip("'")
    return datos, texto[m.end():], texto[:m.end()].count("\n")


# ---------------------------------------------------------------- texto -> HTML
def en_linea(t, fotos_usadas):
    """Negritas, cursivas, enlaces, codigo y referencias a cartas dentro de un renglon (ya escapado)."""
    codigos = []

    def guardar_codigo(m):
        codigos.append(m.group(1))
        return f"\u0000{len(codigos) - 1}\u0000"
    t = re.sub(r"`([^`]+)`", guardar_codigo, t)

    # [[Nombre de carta]]  [[Nombre|SET]]  [[Nombre|SET|numero]]
    def carta(m):
        partes = [p.strip() for p in m.group(1).split("|")]
        nombre = partes[0]
        attrs = f' data-carta="{nombre}"'
        if len(partes) > 1 and partes[1]:
            attrs += f' data-set="{partes[1].lower()}"'
        if len(partes) > 2 and partes[2]:
            attrs += f' data-num="{partes[2]}"'
        return f'<a class="carta-ref"{attrs}>{nombre}</a>'
    t = re.sub(r"\[\[([^\]]+)\]\]", carta, t)
    # [texto](https://...)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])", r"<em>\1</em>", t)
    t = re.sub(r"\u0000(\d+)\u0000", lambda m: f"<code>{codigos[int(m.group(1))]}</code>", t)
    return t


RX_FOTO = re.compile(r'^!\[([^\]]*)\]\(([^)\s]+)\)\s*(\{(ancha|chica|derecha|izquierda)\})?\s*$')


def a_html(cuerpo, carpeta, ruta, desfase=0):
    """Convierte el texto del articulo a HTML. Todo el texto se escapa: no se permite HTML escrito a mano."""
    lineas = cuerpo.replace("\r\n", "\n").split("\n")
    salida, fotos, i, avisos = [], set(), 0, []
    parrafo = []

    def cerrar_parrafo():
        if parrafo:
            salida.append("<p>" + "<br>".join(en_linea(html.escape(x, quote=True), fotos) for x in parrafo) + "</p>")
            parrafo.clear()

    def figura(m, n):
        alt, archivo, mod = m.group(1).strip(), m.group(2).strip(), m.group(4) or ""
        if not (carpeta / archivo).is_file():
            raise Problema(f"{ruta}, linea {n}: no encuentro la foto {archivo!r} en la carpeta del articulo.")
        fotos.add(archivo)
        cap = f"<figcaption>{en_linea(html.escape(alt), fotos)}</figcaption>" if alt else ""
        return (f'<figure class="foto {mod}"><img src="{html.escape(archivo)}" alt="{html.escape(alt)}" loading="lazy">'
                f"{cap}</figure>")

    while i < len(lineas):
        linea, n = lineas[i], i + 1 + desfase
        s = linea.strip()
        if not s:
            cerrar_parrafo(); i += 1; continue
        # bloque de cartas
        if re.match(r"^:::\s*cartas\s*$", s, re.I):
            cerrar_parrafo()
            nombres, i = [], i + 1
            while i < len(lineas) and lineas[i].strip() != ":::":
                if lineas[i].strip():
                    nombres.append(lineas[i].strip().lstrip("-* ").strip())
                i += 1
            if i >= len(lineas):
                raise Problema(f"{ruta}, linea {n}: el bloque '::: cartas' no se cerro con ':::'.")
            items = []
            for nom in nombres:
                p = [x.strip() for x in nom.split("|")]
                a = f' data-carta="{html.escape(p[0])}"' + (f' data-set="{html.escape(p[1].lower())}"' if len(p) > 1 and p[1] else "") + \
                    (f' data-num="{html.escape(p[2])}"' if len(p) > 2 and p[2] else "")
                items.append(f'<a class="carta-tarjeta"{a}><span>{html.escape(p[0])}</span></a>')
            salida.append(f'<div class="cartas-bloque">{"".join(items)}</div>')
            i += 1; continue
        # encabezados
        m = re.match(r"^(#{1,3})\s+(.+)$", s)
        if m:
            cerrar_parrafo()
            nivel = max(2, len(m.group(1)) + 1) if len(m.group(1)) == 1 else len(m.group(1))
            if len(m.group(1)) == 1:
                avisos.append(f"linea {n}: '# ' es el titulo del articulo y ya va en la cabecera; lo tomo como '## '.")
                nivel = 2
            salida.append(f"<h{nivel}>{en_linea(html.escape(m.group(2)), fotos)}</h{nivel}>")
            i += 1; continue
        if re.match(r"^(-{3,}|\*{3,})$", s):
            cerrar_parrafo(); salida.append("<hr>"); i += 1; continue
        # fotos (una sola en su renglon). Varias seguidas = galeria
        m = RX_FOTO.match(s)
        if m:
            cerrar_parrafo()
            grupo = []
            while i < len(lineas) and RX_FOTO.match(lineas[i].strip()):
                grupo.append(figura(RX_FOTO.match(lineas[i].strip()), i + 1 + desfase)); i += 1
            salida.append(grupo[0] if len(grupo) == 1 else f'<div class="galeria g{min(len(grupo), 3)}">{"".join(grupo)}</div>')
            continue
        # citas y recuadros
        if s.startswith(">"):
            cerrar_parrafo()
            bloque = []
            while i < len(lineas) and lineas[i].strip().startswith(">"):
                bloque.append(lineas[i].strip()[1:].strip()); i += 1
            m = re.match(r"^\[!(\w+)\]\s*(.*)$", bloque[0], re.I)
            if m and m.group(1).lower() in CALLOUTS:
                tipo = m.group(1).lower()
                titulo = m.group(2).strip() or CALLOUTS[tipo]
                cuerpo_b = "<br>".join(en_linea(html.escape(x), fotos) for x in bloque[1:] if x)
                salida.append(f'<aside class="recuadro {tipo}"><b>{en_linea(html.escape(titulo), fotos)}</b><div>{cuerpo_b}</div></aside>')
            else:
                salida.append("<blockquote>" + "<br>".join(en_linea(html.escape(x), fotos) for x in bloque if x) + "</blockquote>")
            continue
        # listas
        if re.match(r"^([-*]|\d+[.)])\s+", s):
            cerrar_parrafo()
            ordenada = bool(re.match(r"^\d", s))
            items = []
            while i < len(lineas) and re.match(r"^([-*]|\d+[.)])\s+", lineas[i].strip()):
                items.append(re.sub(r"^([-*]|\d+[.)])\s+", "", lineas[i].strip())); i += 1
            tag = "ol" if ordenada else "ul"
            salida.append(f"<{tag}>" + "".join(f"<li>{en_linea(html.escape(x), fotos)}</li>" for x in items) + f"</{tag}>")
            continue
        # tablas
        if s.startswith("|") and i + 1 < len(lineas) and re.match(r"^\|?\s*:?-{2,}", lineas[i + 1].strip()):
            cerrar_parrafo()
            celdas = lambda x: [c.strip() for c in x.strip().strip("|").split("|")]
            cab = celdas(s)
            alin = ["der" if c.strip().endswith(":") and not c.strip().startswith(":") else "" for c in celdas(lineas[i + 1])]
            i += 2
            filas = []
            while i < len(lineas) and lineas[i].strip().startswith("|"):
                filas.append(celdas(lineas[i])); i += 1
            th = "".join(f'<th class="{alin[k] if k < len(alin) else ""}">{en_linea(html.escape(c), fotos)}</th>' for k, c in enumerate(cab))
            tb = "".join("<tr>" + "".join(f'<td class="{alin[k] if k < len(alin) else ""}">{en_linea(html.escape(c), fotos)}</td>'
                                          for k, c in enumerate(f)) + "</tr>" for f in filas)
            salida.append(f'<div class="tabla"><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>')
            continue
        parrafo.append(s)
        i += 1
    cerrar_parrafo()
    return "\n".join(salida), fotos, avisos


# ---------------------------------------------------------------- fotos
def copiar_foto(origen, destino):
    """Copia la foto; con Pillow la achica a ANCHO_MAX y la comprime. Devuelve (ancho, alto, bytes)."""
    try:
        from PIL import Image, ImageOps
    except ImportError:
        shutil.copy2(origen, destino)
        return None, None, destino.stat().st_size
    with Image.open(origen) as im:
        im = ImageOps.exif_transpose(im)
        if origen.suffix.lower() == ".gif":
            shutil.copy2(origen, destino)
            return im.width, im.height, destino.stat().st_size
        if im.width > ANCHO_MAX:
            im = im.resize((ANCHO_MAX, round(im.height * ANCHO_MAX / im.width)), Image.LANCZOS)
        if origen.suffix.lower() in (".jpg", ".jpeg"):
            im.convert("RGB").save(destino, "JPEG", quality=84, optimize=True, progressive=True)
        elif origen.suffix.lower() == ".webp":
            im.save(destino, "WEBP", quality=84)
        else:
            im.save(destino, "PNG", optimize=True)
        return im.width, im.height, destino.stat().st_size


# ---------------------------------------------------------------- un articulo
def leer_articulo(carpeta):
    md = carpeta / "articulo.md"
    if not md.is_file():
        raise Problema(f"{carpeta.name}: falta el archivo articulo.md.")
    ruta = f"{carpeta.name}/articulo.md"
    cab, cuerpo, desfase = leer_cabecera(md.read_text(encoding="utf-8"), ruta)
    for campo, oblig in CAMPOS.items():
        if oblig and not cab.get(campo):
            raise Problema(f"{ruta}: falta el campo '{campo}' en la cabecera.")
    for campo in cab:
        if campo not in CAMPOS:
            raise Problema(f"{ruta}: no conozco el campo '{campo}'. Los campos son: {', '.join(CAMPOS)}.")
    try:
        fecha = date.fromisoformat(cab["fecha"])
    except ValueError:
        raise Problema(f"{ruta}: la fecha debe ser AAAA-MM-DD (por ejemplo 2026-10-27), no {cab['fecha']!r}.")
    if not (carpeta / cab["portada"]).is_file():
        raise Problema(f"{ruta}: no encuentro la portada {cab['portada']!r} en la carpeta del articulo.")
    if len(cab["resumen"]) > 220:
        raise Problema(f"{ruta}: el resumen tiene {len(cab['resumen'])} letras; el maximo es 220.")
    idioma = (cab.get("idioma") or "es").lower()
    if idioma not in ("es", "en"):
        raise Problema(f"{ruta}: idioma debe ser es o en.")
    cuerpo_html, fotos, avisos = a_html(cuerpo, carpeta, ruta, desfase)
    palabras = len(re.findall(r"\w+", cuerpo))
    return {
        "slug": slug_de(carpeta.name),
        "titulo": cab["titulo"], "resumen": cab["resumen"], "autor": cab["autor"], "fecha": fecha.isoformat(),
        "portada": cab["portada"], "etiquetas": [e.strip() for e in (cab.get("etiquetas") or "").split(",") if e.strip()],
        "idioma": idioma, "destacado": (cab.get("destacado") or "").lower() in ("si", "sí", "yes", "true", "1"),
        "borrador": (cab.get("borrador") or "").lower() in ("si", "sí", "yes", "true", "1"),
        "minutos": max(1, round(palabras / 220)), "html": cuerpo_html,
    }, fotos | {cab["portada"]}, avisos


def publicar(fuente, destino, solo_revisar=False):
    if not fuente.is_dir():
        raise Problema(f"No existe la carpeta de articulos: {fuente}")
    carpetas = sorted(p for p in fuente.iterdir() if p.is_dir() and not p.name.startswith((".", "_")))
    if not carpetas:
        print(f"No hay articulos en {fuente}")
    publicados, errores, slugs = [], 0, {}
    for c in carpetas:
        try:
            art, fotos, avisos = leer_articulo(c)
            if art["slug"] in slugs:
                raise Problema(f"{c.name}: tiene el mismo nombre de carpeta (sin acentos) que {slugs[art['slug']]}.")
            slugs[art["slug"]] = c.name
        except Problema as e:
            print(f"  ✗ {e}")
            errores += 1
            continue
        estado = "borrador (no se publica)" if art["borrador"] else "listo"
        print(f"  ✓ {c.name}: {art['titulo']} · {art['minutos']} min · {len(fotos)} fotos · {estado}")
        for a in avisos:
            print(f"      aviso, {a}")
        sobran = sorted(p.name for p in c.iterdir() if p.suffix.lower() in FOTOS and p.name not in fotos)
        if sobran:
            print(f"      aviso: estas fotos no se usan en el texto y no se suben: {', '.join(sobran)}")
        if art["borrador"] or solo_revisar:
            continue
        salida = destino / art["slug"]
        if salida.exists():
            shutil.rmtree(salida)
        salida.mkdir(parents=True)
        for f in sorted(fotos):
            w, h, b = copiar_foto(c / f, salida / f)
            if b > PESO_AVISO:
                print(f"      aviso: {f} pesa {b / 1e6:.1f} MB; tarda en cargar en el celular" +
                      ("" if w else " (instala Pillow para que se achique sola: pip install pillow)"))
        (salida / "articulo.json").write_text(json.dumps(art, ensure_ascii=False, indent=1), encoding="utf-8")
        publicados.append({k: v for k, v in art.items() if k != "html"})
    if solo_revisar:
        print(f"\nRevisados: {len(carpetas)} · con errores: {errores}")
        return errores
    # lo publicado antes y que ya no esta en la fuente se quita
    vivos = {a["slug"] for a in publicados}
    if destino.is_dir():
        for p in destino.iterdir():
            if p.is_dir() and p.name not in vivos:
                shutil.rmtree(p)
                print(f"  − {p.name}: ya no esta en la carpeta de articulos, se quito de la pagina")
    destino.mkdir(parents=True, exist_ok=True)
    publicados.sort(key=lambda a: (a["fecha"], a["titulo"]), reverse=True)
    (destino / "indice.json").write_text(json.dumps({"esquema": 1, "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                                                     "articulos": publicados}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nPublicados: {len(publicados)} · con errores: {errores}\nListo en: {destino}")
    print("Siguiente paso: sube la carpeta 'articulos' de stack-web a GitHub (Add file › Upload files).")
    return errores


def main():
    try:                                               # consolas de Windows sin UTF-8: que los simbolos no truenen
        sys.stdout.reconfigure(errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser(description="Publica los articulos de Stack.")
    ap.add_argument("--fuente", type=Path, default=FUENTE, help="carpeta con los articulos (cada uno en su carpeta)")
    ap.add_argument("--destino", type=Path, default=DESTINO, help="carpeta 'articulos' dentro de stack-web")
    ap.add_argument("--revisar", action="store_true", help="solo revisar, sin escribir nada")
    ap.add_argument("--ver", action="store_true", help="publicar y abrir la pagina en el navegador")
    a = ap.parse_args()
    print(f"Articulos: {a.fuente}\nPagina:    {a.destino}\n")
    try:
        errores = publicar(a.fuente, a.destino, a.revisar)
    except Problema as e:
        print(f"✗ {e}")
        sys.exit(1)
    if a.ver and not a.revisar:
        import functools
        import http.server
        import threading
        import webbrowser
        raiz = a.destino.parent
        import socket
        srv = http.server.ThreadingHTTPServer(("", 8000), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(raiz)))
        threading.Timer(0.8, lambda: webbrowser.open("http://localhost:8000/#/articulos")).start()
        try:                                           # la IP de esta computadora en la red, para verlo en el celular
            sk = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); sk.connect(("8.8.8.8", 80)); ip = sk.getsockname()[0]; sk.close()
        except OSError:
            ip = None
        print("\nViendo en http://localhost:8000/#/articulos" + (f"  · en el celular (misma red): http://{ip}:8000/#/articulos" if ip else "")
              + "\nCtrl+C para terminar")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
