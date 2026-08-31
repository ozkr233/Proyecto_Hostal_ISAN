-- ===========================================================================
-- Semilla de catalogos: hostales, empresas y alias observados en los libros
-- de julio 2026. Las habitaciones y los cargos los crea el ETL a demanda,
-- porque crecen con los datos.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Hostales
-- ---------------------------------------------------------------------------
INSERT INTO core.hostal (codigo, nombre) VALUES
    ('1724', 'Hostal 1724'),
    ('2163', 'Hostal 2163'),
    ('1794', 'Hostal 1794'),
    -- Aparece una sola vez en el Excel; se deja creado para no rechazar la fila.
    ('1864', 'Hostal 1864')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------------
INSERT INTO core.empresa (nombre) VALUES
    ('MAS ERRAZURIZ'),
    ('LTF'),
    ('ALMAR SUBT'),
    ('ALMAR DMH'),
    ('ALMAR VP'),
    ('WATER SUBT'),
    ('VALKO'),
    ('ICEM'),
    ('ICEM CENT.'),
    ('ICEM- SPENCE-PEP'),
    ('FLS'),
    ('VOB'),
    ('EXTENSION'),
    ('PARTICULAR'),
    ('H. BALMACEDA')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Alias
-- ---------------------------------------------------------------------------
-- El nombre canonico se registra tambien como alias para que el ETL haga
-- siempre la misma consulta, sin casos especiales.
--
-- Los alias con error de tipeo salen de contar los valores reales en ambos
-- libros: LFT (por LTF), MAS ERRAZ y M. ERRAZUDIZ (por MAS ERRAZURIZ),
-- ALMAR SUBT. con punto, y las cuatro escrituras de ALMAR VP.
INSERT INTO core.empresa_alias (empresa_id, alias)
SELECT e.id, a.alias
FROM (VALUES
    ('MAS ERRAZURIZ',    'MAS ERRAZURIZ'),
    ('MAS ERRAZURIZ',    'MAS ERRAZ'),
    ('MAS ERRAZURIZ',    'M. ERRAZUDIZ'),
    ('MAS ERRAZURIZ',    'MAS ERRAZURIS'),

    ('LTF',              'LTF'),
    ('LTF',              'LFT'),

    ('ALMAR SUBT',       'ALMAR SUBT'),
    ('ALMAR SUBT',       'ALMAR SUBT.'),
    ('ALMAR SUBT',       'ALMARSUBT'),

    ('ALMAR DMH',        'ALMAR DMH'),
    ('ALMAR DMH',        'ALAMR DMH'),
    ('ALMAR DMH',        'ALMARDMH'),

    ('ALMAR VP',         'ALMAR VP'),
    ('ALMAR VP',         'ALMARVP'),
    ('ALMAR VP',         'ALAMR VP'),
    ('ALMAR VP',         'ALAMAR VP'),

    ('WATER SUBT',       'WATER SUBT'),
    ('WATER SUBT',       'WATERSUBT'),

    ('VALKO',            'VALKO'),
    ('VALKO',            'VALKO MAQ'),

    ('ICEM',             'ICEM'),
    ('ICEM CENT.',       'ICEM CENT.'),
    ('ICEM CENT.',       'ICEM CENT'),
    ('ICEM- SPENCE-PEP', 'ICEM- SPENCE-PEP'),
    ('ICEM- SPENCE-PEP', 'ICEM-SPENCE-PEP'),

    ('FLS',              'FLS'),
    ('VOB',              'VOB'),
    ('EXTENSION',        'EXTENSION'),
    ('PARTICULAR',       'PARTICULAR'),
    ('H. BALMACEDA',     'H. BALMACEDA'),
    ('H. BALMACEDA',     'HOTEL BALMACEDA')
) AS a(empresa, alias)
JOIN core.empresa e ON core.norm_texto(e.nombre) = core.norm_texto(a.empresa)
ON CONFLICT DO NOTHING;
