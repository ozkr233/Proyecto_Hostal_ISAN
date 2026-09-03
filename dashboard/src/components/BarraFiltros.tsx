"use client";

import { useMemo } from "react";
import { fechaLarga } from "@/lib/formato";
import { useDatos } from "./DatosProvider";
import { CampoTexto, Interruptor, Menu, MultiSelect } from "./ui";

/** Ultimo dia del mes, sin pasar por Date: 'YYYY-MM' -> 'YYYY-MM-DD'. */
function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, "0")}`;
}

const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Una sola fila de filtros, arriba de todo lo que alcanza: cada pestana y cada
 * grafico se dibujan contra la misma rebanada. Nada de filtros por tarjeta.
 */
export function BarraFiltros() {
  const { filtros, ponerFiltros, limpiar, hayFiltros, catalogo, todo } =
    useDatos();

  const meses = useMemo(() => {
    const set = new Set<string>();
    for (const n of todo.noches) set.add(n.fecha.slice(0, 7));
    for (const s of todo.servicios) set.add(s.fecha.slice(0, 7));
    return [...set].sort();
  }, [todo]);

  const rangoResumen =
    filtros.desde || filtros.hasta
      ? `${filtros.desde ? fechaLarga(filtros.desde) : "inicio"} → ${
          filtros.hasta ? fechaLarga(filtros.hasta) : "fin"
        }`
      : "Fechas: todas";

  // z-40: por encima de las celdas fijas de las tablas, que llegan a z-30.
  //
  // Al ser `sticky` con z-index, esta barra crea su propio contexto de
  // apilamiento, asi que el z-40 de los desplegables de dentro solo compite
  // entre hermanos y no contra el resto de la pagina. Lo que decide si un menu
  // abierto tapa a la tabla -o queda tapado por ella- es el z-index de ESTA
  // barra. Con z-20, la columna fija del registro oficial (z-30) atravesaba el
  // desplegable de fechas y lo partia en dos.
  return (
    <div className="sticky top-[73px] z-40 bg-plano border-b border-borde px-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Menu
          resumen={rangoResumen}
          activo={filtros.desde !== "" || filtros.hasta !== ""}
          ancho={230}
        >
          <div className="flex items-center justify-between px-0.5 pb-1.5 mb-1.5 border-b border-borde">
            <span className="rotulo">Rango de fechas</span>
            {filtros.desde || filtros.hasta ? (
              <button
                type="button"
                onClick={() => ponerFiltros({ desde: "", hasta: "" })}
                className="text-[11px] text-acento hover:underline"
              >
                todas
              </button>
            ) : null}
          </div>

          {meses.map((m) => {
            const desde = `${m}-01`;
            const hasta = finDeMes(m);
            const activo = filtros.desde === desde && filtros.hasta === hasta;
            const [a, mm] = m.split("-");
            return (
              <button
                key={m}
                type="button"
                onClick={() => ponerFiltros({ desde, hasta })}
                className={`w-full text-left px-1.5 py-1 rounded text-[12px]
                            hover:bg-superficie-2 flex items-center gap-2 ${
                              activo ? "text-tinta font-medium" : "text-tinta-2"
                            }`}
              >
                <span
                  aria-hidden
                  className={`w-3 shrink-0 ${activo ? "text-acento" : "opacity-0"}`}
                >
                  ✓
                </span>
                {NOMBRE_MES[Number(mm) - 1]} {a}
              </button>
            );
          })}

          <div className="mt-2 pt-2 border-t border-borde flex gap-1.5">
            <label className="flex-1">
              <span className="rotulo">Desde</span>
              <input
                type="date"
                value={filtros.desde}
                min={catalogo.fechaMin}
                max={catalogo.fechaMax}
                onChange={(e) => ponerFiltros({ desde: e.target.value })}
                className="w-full h-7 px-1.5 rounded border border-borde bg-superficie text-[12px]"
              />
            </label>
            <label className="flex-1">
              <span className="rotulo">Hasta</span>
              <input
                type="date"
                value={filtros.hasta}
                min={catalogo.fechaMin}
                max={catalogo.fechaMax}
                onChange={(e) => ponerFiltros({ hasta: e.target.value })}
                className="w-full h-7 px-1.5 rounded border border-borde bg-superficie text-[12px]"
              />
            </label>
          </div>
        </Menu>

        <MultiSelect
          titulo="Empresa"
          opciones={catalogo.empresas}
          seleccion={filtros.empresas}
          onChange={(empresas) => ponerFiltros({ empresas })}
        />
        <MultiSelect
          titulo="Hostal"
          opciones={catalogo.hostales}
          seleccion={filtros.hostales}
          onChange={(hostales) => ponerFiltros({ hostales })}
        />
        <MultiSelect
          titulo="Archivo"
          opciones={catalogo.archivos}
          seleccion={filtros.archivos}
          onChange={(archivos) => ponerFiltros({ archivos })}
          ancho={280}
        />

        <CampoTexto
          valor={filtros.busqueda}
          onChange={(busqueda) => ponerFiltros({ busqueda })}
          placeholder="Nombre, RUT, folio o habitacion…"
          ancho={240}
        />

        <Interruptor
          etiqueta="Solo requiere revision"
          activo={filtros.soloRevision}
          onChange={(soloRevision) => ponerFiltros({ soloRevision })}
        />

        {hayFiltros ? (
          <button
            type="button"
            onClick={limpiar}
            className="text-[12px] text-acento hover:underline"
          >
            Limpiar todo
          </button>
        ) : null}
      </div>
    </div>
  );
}
