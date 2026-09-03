import { db } from "./db";
import type { EstadoEntrega, Fecha, Grupo, TipoHabitacion, Turno } from "./types";

/**
 * Consultas de recepcion. NO pasan por el cache de queries.ts: el panel puede
 * permitirse cinco minutos de retraso, pero quien esta en el mesón necesita ver
 * la habitacion que se acaba de ocupar.
 *
 * Todas leen con el rol de solo lectura. Las escrituras viven en las Server
 * Actions de (recepcion)/acciones.ts.
 */

export type OpcionCatalogo = { id: number; nombre: string };

export type MotivoSalida = {
  id: number;
  codigo: string;
  nombre: string;
  solo_anticipada: boolean;
  exige_detalle: boolean;
  es_temporal: boolean;
};

export type TipoAusencia = {
  id: number;
  codigo: string;
  nombre: string;
  conserva_habitacion: boolean;
  exige_detalle: boolean;
};

export type Alojado = {
  estadia_id: number;
  hostal_codigo: string;
  habitacion: string | null;
  persona_id: number;
  persona: string;
  rut: string | null;
  empresa: string;
  folio: string | null;
  turno_habitual: Turno | null;
  fecha_ingreso: Fecha;
  fecha_salida_prevista: Fecha | null;
  numero_llave: string | null;
  numero_chip: string | null;
  noches: number;
  dias_de_atraso: number | null;
  ausencia_id: number | null;
  ausencia_tipo: string | null;
  ausencia_nombre: string | null;
  ausencia_hasta: Fecha | null;
  ausencia_conserva_habitacion: boolean | null;
};

export type HabitacionLibre = {
  id: number;
  numero: string;
  tipo: TipoHabitacion | null;
  capacidad: number;
  ocupantes: number;
};

export type PersonaConocida = {
  id: number;
  nombre: string;
  rut: string;
  celular: string | null;
  cargo_id: number | null;
  cargo: string | null;
  estadias_previas: number;
  /** Estadia abierta que impide un ingreso nuevo, si la hay. */
  estadia_abierta_id: number | null;
  estadia_abierta_hostal: string | null;
  estadia_abierta_desde: Fecha | null;
};

export type EstadiaEnCurso = {
  id: number;
  persona: string;
  rut: string | null;
  empresa: string;
  hostal_codigo: string;
  hostal_id: number;
  habitacion: string | null;
  folio: string | null;
  fecha_ingreso: Fecha;
  hora_ingreso: string | null;
  fecha_salida_prevista: Fecha | null;
  numero_llave: string | null;
  numero_chip: string | null;
  chip_devuelto: EstadoEntrega;
  turno_habitual: Turno | null;
  grupo: Grupo | null;
  noches: number;
  observaciones: string | null;
  ausencia_id: number | null;
  ausencia_nombre: string | null;
  ausencia_desde: Fecha | null;
};

/* ========================================================================== */

export async function catalogos() {
  const sql = db();

  const hostales = await sql<OpcionCatalogo[]>`
    SELECT id, codigo || ' - ' || nombre AS nombre
    FROM core.hostal WHERE activo ORDER BY codigo
  `;
  const empresas = await sql<OpcionCatalogo[]>`
    SELECT id, nombre FROM core.empresa WHERE activo ORDER BY nombre
  `;
  const cargos = await sql<OpcionCatalogo[]>`
    SELECT id, nombre FROM core.cargo ORDER BY nombre
  `;
  const motivos = await sql<MotivoSalida[]>`
    SELECT id, codigo, nombre, solo_anticipada, exige_detalle, es_temporal
    FROM core.motivo_salida WHERE activo ORDER BY orden, nombre
  `;
  const tiposAusencia = await sql<TipoAusencia[]>`
    SELECT id, codigo, nombre, conserva_habitacion, exige_detalle
    FROM core.tipo_ausencia WHERE activo ORDER BY orden, nombre
  `;

  return {
    hostales: [...hostales],
    empresas: [...empresas],
    cargos: [...cargos],
    motivos: [...motivos],
    tiposAusencia: [...tiposAusencia],
  };
}

/** Quien esta alojado ahora, ordenado como se recorre el hostal. */
export async function alojados(): Promise<Alojado[]> {
  const sql = db();
  const filas = await sql<Alojado[]>`
    SELECT estadia_id, hostal_codigo, habitacion, persona_id, persona, rut,
           empresa, folio, turno_habitual::text AS turno_habitual,
           to_char(fecha_ingreso,         'YYYY-MM-DD') AS fecha_ingreso,
           to_char(fecha_salida_prevista, 'YYYY-MM-DD') AS fecha_salida_prevista,
           numero_llave, numero_chip, noches, dias_de_atraso,
           ausencia_id, ausencia_tipo, ausencia_nombre,
           to_char(ausencia_hasta, 'YYYY-MM-DD') AS ausencia_hasta,
           ausencia_conserva_habitacion
    FROM rpt.vw_alojados
    ORDER BY hostal_codigo, habitacion NULLS LAST, persona
  `;
  return [...filas];
}

/**
 * Habitaciones del hostal con cuantos las ocupan hoy.
 *
 * Un huesped ausente sigue ocupando su cama salvo que la ausencia diga lo
 * contrario (conserva_habitacion = false). Esa distincion no existe en el Excel
 * y es justo la que evita darle la cama de alguien que esta de vacaciones.
 *
 * OJO con `capacidad`: hoy es el DEFAULT 2 en las 67 habitaciones porque el
 * Excel nunca trajo la real -lo denuncia rpt.vw_ocupacion_sobre_capacidad-. Por
 * eso la aplicacion avisa cuando se pasa, pero no lo impide.
 */
export async function habitacionesDe(hostalId: number): Promise<HabitacionLibre[]> {
  const sql = db();
  const filas = await sql<HabitacionLibre[]>`
    SELECT hab.id,
           hab.numero,
           hab.tipo::text AS tipo,
           hab.capacidad,
           count(e.id)::int AS ocupantes
    FROM core.habitacion hab
    LEFT JOIN core.estadia e
           ON e.habitacion_id = hab.id
          AND e.fecha_salida IS NULL
          AND e.origen = 'WEB'
          AND NOT EXISTS (
              SELECT 1 FROM core.estadia_ausencia a
               WHERE a.estadia_id = e.id
                 AND NOT a.conserva_habitacion
                 AND core.hoy() >= a.desde
                 AND core.hoy() <= COALESCE(a.hasta, 'infinity'::date))
    WHERE hab.hostal_id = ${hostalId} AND hab.activa
    GROUP BY hab.id, hab.numero, hab.tipo, hab.capacidad
    ORDER BY hab.numero
  `;
  return [...filas];
}

/**
 * Busca a alguien por RUT ya normalizado. Devuelve tambien si arrastra una
 * estadia abierta, para poder avisarlo antes de que rellene todo el formulario.
 */
export async function personaPorRut(
  rutNormalizado: string,
): Promise<PersonaConocida | null> {
  const sql = db();
  const filas = await sql<PersonaConocida[]>`
    SELECT p.id,
           p.nombre,
           p.rut_normalizado AS rut,
           p.celular,
           p.cargo_id,
           c.nombre AS cargo,
           (SELECT count(*)::int FROM core.estadia e WHERE e.persona_id = p.id) AS estadias_previas,
           ab.id                                    AS estadia_abierta_id,
           h.codigo                                 AS estadia_abierta_hostal,
           to_char(ab.fecha_ingreso, 'YYYY-MM-DD')  AS estadia_abierta_desde
    FROM core.persona p
    LEFT JOIN core.cargo c ON c.id = p.cargo_id
    LEFT JOIN LATERAL (
        SELECT e.id, e.fecha_ingreso, e.hostal_id
          FROM core.estadia e
         WHERE e.persona_id = p.id AND e.fecha_salida IS NULL
         ORDER BY e.origen DESC, e.fecha_ingreso DESC NULLS LAST
         LIMIT 1
    ) ab ON true
    LEFT JOIN core.hostal h ON h.id = ab.hostal_id
    WHERE p.rut_normalizado = ${rutNormalizado}
  `;
  return filas[0] ?? null;
}

/** La estadia que se va a cerrar o a la que se le registra una ausencia. */
export async function estadiaEnCurso(id: number): Promise<EstadiaEnCurso | null> {
  const sql = db();
  const filas = await sql<EstadiaEnCurso[]>`
    SELECT e.id,
           p.nombre                     AS persona,
           p.rut_normalizado            AS rut,
           em.nombre                    AS empresa,
           h.codigo                     AS hostal_codigo,
           e.hostal_id,
           hab.numero                   AS habitacion,
           e.folio,
           to_char(e.fecha_ingreso,         'YYYY-MM-DD') AS fecha_ingreso,
           to_char(e.hora_ingreso,          'HH24:MI')    AS hora_ingreso,
           to_char(e.fecha_salida_prevista, 'YYYY-MM-DD') AS fecha_salida_prevista,
           e.numero_llave,
           e.numero_chip,
           e.chip_devuelto::text        AS chip_devuelto,
           e.turno_habitual::text       AS turno_habitual,
           e.grupo::text                AS grupo,
           e.observaciones,
           (SELECT count(*)::int FROM core.estadia_noche n WHERE n.estadia_id = e.id) AS noches,
           a.id                         AS ausencia_id,
           ta.nombre                    AS ausencia_nombre,
           to_char(a.desde, 'YYYY-MM-DD') AS ausencia_desde
    FROM core.estadia e
    JOIN core.persona p  ON p.id  = e.persona_id
    JOIN core.empresa em ON em.id = e.empresa_id
    JOIN core.hostal  h  ON h.id  = e.hostal_id
    LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
    LEFT JOIN LATERAL (
        SELECT x.* FROM core.estadia_ausencia x
         WHERE x.estadia_id = e.id
           AND core.hoy() >= x.desde
           AND core.hoy() <= COALESCE(x.hasta, 'infinity'::date)
         ORDER BY x.desde DESC LIMIT 1
    ) a ON true
    LEFT JOIN core.tipo_ausencia ta ON ta.id = a.tipo_id
    WHERE e.id = ${id} AND e.fecha_salida IS NULL AND e.origen = 'WEB'
  `;
  return filas[0] ?? null;
}

/** Ocupantes actuales de una habitacion, para el mensaje de "ya esta ocupada". */
export async function ocupantesDe(habitacionId: number): Promise<
  { persona: string; fecha_ingreso: Fecha }[]
> {
  const sql = db();
  const filas = await sql<{ persona: string; fecha_ingreso: Fecha }[]>`
    SELECT p.nombre AS persona,
           to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso
    FROM core.estadia e
    JOIN core.persona p ON p.id = e.persona_id
    WHERE e.habitacion_id = ${habitacionId}
      AND e.fecha_salida IS NULL
      AND e.origen = 'WEB'
    ORDER BY e.fecha_ingreso
  `;
  return [...filas];
}
