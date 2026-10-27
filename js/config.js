// Lo unico que hay que cambiar si los datos se mudan de lugar.
// En tu PC (localhost o la IP de tu red) la pagina lee la carpeta "datos" de al lado.
// Publicada, lee los datos que publica el workflow de stack-datos.
const local = ["localhost", "127.0.0.1", ""].includes(location.hostname) || /^192\.168\.|^10\./.test(location.hostname);

export const DATOS_URL = local ? "datos/" : "https://guayaba7.github.io/stack-datos/datos/";
// Servidor de cuentas (Cloudflare Worker). Pega aqui la direccion que te da Cloudflare al publicarlo.
const CUENTAS_PUBLICO = "https://stack-cuentas.lopezmendeze77.workers.dev";
export const CUENTAS_URL = CUENTAS_PUBLICO;
export const ZONA = "America/Mexico_City";       // "hoy" se cuenta en hora de Mexico, igual que el job
export const POR_GRUPO = 3;                      // impresiones visibles por nombre antes de "Ver mas"
export const MAX_GRUPOS = 25;                    // nombres distintos en los resultados
