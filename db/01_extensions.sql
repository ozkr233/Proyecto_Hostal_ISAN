-- Extensiones requeridas.
--
--   unaccent : lo usa core.norm_texto(), que a su vez sostiene los indices
--              unicos de empresa, cargo y persona. Es obligatoria.
--   pg_trgm  : indice de busqueda por nombre aproximado en core.persona
--              (persona_nombre_trgm_ix). Es obligatoria.
--
-- Ambas son contrib estandar y estan disponibles en Docker y en los Postgres
-- administrados (Neon, Supabase, RDS).

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- tablefunc (crosstab) NO se usa: el pivote de rpt.vw_registro_oficial esta
-- resuelto con agregados FILTER, que son SQL estandar y no necesitan extension.
-- Se deja comentada porque hay proveedores administrados que la bloquean, y un
-- CREATE EXTENSION fallido aborta toda la inicializacion.
-- CREATE EXTENSION IF NOT EXISTS tablefunc;
