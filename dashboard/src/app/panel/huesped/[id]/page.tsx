"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Kpi } from "@/components/Kpi";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta, Marca, nombreTurno } from "@/components/ui";
import { finDeMes, nombreDeMes } from "@/lib/fechas";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import {
  COLOR_SERVICIO,
  COLOR_TURNO,
  NOMBRE_EVENTO,
  NOMBRE_SERVICIO,
  SERVICIOS_ORDEN,
} from "@/lib/paleta";
import { estadoRut, resumenDe } from "@/lib/persona";
import type { Estadia } from "@/lib/types";

export default function PaginaHuesped() {
  const params = useParams<{ id: string }>();
  const { todo } = useDatos();

  const id = Number(params.id);
  // Sobre `todo`, nunca sobre lo filtrado: la ficha es la historia entera de
  // la persona, no su parte del mes que se este mirando en el resto del panel.
  const r = useMemo(
    () => (Number.isFinite(id) ? resumenDe(id, todo) : null),
    [id, todo],
  );

  const columnas = useMemo<Columna<Estadia>[]>(
    () => [
      {
        clave: "hostal",
        titulo: "Hostal",
        tipo: "enum",
        ancho: 78,
        valor: (e) => e.hostal,
        render: (e) => <span className="codigo">{e.hostal}</span>,
      },
      {
        clave: "habitacion",
        titulo: "Cuarto",
        tipo: "texto",
        ancho: 68,
        valor: (e) => e.habitacion,
        render: (e) =>
          e.habitacion ? (
            <span className="codigo">{e.habitacion}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 130, valor: (e) => e.empresa },
      {
        clave: "folio",
        titulo: "Folio",
        tipo: "texto",
        ancho: 84,
        valor: (e) => e.folio,
        render: (e) =>
          e.folio ? <span className="codigo">{e.folio}</span> : <span className="text-tinta-3">—</span>,
      },
      {
        clave: "fecha_ingreso",
        titulo: "Ingreso",
        tipo: "fecha",
        ancho: 104,
        valor: (e) => e.fecha_ingreso,
        render: (e) =>
          e.fecha_ingreso ? (
            <span className="codigo">{fechaLarga(e.fecha_ingreso)}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      {
        clave: "fecha_salida",
        titulo: "Salida",
        tipo: "fecha",
        ancho: 110,
        valor: (e) => e.fecha_salida,
        render: (e) =>
          e.fecha_salida ? (
            <span className="codigo">{fechaLarga(e.fecha_salida)}</span>
          ) : (
            <Etiqueta>alojado</Etiqueta>
          ),
      },
      {
        clave: "noches",
        titulo: "Noches",
        tipo: "numero",
        ancho: 76,
        numerica: true,
        valor: (e) => r?.nochesPorEstadia.get(e.id)?.length ?? 0,
      },
      { clave: "motivo_salida", titulo: "Motivo salida", tipo: "enum", ancho: 130, valor: (e) => e.motivo_salida },
      { clave: "chip_devuelto", titulo: "Chip", tipo: "enum", ancho: 100, oculta: true, valor: (e) => e.chip_devuelto },
      { clave: "llaves_devueltas", titulo: "Llaves", tipo: "enum", ancho: 100, oculta: true, valor: (e) => e.llaves_devueltas },
      { clave: "origen_archivo", titulo: "Archivo", tipo: "enum", ancho: 190, oculta: true, valor: (e) => e.origen_archivo },
    ],
    [r],
  );

  if (!r) {
    return (
      <div className="flex flex-col gap-3">
        <Volver />
        <p className="text-tinta-2 py-10 text-center max-w-[48ch] mx-auto leading-relaxed">
          No hay ninguna persona con ese identificador. Puede que el enlace sea
          de una carga anterior.
        </p>
      </div>
    );
  }

  const { persona } = r;
  const rut = estadoRut(persona);

  return (
    <div className="flex flex-col gap-7 max-w-[1400px]">
      <div>
        <Volver />
        <div className="flex items-baseline gap-2.5 flex-wrap mt-1">
          <h1 className="text-[28px] font-semibold tracking-tight">
            {persona.nombre}
          </h1>
          {persona.rut ? (
            <span
              className={`codigo text-[13px] ${rut === "Invalido" ? "text-critico" : "text-tinta-3"}`}
              title={rut === "Invalido" ? "Digito verificador invalido" : undefined}
            >
              {formatearRut(persona.rut)}
            </span>
          ) : null}
          {rut !== "Valido" ? (
            <Etiqueta tono={rut === "Invalido" ? "critico" : "aviso"}>
              <span aria-hidden>▲</span> {rut === "Invalido" ? "RUT invalido" : "Sin RUT"}
            </Etiqueta>
          ) : null}
        </div>
        <p className="text-tinta-2 mt-1.5">
          {persona.cargo ?? "Sin cargo registrado"}
          {persona.celular ? (
            <>
              {" · "}
              <span className="codigo">{persona.celular}</span>
            </>
          ) : null}
        </p>
        <p className="text-[13px] text-tinta-3 mt-2 max-w-[74ch] leading-relaxed">
          Historial completo, de todos los meses cargados:{" "}
          <strong>esta ficha no responde a los filtros</strong> de la barra
          superior. La misma persona vuelve en distintos meses y a veces con
          otra empresa, y eso solo se ve entero.
        </p>
      </div>

      <section className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <Kpi rotulo="Noches" valor={r.totalNoches} nota={`en ${r.estadias.length} ${r.estadias.length === 1 ? "alojamiento" : "alojamientos"}`} />
        <Kpi
          rotulo="Primera noche"
          valor={r.primeraNoche ? fechaLarga(r.primeraNoche) : "—"}
          nota={r.ultimaNoche ? `ultima: ${fechaLarga(r.ultimaNoche)}` : undefined}
        />
        <Kpi
          rotulo="Empresas"
          valor={r.empresas.length}
          nota={r.empresas.join(", ") || undefined}
        />
        <Kpi
          rotulo="Hostales"
          valor={r.hostales.length}
          nota={r.hostales.map((h) => `Hostal ${h}`).join(", ") || undefined}
        />
        <Kpi
          rotulo="Cuartos"
          valor={r.habitaciones.length}
          nota={r.habitaciones.join(", ") || undefined}
        />
        <Kpi
          rotulo="Dias de ausencia"
          valor={r.diasAusencia}
          tono={r.diasAusencia > 0 ? "aviso" : "neutro"}
          nota={r.ausencias.length ? `${r.ausencias.length} registradas` : "ninguna"}
        />
      </section>

      <CalendarioPersonal
        noches={r.noches.map((n) => ({ fecha: n.fecha, turno: n.turno }))}
      />

      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-[19px] font-semibold tracking-tight">Alojamientos</h3>
          <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
            Cada alojamiento por separado. La columna Noches cuenta las mismas
            casillas del calendario de arriba.
          </p>
        </div>
        <Tabla
          columnas={columnas}
          filas={r.estadias}
          total={r.estadias.length}
          nombreArchivo={`estadias-${persona.id}.csv`}
          claveFila={(e) => e.id}
          vacio="Sin estadias registradas."
        />
      </section>

      <Pension resumen={r} />

      <Bitacora resumen={r} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Volver() {
  return (
    <Link href="/panel/registro" className="text-acento hover:underline">
      ← Volver al registro
    </Link>
  );
}

/* --------------------------------------------------------------------------
   El calendario personal: una fila por mes, la marca D/N/E en cada dia.

   Es el equivalente individual de R. OFICIAL. La grilla del registro se lee de
   a un mes -31 columnas ya son muchas-, asi que la rotacion de alguien a lo
   largo de varios meses no se ve ahi. Aqui si, porque es una sola persona.
   -------------------------------------------------------------------------- */

function CalendarioPersonal({
  noches,
}: {
  noches: { fecha: string; turno: string | null }[];
}) {
  // Un dia puede traer MAS de una noche: la misma persona anotada en dos
  // hostales la misma fecha. Colapsarlas en una celda hacia que el calendario
  // dijera 14 y el resumen de arriba 28, que es justo la contradiccion que
  // este panel existe para no repetir. Se guardan todas y la celda lo muestra.
  const meses = useMemo(() => {
    const m = new Map<string, Map<number, (string | null)[]>>();
    for (const n of noches) {
      const mes = n.fecha.slice(0, 7);
      let dias = m.get(mes);
      if (!dias) m.set(mes, (dias = new Map()));
      const d = Number(n.fecha.slice(8, 10));
      const previas = dias.get(d);
      if (previas) previas.push(n.turno);
      else dias.set(d, [n.turno]);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [noches]);

  if (meses.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[19px] font-semibold tracking-tight">
          Calendario de noches
        </h3>
        <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
          Una fila por mes, la letra que trae cada celda del libro. Los huecos
          son huecos de verdad: alguien puede alojarse en tres tramos sueltos
          dentro del mismo mes.
        </p>
      </div>

      <ul className="flex gap-3.5 flex-wrap">
        {(["D", "N", "E"] as const).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span
              aria-hidden
              style={{ background: COLOR_TURNO[t] }}
              className="w-3 h-3 rounded-[3px]"
            />
            <span className="text-[13px] text-tinta-2">
              <span className="codigo font-semibold">{t}</span>{" "}
              {nombreTurno(t).toLowerCase()}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-3 h-3 rounded-[3px] bg-superficie-2 marca-doble"
          />
          <span className="text-[13px] text-tinta-2">
            dos noches el mismo dia
          </span>
        </li>
      </ul>

      <div className="tarjeta p-3 overflow-auto scroll-fino">
        <table className="border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="rotulo text-left pr-3 pb-1.5" style={{ minWidth: 110 }}>
                Mes
              </th>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <th
                  key={d}
                  style={{ width: 22, minWidth: 22 }}
                  className="pb-1.5 text-[11px] font-normal text-tinta-3 text-center cifras"
                >
                  {d}
                </th>
              ))}
              <th className="rotulo text-right pl-3 pb-1.5" style={{ minWidth: 58 }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {meses.map(([mes, dias]) => {
              const ultimo = Number(finDeMes(mes).slice(8, 10));
              return (
                <tr key={mes}>
                  <th scope="row" className="text-left font-normal pr-3 py-[3px]">
                    {nombreDeMes(mes)}
                  </th>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    if (d > ultimo) return <td key={d} className="p-[1px]" />;
                    const turnos = dias.get(d);
                    if (turnos === undefined) {
                      return (
                        <td key={d} className="p-[1px] text-center">
                          <span className="marca marca-vacia" aria-hidden />
                        </td>
                      );
                    }
                    const doble = turnos.length > 1;
                    const turno = turnos[0] ?? "D";
                    return (
                      <td key={d} className="p-[1px] text-center">
                        <span
                          className={`marca marca-${turno} ${doble ? "marca-doble" : ""}`}
                          title={
                            doble
                              ? `${turnos.length} noches anotadas el mismo dia: la persona figura en dos alojamientos a la vez`
                              : nombreTurno(turno)
                          }
                        >
                          {doble ? turnos.length : turno}
                        </span>
                      </td>
                    );
                  })}
                  <td className="pl-3 py-[3px] text-right tabular-nums font-semibold">
                    {[...dias.values()].reduce((t, v) => t + v.length, 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Pension({ resumen }: { resumen: NonNullable<ReturnType<typeof resumenDe>> }) {
  const tipos = SERVICIOS_ORDEN.filter((t) => resumen.porTipoServicio.has(t));
  if (tipos.length === 0) return null;

  const extras = resumen.servicios.filter((s) => s.es_extra).length;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[19px] font-semibold tracking-tight">Comidas</h3>
        <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
          Todo lo que comio, incluidos los dias en que no se quedo a dormir.
          {extras > 0 ? ` ${extras} de esos consumos van marcados como extra.` : ""}
        </p>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {tipos.map((t) => (
          <div key={t} className="border-l-2 border-borde pl-3.5">
            <p className="rotulo flex items-center gap-1.5">
              <span
                aria-hidden
                style={{ background: COLOR_SERVICIO[t] }}
                className="w-2.5 h-2.5 rounded-[3px] shrink-0"
              />
              {NOMBRE_SERVICIO[t]}
            </p>
            <p className="text-[28px] font-semibold tracking-tight leading-tight cifras mt-0.5">
              {numero(resumen.porTipoServicio.get(t) ?? 0)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Bitacora: eventos y ausencias en una sola linea de tiempo.

   core.estadia_evento se carga desde el ETL y hasta aqui no lo dibujaba
   ninguna pantalla. Un cambio de habitacion o un aviso de salida solo tienen
   sentido junto a la persona a la que le pasaron.
   -------------------------------------------------------------------------- */

function Bitacora({ resumen }: { resumen: NonNullable<ReturnType<typeof resumenDe>> }) {
  const hitos = useMemo(() => {
    const lista: {
      clave: string;
      fecha: string;
      titulo: string;
      detalle: string | null;
      tono: "neutro" | "aviso";
    }[] = [];

    for (const ev of resumen.eventos) {
      lista.push({
        clave: `e${ev.id}`,
        fecha: ev.fecha,
        titulo: NOMBRE_EVENTO[ev.tipo] ?? ev.tipo,
        detalle: ev.detalle,
        tono: "neutro",
      });
    }
    for (const a of resumen.ausencias) {
      lista.push({
        clave: `a${a.id}`,
        fecha: a.desde,
        titulo: a.tipo_nombre,
        detalle:
          (a.hasta
            ? `hasta ${fechaLarga(a.hasta)} · ${a.dias} ${a.dias === 1 ? "dia" : "dias"}`
            : "sin fecha de regreso") +
          (a.conserva_habitacion ? " · conserva la cama" : " · libera la cama") +
          (a.detalle ? ` · ${a.detalle}` : ""),
        tono: a.hasta ? "neutro" : "aviso",
      });
    }
    return lista.sort((x, y) => x.fecha.localeCompare(y.fecha));
  }, [resumen.eventos, resumen.ausencias]);

  if (hitos.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[19px] font-semibold tracking-tight">Bitacora</h3>
        <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
          Cambios de sabanas y de cuarto, acreditaciones, avisos de salida,
          permisos, vacaciones y licencias, en orden.
        </p>
      </div>
      <ul className="tarjeta divide-y divide-linea">
        {hitos.map((h) => (
          <li key={h.clave} className="flex items-baseline gap-3 px-4 py-2.5">
            <span className="cifras text-[13px] text-tinta-3 shrink-0 w-[104px]">
              {fechaLarga(h.fecha)}
            </span>
            <span className="font-medium shrink-0">{h.titulo}</span>
            {h.detalle ? (
              <span
                className={`text-[13px] ${h.tono === "aviso" ? "text-serio" : "text-tinta-3"}`}
              >
                {h.detalle}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
