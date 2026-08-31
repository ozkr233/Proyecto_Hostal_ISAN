"""CLI del ETL.

    python -m etl.main --archivo "Excels/ISAM JULIO 2026 .xlsx" --mes 2026-07
    python -m etl.main --todos --mes 2026-07
    python -m etl.main --todos --mes 2026-07 --dry-run

--dry-run lee y normaliza los libros sin tocar la base. Sirve para revisar que
el layout se entendio bien antes de levantar Postgres.
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import warnings
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

from . import lectores

# openpyxl avisa de celdas con formato de fecha que contienen un telefono
# ('955390523'). Es un error del Excel, no del ETL; se informa una vez al final.
warnings.filterwarnings("ignore", message=".*is marked as a date but.*")


def dsn_desde_entorno() -> str:
    load_dotenv()
    if os.getenv("DATABASE_URL"):
        return os.environ["DATABASE_URL"]
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'hostal_isan')} "
        f"user={os.getenv('POSTGRES_USER', 'hostal')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'hostal')}"
    )


def mes_valido(texto: str) -> dt.date:
    try:
        return dt.datetime.strptime(texto, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise argparse.ArgumentTypeError(f"formato de mes invalido: {texto!r} (se espera AAAA-MM)")


def leer(ruta: Path, mes: dt.date) -> dict:
    """Lee un libro y resume en pantalla lo que encontro."""
    print()
    print(f"=== {ruta.name} ===")
    libro = {
        "archivo": ruta.name,
        "diarias": lectores.leer_hojas_diarias(ruta, mes.year, mes.month),
        "oficial": lectores.leer_registro_oficial(ruta, mes.year, mes.month),
        "almuerzos": lectores.leer_almuerzos(ruta, mes.year, mes.month),
    }
    ingresos = sum(1 for r in libro["diarias"] if r["bloque"] == "INGRESO")
    salidas = len(libro["diarias"]) - ingresos
    print(f"  hojas diarias : {ingresos} ingresos, {salidas} salidas")
    print(f"  perfiles      : {dict(Counter(r['perfil'] for r in libro['diarias']))}")
    print(f"  registro ofic.: {len(libro['oficial'])} noches")
    print(f"  almuerzos     : {len(libro['almuerzos'])} servicios")

    fechas = [r["fecha"] for r in libro["almuerzos"] if r["fecha"]]
    if fechas:
        print(f"  almuerzos: rango {min(fechas)} a {max(fechas)}")
    return libro


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="Carga los libros Excel del hostal a Postgres.")
    p.add_argument("--archivo", type=Path, action="append", default=[],
                   help="ruta a un .xlsx; se puede repetir")
    p.add_argument("--todos", action="store_true",
                   help="procesa todos los .xlsx de --directorio")
    p.add_argument("--directorio", type=Path, default=Path("Excels"))
    p.add_argument("--mes", type=mes_valido, required=True, help="AAAA-MM del libro")
    p.add_argument("--dry-run", action="store_true",
                   help="lee y normaliza sin escribir en la base")
    args = p.parse_args(argv)

    rutas = list(args.archivo)
    if args.todos:
        rutas += sorted(r for r in args.directorio.glob("*.xlsx")
                        if not r.name.startswith("~$"))
    if not rutas:
        p.error("indica --archivo o --todos")

    faltantes = [r for r in rutas if not r.is_file()]
    if faltantes:
        for r in faltantes:
            print(f"no existe: {r}", file=sys.stderr)
        return 1

    libros = [leer(ruta, args.mes) for ruta in rutas]

    if args.dry_run:
        print()
        print("(dry-run: no se escribio en la base)")
        return 0

    # Todos los libros van juntos en una sola transaccion: las hojas diarias de
    # un libro pueden necesitar estadias del otro para deducir hostal y empresa.
    from . import cargar
    resumenes = cargar.ejecutar(dsn_desde_entorno(), args.mes, libros)

    print()
    total_rechazos = 0
    for archivo, res in resumenes.items():
        print(f"{archivo}")
        print(f"  -> staging {res.crudas} filas")
        print(f"  -> core    {res.estadias} estadias, {res.noches} noches, "
              f"{res.servicios} servicios, {res.eventos} eventos")
        if res.rechazos:
            print(f"  -> RECHAZOS {res.rechazos}")
        total_rechazos += res.rechazos
    if total_rechazos:
        print()
        print(f"{total_rechazos} filas rechazadas; revisar staging.rechazo")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
