"use client";

import { useEffect, useRef, useState } from "react";
import { numero } from "@/lib/formato";

/** Ancho real del contenedor: el SVG se dibuja a medida, sin deformar el texto. */
export function useAncho<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(e.contentRect.width));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  return { ref, ancho };
}

/* -------------------------------------------------------------------------- */

export type Serie = { clave: string; nombre: string; color: string };

export function Leyenda({ series }: { series: Serie[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 mt-2.5">
      {series.map((s) => (
        <li key={s.clave} className="flex items-center gap-1.5">
          <span
            aria-hidden
            style={{ background: s.color }}
            className="w-2.5 h-2.5 rounded-[3px] shrink-0"
          />
          <span className="text-[11.5px] text-tinta-2">{s.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Tarjeta de grafico con su gemela en tabla. La paleta clara deja tres tonos
 * por debajo de 3:1 contra la superficie, y la regla de alivio de dataviz pide
 * exactamente esto: que todo valor sea legible sin depender del color.
 */
export function TarjetaGrafico({
  titulo,
  subtitulo,
  series,
  tabla,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  series?: Serie[];
  tabla: () => React.ReactNode;
  children: React.ReactNode;
}) {
  const [verTabla, setVerTabla] = useState(false);

  return (
    <section className="tarjeta p-3.5">
      <header className="flex items-start gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="text-[13.5px] font-semibold tracking-tight">{titulo}</h2>
          {subtitulo ? (
            <p className="text-[11.5px] text-tinta-3 mt-0.5">{subtitulo}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setVerTabla((v) => !v)}
          aria-pressed={verTabla}
          className="ml-auto shrink-0 h-6 px-2 rounded border border-borde
                     text-[11px] text-tinta-2 hover:bg-superficie-2 transition-colors"
        >
          {verTabla ? "Ver grafico" : "Ver tabla"}
        </button>
      </header>

      {verTabla ? (
        <div className="max-h-[300px] overflow-auto scroll-fino">{tabla()}</div>
      ) : (
        <>
          {children}
          {series && series.length > 1 ? <Leyenda series={series} /> : null}
        </>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

export function TablaSimple({
  cabeceras,
  filas,
}: {
  cabeceras: string[];
  filas: (string | number)[][];
}) {
  return (
    <table className="w-full text-[12px] border-collapse">
      <thead className="sticky top-0">
        <tr>
          {cabeceras.map((h, i) => (
            <th
              key={h}
              className={`bg-superficie-2 border-b border-borde px-2 py-1.5 rotulo ${
                i === 0 ? "text-left" : "text-right"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={i} className="border-b border-linea">
            {f.map((c, j) => (
              <td
                key={j}
                className={`px-2 py-1 ${
                  j === 0 ? "" : "text-right tabular-nums"
                }`}
              >
                {typeof c === "number" ? numero(c) : c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* -------------------------------------------------------------------------- */

export function Tooltip({
  x,
  y,
  ancho,
  children,
}: {
  x: number;
  y: number;
  ancho: number;
  children: React.ReactNode;
}) {
  // Se voltea al otro lado cerca del borde derecho para no salirse de la tarjeta.
  const derecha = x > ancho - 170;
  return (
    <div
      style={{
        left: derecha ? undefined : x + 12,
        right: derecha ? ancho - x + 12 : undefined,
        top: y,
      }}
      className="pointer-events-none absolute z-30 tarjeta shadow-lg px-2.5 py-2
                 min-w-[130px] max-w-[220px]"
    >
      {children}
    </div>
  );
}

/** Escala lineal 0..max redondeada a un tope limpio, con 4 marcas. */
export function escalaY(max: number): { tope: number; marcas: number[] } {
  if (max <= 0) return { tope: 1, marcas: [0, 1] };
  const bruto = max / 4;
  const magnitud = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((p) => p >= bruto) ??
    10 * magnitud;
  const tope = Math.ceil(max / paso) * paso;
  const marcas: number[] = [];
  for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(Math.round(v));
  return { tope, marcas };
}
