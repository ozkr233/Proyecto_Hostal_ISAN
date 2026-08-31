-- pg_trgm puede estar en public (Docker) o en extensions (Supabase). Sin esto
-- el operador gin_trgm_ops del indice persona_nombre_trgm_ix no resuelve.
SET search_path TO public, extensions;

-- ---------------------------------------------------------------------------
-- core.persona
-- ---------------------------------------------------------------------------
-- Entidad estable: la misma persona vuelve en distintos meses y a veces con
-- distinta empresa. La empresa NO va aqui, va en la estadia.
CREATE TABLE core.persona (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut_normalizado   text,           -- solo digitos + DV, sin puntos ni guion: '18089941K'
    rut_valido        boolean NOT NULL DEFAULT false,
    nombre            text    NOT NULL,
    celular           text,
    cargo_id          smallint REFERENCES core.cargo(id),
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT persona_nombre_no_vacio CHECK (btrim(nombre) <> ''),
    CONSTRAINT persona_rut_formato CHECK (rut_normalizado IS NULL OR rut_normalizado ~ '^[0-9]{6,9}[0-9K]$')
);

-- RUT unico cuando existe. Hay personas sin RUT en el Excel (LUCIANO VARGAS,
-- RAUL RUBILAR), por eso el indice es parcial y no un UNIQUE de columna.
CREATE UNIQUE INDEX persona_rut_uk
    ON core.persona (rut_normalizado)
    WHERE rut_normalizado IS NOT NULL;

-- Identidad de respaldo para los sin RUT: nombre normalizado.
CREATE UNIQUE INDEX persona_nombre_sin_rut_uk
    ON core.persona (core.norm_texto(nombre))
    WHERE rut_normalizado IS NULL;

CREATE INDEX persona_nombre_trgm_ix
    ON core.persona USING gin (core.norm_texto(nombre) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- core.estadia
-- ---------------------------------------------------------------------------
-- Unidad de reserva: una persona alojada por una empresa en un hostal.
-- fecha_ingreso es NULL cuando el Excel solo trae la salida (pasa en las hojas
-- diarias, donde el bloque de salida es una lista independiente del de ingreso).
CREATE TABLE core.estadia (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    persona_id          integer  NOT NULL REFERENCES core.persona(id),
    empresa_id          smallint NOT NULL REFERENCES core.empresa(id),
    hostal_id           smallint NOT NULL REFERENCES core.hostal(id),
    habitacion_id       integer  REFERENCES core.habitacion(id),
    folio               text,
    tipo_habitacion     core.tipo_habitacion,
    grupo               core.grupo_rotacion,

    fecha_ingreso       date,
    hora_ingreso        time,
    fecha_salida        date,
    hora_salida         time,
    motivo_salida       text,

    chip_devuelto       core.estado_entrega NOT NULL DEFAULT 'NO_APLICA',
    llaves_devueltas    core.estado_entrega NOT NULL DEFAULT 'NO_APLICA',

    patente_vehiculo    text,
    usa_estacionamiento boolean NOT NULL DEFAULT false,

    observaciones       text,
    -- Marcada por el ETL cuando la fila no pudo resolverse del todo
    -- (salida sin ingreso previo, folio ambiguo, etc.).
    requiere_revision   boolean NOT NULL DEFAULT false,
    nota_revision       text,

    -- Procedencia exacta en el Excel. Es la clave natural que permite
    -- recargar un archivo sin duplicar: el ETL borra lo que ese archivo
    -- produjo antes y lo vuelve a insertar.
    origen_archivo      text,
    origen_hoja         text,
    origen_fila         integer,
    -- Una misma fila del Excel puede originar DOS estadias distintas: el
    -- bloque de ingreso y el de salida son personas diferentes. Sin el bloque
    -- en la clave, la salida se aplicaria a la estadia del que llego.
    origen_bloque       text,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    actualizado_en      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT estadia_rango_valido
        CHECK (fecha_ingreso IS NULL OR fecha_salida IS NULL OR fecha_salida >= fecha_ingreso),
    CONSTRAINT estadia_tiene_alguna_fecha
        CHECK (fecha_ingreso IS NOT NULL OR fecha_salida IS NOT NULL)
);

-- "Quien esta alojado ahora": las estadias sin salida registrada.
CREATE INDEX estadia_abiertas_ix
    ON core.estadia (hostal_id, persona_id)
    WHERE fecha_salida IS NULL;

CREATE INDEX estadia_persona_ix   ON core.estadia (persona_id);
CREATE INDEX estadia_empresa_ix   ON core.estadia (empresa_id, fecha_ingreso);
CREATE INDEX estadia_folio_ix     ON core.estadia (hostal_id, folio) WHERE folio IS NOT NULL;
CREATE INDEX estadia_revision_ix  ON core.estadia (requiere_revision) WHERE requiere_revision;
CREATE INDEX estadia_origen_ix    ON core.estadia (origen_archivo);

CREATE UNIQUE INDEX estadia_origen_uk
    ON core.estadia (origen_archivo, origen_hoja, origen_fila, origen_bloque)
    WHERE origen_archivo IS NOT NULL AND origen_fila IS NOT NULL
      AND origen_bloque IS NOT NULL;

-- ---------------------------------------------------------------------------
-- core.estadia_noche
-- ---------------------------------------------------------------------------
-- TABLA CENTRAL. Una fila por persona-noche: es la matriz de R. OFICIAL
-- (columnas O..AS = dias del mes) en forma normalizada, y la unidad que se cobra.
-- La columna "N" del Excel (=COUNTA de los 31 dias) pasa a ser un COUNT(*).
--
-- No se deriva del rango ingreso-salida: hay estadias con huecos. JUAN CORREA
-- (R. OFICIAL fila 7) tiene 18 noches repartidas en tres tramos discontinuos.
CREATE TABLE core.estadia_noche (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estadia_id      integer NOT NULL REFERENCES core.estadia(id) ON DELETE CASCADE,
    fecha           date    NOT NULL,
    turno           core.turno_marca,
    cambio_sabanas  boolean NOT NULL DEFAULT false,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (estadia_id, fecha)
);

CREATE INDEX estadia_noche_fecha_ix ON core.estadia_noche (fecha);

COMMENT ON TABLE core.estadia_noche IS
    'Una fila por persona-noche. Equivale a la matriz dia x persona de la hoja R. OFICIAL.';

-- ---------------------------------------------------------------------------
-- core.servicio_consumo
-- ---------------------------------------------------------------------------
-- Unifica las columnas P..T de las hojas diarias (DESAYUNO, CENA, ALMUERZO,
-- COLACION NORMAL, COLACION ESPECIAL) con toda la hoja ALMUERZOS ISAM.
-- estadia_id es opcional: ALMUERZOS ISAM incluye gente que come sin alojarse.
CREATE TABLE core.servicio_consumo (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha           date               NOT NULL,
    persona_id      integer            REFERENCES core.persona(id),
    estadia_id      integer            REFERENCES core.estadia(id) ON DELETE SET NULL,
    hostal_id       smallint           NOT NULL REFERENCES core.hostal(id),
    empresa_id      smallint           REFERENCES core.empresa(id),
    tipo_servicio   core.tipo_servicio NOT NULL,
    cantidad        smallint           NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    -- Variantes del Excel: HIPOCALORICO, '2 HUEVOS DUROS', '2 PANCITOS'.
    variante        text,
    -- Almuerzo extra ISAM (columna K de R. OFICIAL): se cobra aparte.
    es_extra        boolean            NOT NULL DEFAULT false,
    -- Columna I de ALMUERZOS ISAM, p.ej. 'SRA. ELIANA'.
    autorizado_por  text,
    origen_archivo  text,
    origen_hoja     text,
    creado_en       timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX servicio_fecha_ix   ON core.servicio_consumo (fecha, tipo_servicio);
CREATE INDEX servicio_persona_ix ON core.servicio_consumo (persona_id, fecha);
CREATE INDEX servicio_estadia_ix ON core.servicio_consumo (estadia_id);

-- La idempotencia no se hace con un UNIQUE aqui: eso impediria registrar dos
-- servicios legitimos del mismo tipo el mismo dia. Al recargar un archivo el
-- ETL borra primero lo que ese archivo produjo, usando este indice.
CREATE INDEX servicio_origen_ix ON core.servicio_consumo (origen_archivo);

-- ---------------------------------------------------------------------------
-- core.estadia_evento
-- ---------------------------------------------------------------------------
-- Bitacora. Recoge lo que hoy se escribe suelto en CAMBIO DE SABANAS
-- ('cambio de hab', 'SE RETIRA MANANA A LAS 07:30') y en MOTIVO ('ACREDITACION').
CREATE TABLE core.estadia_evento (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    estadia_id  integer          NOT NULL REFERENCES core.estadia(id) ON DELETE CASCADE,
    fecha       date             NOT NULL,
    tipo        core.tipo_evento NOT NULL DEFAULT 'OTRO',
    detalle     text,
    creado_en   timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX estadia_evento_ix ON core.estadia_evento (estadia_id, fecha);

-- ---------------------------------------------------------------------------
-- Mantenimiento de actualizado_en
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION core.tg_set_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER persona_set_actualizado
    BEFORE UPDATE ON core.persona
    FOR EACH ROW EXECUTE FUNCTION core.tg_set_actualizado_en();

CREATE TRIGGER estadia_set_actualizado
    BEFORE UPDATE ON core.estadia
    FOR EACH ROW EXECUTE FUNCTION core.tg_set_actualizado_en();
