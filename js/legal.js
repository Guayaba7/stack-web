// Aviso de privacidad y Terminos de uso de Stack (pagina y aplicacion). Rutas: #/privacidad y #/terminos.
// Para cambiarlos: edita el texto de abajo y la fecha VIGENTE. Cada idioma tiene su version completa.
import { idiomaActual, t } from "./i18n.js";

const VIGENTE = "2026-10-26";
const CONTACTO = "lopezmendeze77@gmail.com";

const TEXTOS = {
  es: {
    privacidad: `
<h1>Aviso de privacidad</h1>
<p class="tenue">Vigente desde el ${VIGENTE}. Aplica a la página de Stack y a la aplicación de escritorio Stack.</p>

<h2>Quién es responsable</h2>
<p>Stack es desarrollado por López. M (en adelante, "Stack"). Para cualquier duda sobre este aviso o sobre tus datos escribe a <a href="mailto:${CONTACTO}">${CONTACTO}</a>.</p>

<h2>Resumen</h2>
<ul>
  <li>Puedes usar la página y la aplicación <b>sin cuenta</b>. Sin cuenta, Stack no recibe ningún dato tuyo.</li>
  <li>Si creas una cuenta, tus datos se <b>cifran en tu dispositivo</b> antes de salir de él. Stack no puede leerlos: ni tu usuario, ni tu contraseña, ni tus inventarios, ni tu watchlist, ni tu tema.</li>
  <li>No usamos publicidad, cookies de rastreo ni herramientas de analítica.</li>
  <li>El escáner usa la cámara <b>solo en tu teléfono</b>: ninguna imagen se envía a ningún servidor.</li>
</ul>

<h2>Qué se guarda y dónde</h2>
<h3>En tu navegador o computadora</h3>
<p>La página guarda en el almacenamiento local de tu navegador tus ajustes (idioma, tipo de cambio, fuente de precio preferida), el último tema que se vio y, si eliges "Recordar en este dispositivo", tu sesión. También guarda en caché los archivos de precios del día para funcionar más rápido. La aplicación guarda en tu computadora tus compras, inventarios, watchlist, configuración y los precios descargados. Puedes borrar todo esto en cualquier momento desde tu navegador o desinstalando la aplicación.</p>

<h3>En el servidor de cuentas (solo si creas una cuenta)</h3>
<ul>
  <li>Una huella (hash SHA-256) de tu nombre de usuario. El nombre de usuario en sí no se guarda.</li>
  <li>Una huella de una llave que se deriva de tu contraseña. La contraseña nunca sale de tu dispositivo.</li>
  <li>Tus documentos cifrados (tema, watchlist e inventarios), su tamaño, su versión y la fecha de cada cambio.</li>
  <li>Huellas de tus sesiones abiertas y su fecha de vencimiento (90 días).</li>
  <li>Un contador diario de cuentas creadas por red, guardado como huella de la dirección IP, para evitar abusos. Se usa solo ese día.</li>
</ul>
<p>No pedimos correo, nombre real, teléfono ni datos de pago.</p>

<h3>Reportes de problemas (aplicación)</h3>
<p>Si envías un reporte desde la aplicación, se manda por correo a Stack la categoría y la descripción que escribes, una captura de la ventana (si la dejas marcada), los datos de la carta seleccionada, información técnica de la aplicación (versión y lo que estaba en pantalla) y, si lo escribes, tu correo para responderte. Solo se envía cuando tú lo decides.</p>

<h2>Servicios de terceros</h2>
<p>Para funcionar, tu dispositivo se conecta directamente con estos servicios, que reciben tu dirección IP y datos técnicos de la conexión según sus propias políticas:</p>
<ul>
  <li><b>GitHub Pages</b> (alojamiento de la página y de los precios del día) y <b>GitHub</b> (actualizaciones de la aplicación).</li>
  <li><b>Cloudflare</b> (servidor de cuentas).</li>
  <li><b>Scryfall</b> (imágenes, texto, legalidad y rulings de las cartas).</li>
  <li><b>jsDelivr</b> (motor del escáner).</li>
  <li><b>Frankfurter / Banco Central Europeo</b> (tipos de cambio, consultados por la aplicación).</li>
</ul>

<h2>Para qué se usan los datos</h2>
<p>Solo para darte el servicio: mostrar precios, sincronizar tu cuenta entre tus dispositivos, evitar abusos del servidor y atender los reportes que envíes. No vendemos, rentamos ni compartimos datos con terceros con fines comerciales.</p>

<h2>Tus derechos</h2>
<p>Puedes acceder a tus datos y corregirlos desde la aplicación, y <b>borrar tu cuenta</b> desde la página (Mi cuenta › Borrar cuenta): se eliminan de inmediato la cuenta, las sesiones y todos los documentos. Como Stack no puede leer tus datos ni sabe qué cuenta es tuya, no puede consultarlos, corregirlos ni borrarlos por ti; si necesitas ayuda, escríbenos. Si vives en México, estos derechos corresponden a los derechos ARCO de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.</p>

<h2>Recuperación de la cuenta</h2>
<p>Como tus datos están cifrados con tu contraseña, Stack <b>no puede restablecerla</b>. La única forma de recuperar una cuenta es el código de recuperación que se muestra al crearla, o un dispositivo donde tu sesión siga abierta. Si pierdes la contraseña, el código y todos tus dispositivos, nadie puede recuperar los datos.</p>

<h2>Seguridad</h2>
<p>La conexión es siempre cifrada (HTTPS). Las llaves se derivan con PBKDF2-SHA256 (600,000 iteraciones) y los documentos se cifran con AES-256-GCM. Después de 8 intentos fallidos la cuenta se bloquea 15 minutos. La especificación completa del sistema de cuentas es pública.</p>

<h2>Menores de edad</h2>
<p>Stack no está dirigido a menores de 13 años y no recopila a sabiendas datos de ellos.</p>

<h2>Cambios a este aviso</h2>
<p>Si este aviso cambia, se publicará aquí con una nueva fecha de vigencia. Los cambios importantes se anunciarán en la página o en la aplicación.</p>`,

    terminos: `
<h1>Términos de uso</h1>
<p class="tenue">Vigentes desde el ${VIGENTE}. Aplican a la página de Stack y a la aplicación de escritorio Stack.</p>

<h2>Aceptación</h2>
<p>Al usar Stack aceptas estos términos. Si no estás de acuerdo, no uses el servicio.</p>

<h2>Qué es Stack</h2>
<p>Stack es una herramienta de consulta de precios de cartas de Magic: The Gathering, con inventarios, watchlist y un escáner de cartas. Los precios se reúnen una vez al día de fuentes públicas y se muestran solo como <b>referencia</b>.</p>

<h2>Precios e información</h2>
<ul>
  <li>Los precios provienen de terceros (TCGplayer a través de Scryfall, Hareruya, Star City Games y Card Kingdom) y se convierten a pesos con tipos de cambio del día. Pueden tener errores, retrasos o diferencias con el precio real de cada tienda.</li>
  <li>Stack no vende cartas ni garantiza que una tienda tenga una carta disponible o al precio mostrado.</li>
  <li>Las decisiones de compra o venta que tomes con esta información son tu responsabilidad.</li>
</ul>

<h2>Marcas y contenido de terceros</h2>
<p>Stack no está afiliado, respaldado ni patrocinado por Wizards of the Coast, Scryfall, TCGplayer, Hareruya, Star City Games ni Card Kingdom. Magic: The Gathering, los nombres de las cartas, sus símbolos y sus imágenes son propiedad de Wizards of the Coast LLC. Las imágenes y datos de las cartas se obtienen de Scryfall. Los nombres de las tiendas pertenecen a sus dueños.</p>

<h2>Tu cuenta</h2>
<ul>
  <li>Eres responsable de tu contraseña, de tu código de recuperación y de lo que se haga con tu cuenta.</li>
  <li>Por el cifrado de extremo a extremo, Stack no puede recuperar tu contraseña ni tus datos si pierdes la contraseña y el código de recuperación.</li>
  <li>Puedes borrar tu cuenta en cualquier momento.</li>
  <li>Stack puede eliminar cuentas creadas en masa o usadas para dañar el servicio.</li>
</ul>

<h2>Uso aceptable</h2>
<p>No está permitido: intentar acceder a cuentas ajenas, saturar o atacar los servidores, descargar los datos de forma automatizada y masiva a través del servidor de cuentas, ni usar Stack para actividades ilegales.</p>

<h2>La aplicación</h2>
<p>La aplicación de escritorio se distribuye en versión beta. Su código es propiedad de López. M; no está permitido copiarla, modificarla, descompilarla ni redistribuirla sin permiso. Stack puede cambiar sus funciones, sus planes o empezar a cobrar por ellas; los cambios se avisarán con anticipación.</p>

<h2>Disponibilidad y garantía</h2>
<p>Stack se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo. Puede haber interrupciones, errores o cambios sin aviso previo. Haz respaldos de la información que te importe.</p>

<h2>Limitación de responsabilidad</h2>
<p>En la medida que la ley lo permita, Stack no será responsable por pérdidas o daños derivados del uso del servicio, de decisiones tomadas con sus precios o de la pérdida de datos de cuentas cuyos accesos se hayan perdido.</p>

<h2>Cambios a estos términos</h2>
<p>Estos términos pueden actualizarse. La versión vigente siempre estará en esta página con su fecha. Seguir usando Stack después de un cambio significa que lo aceptas.</p>

<h2>Ley aplicable y contacto</h2>
<p>Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Dudas o comentarios: <a href="mailto:${CONTACTO}">${CONTACTO}</a>.</p>`,
  },

  en: {
    privacidad: `
<h1>Privacy notice</h1>
<p class="tenue">Effective ${VIGENTE}. Applies to the Stack website and the Stack desktop application.</p>

<h2>Who is responsible</h2>
<p>Stack is developed by López. M ("Stack"). For any question about this notice or your data, write to <a href="mailto:${CONTACTO}">${CONTACTO}</a>.</p>

<h2>Summary</h2>
<ul>
  <li>You can use the website and the application <b>without an account</b>. Without an account, Stack receives no data about you.</li>
  <li>If you create an account, your data is <b>encrypted on your device</b> before it leaves it. Stack cannot read it: not your username, password, inventories, watchlist or theme.</li>
  <li>We do not use advertising, tracking cookies or analytics tools.</li>
  <li>The scanner uses the camera <b>only on your phone</b>: no image is sent to any server.</li>
</ul>

<h2>What is stored and where</h2>
<h3>In your browser or computer</h3>
<p>The website stores in your browser's local storage your settings (language, exchange rate, preferred price source), the last theme shown and, if you choose "Remember on this device", your session. It also caches the day's price files to work faster. The application stores your purchases, inventories, watchlist, settings and downloaded prices on your computer. You can delete all of this at any time from your browser or by uninstalling the application.</p>

<h3>On the account server (only if you create an account)</h3>
<ul>
  <li>A fingerprint (SHA-256 hash) of your username. The username itself is not stored.</li>
  <li>A fingerprint of a key derived from your password. The password never leaves your device.</li>
  <li>Your encrypted documents (theme, watchlist and inventories), their size, version and the date of each change.</li>
  <li>Fingerprints of your open sessions and their expiry date (90 days).</li>
  <li>A daily counter of accounts created per network, stored as a fingerprint of the IP address, to prevent abuse. It is used only on that day.</li>
</ul>
<p>We do not ask for an e-mail address, real name, phone number or payment details.</p>

<h3>Problem reports (application)</h3>
<p>If you send a report from the application, the category and description you write, a screenshot of the window (if left selected), the selected card's data, technical information about the application (version and what was on screen) and, if you enter it, your e-mail address for a reply are sent to Stack by e-mail. Reports are sent only when you decide to send them.</p>

<h2>Third-party services</h2>
<p>To work, your device connects directly to these services, which receive your IP address and technical connection data under their own policies:</p>
<ul>
  <li><b>GitHub Pages</b> (hosting of the website and the day's prices) and <b>GitHub</b> (application updates).</li>
  <li><b>Cloudflare</b> (account server).</li>
  <li><b>Scryfall</b> (card images, text, legality and rulings).</li>
  <li><b>jsDelivr</b> (scanner engine).</li>
  <li><b>Frankfurter / European Central Bank</b> (exchange rates, requested by the application).</li>
</ul>

<h2>How data is used</h2>
<p>Only to provide the service: showing prices, synchronizing your account between your devices, preventing abuse of the server and handling the reports you send. We do not sell, rent or share data with third parties for commercial purposes.</p>

<h2>Your rights</h2>
<p>You can access and correct your data in the application, and <b>delete your account</b> on the website (My account › Delete account): the account, its sessions and all documents are removed immediately. Because Stack cannot read your data or tell which account is yours, it cannot look up, correct or delete it on your behalf; if you need help, write to us. If you live in Mexico, these rights correspond to the ARCO rights of the Federal Law on the Protection of Personal Data Held by Private Parties.</p>

<h2>Account recovery</h2>
<p>Because your data is encrypted with your password, Stack <b>cannot reset it</b>. The only ways to recover an account are the recovery code shown when it was created, or a device where your session is still open. If you lose the password, the code and every device, no one can recover the data.</p>

<h2>Security</h2>
<p>Connections are always encrypted (HTTPS). Keys are derived with PBKDF2-SHA256 (600,000 iterations) and documents are encrypted with AES-256-GCM. After 8 failed attempts the account is locked for 15 minutes. The full specification of the account system is public.</p>

<h2>Children</h2>
<p>Stack is not directed to children under 13 and does not knowingly collect data from them.</p>

<h2>Changes to this notice</h2>
<p>If this notice changes, the new version will be published here with a new effective date. Significant changes will be announced on the website or in the application.</p>`,

    terminos: `
<h1>Terms of use</h1>
<p class="tenue">Effective ${VIGENTE}. Apply to the Stack website and the Stack desktop application.</p>

<h2>Acceptance</h2>
<p>By using Stack you accept these terms. If you do not agree, do not use the service.</p>

<h2>What Stack is</h2>
<p>Stack is a price lookup tool for Magic: The Gathering cards, with inventories, a watchlist and a card scanner. Prices are collected once a day from public sources and are shown for <b>reference only</b>.</p>

<h2>Prices and information</h2>
<ul>
  <li>Prices come from third parties (TCGplayer through Scryfall, Hareruya, Star City Games and Card Kingdom) and are converted to Mexican pesos with the day's exchange rates. They may contain errors, delays or differences from each store's actual price.</li>
  <li>Stack does not sell cards and does not guarantee that a store has a card available or at the price shown.</li>
  <li>Buying and selling decisions you make with this information are your responsibility.</li>
</ul>

<h2>Trademarks and third-party content</h2>
<p>Stack is not affiliated with, endorsed or sponsored by Wizards of the Coast, Scryfall, TCGplayer, Hareruya, Star City Games or Card Kingdom. Magic: The Gathering, card names, symbols and images are property of Wizards of the Coast LLC. Card images and data are obtained from Scryfall. Store names belong to their owners.</p>

<h2>Your account</h2>
<ul>
  <li>You are responsible for your password, your recovery code and anything done with your account.</li>
  <li>Because of end-to-end encryption, Stack cannot recover your password or your data if you lose both the password and the recovery code.</li>
  <li>You can delete your account at any time.</li>
  <li>Stack may remove accounts created in bulk or used to harm the service.</li>
</ul>

<h2>Acceptable use</h2>
<p>You may not: attempt to access other people's accounts, overload or attack the servers, download data in an automated, massive way through the account server, or use Stack for illegal activities.</p>

<h2>The application</h2>
<p>The desktop application is distributed as a beta. Its code is the property of López. M; it may not be copied, modified, decompiled or redistributed without permission. Stack may change its features or plans, or begin charging for them; changes will be announced in advance.</p>

<h2>Availability and warranty</h2>
<p>Stack is provided "as is" and "as available", without warranties of any kind. There may be interruptions, errors or changes without prior notice. Back up any information that matters to you.</p>

<h2>Limitation of liability</h2>
<p>To the extent permitted by law, Stack is not liable for losses or damages arising from the use of the service, from decisions made with its prices, or from the loss of data of accounts whose credentials were lost.</p>

<h2>Changes to these terms</h2>
<p>These terms may be updated. The current version will always be on this page with its date. Continuing to use Stack after a change means you accept it.</p>

<h2>Governing law and contact</h2>
<p>These terms are governed by the laws of the United Mexican States. Questions or comments: <a href="mailto:${CONTACTO}">${CONTACTO}</a>.</p>`,
  },
};

export function vistaLegal(app, cual) {
  const idioma = TEXTOS[idiomaActual()] ? idiomaActual() : "es";
  const otro = cual === "privacidad" ? "terminos" : "privacidad";
  app.innerHTML = `<a class="volver" href="#/" data-atras>${t("ficha.atras")}</a>
    <article class="legal">${TEXTOS[idioma][cual]}
      <p class="otro-legal"><a href="#/${otro}">${t(`legal.${otro}`)} ›</a></p></article>`;
}
