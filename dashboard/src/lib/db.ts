import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

const OPCIONES = {
  // El pooler de Supabase en modo transaccion no soporta prepared statements.
  // Es el mismo motivo por el que el ETL usa prepare_threshold=None.
  prepare: false,
  // UNA sola conexion, y las consultas en serie (ver queries.ts).
  //
  // Con max: 3 y ocho consultas en paralelo, postgres.js encola varias en la
  // misma conexion (pipelining). El pooler en modo transaccion multiplexa por
  // transaccion, no soporta eso, y la peticion se queda colgada para siempre:
  // ni error ni respuesta. Comprobado -con max: 8, una conexion por consulta,
  // funciona; con max: 3 cuelga-.
  //
  // Subir el maximo lo arreglaria, pero cada instancia serverless se quedaria
  // con ocho conexiones del pooler, y el plan free tiene pocas. En serie son
  // ~1,8 s una vez cada cinco minutos: sale mas barato.
  max: 1,
  idle_timeout: 20,
  connect_timeout: 15,
} as const;

/**
 * Supabase exige TLS; el Postgres del docker-compose no lo tiene levantado, y
 * con ssl fijo en "require" no habria forma de probar en local. Decide la
 * cadena, que es quien sabe contra que se esta conectando.
 */
function opciones(url: string) {
  const local = /@(localhost|127\.0\.0\.1|db)[:/]/.test(url) || /sslmode=disable/.test(url);
  return { ...OPCIONES, ssl: local ? false : ("require" as const) };
}

let lectura: Sql | undefined;
let escritura: Sql | undefined;

/**
 * Conexion perezosa: si se creara al importar el modulo, `next build` fallaria
 * en cualquier maquina sin DATABASE_URL. Aqui solo se abre cuando alguien
 * consulta de verdad.
 */
export function db(): Sql {
  if (lectura) return lectura;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia dashboard/.env.example a dashboard/.env.local " +
        "y pon ahi la cadena del transaction pooler de Supabase.",
    );
  }

  lectura = postgres(url, opciones(url));
  return lectura;
}

/**
 * Conexion de ESCRITURA, con el rol app_rw (ver dashboard/sql/app_rw.sql).
 *
 * Va aparte a proposito: el panel entero sigue leyendo con dashboard_ro, un rol
 * que fisicamente no puede escribir. Solo las Server Actions de recepcion piden
 * esta, asi que un fallo o una inyeccion en una pagina de lectura no puede
 * modificar nada.
 *
 * Si DATABASE_URL_RW no esta definida, cae a DATABASE_URL. Es lo comodo en
 * desarrollo contra el Postgres local, donde el usuario ya es el dueno; en
 * produccion hay que definirla.
 */
export function dbEscritura(): Sql {
  if (escritura) return escritura;

  const url = process.env.DATABASE_URL_RW ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_RW. Es la cadena del rol app_rw; crealo con " +
        "dashboard/sql/app_rw.sql y ponla en dashboard/.env.local.",
    );
  }

  escritura = postgres(url, opciones(url));
  return escritura;
}
