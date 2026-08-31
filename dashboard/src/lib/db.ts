import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

let cliente: Sql | undefined;

/**
 * Conexion perezosa: si se creara al importar el modulo, `next build` fallaria
 * en cualquier maquina sin DATABASE_URL. Aqui solo se abre cuando alguien
 * consulta de verdad.
 */
export function db(): Sql {
  if (cliente) return cliente;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia dashboard/.env.example a dashboard/.env.local " +
        "y pon ahi la cadena del transaction pooler de Supabase.",
    );
  }

  cliente = postgres(url, {
    ssl: "require",
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
  });

  return cliente;
}
