"""Mapeo de columnas de los libros Excel a campos canonicos.

Los encabezados cambian entre hojas y entre libros, asi que aqui NO se
codifican letras de columna. Todo se resuelve leyendo la fila de encabezado
y pareando contra las listas de sinonimos de este modulo. Un mes nuevo con
otro orden de columnas sigue cargando sin tocar codigo.

Variantes reales encontradas en julio 2026:

  * ISAM dias 1-4 y 7-15 : bloque de salida desde 'FECHA DE SALIDA' en X.
  * ISAM dias 5-6        : 'OBSERVACIONES' se cuela en X y corre todo el
                           bloque de salida una columna a la derecha.
  * ISAM dias 16-31      : 'HOSTAL' pasa a 'HOTEL' y
                           'HAB TIPO DOBLE- SINGLE' pasa a 'TIPO'.
  * ALMAR WATER          : otro orden completo; el bloque de salida empieza
                           en un encabezado 'FECHA' pelado.
"""

MESES = {
    "ENERO": 1, "FEBRERO": 2, "MARZO": 3, "ABRIL": 4,
    "MAYO": 5, "JUNIO": 6, "JULIO": 7, "AGOSTO": 8,
    "SEPTIEMBRE": 9, "SETIEMBRE": 9, "OCTUBRE": 10,
    "NOVIEMBRE": 11, "DICIEMBRE": 12,
}

# Encabezados que marcan el inicio del bloque de salida. Se busca la primera
# coincidencia DESPUES de la columna del nombre de ingreso, para no confundirla
# con la 'FECHA' de la fecha de ingreso, que esta al principio de la fila.
INICIO_BLOQUE_SALIDA = ("FECHA DE SALIDA", "FECHA SALIDA", "FECHA")

# campo canonico -> encabezados que lo representan (ya normalizados:
# mayusculas, sin acentos, sin puntuacion, espacios colapsados).
INGRESO_SINONIMOS = {
    "fecha":             ("FECHA", "FECHA INGRESO REAL", "FECHA INGRESO"),
    "hora":              ("HORA DE LLEGADA", "HORA DE INGRESO", "HORA"),
    "hostal":            ("HOSTAL", "HOTEL"),
    "empresa":           ("EMPRESA",),
    "tipo_habitacion":   ("HAB TIPO DOBLE SINGLE", "TIPO", "HAB TIPO"),
    "grupo":             ("GRUPO",),
    "turno":             ("TURNO",),
    "folio":             ("N FOLIO", "FOLIO"),
    "habitacion":        ("N HAB", "HAB", "N HABITACION", "HABITACION"),
    "nombre":            ("NOMBRE",),
    "rut":               ("RUT",),
    "celular":           ("CELULAR", "TELEFONO"),
    "cargo":             ("CARGO",),
    "motivo":            ("MOTIVO",),
    "desayuno":          ("DESAYUNO",),
    "cena":              ("CENA",),
    "almuerzo":          ("ALMUERZO",),
    "colacion_normal":   ("COLACION NORMAL",),
    "colacion_especial": ("COLACION ESPECIAL",),
    "sub":               ("SUB",),
    "cambio_sabanas":    ("CAMBIO DE SABANAS",),
    "observaciones":     ("OBSERVACIONES", "OBSERVACION"),
}

SALIDA_SINONIMOS = {
    "fecha":           ("FECHA DE SALIDA", "FECHA SALIDA", "FECHA"),
    "hora":            ("HORA SALIDA", "HORA DE SALIDA", "HORA"),
    "turno":           ("TURNO",),
    "grupo":           ("GRUPO",),
    "hostal":          ("HOSTAL", "HOTEL"),
    "empresa":         ("EMPRESA",),
    "folio":           ("FOLIO", "N FOLIO"),
    "habitacion":      ("N HABITACION", "N HAB", "HABITACION", "HAB"),
    "nombre":          ("NOMBRE",),
    "rut":             ("RUT",),
    "celular":         ("CELULAR", "TELEFONO"),
    "cargo":           ("CARGO",),
    "motivo":          ("MOTIVO",),
    "desayuno":        ("DESAYUNO",),
    "almuerzo":        ("ALMUERZO",),
    "cena":            ("CENA",),
    "chip":            ("CHIP",),
    "llaves":          ("LLAVES",),
    "observaciones":   ("OBSERVACIONES", "OBSERVACION"),
}

# Hoja de registro oficial (la matriz persona x dia).
# ISAM la llama 'R. OFICIAL', ALMAR WATER 'REGISTRO OFICIAL', y no comparten
# orden de columnas: ALMAR WATER agrega GRUPO y dos columnas de extras.
OFICIAL_SINONIMOS = {
    "tipo_habitacion":   ("TIPO",),
    "hostal":            ("HOTEL", "HOSTAL"),
    "empresa":           ("EMPRESA",),
    "grupo":             ("GRUPO",),
    "folio":             ("FOLIO", "N FOLIO"),
    "habitacion":        ("HABITACION", "N HAB", "HAB"),
    "nombre":            ("NOMBRE",),
    "rut":               ("RUT",),
    "cargo":             ("CARGO",),
    "observacion":       ("OBSERVACION", "OBSERVACIONES"),
    "almuerzo_extra":    ("ALMUERZO EXTRA ISAM", "ALM EXTRA TRABAJADORES",
                          "COLACION EXTRA BODEGUERO"),
    "estacionamiento":   ("ESTACIONAMIENTO",),
    "patente":           ("PATENTE VEHICULO", "PATENTE"),
    "total_alojamiento": ("ALOJAMIENTO",),
    "fecha_ingreso":     ("FECHA INGRESO",),
}

# Hoja ALMUERZOS ISAM.
ALMUERZO_SINONIMOS = {
    "fecha":          ("FECHA",),
    "nombre":         ("NOMBRE",),
    "rut":            ("RUT",),
    "empresa":        ("EMPRESA",),
    "tipo_servicio":  ("ALMUERZO CENA", "ALMUERZO", "SERVICIO"),
    "cantidad":       ("CANTIDAD",),
    "hostal":         ("HOSTAL", "HOTEL"),
}

# Nombres de hoja que no son datos operativos.
HOJAS_IGNORADAS_PREFIJOS = ("REGISTRO OFICIAL (", )

# Etiquetas del pie de las hojas diarias. Debajo de los datos hay un bloque de
# totales cuya primera columna cae justo en la columna NOMBRE, asi que sin esta
# lista se cargarian 'HAB', 'TOTAL' e 'ISAM' como si fueran huespedes.
# Al encontrar la primera, se deja de leer la hoja.
ETIQUETAS_PIE = (
    "HAB", "TOTAL", "ISAM", "TOTAL TRABAJADORES", "DESAYUNOS", "DESAYUNO",
    "CEN", "CENA", "ALMUERZO", "COLACION NORMAL", "COLACION ESPECIAL",
    "TOTALES", "RESUMEN",
)

# Texto marcador en ALMUERZOS ISAM: la fila existe solo para dejar constancia
# de que ese dia no hubo almuerzos. No es una persona.
MARCADORES_SIN_DATOS = ("SIN ALMUERZOS", "SIN ALMUERZO", "SIN COLACION", "SIN CENA")

# Valor del Excel -> tipo_servicio del enum.
SERVICIOS = {
    "desayuno":          "DESAYUNO",
    "almuerzo":          "ALMUERZO",
    "cena":              "CENA",
    "colacion_normal":   "COLACION_NORMAL",
    "colacion_especial": "COLACION_ESPECIAL",
}

# Textos que aparecen en las celdas de servicio y que NO son el servicio en si,
# sino una variante del mismo (dieta o agregado). Se guardan en la columna
# 'variante' de core.servicio_consumo.
VARIANTES_SERVICIO = (
    "HIPOCALORICO", "2 HUEVOS DUROS", "2 HUEVO", "2 PANCITOS", "PANCITOS",
)
