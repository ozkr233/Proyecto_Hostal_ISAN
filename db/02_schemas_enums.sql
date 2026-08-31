-- Tres esquemas:
--   staging : datos crudos del Excel, sin validar. Red de seguridad y auditoria.
--   core    : modelo normalizado, con restricciones. Fuente de verdad.
--   rpt     : vistas de reporte que reemplazan las formulas del Excel.

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS rpt;

COMMENT ON SCHEMA staging IS 'Landing crudo de los libros Excel; todo texto, sin validacion.';
COMMENT ON SCHEMA core    IS 'Modelo normalizado del registro de hostales.';
COMMENT ON SCHEMA rpt     IS 'Vistas de reporte (reemplazan R. OFICIAL y los totales por hoja).';

-- DOBLE / SINGLE, unicos valores observados en ambos libros.
CREATE TYPE core.tipo_habitacion AS ENUM ('DOBLE', 'SINGLE');

-- Marca de turno por noche. D=dia, N=noche, E=especial/extra.
-- En R. OFICIAL ocupa cada celda de la matriz de 31 dias.
CREATE TYPE core.turno_marca AS ENUM ('D', 'N', 'E');

-- Grupo de rotacion (columna GRUPO en ALMAR WATER). '-' del Excel se guarda NULL.
CREATE TYPE core.grupo_rotacion AS ENUM ('A', 'B');

CREATE TYPE core.tipo_servicio AS ENUM (
    'DESAYUNO',
    'ALMUERZO',
    'CENA',
    'COLACION_NORMAL',
    'COLACION_ESPECIAL'
);

-- Devolucion de chip y llaves al hacer checkout.
CREATE TYPE core.estado_entrega AS ENUM ('ENTREGADA', 'NO_ENTREGADA', 'NO_APLICA');

-- Bitacora libre. Recoge los textos que hoy contaminan CAMBIO DE SABANAS y MOTIVO.
CREATE TYPE core.tipo_evento AS ENUM (
    'CAMBIO_SABANAS',
    'CAMBIO_HAB',
    'ACREDITACION',
    'AVISO_SALIDA',
    'OTRO'
);
