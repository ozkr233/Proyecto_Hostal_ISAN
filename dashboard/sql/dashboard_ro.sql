-- ===========================================================================
-- Rol de solo lectura para el dashboard.
--
-- Este archivo SE VERSIONA: no pegues aqui la clave. Genera una, usala al
-- ejecutar, y guardala solo en dashboard/.env.local, que esta en .gitignore.
--
--   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
-- Ejecutar UNA vez en Supabase: panel del proyecto -> SQL Editor -> pegar
-- esto con la clave sustituida -> Run.
--
-- El dashboard nunca escribe. Con este rol, un fallo o una inyeccion en la
-- aplicacion tampoco podria: no tiene INSERT, UPDATE ni DELETE en ningun
-- esquema.
-- ===========================================================================

CREATE ROLE dashboard_ro LOGIN PASSWORD 'PEGAR_CLAVE_GENERADA_AQUI';

GRANT USAGE  ON SCHEMA core, staging, rpt TO dashboard_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA core, staging, rpt TO dashboard_ro;

-- Para que una tabla o vista nueva quede legible sin repetir el GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA core, staging, rpt
    GRANT SELECT ON TABLES TO dashboard_ro;

-- Comprobacion: debe devolver 1650.
--   SET ROLE dashboard_ro; SELECT count(*) FROM core.estadia_noche; RESET ROLE;

-- ---------------------------------------------------------------------------
-- Despues, DATABASE_URL queda asi. Ojo con el usuario: por el pooler va
-- '<rol>.<project-ref>', no el rol pelado.
--
--   postgresql://dashboard_ro.<project-ref>:<clave>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
--
-- Si el pooler rechazara el rol personalizado ('Tenant or user not found'),
-- probar el mismo usuario contra el Session pooler, puerto 5432.
-- ---------------------------------------------------------------------------
