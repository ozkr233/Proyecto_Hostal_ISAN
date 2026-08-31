-- ---------------------------------------------------------------------------
-- staging.registro_crudo
-- ---------------------------------------------------------------------------
-- Landing de las hojas diarias. Todo texto, sin validar nada: si el Excel trae
-- basura, la basura queda guardada tal cual y se puede auditar despues sin
-- volver a abrir el libro.
--
-- Cada fila del Excel produce HASTA DOS filas aqui: una por el bloque de
-- ingreso (columnas A..W) y otra por el de salida (X..AK). Son dos listas
-- independientes puestas lado a lado, no la misma persona: en '01- JULIO'
-- la fila 14 no tiene ingreso pero si registra la salida de ALAN CALDERON.
CREATE TABLE staging.registro_crudo (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archivo_origen  text    NOT NULL,
    hoja            text    NOT NULL,
    fila            integer NOT NULL,
    bloque          text    NOT NULL CHECK (bloque IN ('INGRESO', 'SALIDA')),
    perfil          text,               -- perfil de mapeo de columnas detectado
    fecha_hoja      date,               -- fecha deducida del nombre de la hoja

    -- Campos comunes a ambos bloques, siempre como texto crudo.
    hostal          text,
    empresa         text,
    folio           text,
    habitacion      text,
    tipo_habitacion text,
    grupo           text,
    turno           text,
    nombre          text,
    rut             text,
    celular         text,
    cargo           text,
    fecha           text,
    hora            text,
    motivo          text,
    observaciones   text,
    cambio_sabanas  text,

    -- Servicios (solo bloque INGRESO en las hojas diarias).
    desayuno        text,
    almuerzo        text,
    cena            text,
    colacion_normal text,
    colacion_especial text,
    sub             text,

    -- Devoluciones (solo bloque SALIDA).
    chip            text,
    llaves          text,

    cargado_en      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (archivo_origen, hoja, fila, bloque)
);

CREATE INDEX registro_crudo_archivo_ix ON staging.registro_crudo (archivo_origen, hoja);

-- ---------------------------------------------------------------------------
-- staging.registro_oficial_crudo
-- ---------------------------------------------------------------------------
-- Landing de la hoja R. OFICIAL / REGISTRO OFICIAL. Es la fuente autoritativa
-- de noches: la matriz de 31 columnas se desarma aqui en una fila por dia.
CREATE TABLE staging.registro_oficial_crudo (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archivo_origen    text    NOT NULL,
    hoja              text    NOT NULL,
    fila              integer NOT NULL,
    tipo_habitacion   text,
    hostal            text,
    empresa           text,
    folio             text,
    habitacion        text,
    nombre            text,
    rut               text,
    cargo             text,
    observacion       text,
    almuerzo_extra    text,
    estacionamiento   text,
    patente           text,
    total_alojamiento text,           -- columna N del Excel (=COUNTA), solo para conciliar
    fecha             date    NOT NULL,
    marca             text    NOT NULL,  -- D / N / E de la celda del dia
    cargado_en        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (archivo_origen, hoja, fila, fecha)
);

-- ---------------------------------------------------------------------------
-- staging.almuerzo_crudo
-- ---------------------------------------------------------------------------
-- Landing de la hoja ALMUERZOS ISAM. Las filas marcadoras 'SIN ALMUERZOS'
-- no se cargan: la ausencia de almuerzos se deriva por ausencia de filas.
CREATE TABLE staging.almuerzo_crudo (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archivo_origen text    NOT NULL,
    hoja           text    NOT NULL,
    fila           integer NOT NULL,
    fecha          text,
    nombre         text,
    rut            text,
    empresa        text,
    tipo_servicio  text,
    cantidad       text,
    hostal         text,
    autorizado_por text,
    cargado_en     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (archivo_origen, hoja, fila)
);

-- ---------------------------------------------------------------------------
-- staging.rechazo
-- ---------------------------------------------------------------------------
-- Toda fila que no se pudo promover a core queda aqui con su motivo.
-- El criterio de aceptacion de la carga es que esta tabla quede vacia o
-- con motivos revisados uno a uno.
CREATE TABLE staging.rechazo (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archivo_origen text NOT NULL,
    hoja           text,
    fila           integer,
    bloque         text,
    motivo         text NOT NULL,
    detalle        jsonb,
    creado_en      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rechazo_motivo_ix ON staging.rechazo (motivo);

-- ---------------------------------------------------------------------------
-- staging.carga
-- ---------------------------------------------------------------------------
-- Bitacora de ejecuciones del ETL, para saber que se cargo y cuando.
CREATE TABLE staging.carga (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    archivo_origen  text NOT NULL,
    mes             date NOT NULL,        -- primer dia del mes cargado
    filas_crudas    integer NOT NULL DEFAULT 0,
    filas_core      integer NOT NULL DEFAULT 0,
    filas_rechazo   integer NOT NULL DEFAULT 0,
    iniciado_en     timestamptz NOT NULL DEFAULT now(),
    terminado_en    timestamptz
);
