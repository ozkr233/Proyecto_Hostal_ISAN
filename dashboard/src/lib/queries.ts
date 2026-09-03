import { db } from "./db";
import type {
  Ausencia,
  Datos,
  Descuadre,
  Estadia,
  Evento,
  Habitacion,
  Noche,
  Persona,
  Rechazo,
  Servicio,
} from "./types";

/**
 * Nueve consultas, todas SELECT. Se traen las tablas base aplanadas con sus
 * joins y los agregados se derivan en el navegador: el dataset completo son
 * ~5.300 filas, asi que mover un filtro no vuelve a la base.
 *
 * Las vistas de rpt que agregan (vw_registro_oficial, vw_ocupacion_diaria,
 * vw_pension_diaria, vw_facturacion_empresa_mes) no se consultan justamente
 * por eso: una vista fija no puede reagregarse sobre lo filtrado. Sus numeros
 * quedan como referencia de que el calculo del cliente coincide.
 *
 * vw_descuadre si se consulta tal cual: depende de staging.registro_crudo,
 * que no se carga al cliente.
 */
async function consultar(): Promise<Datos> {
  const sql = db();

  // En SERIE, a proposito. Lanzadas con Promise.all, postgres.js las encola en
  // la misma conexion y el pooler en modo transaccion se cuelga sin devolver
  // error nunca. Ver el comentario largo en db.ts. Son ~2 s en total, una vez
  // cada cinco minutos.
  const estadias = await sql<Estadia[]>`
    SELECT e.id,
           e.persona_id,
           p.nombre                     AS persona,
           p.rut_normalizado            AS rut,
           p.rut_valido,
           p.celular,
           c.nombre                     AS cargo,
           em.nombre                    AS empresa,
           h.codigo                     AS hostal,
           hab.numero                   AS habitacion,
           hab.tipo::text               AS habitacion_tipo,
           e.tipo_habitacion::text      AS tipo_habitacion,
           e.grupo::text                AS grupo,
           e.folio,
           to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
           to_char(e.hora_ingreso,  'HH24:MI')    AS hora_ingreso,
           to_char(e.fecha_salida,  'YYYY-MM-DD') AS fecha_salida,
           to_char(e.hora_salida,   'HH24:MI')    AS hora_salida,
           e.motivo_salida,
           ms.nombre                    AS motivo_salida_nombre,
           e.motivo_salida_detalle,
           e.salida_anticipada,
           to_char(e.fecha_salida_prevista, 'YYYY-MM-DD') AS fecha_salida_prevista,
           e.turno_habitual::text       AS turno_habitual,
           e.chip_devuelto::text        AS chip_devuelto,
           e.llaves_devueltas::text     AS llaves_devueltas,
           e.numero_llave,
           e.numero_chip,
           to_char(e.llaves_devueltas_en, 'YYYY-MM-DD') AS llaves_devueltas_en,
           to_char(e.chip_devuelto_en,    'YYYY-MM-DD') AS chip_devuelto_en,
           e.origen::text               AS origen,
           ureg.nombre                  AS registrado_por,
           usal.nombre                  AS salida_registrada_por,
           e.patente_vehiculo,
           e.usa_estacionamiento,
           e.observaciones,
           e.requiere_revision,
           e.nota_revision,
           e.origen_archivo,
           e.origen_hoja,
           e.origen_fila,
           e.origen_bloque
    FROM core.estadia e
    JOIN core.persona p       ON p.id   = e.persona_id
    JOIN core.empresa em      ON em.id  = e.empresa_id
    JOIN core.hostal  h       ON h.id   = e.hostal_id
    LEFT JOIN core.habitacion    hab  ON hab.id = e.habitacion_id
    LEFT JOIN core.cargo         c    ON c.id   = p.cargo_id
    LEFT JOIN core.motivo_salida ms   ON ms.id  = e.motivo_salida_id
    LEFT JOIN core.usuario       ureg ON ureg.id = e.registrado_por
    LEFT JOIN core.usuario       usal ON usal.id = e.salida_registrada_por
    ORDER BY e.id
  `;

  const noches = await sql<Noche[]>`
    SELECT estadia_id,
           to_char(fecha, 'YYYY-MM-DD') AS fecha,
           turno::text                  AS turno,
           cambio_sabanas
    FROM core.estadia_noche
    ORDER BY fecha, estadia_id
  `;

  const servicios = await sql<Servicio[]>`
    SELECT s.id,
           to_char(s.fecha, 'YYYY-MM-DD') AS fecha,
           s.estadia_id,
           s.persona_id,
           p.nombre            AS persona,
           p.rut_normalizado   AS rut,
           em.nombre           AS empresa,
           h.codigo            AS hostal,
           s.tipo_servicio::text AS tipo_servicio,
           s.cantidad,
           s.variante,
           s.es_extra,
           s.autorizado_por,
           s.origen_archivo,
           s.origen_hoja
    FROM core.servicio_consumo s
    JOIN core.hostal  h  ON h.id  = s.hostal_id
    LEFT JOIN core.empresa em ON em.id = s.empresa_id
    LEFT JOIN core.persona p  ON p.id  = s.persona_id
    ORDER BY s.fecha, s.id
  `;

  const personas = await sql<Persona[]>`
    SELECT p.id,
           p.nombre,
           p.rut_normalizado AS rut,
           p.rut_valido,
           p.celular,
           c.nombre          AS cargo
    FROM core.persona p
    LEFT JOIN core.cargo c ON c.id = p.cargo_id
    ORDER BY p.nombre
  `;

  const eventos = await sql<Evento[]>`
    SELECT id,
           estadia_id,
           to_char(fecha, 'YYYY-MM-DD') AS fecha,
           tipo::text AS tipo,
           detalle
    FROM core.estadia_evento
    ORDER BY fecha, id
  `;

  // Permisos, vacaciones y licencias. En el Excel esto no existia como dato:
  // eran tres totales diarios escritos a mano al pie de R. OFICIAL.
  const ausencias = await sql<Ausencia[]>`
    SELECT a.id,
           a.estadia_id,
           e.persona_id,
           p.nombre            AS persona,
           p.rut_normalizado   AS rut,
           em.nombre           AS empresa,
           h.codigo            AS hostal,
           hab.numero          AS habitacion,
           ta.codigo           AS tipo,
           ta.nombre           AS tipo_nombre,
           to_char(a.desde, 'YYYY-MM-DD') AS desde,
           to_char(a.hasta, 'YYYY-MM-DD') AS hasta,
           -- Los dias de una ausencia sin cierre se cuentan hasta hoy, no hasta
           -- el infinito: es lo unico que se puede afirmar.
           (LEAST(COALESCE(a.hasta, core.hoy()), core.hoy()) - a.desde + 1)::int AS dias,
           a.conserva_habitacion,
           a.detalle,
           u.nombre            AS registrado_por
    FROM core.estadia_ausencia a
    JOIN core.tipo_ausencia ta ON ta.id = a.tipo_id
    JOIN core.estadia e        ON e.id  = a.estadia_id
    JOIN core.persona p        ON p.id  = e.persona_id
    JOIN core.empresa em       ON em.id = e.empresa_id
    JOIN core.hostal  h        ON h.id  = e.hostal_id
    LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
    LEFT JOIN core.usuario u      ON u.id   = a.registrado_por
    ORDER BY a.desde, a.id
  `;

  const habitaciones = await sql<Habitacion[]>`
    SELECT hab.id,
           h.codigo      AS hostal,
           hab.numero,
           hab.tipo::text AS tipo,
           hab.capacidad,
           hab.activa
    FROM core.habitacion hab
    JOIN core.hostal h ON h.id = hab.hostal_id
    ORDER BY h.codigo, hab.numero
  `;

  const rechazos = await sql<Rechazo[]>`
    SELECT id, archivo_origen, hoja, fila, bloque, motivo, detalle
    FROM staging.rechazo
    ORDER BY id
  `;

  const descuadre = await sql<Descuadre[]>`
    SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha,
           noches_core,
           filas_hoja_diaria,
           diferencia
    FROM rpt.vw_descuadre
    ORDER BY fecha
  `;

  return {
    estadias: [...estadias],
    noches: [...noches],
    servicios: [...servicios],
    personas: [...personas],
    eventos: [...eventos],
    ausencias: [...ausencias],
    habitaciones: [...habitaciones],
    rechazos: [...rechazos],
    descuadre: [...descuadre],
    cargadoEn: new Date().toISOString(),
  };
}

/**
 * Cache en memoria del proceso, 5 minutos. Cada instancia serverless mantiene
 * la suya: basta para que navegar entre pestanas no golpee la base, y el plan
 * free de Supabase lo agradece.
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { datos: Datos; expira: number } | undefined;
let enVuelo: Promise<Datos> | undefined;

/**
 * Tira el cache. La llaman las Server Actions de recepcion despues de escribir:
 * sin esto, el panel mostraria hasta cinco minutos de datos viejos justo
 * cuando algo acaba de cambiar.
 *
 * Es por instancia y de mejor esfuerzo -otra instancia serverless conserva el
 * suyo-. El boton "Actualizar" sigue siendo la garantia.
 */
export function invalidarCache(): void {
  cache = undefined;
}

export async function obtenerDatos(forzar = false): Promise<Datos> {
  if (!forzar && cache && Date.now() < cache.expira) return cache.datos;
  // Si ya hay una consulta corriendo, esperar esa en vez de abrir otra.
  if (enVuelo) return enVuelo;

  enVuelo = consultar()
    .then((datos) => {
      cache = { datos, expira: Date.now() + TTL_MS };
      return datos;
    })
    .finally(() => {
      enVuelo = undefined;
    });

  return enVuelo;
}
