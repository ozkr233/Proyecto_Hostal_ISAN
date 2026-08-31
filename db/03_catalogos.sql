-- ---------------------------------------------------------------------------
-- Funcion de normalizacion de texto
-- ---------------------------------------------------------------------------
-- pg_trgm y unaccent pueden vivir en distintos esquemas segun el proveedor.
-- Un esquema inexistente dentro de search_path se ignora sin error, asi que
-- esta linea sirve igual en Docker (public) y en Supabase (extensions).
SET search_path TO public, extensions;

-- Se usa en indices unicos, asi que debe ser IMMUTABLE. unaccent() de un solo
-- argumento es STABLE (depende del search_path del diccionario); pasando el
-- diccionario explicito queda determinista y se puede marcar IMMUTABLE.
--
-- El cast a regdictionary es obligatorio: sin el, el literal queda de tipo
-- 'unknown' y Postgres no resuelve unaccent(unknown, text) al hacer inlining
-- de esta funcion dentro de un indice.
--
-- El esquema de la extension NO se puede dejar fijo. Docker la instala en
-- public y Supabase en extensions. Por eso se averigua donde quedo y se hornea
-- el nombre completo dentro del cuerpo de la funcion: una funcion IMMUTABLE
-- usada en un indice no puede depender del search_path de quien la llame, y
-- ademas el literal 'unaccent'::regdictionary se resuelve en tiempo de
-- ejecucion, no al crearla.
DO $bloque$
DECLARE
    esq text;
BEGIN
    SELECT n.nspname INTO esq
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'unaccent';

    IF esq IS NULL THEN
        RAISE EXCEPTION 'Falta la extension unaccent; ejecutar 01_extensions.sql primero.';
    END IF;

    EXECUTE format($plantilla$
        CREATE OR REPLACE FUNCTION core.norm_texto(txt text)
        RETURNS text
        LANGUAGE sql
        IMMUTABLE
        PARALLEL SAFE
        STRICT
        AS $cuerpo$
            SELECT upper(regexp_replace(trim(%I.unaccent(%L::regdictionary, txt)), '\s+', ' ', 'g'))
        $cuerpo$
    $plantilla$, esq, esq || '.unaccent');
END
$bloque$;

COMMENT ON FUNCTION core.norm_texto IS
    'Mayusculas, sin acentos, sin espacios repetidos ni bordes. Para parear texto sucio del Excel.';

-- ---------------------------------------------------------------------------
-- Validacion de RUT chileno (modulo 11)
-- ---------------------------------------------------------------------------
-- Recibe el RUT ya normalizado (solo digitos + DV, sin puntos ni guion).
CREATE OR REPLACE FUNCTION core.rut_es_valido(rut text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
    cuerpo    text;
    dv_dado   text;
    suma      integer := 0;
    factor    integer := 2;
    i         integer;
    resto     integer;
    dv_calc   text;
BEGIN
    IF rut IS NULL OR rut !~ '^[0-9]{7,8}[0-9K]$' THEN
        RETURN false;
    END IF;

    cuerpo  := left(rut, length(rut) - 1);
    dv_dado := right(rut, 1);

    FOR i IN REVERSE length(cuerpo)..1 LOOP
        suma   := suma + substr(cuerpo, i, 1)::integer * factor;
        factor := CASE WHEN factor = 7 THEN 2 ELSE factor + 1 END;
    END LOOP;

    resto   := 11 - (suma % 11);
    dv_calc := CASE resto WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE resto::text END;

    RETURN dv_calc = dv_dado;
END;
$$;

-- ---------------------------------------------------------------------------
-- Catalogos
-- ---------------------------------------------------------------------------

-- Los hostales se identifican por un codigo numerico en el Excel: 1724, 2163, 1794.
CREATE TABLE core.hostal (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo      text        NOT NULL UNIQUE,
    nombre      text        NOT NULL,
    direccion   text,
    activo      boolean     NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.hostal.codigo IS 'Codigo usado en el Excel (columna HOSTAL/HOTEL): 1724, 2163, 1794.';

-- Empresa mandante del trabajador alojado. Es quien se factura.
CREATE TABLE core.empresa (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      text        NOT NULL,
    rut         text,
    activo      boolean     NOT NULL DEFAULT true,
    creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX empresa_nombre_norm_uk
    ON core.empresa (core.norm_texto(nombre));

-- El Excel escribe la misma empresa de varias formas (LFT/LTF, ALMARVP/ALAMR VP...).
-- El ETL resuelve contra esta tabla; un alias desconocido va a staging.rechazo
-- en vez de crear una empresa nueva por error de tipeo.
CREATE TABLE core.empresa_alias (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id  smallint NOT NULL REFERENCES core.empresa(id) ON DELETE CASCADE,
    alias       text     NOT NULL
);

CREATE UNIQUE INDEX empresa_alias_norm_uk
    ON core.empresa_alias (core.norm_texto(alias));

CREATE TABLE core.cargo (
    id          smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre      text NOT NULL
);

CREATE UNIQUE INDEX cargo_nombre_norm_uk
    ON core.cargo (core.norm_texto(nombre));

-- Habitacion fisica. El numero se repite entre hostales, por eso la clave
-- natural es el par (hostal, numero).
CREATE TABLE core.habitacion (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hostal_id   smallint             NOT NULL REFERENCES core.hostal(id),
    numero      text                 NOT NULL,
    tipo        core.tipo_habitacion,
    capacidad   smallint             NOT NULL DEFAULT 2 CHECK (capacidad > 0),
    activa      boolean              NOT NULL DEFAULT true,
    UNIQUE (hostal_id, numero)
);

COMMENT ON COLUMN core.habitacion.tipo IS
    'Tipo declarado del cuarto. El tipo cobrado va en core.estadia, porque una DOBLE se puede vender como SINGLE.';
