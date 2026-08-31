"""Verificacion estatica del esquema y del SQL del ETL, sin base de datos.

    python -m etl.verificar

Hace tres cosas:

  1. Parsea todos los db/*.sql con el parser real de PostgreSQL (pglast), asi
     que un error de sintaxis se detecta antes de levantar el contenedor.
  2. Extrae las columnas de cada CREATE TABLE y comprueba que todos los
     INSERT de cargar.py apunten a tablas y columnas que existen. Este es el
     error mas facil de cometer al editar el DDL y el ETL por separado.
  3. Comprueba que las vistas de rpt solo lean tablas conocidas.

Es un complemento de la carga real, no un reemplazo: no valida tipos,
restricciones ni resultados.
"""

from __future__ import annotations

import ast
import io
import re
import sys
from pathlib import Path

import pglast
from pglast import ast as pgast

RAIZ = Path(__file__).resolve().parent.parent
DIR_DB = RAIZ / "db"


def tablas_del_ddl() -> dict[str, set[str]]:
    """'esquema.tabla' -> conjunto de columnas, leido de los CREATE TABLE."""
    tablas: dict[str, set[str]] = {}
    for archivo in sorted(DIR_DB.glob("*.sql")):
        arbol = pglast.parse_sql(io.open(archivo, encoding="utf-8").read())
        for sentencia in arbol:
            nodo = sentencia.stmt
            if not isinstance(nodo, pgast.CreateStmt):
                continue
            rel = nodo.relation
            nombre = f"{rel.schemaname or 'public'}.{rel.relname}"
            columnas = {
                e.colname for e in (nodo.tableElts or [])
                if isinstance(e, pgast.ColumnDef) and e.colname
            }
            tablas[nombre] = columnas
    return tablas


def _sql_de(fuente: str) -> list[tuple[int, str]]:
    """Literales de cadena que parecen sentencias SQL, con su numero de linea."""
    arbol = ast.parse(fuente)
    encontrados = []
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Constant) and isinstance(nodo.value, str):
            if re.match(r"\s*(INSERT|UPDATE|DELETE|SELECT|WITH)\b", nodo.value, re.I):
                encontrados.append((nodo.lineno, nodo.value))
    return encontrados


def _sin_marcadores(sql: str) -> str:
    """Reemplaza los marcadores de psycopg para que el parser acepte el SQL."""
    return re.sub(r"%\(\w+\)s", "NULL", sql).replace("%s", "NULL")


def revisar_inserts(tablas: dict[str, set[str]]) -> list[str]:
    problemas: list[str] = []
    fuente = io.open(RAIZ / "etl" / "cargar.py", encoding="utf-8").read()

    for linea, sql in _sql_de(fuente):
        try:
            arbol = pglast.parse_sql(_sin_marcadores(sql))
        except Exception as e:
            # El literal de una f-string llega partido; se valida aparte.
            if "INSERT INTO staging.registro_crudo (" in sql:
                continue
            problemas.append(f"cargar.py:{linea} sintaxis: {e}")
            continue

        for sentencia in arbol:
            nodo = sentencia.stmt
            if not isinstance(nodo, pgast.InsertStmt):
                continue
            rel = nodo.relation
            tabla = f"{rel.schemaname or 'public'}.{rel.relname}"
            if tabla not in tablas:
                problemas.append(f"cargar.py:{linea} tabla desconocida: {tabla}")
                continue
            for col in (nodo.cols or []):
                if col.name and col.name not in tablas[tabla]:
                    problemas.append(
                        f"cargar.py:{linea} {tabla} no tiene la columna '{col.name}'")
    return problemas


def revisar_cols_crudo(tablas: dict[str, set[str]]) -> list[str]:
    """COLS_CRUDO se interpola en un f-string, asi que se revisa por separado."""
    from .cargar import COLS_CRUDO
    faltan = [c for c in COLS_CRUDO if c not in tablas.get("staging.registro_crudo", set())]
    return [f"cargar.py COLS_CRUDO: staging.registro_crudo no tiene '{c}'" for c in faltan]


def revisar_vistas(tablas: dict[str, set[str]]) -> list[str]:
    """Las vistas de rpt solo deben leer tablas que existan en el DDL."""
    problemas = []
    conocidas = set(tablas) | {"core.norm_texto"}
    for archivo in sorted(DIR_DB.glob("*.sql")):
        texto = io.open(archivo, encoding="utf-8").read()
        for esquema, tabla in re.findall(r"\b(?:FROM|JOIN)\s+(core|staging)\.(\w+)", texto):
            nombre = f"{esquema}.{tabla}"
            if nombre not in conocidas:
                problemas.append(f"{archivo.name}: referencia a tabla inexistente {nombre}")
    return problemas


def main() -> int:
    archivos = sorted(DIR_DB.glob("*.sql"))
    if not archivos:
        print(f"no hay .sql en {DIR_DB}", file=sys.stderr)
        return 1

    problemas: list[str] = []
    for archivo in archivos:
        try:
            n = len(pglast.parse_sql(io.open(archivo, encoding="utf-8").read()))
            print(f"  OK  {archivo.name:26s} {n:3d} sentencias")
        except Exception as e:
            problemas.append(f"{archivo.name}: {e}")
            print(f"  MAL {archivo.name}: {e}")

    tablas = tablas_del_ddl()
    print(f"\n  {len(tablas)} tablas en el DDL:")
    for nombre in sorted(tablas):
        print(f"    {nombre:34s} {len(tablas[nombre]):2d} columnas")

    problemas += revisar_inserts(tablas)
    problemas += revisar_cols_crudo(tablas)
    problemas += revisar_vistas(tablas)

    print()
    if problemas:
        for p in problemas:
            print(f"  PROBLEMA: {p}")
        print(f"\n{len(problemas)} problema(s).")
        return 1

    print("Sin problemas: sintaxis valida y el SQL del ETL calza con el DDL.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
