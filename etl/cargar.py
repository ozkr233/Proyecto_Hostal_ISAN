"""Carga a Postgres: staging primero, luego promocion a core.

Estrategia de idempotencia: recargar un archivo BORRA primero todo lo que ese
archivo produjo (por origen_archivo) y lo vuelve a insertar. Las personas no se
borran, porque son compartidas entre archivos y meses.

Orden de promocion, y por que:

  1. Registro oficial -> estadias + noches. Es la fuente autoritativa: trae una
     fila por estadia con folio, habitacion y la marca D/N/E de cada dia, e
     incluye estadias con huecos que no se pueden reconstruir desde el rango
     ingreso-salida.
  2. Hojas diarias, bloque INGRESO -> enriquece la estadia (hora de llegada) y
     genera los servicios del dia.
  3. Hojas diarias, bloque SALIDA -> cierra la estadia. Si no hay ninguna
     abierta que calce, se crea una marcada para revision en vez de perder el
     dato o inventar un ingreso.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass

import psycopg
from psycopg.rows import dict_row

from . import config
from . import normalizar as nz


class Catalogos:
    """Resuelve y cachea ids de catalogo. Una instancia por conexion."""

    def __init__(self, cur):
        self.cur = cur
        self._hostal: dict[str, int] = {}
        self._empresa: dict[str, int] = {}
        self._cargo: dict[str, int] = {}
        self._habitacion: dict[tuple[int, str], int] = {}
        self._persona_rut: dict[str, int] = {}
        self._persona_nombre: dict[str, int] = {}

        self.cur.execute("SELECT codigo, id FROM core.hostal")
        self._hostal = {r["codigo"]: r["id"] for r in self.cur.fetchall()}

        self.cur.execute(
            "SELECT core.norm_texto(alias) AS a, empresa_id FROM core.empresa_alias")
        self._empresa = {r["a"]: r["empresa_id"] for r in self.cur.fetchall()}

    # -- catalogos cerrados: no se crean solos ------------------------------

    def hostal(self, valor) -> int | None:
        s = nz.texto(valor)
        return self._hostal.get(s) if s else None

    def empresa(self, valor) -> int | None:
        """Resuelve contra los alias conocidos.

        Deliberadamente NO crea empresas nuevas: un 'LFT' o un 'M. ERRAZUDIZ'
        se resolveria como empresa distinta y partiria la facturacion en dos.
        Lo desconocido va a staging.rechazo para que alguien lo mire.
        """
        s = nz.norm(valor)
        return self._empresa.get(s) if s else None

    # -- catalogos abiertos: crecen con los datos ---------------------------

    def cargo(self, valor) -> int | None:
        s = nz.cargo(valor)
        if not s:
            return None
        clave = nz.norm(s)
        if clave in self._cargo:
            return self._cargo[clave]
        self.cur.execute(
            """INSERT INTO core.cargo (nombre) VALUES (%s)
               ON CONFLICT DO NOTHING
               RETURNING id""", (s,))
        fila = self.cur.fetchone()
        if fila is None:
            self.cur.execute(
                "SELECT id FROM core.cargo WHERE core.norm_texto(nombre) = core.norm_texto(%s)", (s,))
            fila = self.cur.fetchone()
        self._cargo[clave] = fila["id"]
        return fila["id"]

    def habitacion(self, hostal_id: int | None, numero, tipo=None) -> int | None:
        s = nz.texto(numero)
        if not hostal_id or not s:
            return None
        # '3.0' -> '3': openpyxl devuelve numeros para las habitaciones.
        try:
            s = str(int(float(s)))
        except ValueError:
            pass
        clave = (hostal_id, s)
        if clave in self._habitacion:
            return self._habitacion[clave]
        self.cur.execute(
            """INSERT INTO core.habitacion (hostal_id, numero, tipo)
               VALUES (%s, %s, %s)
               ON CONFLICT (hostal_id, numero) DO UPDATE
                   SET tipo = COALESCE(core.habitacion.tipo, EXCLUDED.tipo)
               RETURNING id""",
            (hostal_id, s, nz.tipo_habitacion(tipo)))
        self._habitacion[clave] = self.cur.fetchone()["id"]
        return self._habitacion[clave]

    def persona(self, nombre, rut_crudo, celular=None, cargo_crudo=None) -> int | None:
        """Busca o crea la persona.

        Identidad: el RUT cuando existe y, si no, el nombre normalizado. Un RUT
        invalido igual sirve de identificador -- se guarda marcado como invalido,
        porque la persona existe aunque el dato este mal escrito.
        """
        nombre = nz.texto(nombre)
        if not nombre:
            return None
        rut_norm, rut_ok = nz.rut(rut_crudo)
        cargo_id = self.cargo(cargo_crudo)
        celular = nz.texto(celular)

        if rut_norm and rut_norm in self._persona_rut:
            pid = self._persona_rut[rut_norm]
            self._completar_persona(pid, celular, cargo_id)
            return pid

        clave_nombre = nz.norm(nombre)
        if not rut_norm and clave_nombre in self._persona_nombre:
            pid = self._persona_nombre[clave_nombre]
            self._completar_persona(pid, celular, cargo_id)
            return pid

        if rut_norm:
            self.cur.execute(
                "SELECT id FROM core.persona WHERE rut_normalizado = %s", (rut_norm,))
        else:
            self.cur.execute(
                """SELECT id FROM core.persona
                   WHERE rut_normalizado IS NULL
                     AND core.norm_texto(nombre) = core.norm_texto(%s)""", (nombre,))
        fila = self.cur.fetchone()

        if fila is None:
            self.cur.execute(
                """INSERT INTO core.persona (rut_normalizado, rut_valido, nombre, celular, cargo_id)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (rut_norm, rut_ok, nombre, celular, cargo_id))
            fila = self.cur.fetchone()
        else:
            self._completar_persona(fila["id"], celular, cargo_id)

        if rut_norm:
            self._persona_rut[rut_norm] = fila["id"]
        else:
            self._persona_nombre[clave_nombre] = fila["id"]
        return fila["id"]

    def _completar_persona(self, persona_id: int, celular, cargo_id):
        """Rellena celular y cargo si faltaban. Nunca pisa un dato existente."""
        if celular is None and cargo_id is None:
            return
        self.cur.execute(
            """UPDATE core.persona
                  SET celular  = COALESCE(celular, %s),
                      cargo_id = COALESCE(cargo_id, %s)
                WHERE id = %s
                  AND (celular IS NULL OR cargo_id IS NULL)""",
            (celular, cargo_id, persona_id))


@dataclass
class Resumen:
    crudas: int = 0
    estadias: int = 0
    noches: int = 0
    servicios: int = 0
    eventos: int = 0
    rechazos: int = 0


def rechazar(cur, archivo, hoja, fila, bloque, motivo, detalle=None):
    cur.execute(
        """INSERT INTO staging.rechazo (archivo_origen, hoja, fila, bloque, motivo, detalle)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (archivo, hoja, fila, bloque, motivo, psycopg.types.json.Jsonb(detalle) if detalle else None))


def limpiar_archivo(cur, archivo: str):
    """Borra todo lo que este archivo produjo, para poder recargarlo limpio.

    Las personas y los catalogos NO se borran: son compartidos entre archivos
    y meses, y volver a crearlos perderia los ids referenciados por otras cargas.
    """
    cur.execute("DELETE FROM core.servicio_consumo WHERE origen_archivo = %s", (archivo,))
    # estadia_noche y estadia_evento caen por ON DELETE CASCADE.
    cur.execute("DELETE FROM core.estadia WHERE origen_archivo = %s", (archivo,))
    cur.execute("DELETE FROM staging.registro_crudo WHERE archivo_origen = %s", (archivo,))
    cur.execute("DELETE FROM staging.registro_oficial_crudo WHERE archivo_origen = %s", (archivo,))
    cur.execute("DELETE FROM staging.almuerzo_crudo WHERE archivo_origen = %s", (archivo,))
    cur.execute("DELETE FROM staging.rechazo WHERE archivo_origen = %s", (archivo,))


# ---------------------------------------------------------------------------
# staging
# ---------------------------------------------------------------------------

COLS_CRUDO = (
    "archivo_origen", "hoja", "fila", "bloque", "perfil", "fecha_hoja",
    "hostal", "empresa", "folio", "habitacion", "tipo_habitacion", "grupo",
    "turno", "nombre", "rut", "celular", "cargo", "fecha", "hora", "motivo",
    "observaciones", "cambio_sabanas", "desayuno", "almuerzo", "cena",
    "colacion_normal", "colacion_especial", "sub", "chip", "llaves",
)


def cargar_staging(cur, diarias, oficial, almuerzos) -> int:
    if diarias:
        cur.executemany(
            f"""INSERT INTO staging.registro_crudo ({', '.join(COLS_CRUDO)})
                VALUES ({', '.join(['%s'] * len(COLS_CRUDO))})""",
            [tuple(nz.texto(r.get(c)) if c not in ("fila", "fecha_hoja") else r.get(c)
                   for c in COLS_CRUDO) for r in diarias])

    if oficial:
        cur.executemany(
            """INSERT INTO staging.registro_oficial_crudo
               (archivo_origen, hoja, fila, tipo_habitacion, hostal, empresa, folio,
                habitacion, nombre, rut, cargo, observacion, almuerzo_extra,
                estacionamiento, patente, total_alojamiento, fecha, marca)
               VALUES (%(archivo_origen)s, %(hoja)s, %(fila)s, %(tipo_habitacion)s,
                       %(hostal)s, %(empresa)s, %(folio)s, %(habitacion)s, %(nombre)s,
                       %(rut)s, %(cargo)s, %(observacion)s, %(almuerzo_extra)s,
                       %(estacionamiento)s, %(patente)s, %(total_alojamiento)s,
                       %(fecha)s, %(marca)s)""",
            oficial)

    if almuerzos:
        cur.executemany(
            """INSERT INTO staging.almuerzo_crudo
               (archivo_origen, hoja, fila, fecha, nombre, rut, empresa,
                tipo_servicio, cantidad, hostal, autorizado_por)
               VALUES (%(archivo_origen)s, %(hoja)s, %(fila)s, %(fecha)s, %(nombre)s,
                       %(rut)s, %(empresa)s, %(tipo_servicio)s, %(cantidad)s,
                       %(hostal)s, %(autorizado_por)s)""",
            [{**r, "fecha": str(r["fecha"]) if r.get("fecha") else None,
              "cantidad": str(r.get("cantidad") or 1)} for r in almuerzos])

    return len(diarias) + len(oficial) + len(almuerzos)


# ---------------------------------------------------------------------------
# promocion a core
# ---------------------------------------------------------------------------

def promover_oficial(cur, cat: Catalogos, oficial: list[dict], res: Resumen) -> dict:
    """Crea una estadia por fila del registro oficial y sus noches.

    Devuelve el indice (persona_id, hostal_id) -> [estadia_id], que despues usan
    las hojas diarias para no duplicar estadias.
    """
    indice: dict[tuple[int, int], list[int]] = {}
    por_fila: dict[tuple[str, int], int] = {}

    for r in oficial:
        clave = (r["hoja"], r["fila"])
        estadia_id = por_fila.get(clave)

        if estadia_id is None:
            hostal_id = cat.hostal(r["hostal"])
            empresa_id = cat.empresa(r["empresa"])
            if hostal_id is None or empresa_id is None:
                rechazar(cur, r["archivo_origen"], r["hoja"], r["fila"], "OFICIAL",
                         "hostal o empresa no reconocidos",
                         {"hostal": r["hostal"], "empresa": r["empresa"]})
                res.rechazos += 1
                por_fila[clave] = -1
                continue

            persona_id = cat.persona(r["nombre"], r["rut"], cargo_crudo=r["cargo"])
            if persona_id is None:
                rechazar(cur, r["archivo_origen"], r["hoja"], r["fila"], "OFICIAL",
                         "fila sin nombre de persona")
                res.rechazos += 1
                por_fila[clave] = -1
                continue

            cur.execute(
                """INSERT INTO core.estadia
                     (persona_id, empresa_id, hostal_id, habitacion_id, folio,
                      tipo_habitacion, grupo, fecha_ingreso, observaciones,
                      patente_vehiculo, usa_estacionamiento,
                      origen_archivo, origen_hoja, origen_fila, origen_bloque)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'OFICIAL')
                   RETURNING id""",
                (persona_id, empresa_id, hostal_id,
                 cat.habitacion(hostal_id, r["habitacion"], r["tipo_habitacion"]),
                 r["folio"], nz.tipo_habitacion(r["tipo_habitacion"]),
                 nz.grupo(r["grupo"]),
                 # La estadia necesita al menos una fecha (CHECK de la tabla).
                 # El registro oficial de ISAM no trae fecha de ingreso, asi que
                 # se parte con la primera noche y se afina abajo con el minimo.
                 r.get("fecha_ingreso") or r["fecha"],
                 r["observacion"],
                 r["patente"], nz.booleano(r["estacionamiento"]),
                 r["archivo_origen"], r["hoja"], r["fila"]))
            estadia_id = cur.fetchone()["id"]
            res.estadias += 1
            por_fila[clave] = estadia_id
            indice.setdefault((persona_id, hostal_id), []).append(estadia_id)

            # 'almuerzo extra ISAM' / 'ALM EXTRA TRABAJADORES': se cobra aparte
            # de la pension, por eso es_extra.
            if nz.texto(r["almuerzo_extra"]):
                cur.execute(
                    """INSERT INTO core.servicio_consumo
                         (fecha, persona_id, estadia_id, hostal_id, empresa_id,
                          tipo_servicio, cantidad, es_extra, origen_archivo, origen_hoja)
                       VALUES (%s, %s, %s, %s, %s, 'ALMUERZO', %s, true, %s, %s)""",
                    (r["fecha"], persona_id, estadia_id, hostal_id, empresa_id,
                     nz.cantidad(r["almuerzo_extra"]), r["archivo_origen"], r["hoja"]))
                res.servicios += 1

        if estadia_id == -1:
            continue

        cur.execute(
            """INSERT INTO core.estadia_noche (estadia_id, fecha, turno)
               VALUES (%s, %s, %s)
               ON CONFLICT (estadia_id, fecha) DO UPDATE SET turno = EXCLUDED.turno""",
            (estadia_id, r["fecha"], nz.turno(r["marca"])))
        res.noches += 1

    # La fecha de ingreso real es la primera noche efectivamente registrada.
    # LEAST ignora los NULL, asi que sirve tanto si la fila traia fecha propia
    # como si se sembro con la primera noche vista.
    #
    # fecha_salida se deja deliberadamente en NULL: la ultima noche no es el
    # checkout. La fecha y hora de salida las pone el bloque SALIDA de la hoja
    # diaria, que es donde realmente se registra. Lo que quede sin cerrar
    # aparece en rpt.vw_calidad_datos en vez de inventarse.
    if oficial:
        cur.execute(
            """UPDATE core.estadia e
                  SET fecha_ingreso = LEAST(e.fecha_ingreso, n.desde)
                 FROM (SELECT estadia_id, min(fecha) AS desde
                         FROM core.estadia_noche GROUP BY estadia_id) n
                WHERE n.estadia_id = e.id AND e.origen_archivo = %s""",
            (oficial[0]["archivo_origen"],))

    return indice


def _buscar_estadia(cur, persona_id, hostal_id, fecha, folio):
    """Estadia de esa persona en ese hostal vigente en esa fecha.

    Se prefiere la que cubre la fecha; si hay varias se desempata por folio.
    """
    cur.execute(
        """SELECT id, folio FROM core.estadia
            WHERE persona_id = %s AND hostal_id = %s
              AND (fecha_ingreso IS NULL OR fecha_ingreso <= %s)
              AND (fecha_salida  IS NULL OR fecha_salida  >= %s)
            ORDER BY (folio IS NOT DISTINCT FROM %s) DESC, fecha_ingreso DESC NULLS LAST
            LIMIT 1""",
        (persona_id, hostal_id, fecha, fecha, nz.texto(folio)))
    fila = cur.fetchone()
    return fila["id"] if fila else None


def promover_diarias(cur, cat: Catalogos, diarias: list[dict], res: Resumen):
    for r in diarias:
        archivo, hoja, fila, bloque = (
            r["archivo_origen"], r["hoja"], r["fila"], r["bloque"])

        persona_id = cat.persona(r["nombre"], r.get("rut"), r.get("celular"), r.get("cargo"))
        if persona_id is None:
            rechazar(cur, archivo, hoja, fila, bloque, "fila sin nombre de persona")
            res.rechazos += 1
            continue

        fecha = nz.fecha(r.get("fecha")) or r.get("fecha_hoja")
        hostal_id = cat.hostal(r.get("hostal"))
        empresa_id = cat.empresa(r.get("empresa"))

        # El bloque de salida de ALMAR WATER no tiene columnas de hostal ni de
        # empresa: quien anota la salida ya sabe donde esta parado. Tampoco las
        # tienen algunas filas sueltas a las que se les olvido la empresa.
        #
        # En vez de rechazar la fila, se toman del alojamiento vigente de esa
        # persona en esa fecha, que es la misma deduccion que haria una persona
        # leyendo la planilla.
        if hostal_id is None or empresa_id is None:
            cur.execute(
                """SELECT hostal_id, empresa_id FROM core.estadia
                    WHERE persona_id = %s
                      AND (fecha_ingreso IS NULL OR fecha_ingreso <= %s)
                      AND (fecha_salida  IS NULL OR fecha_salida  >= %s)
                    ORDER BY fecha_ingreso DESC NULLS LAST
                    LIMIT 1""",
                (persona_id, fecha, fecha))
            vigente = cur.fetchone()
            if vigente is None:
                # Alguien que se retira habiendo llegado en un mes anterior no
                # tiene estadia vigente en este libro. Su ultimo alojamiento
                # conocido sigue siendo mejor dato que descartar la fila.
                cur.execute(
                    """SELECT hostal_id, empresa_id FROM core.estadia
                        WHERE persona_id = %s
                        ORDER BY fecha_ingreso DESC NULLS LAST LIMIT 1""",
                    (persona_id,))
                vigente = cur.fetchone()
            if vigente:
                hostal_id = hostal_id or vigente["hostal_id"]
                empresa_id = empresa_id or vigente["empresa_id"]

        if hostal_id is None or empresa_id is None:
            rechazar(cur, archivo, hoja, fila, bloque,
                     "hostal o empresa no reconocidos y sin alojamiento vigente",
                     {"hostal": r.get("hostal"), "empresa": r.get("empresa"),
                      "nombre": r.get("nombre")})
            res.rechazos += 1
            continue

        hora = nz.hora(r.get("hora"))
        estadia_id = _buscar_estadia(cur, persona_id, hostal_id, fecha, r.get("folio"))

        if estadia_id is None:
            # No hay estadia en el registro oficial que calce. Se crea una y se
            # marca: puede ser una salida sin ingreso previo, o una fila que el
            # registro oficial nunca recibio.
            nota = ("salida sin estadia abierta" if bloque == "SALIDA"
                    else "ingreso ausente del registro oficial")
            cur.execute(
                """INSERT INTO core.estadia
                     (persona_id, empresa_id, hostal_id, habitacion_id, folio,
                      tipo_habitacion, grupo, fecha_ingreso, hora_ingreso,
                      fecha_salida, hora_salida,
                      observaciones, requiere_revision, nota_revision,
                      origen_archivo, origen_hoja, origen_fila, origen_bloque)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s, %s, %s, %s, %s)
                   ON CONFLICT (origen_archivo, origen_hoja, origen_fila, origen_bloque)
                       WHERE origen_archivo IS NOT NULL AND origen_fila IS NOT NULL
                         AND origen_bloque IS NOT NULL
                   DO UPDATE SET nota_revision = EXCLUDED.nota_revision
                   RETURNING id""",
                (persona_id, empresa_id, hostal_id,
                 cat.habitacion(hostal_id, r.get("habitacion"), r.get("tipo_habitacion")),
                 r.get("folio"), nz.tipo_habitacion(r.get("tipo_habitacion")),
                 nz.grupo(r.get("grupo")),
                 fecha if bloque == "INGRESO" else None,
                 hora if bloque == "INGRESO" else None,
                 # Una estadia necesita al menos una fecha. Si esta fila es una
                 # salida huerfana, la unica que hay es la de salida.
                 fecha if bloque == "SALIDA" else None,
                 hora if bloque == "SALIDA" else None,
                 r.get("observaciones"), nota, archivo, hoja, fila, bloque))
            estadia_id = cur.fetchone()["id"]
            res.estadias += 1

        if bloque == "INGRESO":
            cur.execute(
                """UPDATE core.estadia
                      SET hora_ingreso  = COALESCE(hora_ingreso, %s),
                          habitacion_id = COALESCE(habitacion_id, %s),
                          folio         = COALESCE(folio, %s),
                          observaciones = COALESCE(observaciones, %s)
                    WHERE id = %s""",
                (hora, cat.habitacion(hostal_id, r.get("habitacion"), r.get("tipo_habitacion")),
                 nz.texto(r.get("folio")), nz.texto(r.get("observaciones")), estadia_id))
            res.eventos += _eventos(cur, r, estadia_id, fecha)
        else:
            cur.execute(
                """UPDATE core.estadia
                      SET fecha_salida     = COALESCE(fecha_salida, %s),
                          hora_salida      = COALESCE(hora_salida, %s),
                          motivo_salida    = COALESCE(motivo_salida, %s),
                          chip_devuelto    = %s,
                          llaves_devueltas = %s
                    WHERE id = %s
                      AND (fecha_ingreso IS NULL OR %s >= fecha_ingreso)""",
                (fecha, hora, nz.texto(r.get("motivo")),
                 nz.entrega(r.get("chip")), nz.entrega(r.get("llaves")),
                 estadia_id, fecha))

        # La pension se registra en AMBOS bloques: ISAM la anota al ingresar y
        # ALMAR WATER solo al salir, con banderas SI/NO. Se procesan los dos, y
        # no hay doble conteo porque el ingreso y la salida de una misma fila
        # son personas distintas.
        res.servicios += _servicios_del_dia(cur, r, estadia_id, persona_id,
                                            hostal_id, empresa_id, fecha)


def _servicios_del_dia(cur, r, estadia_id, persona_id, hostal_id, empresa_id, fecha) -> int:
    """Crea un servicio por cada columna de pension marcada en la fila."""
    n = 0
    for campo, tipo in config.SERVICIOS.items():
        crudo = r.get(campo)
        if not nz.servicio_marcado(crudo):
            continue
        cur.execute(
            """INSERT INTO core.servicio_consumo
                 (fecha, persona_id, estadia_id, hostal_id, empresa_id,
                  tipo_servicio, cantidad, variante, origen_archivo, origen_hoja)
               VALUES (%s, %s, %s, %s, %s, %s, 1, %s, %s, %s)""",
            (fecha, persona_id, estadia_id, hostal_id, empresa_id, tipo,
             nz.variante_servicio(crudo), r["archivo_origen"], r["hoja"]))
        n += 1
    return n


def _eventos(cur, r, estadia_id, fecha) -> int:
    """Traslada a la bitacora lo que el Excel escribe suelto.

    La columna CAMBIO DE SABANAS trae 'C/S' pero tambien 'cambio de hab' o
    'SE RETIRA MANANA A LAS 07:30'; MOTIVO trae 'ACREDITACION'. Cada cosa va a
    su tipo de evento en vez de quedar como texto libre en una columna que
    deberia ser un booleano.
    """
    n = 0
    sabanas = nz.norm(r.get("cambio_sabanas"))
    if sabanas:
        if sabanas in ("C/S", "CS", "C"):
            tipo = "CAMBIO_SABANAS"
        elif "HAB" in sabanas:
            tipo = "CAMBIO_HAB"
        elif "RETIRA" in sabanas or "SALE" in sabanas or "SE VA" in sabanas:
            tipo = "AVISO_SALIDA"
        else:
            tipo = "OTRO"
        cur.execute(
            """INSERT INTO core.estadia_evento (estadia_id, fecha, tipo, detalle)
               VALUES (%s, %s, %s, %s)""",
            (estadia_id, fecha, tipo, nz.texto(r.get("cambio_sabanas"))))
        n += 1
        if tipo == "CAMBIO_SABANAS":
            cur.execute(
                """UPDATE core.estadia_noche SET cambio_sabanas = true
                    WHERE estadia_id = %s AND fecha = %s""", (estadia_id, fecha))

    motivo = nz.norm(r.get("motivo"))
    if motivo and "ACREDITACION" in motivo:
        cur.execute(
            """INSERT INTO core.estadia_evento (estadia_id, fecha, tipo, detalle)
               VALUES (%s, %s, 'ACREDITACION', %s)""",
            (estadia_id, fecha, nz.texto(r.get("motivo"))))
        n += 1
    return n


def promover_almuerzos(cur, cat: Catalogos, almuerzos: list[dict], res: Resumen):
    """Hoja ALMUERZOS ISAM.

    Ojo: esta hoja NO se limita al mes del libro. En 'ISAM JULIO 2026' cubre de
    febrero a julio de 2026. Se cargan todas las fechas tal como vienen, sin
    recortar al mes, porque son consumos reales.
    """
    for r in almuerzos:
        if not r.get("fecha"):
            rechazar(cur, r["archivo_origen"], r["hoja"], r["fila"], "ALMUERZO",
                     "fila sin fecha legible", {"nombre": r.get("nombre")})
            res.rechazos += 1
            continue

        empresa_id = cat.empresa(r.get("empresa"))
        persona_id = cat.persona(r["nombre"], r.get("rut"))
        hostal_id = cat.hostal(r.get("hostal"))

        # A varias filas les falta el hostal. Si la persona estaba alojada ese
        # dia, el hostal es el de su alojamiento; se resuelve antes de rechazar.
        estadia_id = None
        if persona_id:
            cur.execute(
                """SELECT id, hostal_id, empresa_id FROM core.estadia
                    WHERE persona_id = %s
                      AND (fecha_ingreso IS NULL OR fecha_ingreso <= %s)
                      AND (fecha_salida  IS NULL OR fecha_salida  >= %s)
                    ORDER BY fecha_ingreso DESC NULLS LAST LIMIT 1""",
                (persona_id, r["fecha"], r["fecha"]))
            # Puede no haber estadia: hay gente que almuerza sin alojarse.
            vigente = cur.fetchone()
            if vigente:
                estadia_id = vigente["id"]
                hostal_id = hostal_id or vigente["hostal_id"]
                empresa_id = empresa_id or vigente["empresa_id"]

        if hostal_id is None:
            rechazar(cur, r["archivo_origen"], r["hoja"], r["fila"], "ALMUERZO",
                     "hostal no reconocido y sin alojamiento ese dia",
                     {"hostal": r.get("hostal"), "nombre": r.get("nombre")})
            res.rechazos += 1
            continue

        tipo = nz.norm(r.get("tipo_servicio")) or "ALMUERZO"
        tipo = "CENA" if "CENA" in tipo else "ALMUERZO"

        cur.execute(
            """INSERT INTO core.servicio_consumo
                 (fecha, persona_id, estadia_id, hostal_id, empresa_id,
                  tipo_servicio, cantidad, autorizado_por, origen_archivo, origen_hoja)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (r["fecha"], persona_id, estadia_id, hostal_id, empresa_id, tipo,
             nz.cantidad(r.get("cantidad")), nz.texto(r.get("autorizado_por")),
             r["archivo_origen"], r["hoja"]))
        res.servicios += 1


def ejecutar(dsn: str, mes: dt.date, libros: list[dict]) -> dict[str, Resumen]:
    """Carga TODOS los libros de un mes en una sola transaccion.

    Los libros se cargan juntos, y por fases, a proposito. Al resolver una hoja
    diaria el ETL consulta el alojamiento vigente de la persona para deducir el
    hostal y la empresa que faltan, y esa consulta puede encontrar estadias que
    vinieron del OTRO libro: los dos comparten el hostal 1724 y algunos
    trabajadores.

    Si cada libro se cargara por separado, el resultado dependeria del orden y
    de lo que ya hubiera en la base: cargando dos veces seguidas los conteos
    cambiaban (471, luego 458, luego 457) hasta converger. Procesando primero
    los registros oficiales de todos los libros y despues las hojas diarias de
    todos, el contexto ya esta completo cuando se resuelve la primera fila
    diaria, y una sola pasada da el resultado final.

    Cada libro conserva su propia idempotencia: recargarlo borra solo lo suyo.
    """
    resumenes = {lib["archivo"]: Resumen() for lib in libros}
    # prepare_threshold=None desactiva los prepared statements. psycopg3 los
    # activa solo tras varias ejecuciones de la misma consulta, y el pooler de
    # Supabase en modo transaccion (puerto 6543) los rompe, porque cada
    # sentencia puede caer en una conexion distinta. Desactivarlos cuesta muy
    # poco con este volumen y hace que la carga funcione igual en Docker, en
    # conexion directa y a traves de cualquiera de los dos poolers.
    with psycopg.connect(dsn, row_factory=dict_row, prepare_threshold=None) as conn:
        with conn.cursor() as cur:
            cargas: dict[str, int] = {}

            # Fase 1: staging. Se limpia y se vuelca todo lo crudo.
            for lib in libros:
                archivo = lib["archivo"]
                cur.execute(
                    """INSERT INTO staging.carga (archivo_origen, mes) VALUES (%s, %s)
                       RETURNING id""", (archivo, mes))
                cargas[archivo] = cur.fetchone()["id"]
                limpiar_archivo(cur, archivo)
                resumenes[archivo].crudas = cargar_staging(
                    cur, lib["diarias"], lib["oficial"], lib["almuerzos"])

            cat = Catalogos(cur)

            # Fase 2: registros oficiales de TODOS los libros. Al terminar,
            # existen todas las estadias y todas las noches.
            for lib in libros:
                promover_oficial(cur, cat, lib["oficial"], resumenes[lib["archivo"]])

            # Fase 3: hojas diarias. Ya pueden apoyarse en cualquier estadia.
            for lib in libros:
                promover_diarias(cur, cat, lib["diarias"], resumenes[lib["archivo"]])

            # Fase 4: almuerzos, que se cuelgan de las estadias ya resueltas.
            for lib in libros:
                promover_almuerzos(cur, cat, lib["almuerzos"], resumenes[lib["archivo"]])

            for archivo, res in resumenes.items():
                cur.execute(
                    """UPDATE staging.carga
                          SET filas_crudas = %s, filas_core = %s, filas_rechazo = %s,
                              terminado_en = now()
                        WHERE id = %s""",
                    (res.crudas, res.estadias + res.noches + res.servicios,
                     res.rechazos, cargas[archivo]))
        conn.commit()
    return resumenes
