-- ===========================================================================
-- Captura por web: usuarios, catalogos, ausencias y noches automaticas.
--
-- Hasta 08 el modelo era de solo lectura: lo llenaba el ETL desde los Excel.
-- Este archivo agrega lo que hace falta para que un recepcionista escriba
-- directo en core, sin pasar por el libro.
--
-- Se ejecuta sobre una base QUE YA TIENE DATOS -local y Supabase-, asi que
-- todo va con IF NOT EXISTS o dentro de un bloque que ignora el duplicado.
-- Correrlo dos veces no debe cambiar nada.
--
-- REGLA TRANSVERSAL: las restricciones nuevas se acotan a origen = 'WEB'.
-- Las ~1.000 filas que vinieron del Excel son sucias a proposito -sostienen
-- las vistas de auditoria de 08- y no se pueden invalidar retroactivamente.
-- ===========================================================================

-- btree_gist puede quedar en public (Docker) o en extensions (Supabase); el
-- EXCLUDE de core.estadia_ausencia necesita su opclass en el search_path.
SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
DO $bloque$ BEGIN
    CREATE TYPE core.rol_usuario AS ENUM ('RECEPCION', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

-- Separa lo capturado en la web de lo importado del Excel. El DEFAULT es
-- 'ETL_EXCEL' a proposito: asi el ETL sigue funcionando sin tocar una linea,
-- y es la web -codigo nuevo- la que escribe 'WEB' explicito.
DO $bloque$ BEGIN
    CREATE TYPE core.origen_registro AS ENUM ('ETL_EXCEL', 'WEB');
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;


-- ---------------------------------------------------------------------------
-- core.hoy()
-- ---------------------------------------------------------------------------
-- El servidor corre en UTC -tanto el contenedor como Supabase- y el hostal esta
-- en Chile. Con current_date, cualquier ingreso registrado despues de las 20:00
-- hora local ya cae en el dia siguiente y la ocupacion queda corrida un dia.
-- Es el mismo error que dashboard/src/lib/types.ts evita en el otro extremo.
--
-- STABLE, no IMMUTABLE: depende de la hora, y ademas de las reglas de horario
-- de verano, que cambian.
CREATE OR REPLACE FUNCTION core.hoy()
RETURNS date
LANGUAGE sql
STABLE
AS $funcion$
    SELECT (now() AT TIME ZONE 'America/Santiago')::date
$funcion$;

COMMENT ON FUNCTION core.hoy IS
    'La fecha de HOY en Chile, no en UTC. Usar siempre en vez de current_date.';


-- ---------------------------------------------------------------------------
-- Catalogos de motivos
-- ---------------------------------------------------------------------------
-- Tablas, no ENUM. Un enum tambien seria un selector, pero queda clavado en el
-- tipo: agregar un motivo exigiria ALTER TYPE y un despliegue, y un valor mal
-- puesto no se puede quitar nunca. Como tabla, las opciones son filas: un ADMIN
-- las agrega, reordena y desactiva desde la aplicacion, y la clave foranea
-- garantiza la integridad igual que un enum.
--
-- Ninguna se borra jamas: se marca activo = false. Asi el selector deja de
-- ofrecerla y los registros historicos conservan su motivo.

CREATE TABLE IF NOT EXISTS core.motivo_salida (
    id              smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo          text     NOT NULL UNIQUE,   -- estable, lo usa el codigo
    nombre          text     NOT NULL,          -- lo que ve el recepcionista
    -- Solo tiene sentido cuando la salida ocurre antes de la prevista.
    solo_anticipada boolean  NOT NULL DEFAULT false,
    exige_detalle   boolean  NOT NULL DEFAULT false,
    -- El trabajador vuelve: esto deberia registrarse como ausencia, no como
    -- salida. El formulario lo propone en vez de bloquearlo.
    es_temporal     boolean  NOT NULL DEFAULT false,
    orden           smallint NOT NULL DEFAULT 100,
    activo          boolean  NOT NULL DEFAULT true
);

COMMENT ON TABLE core.motivo_salida IS
    'Catalogo del motivo de salida. Reemplaza el texto libre de core.estadia.motivo_salida.';

CREATE TABLE IF NOT EXISTS core.tipo_ausencia (
    id                  smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo              text     NOT NULL UNIQUE,
    nombre              text     NOT NULL,
    -- Valor por defecto del "le guardamos la habitacion?" del formulario:
    -- unas vacaciones la conservan, un traslado a campamento normalmente no.
    conserva_habitacion boolean  NOT NULL DEFAULT true,
    exige_detalle       boolean  NOT NULL DEFAULT false,
    orden               smallint NOT NULL DEFAULT 100,
    activo              boolean  NOT NULL DEFAULT true
);

COMMENT ON TABLE core.tipo_ausencia IS
    'Catalogo de permisos, vacaciones y licencias. Reemplaza las filas 97-99 de R. OFICIAL, que estaban tecleadas a mano.';


-- ---------------------------------------------------------------------------
-- core.usuario
-- ---------------------------------------------------------------------------
-- clave_hash usa el mismo formato "sal:derivada" de dashboard/src/lib/password.ts
-- (scrypt), generable con dashboard/scripts/hash.mjs.
CREATE TABLE IF NOT EXISTS core.usuario (
    id            smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario       text     NOT NULL,
    nombre        text     NOT NULL,
    clave_hash    text     NOT NULL,
    rol           core.rol_usuario NOT NULL DEFAULT 'RECEPCION',
    -- Hostal que el formulario de ingreso trae preseleccionado.
    hostal_id     smallint REFERENCES core.hostal(id),
    activo        boolean  NOT NULL DEFAULT true,
    creado_en     timestamptz NOT NULL DEFAULT now(),
    ultimo_acceso timestamptz,
    CONSTRAINT usuario_login_no_vacio CHECK (btrim(usuario) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS usuario_login_uk ON core.usuario (lower(usuario));


-- ---------------------------------------------------------------------------
-- Columnas nuevas de core.estadia
-- ---------------------------------------------------------------------------
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS origen core.origen_registro NOT NULL DEFAULT 'ETL_EXCEL';

-- Sin esto, "finalizo su estadia antes" no es computable.
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS fecha_salida_prevista date;

-- D/N/E que se copia a cada noche generada. Sin el, las filas capturadas en la
-- web saldrian en blanco en rpt.vw_registro_oficial.
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS turno_habitual core.turno_marca;

ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS motivo_salida_id smallint REFERENCES core.motivo_salida(id);

-- Complemento del motivo, nunca su reemplazo. La columna motivo_salida (texto)
-- queda CONGELADA como archivo historico del Excel: la web no le escribe nunca.
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS motivo_salida_detalle text;

-- Cual llave y cual chip se entregaron. Hoy solo se sabe si volvieron.
ALTER TABLE core.estadia ADD COLUMN IF NOT EXISTS numero_llave text;
ALTER TABLE core.estadia ADD COLUMN IF NOT EXISTS numero_chip  text;

-- La FECHA de devolucion, no solo el estado.
ALTER TABLE core.estadia ADD COLUMN IF NOT EXISTS llaves_devueltas_en date;
ALTER TABLE core.estadia ADD COLUMN IF NOT EXISTS chip_devuelto_en    date;

ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS registrado_por smallint REFERENCES core.usuario(id);
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS salida_registrada_por smallint REFERENCES core.usuario(id);

-- Derivada, nunca tecleada: asi no puede contradecir a las fechas.
ALTER TABLE core.estadia
    ADD COLUMN IF NOT EXISTS salida_anticipada boolean
    GENERATED ALWAYS AS (
        fecha_salida IS NOT NULL
        AND fecha_salida_prevista IS NOT NULL
        AND fecha_salida < fecha_salida_prevista
    ) STORED;

COMMENT ON COLUMN core.estadia.motivo_salida IS
    'Texto libre heredado del Excel. Congelado: la captura web usa motivo_salida_id.';
COMMENT ON COLUMN core.estadia.origen IS
    'ETL_EXCEL = importado de los libros. WEB = capturado en recepcion, sujeto a las restricciones estrictas.';


-- ---------------------------------------------------------------------------
-- Restricciones
-- ---------------------------------------------------------------------------

-- La habitacion tiene que pertenecer al hostal de la estadia. Se resuelve con
-- una clave foranea compuesta, no con un trigger.
DO $bloque$ BEGIN
    ALTER TABLE core.habitacion ADD CONSTRAINT habitacion_id_hostal_uk UNIQUE (id, hostal_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $bloque$;

-- NOT VALID: si alguna fila del Excel cruzo hostal y habitacion, la restriccion
-- rige para lo nuevo y el historico se limpia aparte. Validar despues con
--   ALTER TABLE core.estadia VALIDATE CONSTRAINT estadia_habitacion_del_hostal;
DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_habitacion_del_hostal
        FOREIGN KEY (habitacion_id, hostal_id)
        REFERENCES core.habitacion(id, hostal_id) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

-- Comprobado contra los libros de julio 2026: ninguna de las 458 estadias cruza
-- hostal con habitacion, asi que la validacion pasa. Va en un bloque que avisa
-- en vez de abortar, por si una carga futura ensucia el historico: la
-- restriccion queda igual vigente para todo lo que se inserte de aqui en
-- adelante, que es lo que importa.
DO $bloque$ BEGIN
    ALTER TABLE core.estadia VALIDATE CONSTRAINT estadia_habitacion_del_hostal;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'estadia_habitacion_del_hostal queda NOT VALID: hay filas historicas que la incumplen (%)', SQLERRM;
END $bloque$;

-- Un ingreso capturado en web esta completo o no existe.
DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_web_completa CHECK (
        origen <> 'WEB' OR (
            fecha_ingreso         IS NOT NULL AND
            hora_ingreso          IS NOT NULL AND
            habitacion_id         IS NOT NULL AND
            fecha_salida_prevista IS NOT NULL AND
            registrado_por        IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

-- Una salida capturada en web trae hora, motivo y una decision sobre las llaves.
DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_web_salida_completa CHECK (
        origen <> 'WEB' OR fecha_salida IS NULL OR (
            hora_salida           IS NOT NULL AND
            motivo_salida_id      IS NOT NULL AND
            llaves_devueltas <> 'NO_APLICA'   AND
            salida_registrada_por IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_prevista_posterior CHECK (
        fecha_salida_prevista IS NULL OR fecha_ingreso IS NULL
        OR fecha_salida_prevista > fecha_ingreso);
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

-- No hay fecha de devolucion de algo que no se devolvio.
DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_fecha_llaves CHECK (
        llaves_devueltas_en IS NULL OR llaves_devueltas = 'ENTREGADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_fecha_chip CHECK (
        chip_devuelto_en IS NULL OR chip_devuelto = 'ENTREGADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

DO $bloque$ BEGIN
    ALTER TABLE core.estadia ADD CONSTRAINT estadia_patente_si_estaciona CHECK (
        origen <> 'WEB' OR NOT usa_estacionamiento OR patente_vehiculo IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $bloque$;

-- Una persona no puede estar alojada dos veces a la vez. Acotado a 'WEB': el
-- historico del Excel tiene estadias abiertas de sobra -es uno de los hallazgos
-- de rpt.vw_estadias_abiertas- y bloquearlas impediria recargar los libros.
CREATE UNIQUE INDEX IF NOT EXISTS estadia_abierta_por_persona_uk
    ON core.estadia (persona_id)
    WHERE fecha_salida IS NULL AND origen = 'WEB';

CREATE UNIQUE INDEX IF NOT EXISTS estadia_folio_web_uk
    ON core.estadia (hostal_id, folio)
    WHERE folio IS NOT NULL AND origen = 'WEB';

CREATE INDEX IF NOT EXISTS estadia_alojados_web_ix
    ON core.estadia (hostal_id)
    WHERE fecha_salida IS NULL AND origen = 'WEB';


-- ---------------------------------------------------------------------------
-- core.estadia_ausencia
-- ---------------------------------------------------------------------------
-- Permisos, vacaciones y licencias: lo que en ALMAR WATER son las filas 97, 98
-- y 99 de REGISTRO OFICIAL, escritas a mano como un conteo diario -1, 20 y 40
-- dias-persona- sin ningun dato debajo que las sostenga. En ISAM el mismo hecho
-- se disfraza de salida completa con MOTIVO = 'DESCANSO' o 'CAMPAMENTO', que es
-- lo que fabrica las estadias con tramos discontinuos.
--
-- Una ausencia NO es una noche que cobrar, pero SI es una cama ocupada: el
-- trabajador conserva la habitacion y vuelve. Esa distincion es justamente la
-- que el Excel no puede expresar.
CREATE TABLE IF NOT EXISTS core.estadia_ausencia (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estadia_id          integer  NOT NULL REFERENCES core.estadia(id) ON DELETE CASCADE,
    -- El motivo NUNCA se teclea: sale del catalogo y la FK lo garantiza.
    tipo_id             smallint NOT NULL REFERENCES core.tipo_ausencia(id),
    desde               date     NOT NULL,
    -- NULL es informacion, no un hueco: "se fue y todavia no vuelve".
    hasta               date,
    conserva_habitacion boolean  NOT NULL DEFAULT true,
    -- Complemento del motivo, nunca su reemplazo. Obligatorio solo cuando el
    -- tipo elegido trae exige_detalle.
    detalle             text,
    registrado_por      smallint REFERENCES core.usuario(id),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ausencia_rango CHECK (hasta IS NULL OR hasta >= desde),
    -- Una misma estadia no puede tener dos ausencias solapadas.
    CONSTRAINT ausencia_sin_solape EXCLUDE USING gist (
        estadia_id WITH =,
        daterange(desde, COALESCE(hasta + 1, 'infinity'::date)) WITH &&)
);

CREATE INDEX IF NOT EXISTS estadia_ausencia_estadia_ix ON core.estadia_ausencia (estadia_id);
CREATE INDEX IF NOT EXISTS estadia_ausencia_fecha_ix   ON core.estadia_ausencia (desde, hasta);
CREATE INDEX IF NOT EXISTS estadia_ausencia_abierta_ix ON core.estadia_ausencia (estadia_id) WHERE hasta IS NULL;

COMMENT ON TABLE core.estadia_ausencia IS
    'Permiso, vacaciones o licencia dentro de una estadia. No genera noche, pero puede seguir ocupando la cama.';


-- ---------------------------------------------------------------------------
-- Generacion automatica de noches
-- ---------------------------------------------------------------------------
-- core.estadia_noche es la unidad que se cobra. El recepcionista NUNCA la
-- teclea: se deriva de las fechas de la estadia menos los dias de ausencia.
--
-- Criterio de conteo: la noche de salida NO se cuenta. Del 3 al 6 son 3 noches.
-- Una estadia todavia abierta acumula hasta hoy inclusive, para que la noche en
-- curso se vea; al cerrarla el mismo dia, el total no cambia.
--
-- SECURITY DEFINER a proposito: asi el rol de la aplicacion no necesita DELETE
-- en ninguna tabla. El search_path fijo evita el secuestro por search_path, que
-- es obligatorio en una funcion con estos permisos.
CREATE OR REPLACE FUNCTION core.sincronizar_noches(p_estadia integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog, pg_temp
AS $funcion$
DECLARE
    e         core.estadia%ROWTYPE;
    v_hasta   date;
    v_creadas integer := 0;
BEGIN
    SELECT * INTO e FROM core.estadia WHERE id = p_estadia;
    IF NOT FOUND OR e.fecha_ingreso IS NULL THEN
        RETURN 0;
    END IF;

    v_hasta := COALESCE(e.fecha_salida - 1, core.hoy());

    -- Fuera del rango, o dentro de una ausencia: esa noche no existe. Se borra
    -- aunque estuviera marcada, porque corregir la salida hacia atras o
    -- registrar vacaciones retroactivas tiene que descontar.
    DELETE FROM core.estadia_noche n
     WHERE n.estadia_id = p_estadia
       AND (n.fecha < e.fecha_ingreso
            OR n.fecha > v_hasta
            OR EXISTS (SELECT 1 FROM core.estadia_ausencia a
                        WHERE a.estadia_id = p_estadia
                          AND n.fecha >= a.desde
                          AND n.fecha <= COALESCE(a.hasta, 'infinity'::date)));

    IF v_hasta < e.fecha_ingreso THEN
        RETURN 0;
    END IF;

    -- ON CONFLICT DO NOTHING: nunca pisa un turno o un cambio_sabanas que
    -- alguien haya marcado a mano sobre una noche que ya existia.
    INSERT INTO core.estadia_noche (estadia_id, fecha, turno)
    SELECT p_estadia, d::date, e.turno_habitual
      FROM generate_series(e.fecha_ingreso, v_hasta, INTERVAL '1 day') AS d
     WHERE NOT EXISTS (SELECT 1 FROM core.estadia_ausencia a
                        WHERE a.estadia_id = p_estadia
                          AND d::date >= a.desde
                          AND d::date <= COALESCE(a.hasta, 'infinity'::date))
    ON CONFLICT (estadia_id, fecha) DO NOTHING;

    GET DIAGNOSTICS v_creadas = ROW_COUNT;
    RETURN v_creadas;
END;
$funcion$;

COMMENT ON FUNCTION core.sincronizar_noches IS
    'Regenera las noches de una estadia: ingreso..salida-1, descontando las ausencias. Idempotente.';

-- Las estadias abiertas acumulan una noche por dia que pasa, y para eso no hay
-- ningun UPDATE que dispare un trigger. Se llama una vez al dia: con pg_cron si
-- el proyecto lo tiene, o desde la portada de recepcion.
CREATE OR REPLACE FUNCTION core.sincronizar_noches_abiertas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = core, pg_catalog, pg_temp
AS $funcion$
DECLARE
    r       record;
    v_total integer := 0;
BEGIN
    FOR r IN SELECT id FROM core.estadia
              WHERE fecha_salida IS NULL AND origen = 'WEB' AND fecha_ingreso IS NOT NULL
    LOOP
        v_total := v_total + core.sincronizar_noches(r.id);
    END LOOP;
    RETURN v_total;
END;
$funcion$;

CREATE OR REPLACE FUNCTION core.tg_sincronizar_noches()
RETURNS trigger
LANGUAGE plpgsql
AS $funcion$
BEGIN
    PERFORM core.sincronizar_noches(NEW.id);
    RETURN NULL;  -- AFTER trigger: el valor de retorno se ignora
END;
$funcion$;

CREATE OR REPLACE FUNCTION core.tg_sincronizar_noches_ausencia()
RETURNS trigger
LANGUAGE plpgsql
AS $funcion$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM core.sincronizar_noches(OLD.estadia_id);
    ELSE
        PERFORM core.sincronizar_noches(NEW.estadia_id);
        -- Mover una ausencia de estadia obliga a recalcular las dos.
        IF TG_OP = 'UPDATE' AND OLD.estadia_id <> NEW.estadia_id THEN
            PERFORM core.sincronizar_noches(OLD.estadia_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$funcion$;

DROP TRIGGER IF EXISTS estadia_noches_web ON core.estadia;
CREATE TRIGGER estadia_noches_web
    AFTER INSERT OR UPDATE OF fecha_ingreso, fecha_salida, turno_habitual
    ON core.estadia
    FOR EACH ROW
    WHEN (NEW.origen = 'WEB')
    EXECUTE FUNCTION core.tg_sincronizar_noches();

DROP TRIGGER IF EXISTS ausencia_noches ON core.estadia_ausencia;
CREATE TRIGGER ausencia_noches
    AFTER INSERT OR UPDATE OR DELETE ON core.estadia_ausencia
    FOR EACH ROW
    EXECUTE FUNCTION core.tg_sincronizar_noches_ausencia();


-- ---------------------------------------------------------------------------
-- rpt.vw_alojados
-- ---------------------------------------------------------------------------
-- La portada de recepcion. Solo estadias capturadas en web: las abiertas que
-- vienen del Excel son de julio 2026 y son un hallazgo de auditoria, no gente
-- que este durmiendo hoy en el hostal.
--
-- Trae el estado de ausencia del dia para que un huesped de vacaciones se vea
-- como tal, y no como alguien que desaparecio.
CREATE OR REPLACE VIEW rpt.vw_alojados AS
SELECT
    e.id                                    AS estadia_id,
    h.codigo                                AS hostal_codigo,
    hab.numero                              AS habitacion,
    p.id                                    AS persona_id,
    p.nombre                                AS persona,
    p.rut_normalizado                       AS rut,
    p.celular,
    em.nombre                               AS empresa,
    e.folio,
    e.tipo_habitacion,
    e.turno_habitual,
    e.fecha_ingreso,
    e.hora_ingreso,
    e.fecha_salida_prevista,
    e.numero_llave,
    e.numero_chip,
    e.chip_devuelto,
    (SELECT count(*) FROM core.estadia_noche n WHERE n.estadia_id = e.id) AS noches,
    core.hoy() - e.fecha_salida_prevista   AS dias_de_atraso,
    a.id                                     AS ausencia_id,
    ta.codigo                                AS ausencia_tipo,
    ta.nombre                                AS ausencia_nombre,
    a.desde                                  AS ausencia_desde,
    a.hasta                                  AS ausencia_hasta,
    a.conserva_habitacion                    AS ausencia_conserva_habitacion
FROM core.estadia e
JOIN core.persona p   ON p.id  = e.persona_id
JOIN core.empresa em  ON em.id = e.empresa_id
JOIN core.hostal  h   ON h.id  = e.hostal_id
LEFT JOIN core.habitacion hab ON hab.id = e.habitacion_id
-- La ausencia vigente HOY, si la hay.
LEFT JOIN LATERAL (
    SELECT x.*
      FROM core.estadia_ausencia x
     WHERE x.estadia_id = e.id
       AND core.hoy() >= x.desde
       AND core.hoy() <= COALESCE(x.hasta, 'infinity'::date)
     ORDER BY x.desde DESC
     LIMIT 1
) a ON true
LEFT JOIN core.tipo_ausencia ta ON ta.id = a.tipo_id
WHERE e.fecha_salida IS NULL
  AND e.origen = 'WEB';

COMMENT ON VIEW rpt.vw_alojados IS
    'Quien esta alojado ahora segun la captura web, con su salida prevista y su ausencia vigente.';


-- ---------------------------------------------------------------------------
-- rpt.vw_ausencias_dia
-- ---------------------------------------------------------------------------
-- El reemplazo CALCULADO de las filas 97, 98 y 99 de REGISTRO OFICIAL. Aquello
-- eran tres numeros tecleados a mano; esto se deriva de ausencias atribuidas a
-- una persona concreta, y se puede auditar fila por fila.
--
-- Una ausencia sin fecha de regreso se cuenta hasta hoy, no hasta el infinito.
CREATE OR REPLACE VIEW rpt.vw_ausencias_dia AS
SELECT
    d::date        AS fecha,
    h.codigo       AS hostal_codigo,
    em.nombre      AS empresa,
    ta.codigo      AS tipo,
    ta.nombre      AS tipo_nombre,
    count(*)       AS dias_persona
FROM core.estadia_ausencia a
JOIN core.tipo_ausencia ta ON ta.id = a.tipo_id
JOIN core.estadia e        ON e.id  = a.estadia_id
JOIN core.hostal  h        ON h.id  = e.hostal_id
JOIN core.empresa em       ON em.id = e.empresa_id
CROSS JOIN LATERAL generate_series(
    a.desde,
    LEAST(COALESCE(a.hasta, core.hoy()), core.hoy()),
    INTERVAL '1 day') AS d
GROUP BY 1, 2, 3, 4, 5;

COMMENT ON VIEW rpt.vw_ausencias_dia IS
    'Dias-persona de permiso, vacaciones y licencia por dia, hostal, empresa y tipo. Calculado, no tecleado.';


-- ---------------------------------------------------------------------------
-- Ajustes a las vistas de 06 y 08
-- ---------------------------------------------------------------------------

-- El ingreso web marca la llave como NO_ENTREGADA mientras el huesped esta
-- alojado -esta fuera, es cierto-. Sin acotar a las estadias cerradas, esta
-- vista de auditoria contaria como perdida cada llave legitimamente en uso.
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
WHERE e.fecha_salida IS NOT NULL
  AND (e.chip_devuelto    = 'NO_ENTREGADA'
    OR e.llaves_devueltas = 'NO_ENTREGADA');

COMMENT ON VIEW rpt.vw_activos_no_devueltos IS
    'Estadias YA TERMINADAS sin devolver el chip o las llaves. Lo que sigue en manos de un huesped alojado no es una perdida.';

CREATE OR REPLACE VIEW rpt.vw_calidad_datos AS
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
SELECT 'ausencias sin fecha de regreso', count(*) FROM core.estadia_ausencia WHERE hasta IS NULL
UNION ALL
SELECT 'filas rechazadas en la carga', count(*) FROM staging.rechazo;

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
       count(*), 'integridad' FROM staging.rechazo
UNION ALL
-- Nuevo: una ausencia sin regreso es alguien que la operacion perdio de vista.
SELECT 13, 'Ausencias sin fecha de regreso',
       count(*), 'operacion' FROM core.estadia_ausencia WHERE hasta IS NULL;


-- ---------------------------------------------------------------------------
-- Semillas de los catalogos
-- ---------------------------------------------------------------------------
-- No estan inventadas. DESCANSO y CAMPAMENTO son los dos unicos motivos de
-- salida que las hojas diarias de ISAM escriben de verdad -20 veces cada uno-.
-- PERMISO, VACACIONES y LICENCIA_MEDICA son literalmente las filas 97, 98 y 99
-- de REGISTRO OFICIAL de ALMAR WATER.
INSERT INTO core.motivo_salida (codigo, nombre, solo_anticipada, exige_detalle, es_temporal, orden) VALUES
    ('TERMINO_PROGRAMADO',     'Termino su estadia segun lo previsto', false, false, false, 10),
    ('FIN_DE_FAENA',           'Fin de faena',                         false, false, false, 20),
    ('TRASLADO_HOSTAL',        'Traslado a otro hostal',               false, false, false, 30),
    ('CAMBIO_EMPRESA',         'Cambio de empresa',                    false, false, false, 40),
    ('DESCANSO',               'Descanso (vuelve)',                    false, false, true,  50),
    ('CAMPAMENTO',             'Se va a campamento (vuelve)',          false, false, true,  60),
    ('RETIRO_ANTICIPADO',      'Se retira antes por decision propia',  true,  false, false, 70),
    ('ENFERMEDAD_O_ACCIDENTE', 'Enfermedad o accidente',               true,  false, false, 80),
    ('DESVINCULACION',         'Desvinculacion de la empresa',         true,  false, false, 90),
    ('INCUMPLIMIENTO_NORMAS',  'Incumplimiento de las normas',         true,  true,  false, 100),
    ('OTRO',                   'Otro motivo',                          false, true,  false, 999)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO core.tipo_ausencia (codigo, nombre, conserva_habitacion, exige_detalle, orden) VALUES
    ('PERMISO',         'Permiso',           true,  false, 10),
    ('VACACIONES',      'Vacaciones',        true,  false, 20),
    ('LICENCIA_MEDICA', 'Licencia medica',   true,  false, 30),
    ('DESCANSO',        'Descanso',          true,  false, 40),
    ('CAMPAMENTO',      'Turno en campamento', false, false, 50),
    ('OTRO',            'Otro motivo',       true,  true,  999)
ON CONFLICT (codigo) DO NOTHING;
