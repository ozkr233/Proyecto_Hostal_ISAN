-- ===========================================================================
-- Rol de solo lectura para el dashboard.
--
-- Ejecutar UNA vez en Supabase: panel del proyecto -> SQL Editor -> pegar
-- todo esto -> Run. Despues cambiar DATABASE_URL para que use este rol.
--
-- El dashboard nunca escribe. Con este rol, un fallo o una inyeccion en la
-- aplicacion tampoco podria: no tiene INSERT, UPDATE ni DELETE en ningun
-- esquema.
-- ===========================================================================

CREATE ROLE dashboard_ro LOGIN PASSWORD 'HwKAVVeEYS8xoQLcpjfnbUKf8KL8gkqn';

GRANT USAGE  ON SCHEMA core, staging, rpt TO dashboard_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA core, staging, rpt TO dashboard_ro;

-- Para que una tabla o vista nueva quede legible sin repetir el GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA core, staging, rpt
    GRANT SELECT ON TABLES TO dashboard_ro;

-- Comprobacion: debe devolver 1650.
-- SET ROLE dashboard_ro; SELECT count(*) FROM core.estadia_noche; RESET ROLE;

-- ---------------------------------------------------------------------------
-- Despues de correr esto, DATABASE_URL queda asi (ojo con el usuario: por el
-- pooler va '<rol>.<project-ref>', no el rol pelado):
--
-- postgresql://dashboard_ro.nzyamnmilodlcxtdetzd:HwKAVVeEYS8xoQLcpjfnbUKf8KL8gkqn@aws-0-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require
--
-- Si el pooler rechazara el rol personalizado ('Tenant or user not found'),
-- probar el mismo usuario contra el Session pooler, puerto 5432.
-- ---------------------------------------------------------------------------
