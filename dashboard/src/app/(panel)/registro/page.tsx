"use client";

import { useMemo, useState } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Marca, nombreTurno } from "@/components/ui";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import { COLOR_TURNO } from "@/lib/paleta";

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

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
export default function PaginaRegistro() {
  const { estadias, noches, nochesPorEstadia } = useDatos();
  const [orden, setOrden] = useState<"nombre" | "noches">("nombre");

  const fechas = useMemo(
    () => [...new Set(noches.map((n) => n.fecha))].sort(),
    [noches],
  );

  const marcas = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const n of noches) m.set(`${n.estadia_id}|${n.fecha}`, n.turno);
    return m;
  }, [noches]);

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

  if (fechas.length === 0) {
    return (
      <Marco>
        <p className="text-tinta-3 py-10 text-center">
          No hay noches registradas en este rango.
        </p>
      </Marco>
    );
  }

  if (fechas.length > MAX_COLUMNAS) {
    return (
      <Marco>
        <p className="text-tinta-2 py-10 text-center max-w-[52ch] mx-auto leading-relaxed">
          El rango abarca {fechas.length} dias. La matriz se lee de a un mes,
          como en el libro: acota el rango de fechas en la barra de arriba.
        </p>
      </Marco>
    );
  }

  const anchoDia = 22;

  return (
    <Marco>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-[12.5px] text-tinta-2">
          <strong className="text-tinta font-semibold tabular-nums">
            {numero(filas.length)}
          </strong>{" "}
          estadias · {numero(noches.length)} noches · {fechas.length} dias
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="rotulo">Ordenar</span>
          {(["nombre", "noches"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrden(o)}
              className={`h-7 px-2 rounded-md border text-[12px] transition-colors ${
                orden === o
                  ? "border-acento bg-acento-suave text-tinta"
                  : "border-borde text-tinta-2 hover:bg-superficie-2"
              }`}
            >
              {o === "nombre" ? "Nombre" : "Noches"}
            </button>
          ))}
        </div>
      </div>

      {/* Leyenda de marcas: la identidad nunca queda solo en el color. */}
      <ul className="flex gap-3.5 mb-2.5 flex-wrap">
        {(["D", "N", "E"] as const).map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span
              aria-hidden
              style={{ background: COLOR_TURNO[t] }}
              className="w-2.5 h-2.5 rounded-[3px]"
            />
            <span className="text-[11.5px] text-tinta-2">
              <span className="codigo font-semibold">{t}</span>{" "}
              {nombreTurno(t).toLowerCase()}
            </span>
          </li>
        ))}
      </ul>

      <div className="tarjeta overflow-auto scroll-fino max-h-[calc(100vh-290px)]">
        <table className="border-collapse text-[12px]">
          <thead className="sticky top-0 z-20">
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 z-30 bg-superficie-2 border-b border-r border-borde
                           px-2 py-1 text-left rotulo"
                style={{ minWidth: 190 }}
              >
                Nombre
              </th>
              <th className="bg-superficie-2 border-b border-borde px-2 py-1 text-left rotulo" style={{ minWidth: 118 }}>
                Empresa
              </th>
              <th className="bg-superficie-2 border-b border-borde px-2 py-1 text-left rotulo" style={{ minWidth: 62 }}>
                Hostal
              </th>
              <th className="bg-superficie-2 border-b border-borde px-2 py-1 text-left rotulo" style={{ minWidth: 58 }}>
                Hab.
              </th>
              <th className="bg-superficie-2 border-b border-borde px-2 py-1 text-right rotulo" style={{ minWidth: 58 }}>
                Noches
              </th>
              {tramosMes.map((t) => {
                const [a, m] = t.mes.split("-");
                return (
                  <th
                    key={t.mes}
                    colSpan={t.largo}
                    className="bg-superficie-2 border-b border-l border-borde px-1 py-1 rotulo text-center"
                  >
                    {MESES_LARGOS[Number(m) - 1]} {a}
                  </th>
                );
              })}
            </tr>
            <tr>
              <th className="bg-superficie-2 border-b border-borde" colSpan={4} />
              {fechas.map((f) => (
                <th
                  key={f}
                  title={fechaLarga(f)}
                  style={{ width: anchoDia, minWidth: anchoDia }}
                  className="bg-superficie-2 border-b border-borde px-0 py-1
                             text-[10px] font-normal text-tinta-3 text-center codigo"
                >
                  {Number(f.slice(8, 10))}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filas.map((e) => {
              const total = nochesPorEstadia.get(e.id)?.length ?? 0;
              return (
                <tr key={e.id} className="border-b border-linea">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-superficie border-r border-borde
                               px-2 py-[3px] text-left font-normal"
                  >
                    <span className="block truncate max-w-[178px]" title={e.persona}>
                      {e.persona}
                    </span>
                    {e.rut ? (
                      <span className="codigo text-[10.5px] text-tinta-3">
                        {formatearRut(e.rut)}
                      </span>
                    ) : null}
                  </th>
                  <td className="px-2 py-[3px] truncate" title={e.empresa}>
                    {e.empresa}
                  </td>
                  <td className="px-2 py-[3px] codigo">{e.hostal}</td>
                  <td className="px-2 py-[3px] codigo">
                    {e.habitacion ?? <span className="text-tinta-3">—</span>}
                  </td>
                  <td className="px-2 py-[3px] text-right tabular-nums font-semibold">
                    {total}
                  </td>
                  {fechas.map((f) => {
                    const turno = marcas.get(`${e.id}|${f}`);
                    return (
                      <td key={f} className="p-[1px] text-center">
                        {turno !== undefined ? (
                          <Marca turno={turno ?? "D"} />
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

          {/* El pie del libro: total por dia. En el Excel es la fila 168. */}
          <tfoot className="sticky bottom-0">
            <tr>
              <th
                className="sticky left-0 z-30 bg-superficie-2 border-t border-r border-borde
                           px-2 py-1 text-left rotulo"
              >
                Total por dia
              </th>
              <td className="bg-superficie-2 border-t border-borde" colSpan={3} />
              <td className="bg-superficie-2 border-t border-borde px-2 py-1 text-right tabular-nums font-semibold">
                {numero(noches.length)}
              </td>
              {fechas.map((f) => (
                <td
                  key={f}
                  className="bg-superficie-2 border-t border-borde px-0 py-1
                             text-center text-[10px] tabular-nums text-tinta-2"
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

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <header className="mb-3">
        <h2 className="text-[14px] font-semibold tracking-tight">
          Registro oficial
        </h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[80ch] leading-relaxed">
          La hoja <span className="codigo">R. OFICIAL</span> tal cual: una fila
          por estadia, una columna por dia, una marca por noche. La columna
          Noches es un conteo de las mismas celdas que se ven a su derecha, no
          un total escrito aparte.
        </p>
      </header>
      {children}
    </div>
  );
}
