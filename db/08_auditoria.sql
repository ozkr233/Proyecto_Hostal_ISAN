-- ===========================================================================
-- Esquema rpt: vistas de auditoria.
--
-- 06_vistas.sql reemplaza las formulas del Excel. Este archivo hace otra cosa:
-- expone los ERRORES que traen los libros, uno por vista, cada uno con las
-- filas concretas que lo causan.
--
-- Sirve para dos cosas:
--   1. Cualquiera puede re-verificar las cifras del informe sin creerle a nadie.
--   2. Es la linea base contra la que se mide el proyecto: estas vistas deben
--      quedar vacias al cierre de cada mes.
--
-- Todas son SELECT puros sobre core y staging. No modifican nada.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Ventana de vigencia de los libros cargados
-- ---------------------------------------------------------------------------
-- Varias vistas necesitan saber "que periodo dice cubrir esto". Se deduce de
-- las noches, que son la unica fuente de fechas que no se teclea suelta: salen
-- de la posicion de la celda en la matriz de R. OFICIAL, no de un campo libre.
--
-- ALMUERZOS ISAM se sale a proposito -cubre de febrero a julio-, por eso el
-- margen hacia atras es de seis meses y hacia adelante de ninguno.
CREATE OR REPLACE VIEW rpt.vw_ventana_libros AS
SELECT (min(fecha) - INTERVAL '6 months')::date AS desde,
       max(fecha)                               AS hasta
FROM core.estadia_noche;

COMMENT ON VIEW rpt.vw_ventana_libros IS
    'Periodo plausible de los libros cargados. Fuera de aqui, la fecha esta mal tecleada.';


-- ---------------------------------------------------------------------------
-- rpt.vw_noches_no_registradas
-- ---------------------------------------------------------------------------
-- EL HALLAZGO PRINCIPAL.
--
-- Compara, POR ARCHIVO y por dia, las noches que R. OFICIAL registra contra las
-- personas que la hoja diaria de ese mismo dia dice tener alojadas.
--
-- OJO CON LA LECTURA: el registro operativo real es analogo -hojas de ingreso y
-- facturas-; el Excel es el respaldo. Asi que una diferencia aqui NO prueba que
-- se dejo de cobrar: prueba que las dos hojas del respaldo se contradicen entre
-- si. Cual de las dos coincide con el papel hay que verificarlo contra el papel.
-- Que nadie pueda responder eso sin ir a buscar carpetas es el hallazgo.
--
-- La diferencia con rpt.vw_descuadre es el "por archivo": aquella suma los dos
-- libros y por eso el hueco de ISAM entre el 14 y el 20 de julio -40 noches en
-- un solo dia- queda tapado por el libro de ALMAR WATER, que esos dias cuadra.
CREATE OR REPLACE VIEW rpt.vw_noches_no_registradas AS
WITH oficial AS (
    SELECT e.origen_archivo AS archivo,
           n.fecha,
           count(*)         AS noches_registro_oficial
    FROM core.estadia_noche n
    JOIN core.estadia e ON e.id = n.estadia_id
    GROUP BY 1, 2
),
diaria AS (
    SELECT r.archivo_origen AS archivo,
           r.fecha_hoja     AS fecha,
           count(*)         AS alojados_hoja_diaria
    FROM staging.registro_crudo r
    WHERE r.bloque = 'INGRESO'
      AND r.nombre IS NOT NULL
      AND btrim(r.nombre) <> ''
      AND r.fecha_hoja IS NOT NULL
    GROUP BY 1, 2
)
SELECT
    COALESCE(o.archivo, d.archivo)                  AS archivo,
    COALESCE(o.fecha,   d.fecha)                    AS fecha,
    COALESCE(o.noches_registro_oficial, 0)          AS noches_registro_oficial,
    COALESCE(d.alojados_hoja_diaria,    0)          AS alojados_hoja_diaria,
    COALESCE(d.alojados_hoja_diaria, 0)
      - COALESCE(o.noches_registro_oficial, 0)      AS noches_sin_registrar
FROM oficial o
FULL JOIN diaria d ON d.archivo = o.archivo AND d.fecha = o.fecha;

COMMENT ON VIEW rpt.vw_noches_no_registradas IS
    'Por archivo y dia: alojados segun la hoja diaria menos noches en R. OFICIAL. Positivo = el respaldo digital se contradice; contrastar con la hoja de ingreso.';


-- ---------------------------------------------------------------------------
-- rpt.vw_estadias_sin_noche
-- ---------------------------------------------------------------------------
-- La misma divergencia vista por estadia en vez de por dia: alguien registrado
-- entrando al hostal que no tiene ni una sola noche en R. OFICIAL.
CREATE OR REPLACE VIEW rpt.vw_estadias_sin_noche AS
SELECT
    e.id            AS estadia_id,
    p.nombre        AS persona,
    p.rut_normalizado AS rut,
    em.nombre       AS empresa,
    h.codigo        AS hostal,
    e.fecha_ingreso,
    e.fecha_salida,
    e.nota_revision,
    e.origen_archivo,
    e.origen_hoja,
    e.origen_fila
FROM core.estadia e
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.empresa em ON em.id = e.empresa_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
WHERE NOT EXISTS (
    SELECT 1 FROM core.estadia_noche n WHERE n.estadia_id = e.id
);

COMMENT ON VIEW rpt.vw_estadias_sin_noche IS
    'Estadias registradas en la hoja diaria que no tienen ninguna noche en R. OFICIAL.';


-- ---------------------------------------------------------------------------
-- rpt.vw_personas_duplicadas
-- ---------------------------------------------------------------------------
-- La misma persona cargada varias veces porque el RUT se tecleo distinto -o no
-- se tecleo-. El nombre normalizado es lo unico estable entre las copias.
--
-- No decide cual es la buena: eso lo tiene que resolver una persona mirando el
-- RUT real. Solo muestra el grupo completo para que la decision sea de un vistazo.
CREATE OR REPLACE VIEW rpt.vw_personas_duplicadas AS
SELECT
    core.norm_texto(p.nombre)                                       AS nombre_normalizado,
    count(*)                                                        AS copias,
    count(*) - 1                                                    AS registros_sobrantes,
    count(*) FILTER (WHERE p.rut_normalizado IS NULL)               AS sin_rut,
    count(*) FILTER (WHERE p.rut_normalizado IS NOT NULL
                       AND NOT p.rut_valido)                        AS rut_invalido,
    array_agg(p.id ORDER BY p.id)                                   AS persona_ids,
    array_agg(COALESCE(p.rut_normalizado, '(sin RUT)')
              ORDER BY p.id)                                        AS ruts,
    (SELECT count(*) FROM core.estadia e
      WHERE e.persona_id = ANY(array_agg(p.id)))                    AS estadias_afectadas
FROM core.persona p
GROUP BY 1
HAVING count(*) > 1;

COMMENT ON VIEW rpt.vw_personas_duplicadas IS
    'Grupos de personas con el mismo nombre y distinto RUT: la misma persona cargada varias veces.';


-- ---------------------------------------------------------------------------
-- rpt.vw_doble_alojamiento
-- ---------------------------------------------------------------------------
-- Consecuencia medible de lo anterior: la misma persona figura alojada dos
-- veces la misma noche, casi siempre en dos hostales a la vez. Una de las dos
-- filas esta mal, o se esta cobrando dos veces la misma cama.
CREATE OR REPLACE VIEW rpt.vw_doble_alojamiento AS
SELECT
    core.norm_texto(p.nombre)                       AS persona,
    n.fecha,
    count(*)                                        AS veces,
    array_agg(DISTINCT h.codigo)                    AS hostales,
    array_agg(DISTINCT em.nombre)                   AS empresas,
    array_agg(DISTINCT p.id)                        AS persona_ids,
    array_agg(e.id ORDER BY e.id)                   AS estadia_ids
FROM core.estadia_noche n
JOIN core.estadia e  ON e.id  = n.estadia_id
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
JOIN core.empresa em ON em.id = e.empresa_id
GROUP BY 1, 2
HAVING count(*) > 1;

COMMENT ON VIEW rpt.vw_doble_alojamiento IS
    'Misma persona alojada dos veces la misma noche. Doble cobro, o un hostal mal anotado.';


-- ---------------------------------------------------------------------------
-- rpt.vw_identidad_incompleta
-- ---------------------------------------------------------------------------
-- El registro de huespedes tiene que identificar a la persona. Estas no lo hacen.
CREATE OR REPLACE VIEW rpt.vw_identidad_incompleta AS
SELECT
    p.id            AS persona_id,
    p.nombre,
    p.rut_normalizado AS rut,
    p.celular,
    CASE
        WHEN p.rut_normalizado IS NULL THEN 'sin RUT'
        ELSE 'RUT no pasa el modulo 11'
    END             AS motivo,
    (SELECT count(*) FROM core.estadia   e WHERE e.persona_id = p.id) AS estadias,
    (SELECT count(*) FROM core.estadia   e
       JOIN core.estadia_noche n ON n.estadia_id = e.id
      WHERE e.persona_id = p.id)                                      AS noches
FROM core.persona p
WHERE p.rut_normalizado IS NULL
   OR NOT p.rut_valido;

COMMENT ON VIEW rpt.vw_identidad_incompleta IS
    'Personas sin RUT o con RUT invalido, con cuantas noches arrastran.';


-- ---------------------------------------------------------------------------
-- rpt.vw_fechas_imposibles
-- ---------------------------------------------------------------------------
-- Anos y meses mal tecleados en la celda de origen. El ETL carga la fecha que
-- trae el libro sin corregirla -es lo correcto: no puede adivinar-, asi que
-- salen aqui. Contaminan la facturacion creando meses que nadie va a cobrar.
CREATE OR REPLACE VIEW rpt.vw_fechas_imposibles AS
WITH v AS (SELECT desde, hasta FROM rpt.vw_ventana_libros)
SELECT
    'estadia'::text                 AS entidad,
    e.id                            AS id,
    p.nombre                        AS persona,
    em.nombre                       AS empresa,
    e.fecha_salida                  AS fecha_fuera_de_rango,
    'fecha de salida'::text         AS campo,
    e.origen_archivo,
    e.origen_hoja,
    e.origen_fila
FROM core.estadia e
CROSS JOIN v
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.empresa em ON em.id = e.empresa_id
WHERE e.fecha_salida IS NOT NULL
  AND (e.fecha_salida < v.desde OR e.fecha_salida > v.hasta)

UNION ALL

SELECT
    'servicio',
    s.id,
    p.nombre,
    em.nombre,
    s.fecha,
    'fecha del servicio: ' || s.tipo_servicio::text,
    s.origen_archivo,
    s.origen_hoja,
    NULL
FROM core.servicio_consumo s
CROSS JOIN v
LEFT JOIN core.persona p  ON p.id  = s.persona_id
LEFT JOIN core.empresa em ON em.id = s.empresa_id
WHERE s.fecha < v.desde OR s.fecha > v.hasta;

COMMENT ON VIEW rpt.vw_fechas_imposibles IS
    'Estadias y servicios con fecha fuera del periodo que los libros dicen cubrir.';


-- ---------------------------------------------------------------------------
-- rpt.vw_empresa_contradictoria
-- ---------------------------------------------------------------------------
-- La empresa es a quien se factura. Cuando el registro oficial y la hoja diaria
-- del MISMO libro dicen empresas distintas para la misma persona, la base de
-- cobro por empresa no es confiable.
--
-- El caso real: el REGISTRO OFICIAL de ALMAR WATER escribe una sola empresa en
-- sus 953 filas, mientras sus hojas diarias distinguen cuatro.
CREATE OR REPLACE VIEW rpt.vw_empresa_contradictoria AS
WITH oficial AS (
    SELECT DISTINCT
           ro.archivo_origen                    AS archivo,
           core.norm_texto(ro.nombre)           AS persona,
           core.norm_texto(ro.empresa)          AS empresa_registro_oficial
    FROM staging.registro_oficial_crudo ro
    WHERE ro.nombre IS NOT NULL AND ro.empresa IS NOT NULL
),
diaria AS (
    SELECT DISTINCT
           r.archivo_origen                     AS archivo,
           core.norm_texto(r.nombre)            AS persona,
           core.norm_texto(r.empresa)           AS empresa_hoja_diaria
    FROM staging.registro_crudo r
    WHERE r.bloque = 'INGRESO'
      AND r.nombre IS NOT NULL AND r.empresa IS NOT NULL
)
SELECT
    o.archivo,
    o.persona,
    o.empresa_registro_oficial,
    d.empresa_hoja_diaria
FROM oficial o
JOIN diaria d ON d.archivo = o.archivo AND d.persona = o.persona
-- Los alias no son contradiccion: 'ALMAR SUBT.' y 'ALMARSUBT' son la misma
-- empresa. Solo interesa cuando resuelven a empresas distintas de verdad.
WHERE COALESCE((SELECT a.empresa_id FROM core.empresa_alias a
                 WHERE core.norm_texto(a.alias) = o.empresa_registro_oficial), -1)
   <> COALESCE((SELECT a.empresa_id FROM core.empresa_alias a
                 WHERE core.norm_texto(a.alias) = d.empresa_hoja_diaria), -2);

COMMENT ON VIEW rpt.vw_empresa_contradictoria IS
    'Personas cuya empresa en el registro oficial no coincide con la de la hoja diaria del mismo libro.';


-- ---------------------------------------------------------------------------
-- rpt.vw_estadias_abiertas
-- ---------------------------------------------------------------------------
-- Estadias sin salida registrada. Distingue las que siguen vigentes de las que
-- son claramente un olvido: si el libro ya cerro el mes y la persona nunca
-- salio, la salida no se anoto.
CREATE OR REPLACE VIEW rpt.vw_estadias_abiertas AS
SELECT
    e.id            AS estadia_id,
    p.nombre        AS persona,
    em.nombre       AS empresa,
    h.codigo        AS hostal,
    e.fecha_ingreso,
    (SELECT max(n.fecha) FROM core.estadia_noche n WHERE n.estadia_id = e.id) AS ultima_noche,
    (SELECT hasta FROM rpt.vw_ventana_libros)
      - (SELECT max(n.fecha) FROM core.estadia_noche n WHERE n.estadia_id = e.id)
                    AS dias_desde_la_ultima_noche,
    e.origen_archivo,
    e.origen_hoja
FROM core.estadia e
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.empresa em ON em.id = e.empresa_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
WHERE e.fecha_salida IS NULL;

COMMENT ON VIEW rpt.vw_estadias_abiertas IS
    'Estadias sin fecha de salida. Cuantos dias pasaron desde su ultima noche registrada.';


-- ---------------------------------------------------------------------------
-- rpt.vw_activos_no_devueltos
-- ---------------------------------------------------------------------------
-- Chips y llaves que salieron y no volvieron. Costo directo de reposicion y,
-- en el caso del chip, un control de acceso que sigue vivo.
CREATE OR REPLACE VIEW rpt.vw_activos_no_devueltos AS
SELECT
    e.id            AS estadia_id,
    p.nombre        AS persona,
    em.nombre       AS empresa,
    h.codigo        AS hostal,
    hab.numero      AS habitacion,
    e.fecha_salida,
    e.chip_devuelto,
    e.llaves_devueltas
FROM core.estadia e
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.empresa em ON em.id = e.empresa_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
WHERE e.chip_devuelto    = 'NO_ENTREGADA'
   OR e.llaves_devueltas = 'NO_ENTREGADA';

COMMENT ON VIEW rpt.vw_activos_no_devueltos IS
    'Estadias que terminaron sin devolver el chip o las llaves.';


-- ---------------------------------------------------------------------------
-- rpt.vw_sabanas_pendientes
-- ---------------------------------------------------------------------------
-- Estadias largas sin ningun cambio de sabanas anotado. O no se hizo, o no se
-- registro: en ambos casos no hay como demostrarlo ante el mandante.
CREATE OR REPLACE VIEW rpt.vw_sabanas_pendientes AS
SELECT
    e.id            AS estadia_id,
    p.nombre        AS persona,
    em.nombre       AS empresa,
    h.codigo        AS hostal,
    count(*)                                          AS noches,
    count(*) FILTER (WHERE n.cambio_sabanas)          AS cambios_registrados,
    min(n.fecha)                                      AS primera_noche,
    max(n.fecha)                                      AS ultima_noche
FROM core.estadia e
JOIN core.estadia_noche n ON n.estadia_id = e.id
JOIN core.persona p  ON p.id  = e.persona_id
JOIN core.empresa em ON em.id = e.empresa_id
JOIN core.hostal  h  ON h.id  = e.hostal_id
GROUP BY e.id, p.nombre, em.nombre, h.codigo
HAVING count(*) >= 7 AND count(*) FILTER (WHERE n.cambio_sabanas) = 0;

COMMENT ON VIEW rpt.vw_sabanas_pendientes IS
    'Estadias de 7 noches o mas sin ningun cambio de sabanas registrado.';


-- ---------------------------------------------------------------------------
-- rpt.vw_ocupacion_sobre_capacidad
-- ---------------------------------------------------------------------------
-- Habitaciones con mas ocupantes que su capacidad en una misma noche.
--
-- ADVERTENCIA: hoy core.habitacion.capacidad es el DEFAULT 2 en las 67
-- habitaciones, porque el Excel nunca trajo la capacidad real. Mientras eso no
-- se cargue, esta vista NO prueba hacinamiento: prueba que hay que cargar la
-- capacidad. Que el dato no exista en ninguna parte ya es el hallazgo.
CREATE OR REPLACE VIEW rpt.vw_ocupacion_sobre_capacidad AS
SELECT
    h.codigo        AS hostal,
    hab.numero      AS habitacion,
    hab.capacidad,
    n.fecha,
    count(*)                            AS ocupantes,
    array_agg(p.nombre ORDER BY p.nombre) AS personas
FROM core.estadia_noche n
JOIN core.estadia    e   ON e.id   = n.estadia_id
JOIN core.habitacion hab ON hab.id = e.habitacion_id
JOIN core.hostal     h   ON h.id   = hab.hostal_id
JOIN core.persona    p   ON p.id   = e.persona_id
GROUP BY h.codigo, hab.numero, hab.capacidad, n.fecha
HAVING count(*) > hab.capacidad;

COMMENT ON VIEW rpt.vw_ocupacion_sobre_capacidad IS
    'Noches con mas ocupantes que la capacidad declarada. Ojo: la capacidad es hoy un valor por defecto, no un dato.';


-- ---------------------------------------------------------------------------
-- rpt.vw_auditoria_resumen
-- ---------------------------------------------------------------------------
-- Una fila por hallazgo. Es el tablero: al cierre de cada mes, todas las
-- cantidades deberian ser 0.
CREATE OR REPLACE VIEW rpt.vw_auditoria_resumen AS
SELECT 1 AS orden, 'Persona-noches alojadas que R. OFICIAL no recoge'::text AS hallazgo,
       COALESCE(sum(noches_sin_registrar), 0)::bigint AS cantidad,
       'facturacion'::text AS ambito
  FROM rpt.vw_noches_no_registradas WHERE noches_sin_registrar > 0
UNION ALL
SELECT 2, 'Estadias sin ninguna noche en el registro oficial',
       count(*), 'facturacion' FROM rpt.vw_estadias_sin_noche
UNION ALL
SELECT 3, 'Registros de persona sobrantes por duplicacion',
       COALESCE(sum(registros_sobrantes), 0)::bigint, 'identidad' FROM rpt.vw_personas_duplicadas
UNION ALL
SELECT 4, 'Persona-noches con doble alojamiento simultaneo',
       count(*), 'facturacion' FROM rpt.vw_doble_alojamiento
UNION ALL
SELECT 5, 'Personas sin RUT valido',
       count(*), 'identidad' FROM rpt.vw_identidad_incompleta
UNION ALL
SELECT 6, 'Fechas fuera del periodo de los libros',
       count(*), 'integridad' FROM rpt.vw_fechas_imposibles
UNION ALL
SELECT 7, 'Personas con empresa contradictoria entre hojas',
       count(*), 'facturacion' FROM rpt.vw_empresa_contradictoria
UNION ALL
SELECT 8, 'Estadias sin fecha de salida',
       count(*), 'operacion' FROM rpt.vw_estadias_abiertas
UNION ALL
SELECT 9, 'Estadias con chip o llaves sin devolver',
       count(*), 'operacion' FROM rpt.vw_activos_no_devueltos
UNION ALL
SELECT 10, 'Estadias largas sin cambio de sabanas registrado',
       count(*), 'cumplimiento' FROM rpt.vw_sabanas_pendientes
UNION ALL
SELECT 11, 'Noches sobre la capacidad declarada de la habitacion',
       count(*), 'cumplimiento' FROM rpt.vw_ocupacion_sobre_capacidad
UNION ALL
SELECT 12, 'Filas que no se pudieron cargar',
       count(*), 'integridad' FROM staging.rechazo;

COMMENT ON VIEW rpt.vw_auditoria_resumen IS
    'Tablero de auditoria: una fila por hallazgo. Al cierre de mes deberian ser todas 0.';
