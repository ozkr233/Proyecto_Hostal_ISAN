-- ===========================================================================
-- Esquema rpt: reemplaza las formulas mantenidas a mano en el Excel.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- rpt.vw_registro_oficial
-- ---------------------------------------------------------------------------
-- Reproduce la hoja R. OFICIAL: una fila por estadia, una columna por dia del
-- mes con la marca D/N/E, y el total de noches CALCULADO.
--
-- En el Excel la columna N es =COUNTA(O3:AS3), escrita a mano fila por fila y
-- por eso desincronizada. Aqui total_noches es un count() sobre los mismos
-- datos que se muestran, asi que no puede descuadrar.
CREATE VIEW rpt.vw_registro_oficial AS
SELECT
    date_trunc('month', n.fecha)::date         AS mes,
    e.id                                       AS estadia_id,
    e.tipo_habitacion,
    h.codigo                                   AS hostal_codigo,
    em.nombre                                  AS empresa,
    e.folio,
    hab.numero                                 AS habitacion,
    p.nombre,
    p.rut_normalizado                          AS rut,
    c.nombre                                   AS cargo,
    e.observaciones,
    e.usa_estacionamiento,
    e.patente_vehiculo,
    count(*)                                   AS total_noches,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  1) AS dia_01,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  2) AS dia_02,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  3) AS dia_03,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  4) AS dia_04,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  5) AS dia_05,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  6) AS dia_06,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  7) AS dia_07,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  8) AS dia_08,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) =  9) AS dia_09,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 10) AS dia_10,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 11) AS dia_11,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 12) AS dia_12,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 13) AS dia_13,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 14) AS dia_14,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 15) AS dia_15,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 16) AS dia_16,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 17) AS dia_17,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 18) AS dia_18,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 19) AS dia_19,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 20) AS dia_20,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 21) AS dia_21,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 22) AS dia_22,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 23) AS dia_23,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 24) AS dia_24,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 25) AS dia_25,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 26) AS dia_26,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 27) AS dia_27,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 28) AS dia_28,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 29) AS dia_29,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 30) AS dia_30,
    max(n.turno::text) FILTER (WHERE extract(day FROM n.fecha) = 31) AS dia_31
FROM core.estadia_noche n
JOIN core.estadia   e   ON e.id  = n.estadia_id
JOIN core.persona   p   ON p.id  = e.persona_id
JOIN core.empresa   em  ON em.id = e.empresa_id
JOIN core.hostal    h   ON h.id  = e.hostal_id
LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
LEFT JOIN core.cargo      c   ON c.id   = p.cargo_id
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13;

-- ---------------------------------------------------------------------------
-- rpt.vw_ocupacion_diaria
-- ---------------------------------------------------------------------------
-- Noches por fecha, hostal y empresa. Equivale al bloque M171:AS183 de
-- R. OFICIAL (los COUNTIFS por empresa), pero siempre cuadrado por construccion.
CREATE VIEW rpt.vw_ocupacion_diaria AS
SELECT
    n.fecha,
    h.codigo   AS hostal_codigo,
    em.nombre  AS empresa,
    count(*)   AS noches,
    count(*) FILTER (WHERE n.turno = 'D') AS noches_dia,
    count(*) FILTER (WHERE n.turno = 'N') AS noches_noche,
    count(*) FILTER (WHERE n.turno = 'E') AS noches_especial
FROM core.estadia_noche n
JOIN core.estadia e  ON e.id  = n.estadia_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
JOIN core.empresa em ON em.id = e.empresa_id
GROUP BY 1, 2, 3;

-- ---------------------------------------------------------------------------
-- rpt.vw_pension_diaria
-- ---------------------------------------------------------------------------
-- Desayunos / almuerzos / cenas / colaciones por fecha, hostal y empresa.
-- Equivale al bloque K76:T82 que cada hoja diaria calcula con COUNTA.
CREATE VIEW rpt.vw_pension_diaria AS
SELECT
    s.fecha,
    h.codigo  AS hostal_codigo,
    em.nombre AS empresa,
    s.tipo_servicio,
    s.es_extra,
    sum(s.cantidad)::bigint AS cantidad
FROM core.servicio_consumo s
JOIN core.hostal h       ON h.id  = s.hostal_id
LEFT JOIN core.empresa em ON em.id = s.empresa_id
GROUP BY 1, 2, 3, 4, 5;

-- Misma informacion en formato ancho, como se ve en la hoja diaria.
CREATE VIEW rpt.vw_pension_diaria_ancha AS
SELECT
    s.fecha,
    h.codigo  AS hostal_codigo,
    sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'DESAYUNO')          AS desayunos,
    sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'ALMUERZO')          AS almuerzos,
    sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'CENA')              AS cenas,
    sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'COLACION_NORMAL')   AS colacion_normal,
    sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'COLACION_ESPECIAL') AS colacion_especial
FROM core.servicio_consumo s
JOIN core.hostal h ON h.id = s.hostal_id
GROUP BY 1, 2;

-- ---------------------------------------------------------------------------
-- rpt.vw_facturacion_empresa_mes
-- ---------------------------------------------------------------------------
-- Base de cobro: noches y servicios consumidos por empresa y mes.
CREATE VIEW rpt.vw_facturacion_empresa_mes AS
WITH noches AS (
    SELECT date_trunc('month', n.fecha)::date AS mes,
           e.empresa_id,
           e.hostal_id,
           count(*) AS noches
    FROM core.estadia_noche n
    JOIN core.estadia e ON e.id = n.estadia_id
    GROUP BY 1, 2, 3
),
servicios AS (
    SELECT date_trunc('month', s.fecha)::date AS mes,
           s.empresa_id,
           s.hostal_id,
           sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'DESAYUNO')          AS desayunos,
           sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'ALMUERZO')          AS almuerzos,
           sum(s.cantidad) FILTER (WHERE s.tipo_servicio = 'CENA')              AS cenas,
           sum(s.cantidad) FILTER (WHERE s.tipo_servicio IN ('COLACION_NORMAL','COLACION_ESPECIAL')) AS colaciones,
           sum(s.cantidad) FILTER (WHERE s.es_extra)                            AS servicios_extra
    FROM core.servicio_consumo s
    GROUP BY 1, 2, 3
)
SELECT
    COALESCE(n.mes, sv.mes)                         AS mes,
    em.nombre                                       AS empresa,
    h.codigo                                        AS hostal_codigo,
    COALESCE(n.noches, 0)                           AS noches,
    COALESCE(sv.desayunos, 0)                       AS desayunos,
    COALESCE(sv.almuerzos, 0)                       AS almuerzos,
    COALESCE(sv.cenas, 0)                           AS cenas,
    COALESCE(sv.colaciones, 0)                      AS colaciones,
    COALESCE(sv.servicios_extra, 0)                 AS servicios_extra
FROM noches n
FULL JOIN servicios sv
       ON sv.mes = n.mes AND sv.empresa_id = n.empresa_id AND sv.hostal_id = n.hostal_id
JOIN core.empresa em ON em.id = COALESCE(n.empresa_id, sv.empresa_id)
JOIN core.hostal  h  ON h.id  = COALESCE(n.hostal_id,  sv.hostal_id);

-- ---------------------------------------------------------------------------
-- rpt.vw_ocupacion_actual
-- ---------------------------------------------------------------------------
-- Quien esta alojado hoy y en que habitacion.
CREATE VIEW rpt.vw_ocupacion_actual AS
SELECT
    h.codigo   AS hostal_codigo,
    hab.numero AS habitacion,
    hab.tipo   AS tipo_habitacion,
    p.nombre,
    p.rut_normalizado AS rut,
    em.nombre  AS empresa,
    e.folio,
    e.fecha_ingreso,
    current_date - e.fecha_ingreso AS dias_alojado,
    e.id       AS estadia_id
FROM core.estadia e
JOIN core.persona p       ON p.id  = e.persona_id
JOIN core.empresa em      ON em.id = e.empresa_id
JOIN core.hostal  h       ON h.id  = e.hostal_id
LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
WHERE e.fecha_salida IS NULL;

-- ---------------------------------------------------------------------------
-- rpt.vw_descuadre
-- ---------------------------------------------------------------------------
-- Compara las noches promovidas a core (que vienen de R. OFICIAL) contra las
-- filas de ingreso que el Excel registro en cada hoja diaria.
--
-- Esto hace explicito el descuadre que en el Excel esta escondido en la fila
-- 168 de R. OFICIAL, con valores como -40 y -37 entre el 14 y el 20 de julio.
CREATE VIEW rpt.vw_descuadre AS
WITH desde_core AS (
    SELECT n.fecha, count(*) AS noches_core
    FROM core.estadia_noche n
    GROUP BY 1
),
desde_hoja AS (
    SELECT r.fecha_hoja AS fecha, count(*) AS filas_hoja
    FROM staging.registro_crudo r
    WHERE r.bloque = 'INGRESO'
      AND r.nombre IS NOT NULL
      AND btrim(r.nombre) <> ''
      AND r.fecha_hoja IS NOT NULL
    GROUP BY 1
)
SELECT
    COALESCE(c.fecha, d.fecha)                              AS fecha,
    COALESCE(c.noches_core, 0)                              AS noches_core,
    COALESCE(d.filas_hoja, 0)                               AS filas_hoja_diaria,
    COALESCE(c.noches_core, 0) - COALESCE(d.filas_hoja, 0)  AS diferencia
FROM desde_core c
FULL JOIN desde_hoja d ON d.fecha = c.fecha;

-- ---------------------------------------------------------------------------
-- rpt.vw_calidad_datos
-- ---------------------------------------------------------------------------
-- Tablero de salud de la carga: lo que quedo marcado para revision humana.
CREATE VIEW rpt.vw_calidad_datos AS
SELECT 'personas sin RUT'          AS indicador, count(*) AS cantidad FROM core.persona WHERE rut_normalizado IS NULL
UNION ALL
SELECT 'personas con RUT invalido', count(*) FROM core.persona WHERE rut_normalizado IS NOT NULL AND NOT rut_valido
UNION ALL
SELECT 'estadias sin fecha de ingreso', count(*) FROM core.estadia WHERE fecha_ingreso IS NULL
UNION ALL
SELECT 'estadias sin fecha de salida', count(*) FROM core.estadia WHERE fecha_salida IS NULL
UNION ALL
SELECT 'estadias marcadas para revision', count(*) FROM core.estadia WHERE requiere_revision
UNION ALL
SELECT 'estadias sin habitacion asignada', count(*) FROM core.estadia WHERE habitacion_id IS NULL
UNION ALL
SELECT 'filas rechazadas en la carga', count(*) FROM staging.rechazo;
