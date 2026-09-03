-- ===========================================================================
-- Fusion de personas con RUT invalido o vacio contra su registro con RUT valido.
--
-- NO borra noches ni servicios: los reasigna. La persona con el RUT mal
-- tecleado (o sin RUT) desaparece, pero todo lo que arrastraba queda colgando
-- del registro bueno. Es la contraparte de rpt.vw_personas_duplicadas.
--
-- Solo actua sobre grupos NO ambiguos: un unico RUT valido por nombre
-- normalizado. Los nombres con dos RUT validos distintos (MARIO ESPINA,
-- MICHAEL CONTRERAS) se dejan intactos, porque elegir cual es el bueno no se
-- puede hacer con los datos de la base.
--
-- Al final borra las personas con RUT invalido o vacio que no arrastran nada:
-- ni estadias ni servicios. Esas si se pierden sin consecuencia.
--
-- No esta en db/*.sql a proposito: aquello es DDL que corre en el initdb del
-- contenedor, y esto es una correccion de datos que se ejecuta a mano.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Pares (duplicado -> canonico)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE fusion ON COMMIT DROP AS
WITH grupo AS (
    SELECT core.norm_texto(nombre) AS clave,
           count(*) FILTER (WHERE rut_valido AND rut_normalizado IS NOT NULL) AS validos
    FROM core.persona
    GROUP BY 1
),
canonico AS (
    SELECT core.norm_texto(p.nombre) AS clave, p.id AS canonico_id
    FROM core.persona p
    JOIN grupo g ON g.clave = core.norm_texto(p.nombre)
    WHERE g.validos = 1                    -- sin ambiguedad
      AND p.rut_valido
      AND p.rut_normalizado IS NOT NULL
)
SELECT p.id AS duplicado_id, c.canonico_id
FROM core.persona p
JOIN canonico c ON c.clave = core.norm_texto(p.nombre)
WHERE NOT (p.rut_valido AND p.rut_normalizado IS NOT NULL);

-- ---------------------------------------------------------------------------
-- El duplicado a veces trae celular o cargo que el canonico no tiene.
-- Se rescatan antes de borrarlo; nunca pisan un valor ya presente.
-- ---------------------------------------------------------------------------
UPDATE core.persona c
SET celular  = COALESCE(c.celular,  x.celular),
    cargo_id = COALESCE(c.cargo_id, x.cargo_id)
FROM (
    SELECT f.canonico_id,
           (array_agg(d.celular)  FILTER (WHERE d.celular  IS NOT NULL))[1] AS celular,
           (array_agg(d.cargo_id) FILTER (WHERE d.cargo_id IS NOT NULL))[1] AS cargo_id
    FROM fusion f
    JOIN core.persona d ON d.id = f.duplicado_id
    GROUP BY 1
) x
WHERE c.id = x.canonico_id
  AND (c.celular IS NULL OR c.cargo_id IS NULL);

-- ---------------------------------------------------------------------------
-- Reasignacion. estadia_noche y estadia_evento cuelgan de estadia_id, asi que
-- se mueven solas. servicio_consumo apunta a la persona directo y hay que
-- moverlo aparte.
-- ---------------------------------------------------------------------------
UPDATE core.estadia e
SET persona_id = f.canonico_id
FROM fusion f
WHERE e.persona_id = f.duplicado_id;

UPDATE core.servicio_consumo s
SET persona_id = f.canonico_id
FROM fusion f
WHERE s.persona_id = f.duplicado_id;

DELETE FROM core.persona p
USING fusion f
WHERE p.id = f.duplicado_id;

-- ---------------------------------------------------------------------------
-- Personas con RUT invalido o vacio que no quedaron fusionadas y no arrastran
-- nada. Sin estadias ni servicios no hay nada que perder.
-- ---------------------------------------------------------------------------
DELETE FROM core.persona p
WHERE (p.rut_normalizado IS NULL OR NOT p.rut_valido)
  AND NOT EXISTS (SELECT 1 FROM core.estadia          e WHERE e.persona_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM core.servicio_consumo s WHERE s.persona_id = p.id);

COMMIT;
