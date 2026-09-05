"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SelectorMes } from "@/components/BarraFiltros";
import { useDatos } from "@/components/DatosProvider";
import { SinMovimiento } from "@/components/SinMovimiento";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta } from "@/components/ui";
import { descargar, filasACSV } from "@/lib/csv";
import {
  diaSemana,
  esFinDeSemana,
  finDeMes,
  INICIAL_DIA,
  rangoDeDias,
} from "@/lib/fechas";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import type { Ausencia } from "@/lib/types";

const MAX_COLUMNAS = 92;

/** Sin numero de habitacion. Es una fila real, no un hueco: hay alojamientos asi. */
const SIN_HAB = " sin";

type Ocupante = { id: number; nombre: string };
type Celda = { gente: Ocupante[]; exceso: boolean };

type Cuarto = {
  clave: string;
  hostal: string;
  numero: string;
  etiqueta: string;
  detalle: string | null;
  capacidad: number | null;
};

/** Paso de la rampa segun cuanta gente hay. Compartido con el calendario. */
function pasoDe(n: number): number {
  return n === 0 ? 0 : n >= 4 ? 4 : n;
}

/**
 * Ocupacion: el plano del edificio, no el libro.
 *
 * Antes era una rejilla habitacion x dia, que es exactamente la misma forma que
 * el registro oficial -personas x dia-, y las dos pantallas se confundian. Aqui
 * el objeto es el CUARTO: cuantas camas tiene, quien duerme dentro hoy y como
 * le fue en el mes. La rejilla sigue disponible en el conmutador, porque para
 * comparar dias seguidos no hay nada mejor; lo que cambia es cual manda.
 */
export default function PaginaOcupacion() {
  const { estadias, noches, habitaciones, ausencias, filtros, todo, rol } =
    useDatos();
  const [vista, setVista] = useState<"tablero" | "rejilla">("tablero");
  const [diaElegido, setDiaElegido] = useState<string | null>(null);

  // Mismo eje que el registro: continuo, no solo los dias con datos. Un cuarto
  // que se desocupa el 12 y se vuelve a ocupar el 20 tiene que mostrar los
  // siete dias vacios de por medio.
  const fechas = useMemo(() => {
    if (noches.length === 0) return [];
    if (filtros.desde && filtros.hasta) return rangoDeDias(filtros.desde, filtros.hasta);
    const ordenadas = noches.map((n) => n.fecha).sort();
    const primera = ordenadas[0];
    const ultima = ordenadas[ordenadas.length - 1];
    return rangoDeDias(primera.slice(0, 8) + "01", finDeMes(ultima.slice(0, 7)));
  }, [noches, filtros.desde, filtros.hasta]);

  // El alojamiento de cada noche sale del conjunto completo: si viniera del
  // filtrado, una noche cuyo alojamiento quedo fuera por fecha no encontraria
  // su habitacion y desapareceria del cuarto.
  const estadiaDe = useMemo(() => {
    const m = new Map<
      number,
      { hostal: string; habitacion: string | null; persona: string; persona_id: number }
    >();
    for (const e of todo.estadias) {
      m.set(e.id, {
        hostal: e.hostal,
        habitacion: e.habitacion,
        persona: e.persona,
        persona_id: e.persona_id,
      });
    }
    return m;
  }, [todo.estadias]);

  const capacidadDe = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of habitaciones) m.set(`${h.hostal}|${h.numero}`, h.capacidad);
    return m;
  }, [habitaciones]);

  /** Quien durmio en cada cuarto cada dia. La clave es hostal|numero|fecha. */
  const ocupacion = useMemo(() => {
    const m = new Map<string, Celda>();
    for (const n of noches) {
      const e = estadiaDe.get(n.estadia_id);
      if (!e) continue;
      const hab = e.habitacion ?? SIN_HAB;
      const clave = `${e.hostal}|${hab}|${n.fecha}`;
      let c = m.get(clave);
      if (!c) m.set(clave, (c = { gente: [], exceso: false }));
      c.gente.push({ id: e.persona_id, nombre: e.persona });
    }
    // El exceso se marca al final, cuando ya se sabe cuanta gente hay.
    for (const [clave, c] of m) {
      const [hostal, hab] = clave.split("|");
      if (hab === SIN_HAB) continue;
      const cap = capacidadDe.get(`${hostal}|${hab}`);
      if (cap !== undefined && c.gente.length > cap) c.exceso = true;
    }
    return m;
  }, [noches, estadiaDe, capacidadDe]);

  /**
   * Los cuartos, agrupados por hostal. Se muestran tambien los que nunca se
   * ocuparon: un cuarto vacio todo el mes es justamente lo que hay que ver.
   */
  const grupos = useMemo(() => {
    const porHostal = new Map<string, Cuarto[]>();
    for (const h of habitaciones) {
      const lista = porHostal.get(h.hostal) ?? [];
      lista.push({
        clave: `${h.hostal}|${h.numero}`,
        hostal: h.hostal,
        numero: h.numero,
        etiqueta: `Cuarto ${h.numero}`,
        detalle: h.tipo ? h.tipo.toLowerCase() : null,
        capacidad: h.capacidad,
      });
      porHostal.set(h.hostal, lista);
    }

    // Hostales con noches sin habitacion anotada: necesitan su propia fila.
    const conSinHab = new Set<string>();
    for (const clave of ocupacion.keys()) {
      const [hostal, hab] = clave.split("|");
      if (hab === SIN_HAB) conSinHab.add(hostal);
    }
    for (const h of conSinHab) if (!porHostal.has(h)) porHostal.set(h, []);

    return [...porHostal.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
      .map(([hostal, cuartos]) => {
        const ordenados = cuartos.sort((a, b) =>
          a.numero.localeCompare(b.numero, "es", { numeric: true }),
        );
        if (conSinHab.has(hostal)) {
          ordenados.push({
            clave: `${hostal}|${SIN_HAB}`,
            hostal,
            numero: SIN_HAB,
            etiqueta: "Sin cuarto",
            detalle: "no se anoto cual",
            capacidad: null,
          });
        }
        return { hostal, cuartos: ordenados };
      });
  }, [habitaciones, ocupacion]);

  /* ---- Cifras ---------------------------------------------------------- */
  const cifras = useMemo(() => {
    const cuartosUsados = new Set<string>();
    let ocupantes = 0;
    let celdas = 0;
    let excesos = 0;
    let sinHabitacion = 0;

    for (const [clave, c] of ocupacion) {
      const [hostal, hab] = clave.split("|");
      if (hab === SIN_HAB) {
        sinHabitacion += c.gente.length;
        continue;
      }
      cuartosUsados.add(`${hostal}|${hab}`);
      ocupantes += c.gente.length;
      celdas += 1;
      if (c.exceso) excesos += 1;
    }

    return {
      usados: cuartosUsados.size,
      activas: habitaciones.filter((h) => h.activa).length,
      media: celdas > 0 ? ocupantes / celdas : 0,
      excesos,
      sinHabitacion,
    };
  }, [ocupacion, habitaciones]);

  /** Por defecto, el ultimo dia del mes en el que durmio alguien. */
  const diaPorDefecto = useMemo(() => {
    let max = "";
    for (const n of noches) if (n.fecha > max) max = n.fecha;
    return max || null;
  }, [noches]);

  const dia = diaElegido && fechas.includes(diaElegido) ? diaElegido : diaPorDefecto;

  /** Cuanta gente durmio cada dia del mes, para la tira selectora. */
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of noches) m.set(n.fecha, (m.get(n.fecha) ?? 0) + 1);
    return m;
  }, [noches]);

  const bajarCSV = () => {
    const cabecera = ["Hostal", "Cuarto", "Camas", ...fechas];
    const cuerpo: (string | number | null)[][] = [];
    for (const g of grupos) {
      for (const c of g.cuartos) {
        cuerpo.push([
          g.hostal,
          c.numero === SIN_HAB ? "sin cuarto" : c.numero,
          c.capacidad,
          ...fechas.map((f) => ocupacion.get(`${c.clave}|${f}`)?.gente.length ?? 0),
        ]);
      }
    }
    descargar(
      `ocupacion-${fechas[0]}-a-${fechas[fechas.length - 1]}.csv`,
      filasACSV([cabecera, ...cuerpo]),
    );
  };

  /* ---- Render ----------------------------------------------------------- */

  const cabecera = (
    <header>
      <SelectorMes />
      <p className="text-tinta-2 mt-1 ml-1.5">
        Que cuartos estan ocupados, por quien, y cuantas camas quedan libres.
      </p>
    </header>
  );

  if (fechas.length === 0) {
    return (
      <div className="flex flex-col gap-7 max-w-[1500px]">
        {cabecera}
        <SinMovimiento que="cuartos ocupados" />
      </div>
    );
  }

  if (fechas.length > MAX_COLUMNAS) {
    return (
      <div className="flex flex-col gap-7 max-w-[1500px]">
        {cabecera}
        <div className="tarjeta px-8 py-14 text-center">
          <p className="text-[19px] font-semibold tracking-tight">
            El periodo es demasiado largo
          </p>
          <p className="text-tinta-2 mt-2 max-w-[46ch] mx-auto leading-relaxed">
            Son {fechas.length} dias. Los cuartos se miran de a un mes: elige uno
            arriba.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 max-w-[1500px]">
      {cabecera}

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Cifra
          rotulo="Cuartos ocupados"
          valor={numero(cifras.usados)}
          nota={`de ${cifras.activas} disponibles`}
        />
        <Cifra
          rotulo="Huespedes por cuarto"
          valor={cifras.media.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
          nota="promedio de los cuartos en uso"
        />
        <Cifra
          rotulo="Dias sobre capacidad"
          valor={numero(cifras.excesos)}
          nota="mas huespedes que camas declaradas"
          alerta={cifras.excesos > 0}
        />
        <Cifra
          rotulo="Noches sin cuarto"
          valor={numero(cifras.sinHabitacion)}
          nota="no se anoto en que cuarto durmieron"
          alerta={cifras.sinHabitacion > 0}
        />
      </section>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-md border border-borde overflow-hidden bg-superficie">
          {(["tablero", "rejilla"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={`h-9 px-3.5 text-[14px] border-r border-borde last:border-r-0
                          transition-colors ${
                            vista === v
                              ? "bg-acento-suave text-tinta font-medium"
                              : "text-tinta-2 hover:bg-superficie-2"
                          }`}
            >
              {v === "tablero" ? "Cuartos" : "Mes completo"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={bajarCSV}
          className="ml-auto h-9 px-3.5 rounded-md border border-borde bg-superficie
                     hover:bg-superficie-2 text-[14px] text-tinta-2 transition-colors"
        >
          Descargar CSV
        </button>
      </div>

      {vista === "tablero" ? (
        <>
          <TiraDeDias
            fechas={fechas}
            porDia={porDia}
            elegido={dia}
            onElegir={setDiaElegido}
          />
          {grupos.map((g) => (
            <section key={g.hostal} className="flex flex-col gap-3">
              <h2 className="text-[19px] font-semibold tracking-tight">
                Hostal {g.hostal}
                <span className="text-tinta-3 font-normal text-[15px]">
                  {"  "}
                  {g.cuartos.filter((c) => c.numero !== SIN_HAB).length} cuartos
                </span>
              </h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.cuartos.map((c) => (
                  <TarjetaCuarto
                    key={c.clave}
                    cuarto={c}
                    hoyCelda={dia ? ocupacion.get(`${c.clave}|${dia}`) : undefined}
                    fechas={fechas}
                    ocupacion={ocupacion}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <Rejilla fechas={fechas} grupos={grupos} ocupacion={ocupacion} />
      )}

      <p className="text-[13px] text-tinta-3 max-w-[80ch] leading-relaxed">
        <strong className="text-tinta-2">Camas</strong> es la capacidad anotada
        en el catalogo. Los libros nunca la trajeron, asi que casi todos los
        cuartos siguen en el valor por omision: el borde rojo avisa que hay mas
        huespedes que camas anotadas, que hoy es sobre todo una capacidad por
        cargar.{" "}
        {rol === "ADMIN" ? (
          <Link href="/catalogos" className="text-acento hover:underline">
            Corregir las camas
          </Link>
        ) : (
          "Un administrador puede corregirlas en Catalogos."
        )}
      </p>

      <Ausencias ausencias={ausencias} total={todo.ausencias.length} />

      <p className="text-[13px] text-tinta-3">
        {numero(estadias.length)} alojamientos en el periodo.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Cifra({
  rotulo,
  valor,
  nota,
  alerta,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div className={`border-l-2 pl-3.5 ${alerta ? "border-serio" : "border-borde"}`}>
      <p className="rotulo">{rotulo}</p>
      <p
        className={`text-[32px] font-semibold tracking-tight leading-tight cifras mt-0.5 ${
          alerta ? "text-serio" : ""
        }`}
      >
        {valor}
      </p>
      {nota ? (
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-snug">{nota}</p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------------------
   La tira de dias: elige que dia muestra el tablero, y de paso deja ver la
   forma del mes sin abrir el calendario.
   -------------------------------------------------------------------------- */

function TiraDeDias({
  fechas,
  porDia,
  elegido,
  onElegir,
}: {
  fechas: string[];
  porDia: Map<string, number>;
  elegido: string | null;
  onElegir: (f: string) => void;
}) {
  const max = useMemo(() => {
    let m = 0;
    for (const f of fechas) {
      const n = porDia.get(f) ?? 0;
      if (n > m) m = n;
    }
    return m;
  }, [fechas, porDia]);

  return (
    <div className="tarjeta p-3">
      <div className="flex items-baseline justify-between mb-2">
        <p className="rotulo">Elige un dia</p>
        {elegido ? (
          <p className="text-[14px] text-tinta-2">
            Mostrando{" "}
            <strong className="text-tinta font-medium">{fechaLarga(elegido)}</strong>
          </p>
        ) : null}
      </div>
      <div className="flex gap-1 overflow-x-auto scroll-fino pb-1">
        {fechas.map((f) => {
          const n = porDia.get(f) ?? 0;
          const paso = max > 0 && n > 0 ? Math.min(4, Math.max(1, Math.ceil((n / max) * 4))) : 0;
          const sel = f === elegido;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onElegir(f)}
              title={`${fechaLarga(f)}: ${n === 0 ? "nadie" : `${numero(n)} personas`}`}
              aria-pressed={sel}
              style={{ background: `var(--rampa-${paso})` }}
              className={`shrink-0 w-9 rounded-md py-1.5 flex flex-col items-center gap-0.5
                          transition-shadow ${sel ? "ring-2 ring-acento" : "hover:ring-1 hover:ring-eje"}`}
            >
              <span
                className={`text-[10px] leading-none ${
                  esFinDeSemana(f) ? "text-tinta-2 font-semibold" : "text-tinta-3"
                }`}
              >
                {INICIAL_DIA[diaSemana(f)]}
              </span>
              <span
                className={`text-[13px] leading-none cifras ${
                  paso >= 3 ? "text-[var(--rampa-ink-alto)]" : "text-tinta"
                }`}
              >
                {Number(f.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   La tarjeta de un cuarto: el objeto fisico, no una fila de tabla.
   -------------------------------------------------------------------------- */

function TarjetaCuarto({
  cuarto,
  hoyCelda,
  fechas,
  ocupacion,
}: {
  cuarto: Cuarto;
  hoyCelda: Celda | undefined;
  fechas: string[];
  ocupacion: Map<string, Celda>;
}) {
  const gente = hoyCelda?.gente ?? [];
  const exceso = hoyCelda?.exceso ?? false;
  const cap = cuarto.capacidad;
  const libres = cap !== null ? Math.max(0, cap - gente.length) : null;

  return (
    <article
      className={`tarjeta p-3.5 flex flex-col gap-2.5 ${
        exceso ? "outline outline-2 outline-critico" : ""
      } ${gente.length === 0 ? "opacity-70" : ""}`}
    >
      <header className="flex items-baseline gap-2">
        <h3 className="text-[17px] font-semibold tracking-tight">
          {cuarto.etiqueta}
        </h3>
        {cuarto.detalle ? (
          <span className="text-[13px] text-tinta-3">{cuarto.detalle}</span>
        ) : null}
        <span className="ml-auto text-[13px] cifras text-tinta-2">
          {cap !== null ? `${gente.length}/${cap}` : gente.length}
        </span>
      </header>

      {gente.length === 0 ? (
        <p className="text-[14px] text-tinta-3">Libre</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {gente.map((p, i) => (
            <li key={`${p.id}-${i}`} className="text-[14px] leading-snug">
              <Link
                href={`/panel/huesped/${p.id}`}
                className="hover:text-acento hover:underline"
              >
                {p.nombre}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {exceso ? (
        <p className="text-[13px] text-critico">
          <span aria-hidden>&#9650;</span> Mas huespedes que camas anotadas
        </p>
      ) : libres !== null && libres > 0 && gente.length > 0 ? (
        <p className="text-[13px] text-tinta-3">
          {libres} {libres === 1 ? "cama libre" : "camas libres"}
        </p>
      ) : null}

      {/* La tira del mes: el dia a dia no se pierde, solo deja de mandar. */}
      <div
        className="flex gap-[2px] mt-auto pt-1"
        title="Ocupacion de este cuarto a lo largo del mes"
      >
        {fechas.map((f) => {
          const n = ocupacion.get(`${cuarto.clave}|${f}`)?.gente.length ?? 0;
          return (
            <span
              key={f}
              aria-hidden
              style={{ background: `var(--rampa-${pasoDe(n)})` }}
              className="h-2 flex-1 rounded-[1px] min-w-[3px]"
            />
          );
        })}
      </div>
    </article>
  );
}

/* --------------------------------------------------------------------------
   La rejilla habitacion x dia. Deja de ser lo primero, pero sigue estando:
   para comparar dias seguidos no hay nada mejor.
   -------------------------------------------------------------------------- */

function Rejilla({
  fechas,
  grupos,
  ocupacion,
}: {
  fechas: string[];
  grupos: { hostal: string; cuartos: Cuarto[] }[];
  ocupacion: Map<string, Celda>;
}) {
  return (
    <div className="tarjeta overflow-auto scroll-fino max-h-[calc(100vh-320px)]">
      <table className="border-collapse text-[13px]">
        <thead className="sticky top-0 z-20">
          <tr>
            <th
              className="sticky left-0 z-30 bg-superficie-2 border-b border-r border-borde
                         px-3 py-2 text-left rotulo"
              style={{ minWidth: 170 }}
            >
              Cuarto
            </th>
            <th
              className="bg-superficie-2 border-b border-borde px-3 py-2 text-right rotulo"
              style={{ minWidth: 66 }}
            >
              Camas
            </th>
            {fechas.map((f) => (
              <th
                key={f}
                title={fechaLarga(f)}
                style={{ width: 26, minWidth: 26 }}
                className={`border-b border-borde px-0 pb-1 pt-1 font-normal text-center ${
                  esFinDeSemana(f)
                    ? "bg-superficie-3 text-tinta-2"
                    : "bg-superficie-2 text-tinta-3"
                }`}
              >
                <span className="block text-[9px] leading-none opacity-70">
                  {INICIAL_DIA[diaSemana(f)]}
                </span>
                <span className="block text-[11px] leading-tight cifras">
                  {Number(f.slice(8, 10))}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        {grupos.map((g) => (
          <tbody key={g.hostal}>
            <tr>
              <th
                scope="rowgroup"
                colSpan={2}
                className="sticky left-0 z-10 bg-superficie-2 border-y border-borde
                           px-3 py-1.5 text-left font-semibold"
              >
                Hostal {g.hostal}
              </th>
              {fechas.map((f) => {
                let n = 0;
                for (const c of g.cuartos) {
                  n += ocupacion.get(`${c.clave}|${f}`)?.gente.length ?? 0;
                }
                return (
                  <td
                    key={f}
                    className={`border-y border-borde px-0 py-1.5 text-center
                                text-[11px] cifras text-tinta-2 ${
                                  esFinDeSemana(f) ? "bg-superficie-3" : "bg-superficie-2"
                                }`}
                  >
                    {n || ""}
                  </td>
                );
              })}
            </tr>

            {g.cuartos.map((c) => (
              <tr key={c.clave} className="border-b border-linea">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-superficie border-r border-borde
                             px-3 py-1 text-left font-normal"
                >
                  {c.etiqueta}
                  {c.detalle ? (
                    <span className="block text-[12px] text-tinta-3">{c.detalle}</span>
                  ) : null}
                </th>
                <td className="px-3 py-1 text-right cifras text-tinta-3">
                  {c.capacidad ?? "—"}
                </td>
                {fechas.map((f) => {
                  const celda = ocupacion.get(`${c.clave}|${f}`);
                  const n = celda?.gente.length ?? 0;
                  return (
                    <td
                      key={f}
                      className={`p-[1px] text-center ${esFinDeSemana(f) ? "dia-finde" : ""}`}
                    >
                      <span
                        className={`ocupa ocupa-${pasoDe(n)} ${celda?.exceso ? "ocupa-exceso" : ""}`}
                        title={
                          n === 0
                            ? `${c.etiqueta}, ${fechaLarga(f)}: libre`
                            : `${c.etiqueta}, ${fechaLarga(f)}\n${celda?.gente.map((p) => p.nombre).join("\n")}`
                        }
                      >
                        {n || ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Ausencias: quien no durmio en su cama y si la conserva.

   Vive aqui porque la pregunta que contesta es de ocupacion: si el cuarto
   quedo tomado o quedo libre.
   -------------------------------------------------------------------------- */

function Ausencias({
  ausencias,
  total,
}: {
  ausencias: Ausencia[];
  total: number;
}) {
  const columnas = useMemo<Columna<Ausencia>[]>(
    () => [
      { clave: "persona", titulo: "Nombre", tipo: "texto", ancho: 210, valor: (a) => a.persona },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 124,
        valor: (a) => a.rut,
        render: (a) =>
          a.rut ? (
            <span className="codigo">{formatearRut(a.rut)}</span>
          ) : (
            <span className="text-tinta-3">&mdash;</span>
          ),
      },
      { clave: "tipo_nombre", titulo: "Motivo", tipo: "enum", ancho: 160, valor: (a) => a.tipo_nombre },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 140, valor: (a) => a.empresa },
      {
        clave: "hostal",
        titulo: "Hostal",
        tipo: "enum",
        ancho: 88,
        valor: (a) => a.hostal,
        render: (a) => <span className="cifras">{a.hostal}</span>,
      },
      {
        clave: "habitacion",
        titulo: "Cuarto",
        tipo: "texto",
        ancho: 82,
        valor: (a) => a.habitacion,
        render: (a) =>
          a.habitacion ? (
            <span className="cifras">{a.habitacion}</span>
          ) : (
            <span className="text-tinta-3">&mdash;</span>
          ),
      },
      {
        clave: "desde",
        titulo: "Desde",
        tipo: "fecha",
        ancho: 112,
        valor: (a) => a.desde,
        render: (a) => <span className="cifras">{fechaLarga(a.desde)}</span>,
      },
      {
        clave: "hasta",
        titulo: "Hasta",
        tipo: "fecha",
        ancho: 130,
        valor: (a) => a.hasta,
        // Sin fecha de regreso no es un dato que falte: es alguien a quien la
        // operacion perdio de vista, y por eso se marca.
        render: (a) =>
          a.hasta ? (
            <span className="cifras">{fechaLarga(a.hasta)}</span>
          ) : (
            <Etiqueta tono="aviso">
              <span aria-hidden>&#9650;</span> sin regreso
            </Etiqueta>
          ),
      },
      { clave: "dias", titulo: "Dias", tipo: "numero", ancho: 76, numerica: true, valor: (a) => a.dias },
      {
        clave: "conserva_habitacion",
        titulo: "Cama",
        tipo: "booleano",
        ancho: 112,
        valor: (a) => a.conserva_habitacion,
        render: (a) =>
          a.conserva_habitacion ? (
            <span className="text-tinta-2">reservada</span>
          ) : (
            <span className="text-tinta-3">liberada</span>
          ),
      },
      { clave: "detalle", titulo: "Detalle", tipo: "texto", ancho: 240, oculta: true, valor: (a) => a.detalle },
      { clave: "registrado_por", titulo: "Registro", tipo: "enum", ancho: 150, oculta: true, valor: (a) => a.registrado_por },
    ],
    [],
  );

  const diasPersona = ausencias.reduce((n, a) => n + a.dias, 0);
  const sinCerrar = ausencias.filter((a) => a.hasta === null).length;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[19px] font-semibold tracking-tight">
          Permisos, vacaciones y licencias
        </h2>
        <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
          Sus dias se descuentan solos de las noches que se cobran, y la columna{" "}
          <strong>Cama</strong> dice si el cuarto quedo tomado igual.
          {ausencias.length > 0 ? (
            <>
              {" "}
              Suman <strong className="cifras">{diasPersona}</strong> dias.
              {sinCerrar > 0 ? (
                <span className="text-serio">
                  {" "}
                  {sinCerrar} sin fecha de regreso.
                </span>
              ) : null}
            </>
          ) : null}
        </p>
      </div>
      <Tabla
        columnas={columnas}
        filas={ausencias}
        total={total}
        nombreArchivo="ausencias.csv"
        claveFila={(a) => a.id}
        vacio="Nadie estuvo de permiso en este periodo."
      />
    </section>
  );
}
