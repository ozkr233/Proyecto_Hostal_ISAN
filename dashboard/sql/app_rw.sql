-- ===========================================================================
-- Rol de escritura para la recepcion.
--
-- Convive con dashboard_ro, que sigue siendo el que usa el panel: el dashboard
-- lee con un rol que fisicamente no puede escribir, y solo las rutas de
-- recepcion usan este.
--
-- Este archivo SE VERSIONA: no pegues aqui la clave. Genera una, usala al
-- ejecutar, y guardala solo en dashboard/.env.local, que esta en .gitignore.
--
--   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
-- Ejecutar UNA vez en Supabase: panel del proyecto -> SQL Editor -> pegar esto
-- con la clave sustituida -> Run. Requiere que db/09_recepcion.sql ya este
-- aplicado.
-- ===========================================================================

CREATE ROLE app_rw LOGIN PASSWORD 'PEGAR_CLAVE_GENERADA_AQUI';

-- staging NO se expone: son los datos crudos del Excel y la recepcion no tiene
-- nada que hacer ahi.
GRANT USAGE  ON SCHEMA core, rpt TO app_rw;
GRANT SELECT ON ALL TABLES IN SCHEMA core, rpt TO app_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA core, rpt
    GRANT SELECT ON TABLES TO app_rw;

-- ---------------------------------------------------------------------------
-- Escritura, tabla por tabla y nunca con GRANT ALL.
-- ---------------------------------------------------------------------------
-- Lo que la recepcion crea o corrige:
GRANT INSERT, UPDATE ON core.persona          TO app_rw;
GRANT INSERT, UPDATE ON core.estadia          TO app_rw;
GRANT INSERT, UPDATE ON core.estadia_evento   TO app_rw;
-- La ausencia es la unica tabla con DELETE, y por un motivo concreto: si el
-- huesped se va y vuelve el mismo dia, no hubo ausencia. Cerrarla en "ayer"
-- daria un rango invertido y dejarla cubriendo hoy descontaria una noche que si
-- se durmio. La accion solo borra cuando la ausencia empieza hoy o despues; una
-- de la semana pasada solo se puede cerrar.
GRANT INSERT, UPDATE, DELETE ON core.estadia_ausencia TO app_rw;
GRANT INSERT          ON core.cargo           TO app_rw;

-- Los catalogos: el rol puede escribirlos, pero la aplicacion solo expone esa
-- escritura en /catalogos, detras de la comprobacion de rol ADMIN.
GRANT INSERT, UPDATE ON core.motivo_salida    TO app_rw;
GRANT INSERT, UPDATE ON core.tipo_ausencia    TO app_rw;

-- Usuarios: los administra /usuarios, tambien solo para ADMIN. El UPDATE cubre
-- ademas el sello de ultimo_acceso al entrar.
GRANT INSERT, UPDATE ON core.usuario          TO app_rw;

-- La capacidad de las habitaciones: el Excel nunca la trajo y las 67 quedaron
-- en el DEFAULT 2. Mientras siga asi, el aviso de "sobre capacidad" del panel
-- no prueba hacinamiento sino que falta cargar el dato, asi que /catalogos deja
-- corregirlo. Solo UPDATE: el alta de una habitacion sigue siendo por SQL.
GRANT UPDATE ON core.habitacion               TO app_rw;

-- OJO CON LO QUE NO ESTA:
--
--   * DELETE en ninguna otra tabla. Una estadia se corrige, no se borra; una
--     opcion de catalogo se desactiva, no se borra.
--   * core.estadia_noche no aparece: la mueve core.sincronizar_noches(), que es
--     SECURITY DEFINER. Las noches son la unidad que se cobra y no se tocan a
--     mano desde la aplicacion, ni siquiera por error.
--   * core.hostal y core.empresa son de solo lectura aqui, y de core.habitacion
--     solo se puede actualizar la capacidad (ver el GRANT de arriba): el alta de
--     un hostal, una empresa o una habitacion es una decision administrativa que
--     se hace por SQL, no desde el formulario de recepcion.
--
-- Las secuencias de las columnas GENERATED ALWAYS AS IDENTITY no necesitan
-- GRANT: el permiso de INSERT sobre la tabla ya alcanza.

-- Comprobacion:
--   SET ROLE app_rw;
--   SELECT count(*) FROM core.estadia;                    -- funciona
--   DELETE FROM core.estadia WHERE id = -1;               -- debe dar permiso denegado
--   INSERT INTO core.estadia_noche (estadia_id, fecha) VALUES (-1, now());  -- idem
--   RESET ROLE;

-- ---------------------------------------------------------------------------
-- Despues, DATABASE_URL_RW queda asi. Ojo con el usuario: por el pooler va
-- '<rol>.<project-ref>', no el rol pelado.
--
--   postgresql://app_rw.<project-ref>:<clave>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
-- ---------------------------------------------------------------------------
