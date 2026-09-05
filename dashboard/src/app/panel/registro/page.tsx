"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useDatos } from "@/components/DatosProvider";
import { SelectorMes } from "@/components/BarraFiltros";
import { SinMovimiento } from "@/components/SinMovimiento";
import { Marca, Menu, nombreTurno } from "@/components/ui";
import { descargar, filasACSV } from "@/lib/csv";
import {
  esFinDeSemana,
  INICIAL_DIA,
  diaSemana,
  finDeMes,
  nombreDeMes,
  rangoDeDias,
} from "@/lib/fechas";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import { COLOR_TURNO } from "@/lib/paleta";
import type { Estadia } from "@/lib/types";

const MAX_COLUMNAS = 92;

/**
 * La hoja R. OFICIAL: una fila por estadia, una columna por dia, y en cada
 * celda la letra D / N / E que se escribe a mano en el libro.
 *
 * La diferencia con el Excel esta en la columna "Noches": alli es
 * =COUNTA(O3:AS3), escrita fila por fila y desincronizada -la hoja se
 * contradice sola, 701 en la fila 164 y 707 en la 184-. Aqui es un conteo
 * sobre las mismas celdas que se ven al lado, asi que no puede descuadrar.
 */

/**
 * Las columnas de identidad. Nombre va siempre primero y congelada; Noches
 * siempre ultima, porque el pie la totaliza. Las de en medio se encienden
 * desde el menu "Columnas": el libro las trae todas, pero mostrarlas siempre
 * aplasta la matriz de 31 dias, que es lo que se viene a ver.
 */
type ColId = {
  clave: string;
  titulo: string;
  ancho: number;
  valor: (e: Estadia) => string | number | null;
  render?: (e: Estadia) => React.ReactNode;
  /** Encendida al abrir. */
  inicial?: boolean;
};

const guion = <span className="text-tinta-3">—</span>;
const codigo = (v: string | null) =>
  v ? <span className="codigo">{v}</span> : guion;

const COLUMNAS: ColId[] = [
  {
    clave: "empresa",
    titulo: "Empresa",
    ancho: 118,
    inicial: true,
    valor: (e) => e.empresa,
  },
  {
    clave: "hostal",
    titulo: "Hostal",
    ancho: 62,
    inicial: true,
    valor: (e) => e.hostal,
    render: (e) => <span className="codigo">{e.hostal}</span>,
  },
  {
    clave: "habitacion",
    titulo: "Hab.",
    ancho: 58,
    inicial: true,
    valor: (e) => e.habitacion,
    render: (e) => codigo(e.habitacion),
  },
  {
    clave: "tipo_habitacion",
    titulo: "Tipo",
    ancho: 76,
    valor: (e) => e.tipo_habitacion,
    render: (e) => e.tipo_habitacion ?? guion,
  },
  { clave: "cargo", titulo: "Cargo", ancho: 150, valor: (e) => e.cargo,
    render: (e) => e.cargo ?? guion },
  { clave: "folio", titulo: "Folio", ancho: 82, valor: (e) => e.folio,
    render: (e) => codigo(e.folio) },
  { clave: "grupo", titulo: "Grupo", ancho: 60, valor: (e) => e.grupo,
    render: (e) => e.grupo ?? guion },
  {
    clave: "fecha_ingreso",
    titulo: "Ingreso",
    ancho: 96,
    valor: (e) => e.fecha_ingreso,
    render: (e) => (e.fecha_ingreso ? codigo(fechaLarga(e.fecha_ingreso)) : guion),
  },
  {
    clave: "fecha_salida",
    titulo: "Salida",
    ancho: 96,
    valor: (e) => e.fecha_salida,
    render: (e) => (e.fecha_salida ? codigo(fechaLarga(e.fecha_salida)) : guion),
  },
  {
    clave: "usa_estacionamiento",
    titulo: "Estac.",
    ancho: 62,
    valor: (e) => (e.usa_estacionamiento ? "SI" : "NO"),
    render: (e) =>
      e.usa_estacionamiento ? <span className="codigo">si</span> : guion,
  },
  { clave: "patente_vehiculo", titulo: "Patente", ancho: 84,
    valor: (e) => e.patente_vehiculo, render: (e) => codigo(e.patente_vehiculo) },
  {
    clave: "observaciones",
    titulo: "Observaciones",
    ancho: 200,
    valor: (e) => e.observaciones,
    render: (e) =>
      e.observaciones ? (
        <span className="block truncate max-w-[190px]" title={e.observaciones}>
          {e.observaciones}
        </span>
      ) : (
        guion
      ),
  },
];

type Agrupar = "no" | "hostal" | "empresa";

export default function PaginaRegistro() {
  const { estadias, noches, nochesPorEstadia, ausencias, filtros } = useDatos();
  const [orden, setOrden] = useState<"nombre" | "noches">("nombre");
  const [agrupar, setAgrupar] = useState<Agrupar>("no");
  const [ocultas, setOcultas] = useState<Set<string>>(
    () => new Set(COLUMNAS.filter((c) => !c.inicial).map((c) => c.clave)),
  );

  const cols = useMemo(
    () => COLUMNAS.filter((c) => !ocultas.has(c.clave)),
    [ocultas],
  );

  // El eje de dias es CONTINUO, no solo los dias con datos. Si las columnas
  // fueran las fechas presentes, buscar a una persona dejaria sus 18 noches
  // pegadas una tras otra y los huecos desapareceran: justo lo que esta
  // grilla existe para mostrar. JUAN CORREA tiene 18 noches en tres tramos.
  const fechas = useMemo(() => {
    if (noches.length === 0) return [];

    // Con rango explicito manda el rango; si no, el mes completo, como la hoja.
    if (filtros.desde && filtros.hasta) return rangoDeDias(filtros.desde, filtros.hasta);

    const ordenadas = noches.map((n) => n.fecha).sort();
    const primera = ordenadas[0];
    const ultima = ordenadas[ordenadas.length - 1];
    return rangoDeDias(primera.slice(0, 8) + "01", finDeMes(ultima.slice(0, 7)));
  }, [noches, filtros.desde, filtros.hasta]);

  const marcas = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const n of noches) m.set(`${n.estadia_id}|${n.fecha}`, n.turno);
    return m;
  }, [noches]);

  // Los dias de permiso, vacaciones o licencia. Sin esto, en la grilla se ven
  // igual que los dias en que la persona todavia no habia llegado, y no son
  // lo mismo: uno es una cama reservada y el otro no existe.
  const ausente = useMemo(() => {
    const m = new Map<string, string>();
    if (fechas.length === 0) return m;
    const primero = fechas[0];
    const ultimo = fechas[fechas.length - 1];
    for (const a of ausencias) {
      const desde = a.desde > primero ? a.desde : primero;
      const hasta = a.hasta === null || a.hasta > ultimo ? ultimo : a.hasta;
      if (desde > hasta) continue;
      for (const f of rangoDeDias(desde, hasta)) {
        m.set(`${a.estadia_id}|${f}`, a.tipo_nombre);
      }
    }
    return m;
  }, [ausencias, fechas]);

  const filas = useMemo(() => {
    const conNoches = estadias.filter(
      (e) => (nochesPorEstadia.get(e.id)?.length ?? 0) > 0,
    );
    return conNoches.sort((a, b) =>
      orden === "nombre"
        ? a.persona.localeCompare(b.persona, "es")
        : (nochesPorEstadia.get(b.id)?.length ?? 0) -
            (nochesPorEstadia.get(a.id)?.length ?? 0) ||
          a.persona.localeCompare(b.persona, "es"),
    );
  }, [estadias, nochesPorEstadia, orden]);

  const totalesPorDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of noches) m.set(n.fecha, (m.get(n.fecha) ?? 0) + 1);
    return m;
  }, [noches]);

  // Cabecera de meses: un tramo por mes, para no repetir el ano 31 veces.
  const tramosMes = useMemo(() => {
    const tramos: { mes: string; largo: number }[] = [];
    for (const f of fechas) {
      const mes = f.slice(0, 7);
      const ultimo = tramos[tramos.length - 1];
      if (ultimo && ultimo.mes === mes) ultimo.largo += 1;
      else tramos.push({ mes, largo: 1 });
    }
    return tramos;
  }, [fechas]);

  /**
   * Las filas repartidas en grupos. Sin agrupar es un solo grupo sin titulo,
   * asi el render es uno solo y no dos caminos que se desincronizan.
   */
  const grupos = useMemo(() => {
    if (agrupar === "no") return [{ titulo: "", filas }];
    const m = new Map<string, Estadia[]>();
    for (const e of filas) {
      const k = agrupar === "hostal" ? e.hostal : e.empresa;
      const lista = m.get(k);
      if (lista) lista.push(e);
      else m.set(k, [e]);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
      .map(([k, v]) => ({
        titulo: agrupar === "hostal" ? `Hostal ${k}` : k,
        filas: v,
      }));
  }, [filas, agrupar]);

  const bajarCSV = () => {
    const cabecera = [
      "Nombre",
      "RUT",
      ...cols.map((c) => c.titulo),
      "Noches",
      ...fechas,
    ];
    const cuerpo = filas.map((e) => [
      e.persona,
      e.rut,
      ...cols.map((c) => c.valor(e)),
      nochesPorEstadia.get(e.id)?.length ?? 0,
      ...fechas.map((f) => {
        const t = marcas.get(`${e.id}|${f}`);
        if (t !== undefined) return t ?? "D";
        return ausente.has(`${e.id}|${f}`) ? "ausente" : "";
      }),
    ]);
    const pie = [
      "Total por dia",
      "",
      ...cols.map(() => ""),
      noches.length,
      ...fechas.map((f) => totalesPorDia.get(f) ?? 0),
    ];
    descargar(
      `registro-oficial-${fechas[0]}-a-${fechas[fechas.length - 1]}.csv`,
      filasACSV([cabecera, ...cuerpo, pie]),
    );
  };

  if (fechas.length === 0) {
    return (
      <Marco>
        <SinMovimiento que="noches registradas" />
      </Marco>
    );
  }

  if (fechas.length > MAX_COLUMNAS) {
    return (
      <Marco>
        <div className="tarjeta px-8 py-14 text-center">
          <p className="text-[19px] font-semibold tracking-tight">
            El periodo es demasiado largo
          </p>
          <p className="text-tinta-2 mt-2 max-w-[46ch] mx-auto leading-relaxed">
            Son {fechas.length} dias. El registro se lee de a un mes, como el
            libro: elige uno arriba.
          </p>
        </div>
      </Marco>
    );
  }

  const anchoDia = 26;
  const anchoId = 1 + cols.length; // Nombre + las de en medio, sin contar Noches

  return (
    <Marco>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[14px] text-tinta-2">
          <strong className="text-tinta font-semibold cifras">
            {numero(filas.length)}
          </strong>{" "}
          huespedes, <strong className="cifras">{numero(noches.length)}</strong>{" "}
          noches en {fechas.length} dias
        </span>

        <div className="ml-auto">
          {/* Agrupar, ordenar, columnas y CSV estaban los cuatro desplegados a
              la vez. Son ajustes, no el contenido: van juntos y guardados. */}
          <Menu resumen="Ver" ancho={250} alinear="der">
            <p className="rotulo px-1 pb-1.5 mb-1.5 border-b border-borde">
              Agrupar por
            </p>
            <div className="flex gap-1 mb-3">
              {(["no", "hostal", "empresa"] as const).map((g) => (
                <Opcion key={g} activo={agrupar === g} onClick={() => setAgrupar(g)}>
                  {g === "no" ? "Nada" : g === "hostal" ? "Hostal" : "Empresa"}
                </Opcion>
              ))}
            </div>

            <p className="rotulo px-1 pb-1.5 mb-1.5 border-b border-borde">
              Ordenar por
            </p>
            <div className="flex gap-1 mb-3">
              {(["nombre", "noches"] as const).map((o) => (
                <Opcion key={o} activo={orden === o} onClick={() => setOrden(o)}>
                  {o === "nombre" ? "Nombre" : "Noches"}
                </Opcion>
              ))}
            </div>

            <p className="rotulo px-1 pb-1.5 mb-1.5 border-b border-borde">
              Datos del huesped
            </p>
            <div className="max-h-[210px] overflow-auto scroll-fino">
              {COLUMNAS.map((c) => (
                <label
                  key={c.clave}
                  className="flex items-center gap-2.5 px-1 py-1.5 rounded-md hover:bg-superficie-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!ocultas.has(c.clave)}
                    onChange={() =>
                      setOcultas((s) => {
                        const n = new Set(s);
                        if (n.has(c.clave)) n.delete(c.clave);
                        else n.add(c.clave);
                        return n;
                      })
                    }
                    className="accent-[var(--acento)]"
                  />
                  <span className="text-[14px] truncate">{c.titulo}</span>
                </label>
              ))}
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-borde">
              <button
                type="button"
                onClick={bajarCSV}
                className="w-full text-left px-1 py-1.5 rounded-md hover:bg-superficie-2"
              >
                Descargar CSV
              </button>
            </div>
          </Menu>
        </div>
      </div>

      {/* Leyenda de marcas: la identidad nunca queda solo en el color. */}
      <ul className="flex gap-3.5 mb-2.5 flex-wrap">
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
          <span aria-hidden className="marca marca-ausente w-3 h-3 rounded-[3px]" />
          <span className="text-[13px] text-tinta-2">de permiso</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="w-3 h-3 rounded-[3px] bg-superficie-2 border border-borde" />
          <span className="text-[13px] text-tinta-2">no durmio</span>
        </li>
      </ul>

      <div className="tarjeta overflow-auto scroll-fino max-h-[calc(100vh-340px)]">
        <table className="border-collapse text-[14px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 bg-superficie-2 border-b border-r border-borde
                           px-3 py-2 text-left rotulo"
                style={{ minWidth: 210 }}
              >
                Nombre
              </th>
              {cols.map((c) => (
                <th
                  key={c.clave}
                  className="bg-superficie-2 border-b border-borde px-3 py-2 text-left rotulo"
                  style={{ minWidth: c.ancho }}
                >
                  {c.titulo}
                </th>
              ))}
              <th
                className="bg-superficie-2 border-b border-borde px-3 py-2 text-right rotulo"
                style={{ minWidth: 58 }}
              >
                Noches
              </th>
              {tramosMes.map((t) => (
                <th
                  key={t.mes}
                  colSpan={t.largo}
                  className="bg-superficie-2 border-b border-l border-borde px-1 py-1 rotulo text-center"
                >
                  {nombreDeMes(t.mes)}
                </th>
              ))}
            </tr>
            <tr>
              <th className="bg-superficie-2 border-b border-borde" colSpan={cols.length + 1} />
              {fechas.map((f) => (
                <th
                  key={f}
                  title={fechaLarga(f)}
                  style={{ width: anchoDia, minWidth: anchoDia }}
                  className={`border-b border-borde px-0 pb-1 pt-0.5 font-normal
                              text-center codigo ${
                                esFinDeSemana(f)
                                  ? "bg-superficie-3 text-tinta-2"
                                  : "bg-superficie-2 text-tinta-3"
                              }`}
                >
                  <span className="block text-[9.5px] leading-none opacity-70">
                    {INICIAL_DIA[diaSemana(f)]}
                  </span>
                  <span className="block text-[11px] leading-tight">
                    {Number(f.slice(8, 10))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {grupos.map((g) => (
            <tbody key={g.titulo || "todo"}>
              {g.titulo ? (
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={anchoId + 1}
                    className="sticky left-0 z-10 bg-superficie-2 border-y border-borde
                               px-2 py-1 text-left text-[11.5px] font-semibold"
                  >
                    {g.titulo}
                    <span className="text-tinta-3 font-normal">
                      {" · "}
                      {numero(g.filas.length)} estadias ·{" "}
                      {numero(
                        g.filas.reduce(
                          (t, e) => t + (nochesPorEstadia.get(e.id)?.length ?? 0),
                          0,
                        ),
                      )}{" "}
                      noches
                    </span>
                  </th>
                  {fechas.map((f) => {
                    const n = g.filas.reduce(
                      (t, e) => t + (marcas.has(`${e.id}|${f}`) ? 1 : 0),
                      0,
                    );
                    return (
                      <td
                        key={f}
                        className={`border-y border-borde px-0 py-1 text-center
                                    text-[11px] cifras text-tinta-2 ${
                                      esFinDeSemana(f)
                                        ? "bg-superficie-3"
                                        : "bg-superficie-2"
                                    }`}
                      >
                        {n || ""}
                      </td>
                    );
                  })}
                </tr>
              ) : null}

              {g.filas.map((e) => {
                const total = nochesPorEstadia.get(e.id)?.length ?? 0;
                return (
                  <tr key={e.id} className="border-b border-linea">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-superficie border-r border-borde
                                 px-3 py-1.5 text-left font-normal"
                    >
                      <Link
                        href={`/panel/huesped/${e.persona_id}`}
                        className="block truncate max-w-[196px] hover:text-acento hover:underline"
                        title={`${e.persona} · ver ficha`}
                      >
                        {e.persona}
                      </Link>
                      {e.rut ? (
                        <span className="codigo text-[12px] text-tinta-3">
                          {formatearRut(e.rut)}
                        </span>
                      ) : null}
                    </th>
                    {cols.map((c) => (
                      <td key={c.clave} className="px-3 py-1.5 truncate">
                        {c.render ? c.render(e) : (c.valor(e) ?? guion)}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right cifras font-semibold">
                      {total}
                    </td>
                    {fechas.map((f) => {
                      const clave = `${e.id}|${f}`;
                      const turno = marcas.get(clave);
                      const motivo = ausente.get(clave);
                      return (
                        <td
                          key={f}
                          className={`p-[1px] text-center ${
                            esFinDeSemana(f) ? "dia-finde" : ""
                          }`}
                        >
                          {turno !== undefined ? (
                            <Marca turno={turno ?? "D"} />
                          ) : motivo ? (
                            <span
                              className="marca marca-ausente"
                              title={`${motivo} · ${fechaLarga(f)}`}
                            />
                          ) : (
                            <span className="marca marca-vacia" aria-hidden />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}

          {/* El pie del libro: total por dia. En el Excel es la fila 168. */}
          <tfoot className="sticky bottom-0">
            <tr>
              <th
                className="sticky left-0 z-30 bg-superficie-2 border-t border-r border-borde
                           px-3 py-2 text-left rotulo"
              >
                Total por dia
              </th>
              <td className="bg-superficie-2 border-t border-borde" colSpan={cols.length} />
              <td className="bg-superficie-2 border-t border-borde px-2 py-1 text-right cifras font-semibold">
                {numero(noches.length)}
              </td>
              {fechas.map((f) => (
                <td
                  key={f}
                  className={`border-t border-borde px-0 py-1 text-center
                              text-[11px] cifras text-tinta-2 ${
                                esFinDeSemana(f) ? "bg-superficie-3" : "bg-superficie-2"
                              }`}
                >
                  {totalesPorDia.get(f) ?? 0}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Marco>
  );
}

function Opcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex-1 h-8 rounded-md border text-[13px] transition-colors ${
        activo
          ? "border-acento bg-acento-suave text-tinta font-medium"
          : "border-borde text-tinta-2 hover:bg-superficie-2"
      }`}
    >
      {children}
    </button>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col max-w-[1500px]">
      <header className="mb-6">
        <SelectorMes />
        <p className="text-tinta-2 mt-1 ml-1.5 max-w-[76ch]">
          El libro de firmas: una fila por huesped, una columna por dia y una
          marca por cada noche dormida. Toca un nombre para ver su ficha.
        </p>
      </header>
      {children}
    </div>
  );
}
