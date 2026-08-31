"use client";

import { numero } from "@/lib/formato";

export type ItemBarra = {
  clave: string;
  nombre: string;
  valor: number;
  color: string;
  /** Segunda linea bajo el nombre, p. ej. "3 estadias". */
  nota?: string;
};

/**
 * Ranking horizontal. Sin grilla ni eje: cada barra lleva su valor en la punta,
 * y las etiquetas directas van antes que las lineas de grilla.
 *
 * El color viene de la entidad (la empresa, el hostal), no de su posicion:
 * al filtrar, las que quedan conservan su tono.
 */
export function BarrasH({
  items,
  unidad = "",
}: {
  items: ItemBarra[];
  unidad?: string;
}) {
  const max = Math.max(...items.map((i) => i.valor), 1);

  if (items.length === 0) {
    return (
      <p className="text-tinta-3 text-[12px] py-6 text-center">
        Sin datos en este rango.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((i) => (
        <li key={i.clave} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-2.5">
          <div className="min-w-0">
            <p className="text-[12px] truncate" title={i.nombre}>
              {i.nombre}
            </p>
            {i.nota ? (
              <p className="text-[10.5px] text-tinta-3 truncate">{i.nota}</p>
            ) : null}
          </div>

          <div className="h-[18px] flex items-center">
            <div
              style={{
                width: `${Math.max((i.valor / max) * 100, i.valor > 0 ? 1.5 : 0)}%`,
                background: i.color,
              }}
              className="h-full rounded-r-[4px]"
            />
          </div>

          <span className="text-[12px] tabular-nums font-medium tracking-tight">
            {numero(i.valor)}
            {unidad ? (
              <span className="text-tinta-3 font-normal"> {unidad}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
