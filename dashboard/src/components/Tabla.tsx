"use client";

import { useMemo, useState } from "react";
import {
  comparar,
  filtroActivo,
  filtroInicial,
  pasa,
  valoresDistintos,
  type EstadoNulos,
  type Filtro,
  type TipoColumna,
  type Valor,
} from "@/lib/filtros";
import { aCSV, descargar } from "@/lib/csv";
import { Menu } from "./ui";

export type Columna<T> = {
  clave: string;
  titulo: string;
  tipo: TipoColumna;
  /** Valor crudo: es lo que se filtra, se ordena y se exporta. */
  valor: (fila: T) => Valor;
  /** Presentacion. Si falta, se muestra el valor crudo. */
  render?: (fila: T) => React.ReactNode;
  numerica?: boolean;
  ancho?: number;
  /** Oculta al abrir; se activa desde el menu "Columnas". */
  oculta?: boolean;
};

const PASO = 150;

/* ========================================================================== */

function ControlNulos({
  valor,
  onChange,
}: {
  valor: EstadoNulos;
  onChange: (v: EstadoNulos) => void;
}) {
  const opciones: [EstadoNulos, string][] = [
    ["todos", "Todos"],
    ["con-valor", "Solo con valor"],
    ["vacios", "Solo vacios"],
  ];
  return (
    <div className="mt-2 pt-2 border-t border-borde">
      <span className="rotulo">Vacios</span>
      <div className="flex gap-1 mt-1">
        {opciones.map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`px-1.5 py-1 rounded text-[11px] border transition-colors ${
              valor === v
                ? "border-acento bg-acento-suave text-tinta"
                : "border-borde text-tinta-2 hover:bg-superficie-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlFiltro({
  filtro,
  opciones,
  onChange,
}: {
  filtro: Filtro;
  opciones: string[];
  onChange: (f: Filtro) => void;
}) {
  const entrada =
    "w-full h-7 px-2 rounded border border-borde bg-superficie text-[12px]";

  if (filtro.tipo === "booleano") {
    const opts: [typeof filtro.valor, string][] = [
      ["todos", "Todos"],
      ["si", "Si"],
      ["no", "No"],
    ];
    return (
      <div className="flex gap-1">
        {opts.map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ ...filtro, valor: v })}
            className={`flex-1 py-1 rounded text-[11.5px] border transition-colors ${
              filtro.valor === v
                ? "border-acento bg-acento-suave text-tinta"
                : "border-borde text-tinta-2 hover:bg-superficie-2"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    );
  }

  if (filtro.tipo === "texto") {
    return (
      <>
        <input
          autoFocus
          value={filtro.texto}
          placeholder="contiene…"
          onChange={(e) => onChange({ ...filtro, texto: e.target.value })}
          className={entrada}
        />
        <ControlNulos
          valor={filtro.nulos}
          onChange={(nulos) => onChange({ ...filtro, nulos })}
        />
      </>
    );
  }

  if (filtro.tipo === "enum") {
    const alternar = (v: string) =>
      onChange({
        ...filtro,
        seleccion: filtro.seleccion.includes(v)
          ? filtro.seleccion.filter((x) => x !== v)
          : [...filtro.seleccion, v],
      });
    return (
      <>
        <div className="max-h-[190px] overflow-auto scroll-fino -mx-0.5">
          {opciones.map((o) => (
            <label
              key={o}
              className="flex items-center gap-2 px-0.5 py-[3px] rounded hover:bg-superficie-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filtro.seleccion.includes(o)}
                onChange={() => alternar(o)}
                className="accent-[var(--acento)]"
              />
              <span className="text-[12px] truncate">{o}</span>
            </label>
          ))}
        </div>
        <ControlNulos
          valor={filtro.nulos}
          onChange={(nulos) => onChange({ ...filtro, nulos })}
        />
      </>
    );
  }

  if (filtro.tipo === "fecha") {
    return (
      <>
        <label className="block">
          <span className="rotulo">Desde</span>
          <input
            type="date"
            value={filtro.desde}
            onChange={(e) => onChange({ ...filtro, desde: e.target.value })}
            className={entrada}
          />
        </label>
        <label className="block mt-1.5">
          <span className="rotulo">Hasta</span>
          <input
            type="date"
            value={filtro.hasta}
            onChange={(e) => onChange({ ...filtro, hasta: e.target.value })}
            className={entrada}
          />
        </label>
        <ControlNulos
          valor={filtro.nulos}
          onChange={(nulos) => onChange({ ...filtro, nulos })}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex gap-1.5">
        <label className="flex-1">
          <span className="rotulo">Min</span>
          <input
            type="number"
            value={filtro.min}
            onChange={(e) => onChange({ ...filtro, min: e.target.value })}
            className={entrada}
          />
        </label>
        <label className="flex-1">
          <span className="rotulo">Max</span>
          <input
            type="number"
            value={filtro.max}
            onChange={(e) => onChange({ ...filtro, max: e.target.value })}
            className={entrada}
          />
        </label>
      </div>
      <ControlNulos
        valor={filtro.nulos}
        onChange={(nulos) => onChange({ ...filtro, nulos })}
      />
    </>
  );
}

/* ========================================================================== */

export function Tabla<T>({
  columnas,
  filas,
  total,
  nombreArchivo,
  claveFila,
  vacio = "Nada que mostrar con estos filtros.",
}: {
  columnas: Columna<T>[];
  filas: T[];
  /** Denominador de "X de N": el universo antes de filtrar. */
  total: number;
  nombreArchivo: string;
  claveFila: (fila: T) => string | number;
  vacio?: string;
}) {
  const [filtros, setFiltros] = useState<Record<string, Filtro>>({});
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(
    null,
  );
  const [ocultas, setOcultas] = useState<Set<string>>(
    () => new Set(columnas.filter((c) => c.oculta).map((c) => c.clave)),
  );
  const [visibles, setVisibles] = useState(PASO);

  const visiblesCols = useMemo(
    () => columnas.filter((c) => !ocultas.has(c.clave)),
    [columnas, ocultas],
  );

  const opcionesEnum = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const c of columnas) {
      if (c.tipo === "enum") m[c.clave] = valoresDistintos(filas, c.valor);
    }
    return m;
  }, [columnas, filas]);

  const filtradas = useMemo(() => {
    const activos = columnas
      .map((c) => [c, filtros[c.clave]] as const)
      .filter((par): par is [Columna<T>, Filtro] => !!par[1] && filtroActivo(par[1]));

    let out = filas;
    if (activos.length > 0) {
      out = filas.filter((fila) =>
        activos.every(([c, f]) => pasa(f, c.valor(fila))),
      );
    }

    if (orden) {
      const col = columnas.find((c) => c.clave === orden.clave);
      if (col) {
        out = [...out].sort((a, b) => {
          const r = comparar(col.valor(a), col.valor(b));
          return orden.asc ? r : -r;
        });
      }
    }
    return out;
  }, [filas, filtros, orden, columnas]);

  const mostradas = filtradas.slice(0, visibles);
  const hayFiltroColumna = Object.values(filtros).some(filtroActivo);

  const cambiarOrden = (clave: string) =>
    setOrden((o) =>
      o?.clave !== clave
        ? { clave, asc: true }
        : o.asc
          ? { clave, asc: false }
          : null,
    );

  return (
    <div className="tarjeta overflow-hidden">
      {/* Barra de la tabla */}
      <div className="flex items-center gap-3 flex-wrap px-3.5 py-2.5 border-b border-borde">
        <span className="text-[14px] text-tinta-2">
          <strong className="text-tinta font-semibold cifras">
            {filtradas.length.toLocaleString("es-CL")}
          </strong>{" "}
          de {total.toLocaleString("es-CL")}
        </span>

        {hayFiltroColumna ? (
          <button
            type="button"
            onClick={() => setFiltros({})}
            className="text-[13px] text-acento hover:underline"
          >
            quitar filtros de columna
          </button>
        ) : null}

        <div className="ml-auto">
          {/* Un solo menu para lo de experto. Columnas y CSV estaban siempre a
              la vista, compitiendo con el dato; se usan de vez en cuando. */}
          <Menu resumen="Acciones" ancho={230} alinear="der">
            <p className="rotulo px-1 pb-1.5 mb-1 border-b border-borde">
              Columnas visibles
            </p>
            <div className="max-h-[240px] overflow-auto scroll-fino">
              {columnas.map((c) => (
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

            <div className="mt-1.5 pt-1.5 border-t border-borde flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => setOcultas(new Set())}
                className="w-full text-left px-1 py-1.5 rounded-md hover:bg-superficie-2"
              >
                Mostrar todas las columnas
              </button>
              <button
                type="button"
                onClick={() => descargar(nombreArchivo, aCSV(visiblesCols, filtradas))}
                className="w-full text-left px-1 py-1.5 rounded-md hover:bg-superficie-2"
              >
                Descargar CSV
              </button>
            </div>
          </Menu>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-auto scroll-fino max-h-[calc(100vh-260px)]">
        <table className="w-full border-collapse text-[14px]">
          <thead className="sticky top-0 z-20">
            <tr>
              {visiblesCols.map((c) => {
                const f = filtros[c.clave] ?? filtroInicial(c.tipo);
                const activo = filtroActivo(f);
                const ordenado = orden?.clave === c.clave;
                return (
                  <th
                    key={c.clave}
                    style={{ minWidth: c.ancho ?? 110 }}
                    className="bg-superficie-2 border-b border-borde px-3 py-2
                               text-left align-bottom font-normal"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => cambiarOrden(c.clave)}
                        title="Ordenar"
                        className="rotulo hover:text-tinta transition-colors text-left"
                      >
                        {c.titulo}
                        {ordenado ? (
                          <span className="ml-1 text-acento">
                            {orden.asc ? "▲" : "▼"}
                          </span>
                        ) : null}
                      </button>
                      <span className="ml-auto">
                        <Menu
                          resumen={<span aria-hidden>⋯</span>}
                          activo={activo}
                          ancho={200}
                          alinear="der"
                        >
                          <div className="flex items-center justify-between px-0.5 pb-1.5 mb-1.5 border-b border-borde">
                            <span className="rotulo">{c.titulo}</span>
                            {activo ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setFiltros((s) => {
                                    const n = { ...s };
                                    delete n[c.clave];
                                    return n;
                                  })
                                }
                                className="text-[11px] text-acento hover:underline"
                              >
                                limpiar
                              </button>
                            ) : null}
                          </div>
                          <ControlFiltro
                            filtro={f}
                            opciones={opcionesEnum[c.clave] ?? []}
                            onChange={(nuevo) =>
                              setFiltros((s) => ({ ...s, [c.clave]: nuevo }))
                            }
                          />
                        </Menu>
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {mostradas.map((fila) => (
              <tr
                key={claveFila(fila)}
                className="border-b border-linea hover:bg-superficie-2"
              >
                {visiblesCols.map((c) => (
                  <td
                    key={c.clave}
                    className={`px-3 py-2 align-top ${
                      c.numerica ? "text-right cifras" : ""
                    }`}
                  >
                    {c.render ? c.render(fila) : celda(c.valor(fila))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {filtradas.length === 0 ? (
          <p className="px-3 py-8 text-center text-tinta-3">{vacio}</p>
        ) : null}
      </div>

      {filtradas.length > mostradas.length ? (
        <div className="flex items-center justify-center gap-3 px-3 py-2 border-t border-borde">
          <span className="text-[12px] text-tinta-3">
            Mostrando {mostradas.length.toLocaleString("es-CL")}
          </span>
          <button
            type="button"
            onClick={() => setVisibles((v) => v + PASO)}
            className="h-7 px-2.5 rounded-md border border-borde bg-superficie
                       hover:bg-superficie-2 text-[12px]"
          >
            Mostrar {PASO} mas
          </button>
          <button
            type="button"
            onClick={() => setVisibles(filtradas.length)}
            className="text-[12px] text-acento hover:underline"
          >
            Mostrar todas ({filtradas.length.toLocaleString("es-CL")})
          </button>
        </div>
      ) : null}
    </div>
  );
}

function celda(v: Valor): React.ReactNode {
  if (v === null || v === undefined || v === "") {
    return <span className="text-tinta-3">—</span>;
  }
  if (typeof v === "boolean") {
    return v ? "Si" : <span className="text-tinta-3">No</span>;
  }
  return String(v);
}
