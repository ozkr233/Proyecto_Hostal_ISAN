"""Limpieza de los valores crudos del Excel.

Cada funcion recibe lo que openpyxl haya devuelto (str, int, float, datetime,
time o None) y entrega un valor tipado, o None si la celda no dice nada util.
Ninguna lanza excepcion por dato sucio: devuelven None y el llamador decide
si eso es un rechazo o simplemente un campo vacio.
"""

from __future__ import annotations

import datetime as dt
import re
import unicodedata

from . import config

# Excel guarda fechas como dias desde esta epoca (con el bug del 1900 ya
# incorporado, por eso 1899-12-30 y no 1899-12-31).
EPOCA_EXCEL = dt.date(1899, 12, 30)

# Rango plausible de seriales de fecha: 2010-01-01 .. 2069-12-31.
SERIAL_MIN, SERIAL_MAX = 40179, 62092


def texto(valor) -> str | None:
    """Texto limpio, o None si la celda esta vacia."""
    if valor is None:
        return None
    s = str(valor).strip()
    s = re.sub(r"\s+", " ", s)
    if s == "" or s == "-":
        return None
    return s


def norm(valor) -> str | None:
    """Texto en mayusculas, sin acentos ni espacios repetidos. Para comparar."""
    s = texto(valor)
    if s is None:
        return None
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.upper()


def norm_encabezado(valor) -> str | None:
    """Normaliza un encabezado para parear contra las listas de sinonimos.

    Ademas de norm(), quita la puntuacion: asi 'N° FOLIO' y 'N FOLIO' son lo
    mismo, y 'HAB TIPO DOBLE- SINGLE' queda como 'HAB TIPO DOBLE SINGLE'.

    Los indicadores ordinales se borran ANTES de normalizar. Es imprescindible:
    las hojas escriben 'Nª FOLIO' y 'Nº HAB', y la descomposicion NFKD convierte
    'ª' en 'a' y 'º' en 'o', dejando 'NA FOLIO' y 'NO HAB'. Con eso ninguna de
    las dos columnas pareaba, y folio y habitacion se perdian en todo el libro.
    """
    if valor is None:
        return None
    s = norm(re.sub(r"[ªº°]", " ", str(valor)))
    if s is None:
        return None
    s = re.sub(r"[^A-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s or None


# ---------------------------------------------------------------------------
# RUT
# ---------------------------------------------------------------------------

def _dv_esperado(cuerpo: str) -> str:
    suma, factor = 0, 2
    for ch in reversed(cuerpo):
        suma += int(ch) * factor
        factor = 2 if factor == 7 else factor + 1
    resto = 11 - (suma % 11)
    return {11: "0", 10: "K"}.get(resto, str(resto))


def rut(valor) -> tuple[str | None, bool]:
    """Devuelve (rut_normalizado, es_valido).

    Normalizado = solo digitos + DV en mayuscula, sin puntos ni guion.
    El Excel trae ambas formas ('18089941-3' y '180899413'), y tambien RUT
    invalidos o vacios. Los invalidos NO se descartan: se marcan, porque la
    persona igual existe y hay que poder cobrarle a su empresa.
    """
    s = norm(valor)
    if s is None:
        return None, False

    s = re.sub(r"[^0-9K]", "", s)
    if len(s) < 7 or len(s) > 10:
        return None, False

    cuerpo, dv = s[:-1], s[-1]
    if not cuerpo.isdigit():
        return None, False

    return s, _dv_esperado(cuerpo) == dv


# ---------------------------------------------------------------------------
# Fechas y horas
# ---------------------------------------------------------------------------

def fecha(valor) -> dt.date | None:
    """Fecha desde cualquiera de las formas que usa el Excel.

    Las hojas mezclan tres representaciones de la misma fecha:
      * datetime real (openpyxl ya la convirtio),
      * serial de Excel, p.ej. 46204 = 2026-07-01,
      * texto 'dd-mm-yyyy' o 'dd/mm/yyyy'.
    """
    if valor is None:
        return None
    if isinstance(valor, dt.datetime):
        return valor.date()
    if isinstance(valor, dt.date):
        return valor

    if isinstance(valor, (int, float)):
        n = int(valor)
        if SERIAL_MIN <= n <= SERIAL_MAX:
            return EPOCA_EXCEL + dt.timedelta(days=n)
        return None

    s = texto(valor)
    if s is None:
        return None

    # Un serial que llego como texto.
    if re.fullmatch(r"\d{5}", s):
        n = int(s)
        if SERIAL_MIN <= n <= SERIAL_MAX:
            return EPOCA_EXCEL + dt.timedelta(days=n)
        return None

    for patron in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%y", "%d/%m/%y"):
        try:
            return dt.datetime.strptime(s, patron).date()
        except ValueError:
            continue
    return None


def hora(valor) -> dt.time | None:
    """Hora desde fraccion de dia, datetime, time o texto 'HH:MM'.

    El Excel guarda las horas como fraccion: 0.29166666666666669 = 07:00.
    """
    if valor is None:
        return None
    if isinstance(valor, dt.datetime):
        return valor.time()
    if isinstance(valor, dt.time):
        return valor

    if isinstance(valor, (int, float)):
        frac = float(valor) % 1.0
        if frac == 0.0 and float(valor) != 0.0:
            return None          # es un serial de fecha, no una hora
        segundos = int(round(frac * 86400))
        segundos = min(segundos, 86399)
        return dt.time(segundos // 3600, (segundos % 3600) // 60, segundos % 60)

    s = texto(valor)
    if s is None:
        return None
    for patron in ("%H:%M:%S", "%H:%M", "%H.%M"):
        try:
            return dt.datetime.strptime(s, patron).time()
        except ValueError:
            continue
    try:
        return hora(float(s.replace(",", ".")))
    except ValueError:
        return None


def dia_desde_hoja(nombre_hoja: str) -> int | None:
    """Extrae el numero de dia del nombre de la hoja.

    Los nombres son irregulares: '01- JULIO', ' 03- JULIO', '15-JULIO',
    '31  JULIO'. Se exige que aparezca un mes conocido para no confundir
    una hoja de datos con otra cosa.
    """
    s = norm_encabezado(nombre_hoja)
    if not s:
        return None
    m = re.match(r"^(\d{1,2})\s*([A-Z]+)$", s)
    if not m:
        return None
    dia, mes = int(m.group(1)), m.group(2)
    if mes not in config.MESES or not 1 <= dia <= 31:
        return None
    return dia


def dia_desde_encabezado(valor) -> int | None:
    """Numero de dia desde un encabezado de columna tipo '01 JULIO' / '2  JULIO'."""
    s = norm_encabezado(valor)
    if not s:
        return None
    m = re.match(r"^(\d{1,2})\s+([A-Z]+)$", s)
    if not m:
        return None
    dia, mes = int(m.group(1)), m.group(2)
    if mes not in config.MESES or not 1 <= dia <= 31:
        return None
    return dia


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

def tipo_habitacion(valor) -> str | None:
    s = norm(valor)
    if s is None:
        return None
    if s.startswith("DOBLE"):
        return "DOBLE"
    if s.startswith("SINGLE"):
        return "SINGLE"
    return None


def turno(valor) -> str | None:
    """Marca de turno de una noche: D, N o E. Cualquier otra cosa es None."""
    s = norm(valor)
    if s is None:
        return None
    inicial = s[0]
    return inicial if inicial in ("D", "N", "E") else None


def grupo(valor) -> str | None:
    s = norm(valor)
    if s is None:
        return None
    return s[0] if s[0] in ("A", "B") else None


def entrega(valor) -> str:
    """Estado de devolucion de chip o llaves."""
    s = norm(valor)
    if s is None:
        return "NO_APLICA"
    if "NO SE" in s or s.startswith("NO"):
        return "NO_ENTREGADA"
    if "ENTREG" in s or s in ("SI", "S"):
        return "ENTREGADA"
    return "NO_APLICA"


def booleano(valor) -> bool:
    s = norm(valor)
    if s is None:
        return False
    return s not in ("NO", "N", "0", "FALSE")


def servicio_marcado(valor) -> bool:
    """True si la celda de un servicio significa que SI se consumio.

    Los dos libros marcan lo mismo de formas distintas: el bloque de ingreso
    escribe la palabra ('DESAYUNO', 'ALMUERZO', 'HIPOCALORICO') y el de salida
    usa banderas 'SI'/'NO'. Sin esta distincion, un 'NO' se contaria como una
    comida servida.
    """
    s = norm(valor)
    if s is None:
        return False
    return s not in ("NO", "N", "0", "NO APLICA", "N/A")


def es_etiqueta_pie(valor) -> bool:
    """True si la celda es una etiqueta del bloque de totales de la hoja."""
    s = norm(valor)
    return s is not None and s in config.ETIQUETAS_PIE


def cargo(valor) -> str | None:
    """Cargo del trabajador, descartando lo que no lo es.

    La columna CARGO de las hojas ISAM se usa a veces para anotar una hora
    ('16:00:00') o un numero. Eso no es un cargo y no debe llegar al catalogo.
    """
    if isinstance(valor, (dt.time, dt.datetime, int, float)):
        return None
    s = texto(valor)
    if s is None:
        return None
    if re.fullmatch(r"[\d\s:.,/-]+", s):
        return None
    return s


def es_marcador_sin_datos(valor) -> bool:
    """True para las filas 'SIN ALMUERZOS' de la hoja ALMUERZOS ISAM."""
    s = norm(valor)
    return s is not None and any(m in s for m in config.MARCADORES_SIN_DATOS)


def variante_servicio(valor) -> str | None:
    """Extrae la variante de dieta si la celda de servicio trae una.

    'DESAYUNO' -> None ; 'HIPOCALORICO' -> 'HIPOCALORICO' ;
    '2 PANCITOS' -> '2 PANCITOS'.
    """
    s = norm(valor)
    if s is None:
        return None
    for v in config.VARIANTES_SERVICIO:
        if v in s:
            return v
    return None


def cantidad(valor, defecto: int = 1) -> int:
    if valor is None:
        return defecto
    try:
        n = int(float(str(valor).strip().replace(",", ".")))
    except (TypeError, ValueError):
        return defecto
    return n if n > 0 else defecto
