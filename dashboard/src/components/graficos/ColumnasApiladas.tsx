"use client";

import { useState } from "react";
import { numero } from "@/lib/formato";
import { escalaY, Tooltip, useAncho, type Serie } from "./comun";

export type PuntoApilado = {
  /** Clave unica del bucket (una fecha 'YYYY-MM-DD', normalmente). */
  x: string;
  etiqueta: string;
  valores: Record<string, number>;
};

const M = { arriba: 6, derecha: 8, abajo: 26, izquierda: 40 };
const GAP = 2; // separacion en color de superficie entre segmentos apilados

/** Rectangulo con las dos esquinas de arriba redondeadas y la base cuadrada. */
function techo(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return (
    `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} ` +
    `L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} ` +
    `L${x + w},${y + h} Z`
  );
}

export function ColumnasApiladas({
  puntos,
  series,
  alto = 200,
  unidad = "",
}: {
  puntos: PuntoApilado[];
  series: Serie[];
  alto?: number;
  unidad?: string;
}) {
  const { ref, ancho } = useAncho<HTMLDivElement>();
  const [sobre, setSobre] = useState<number | null>(null);

  const anchoUtil = Math.max(0, ancho - M.izquierda - M.derecha);
  const altoUtil = Math.max(0, alto - M.arriba - M.abajo);

  const totales = puntos.map((p) =>
    series.reduce((s, se) => s + (p.valores[se.clave] ?? 0), 0),
  );
  const { tope, marcas } = escalaY(Math.max(...totales, 0));

  const banda = puntos.length > 0 ? anchoUtil / puntos.length : 0;
  const anchoBarra = Math.max(2, Math.min(24, banda - 4));
  const aY = (v: number) => M.arriba + altoUtil - (v / tope) * altoUtil;

  // Una etiqueta cada N columnas, para que no se pisen.
  const pasoEtiqueta = Math.max(1, Math.ceil(46 / Math.max(banda, 1)));

  const p = sobre !== null ? puntos[sobre] : null;

  return (
    <div ref={ref} className="relative">
      {ancho > 0 && puntos.length > 0 ? (
        <svg
          width={ancho}
          height={alto}
          role="img"
          aria-label={`Grafico de columnas apiladas, ${puntos.length} periodos`}
        >
          {/* Grilla: hairline solida, un paso por debajo de la superficie */}
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={M.izquierda}
                x2={ancho - M.derecha}
                y1={aY(m)}
                y2={aY(m)}
                stroke="var(--linea)"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
              <text
                x={M.izquierda - 7}
                y={aY(m) + 3.5}
                textAnchor="end"
                fontSize={10}
                fill="var(--tinta-3)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {numero(m)}
              </text>
            </g>
          ))}

          {puntos.map((punto, i) => {
            const x = M.izquierda + i * banda + (banda - anchoBarra) / 2;
            let acumulado = 0;

            // De abajo hacia arriba; solo el ultimo segmento con valor lleva
            // el extremo redondeado.
            const conValor = series.filter((s) => (punto.valores[s.clave] ?? 0) > 0);

            return (
              <g key={punto.x}>
                {sobre === i ? (
                  <rect
                    x={M.izquierda + i * banda}
                    y={M.arriba}
                    width={banda}
                    height={altoUtil}
                    fill="var(--superficie-3)"
                    opacity={0.55}
                  />
                ) : null}

                {conValor.map((s, idx) => {
                  const v = punto.valores[s.clave] ?? 0;
                  const yBase = aY(acumulado);
                  acumulado += v;
                  const yTope = aY(acumulado);
                  const esUltimo = idx === conValor.length - 1;
                  // El hueco de 2px lo hace la superficie, no un borde.
                  const h = Math.max(1, yBase - yTope - (esUltimo ? 0 : GAP));
                  const y = yBase - h;

                  return esUltimo ? (
                    <path
                      key={s.clave}
                      d={techo(x, y, anchoBarra, h, 4)}
                      fill={s.color}
                    />
                  ) : (
                    <rect
                      key={s.clave}
                      x={x}
                      y={y}
                      width={anchoBarra}
                      height={h}
                      fill={s.color}
                    />
                  );
                })}

                {i % pasoEtiqueta === 0 ? (
                  <text
                    x={M.izquierda + i * banda + banda / 2}
                    y={alto - 9}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--tinta-3)"
                  >
                    {punto.etiqueta}
                  </text>
                ) : null}

                {/* Blanco de captura: toda la columna, no solo la barra. */}
                <rect
                  x={M.izquierda + i * banda}
                  y={M.arriba}
                  width={banda}
                  height={altoUtil}
                  fill="transparent"
                  onMouseEnter={() => setSobre(i)}
                  onMouseLeave={() => setSobre(null)}
                />
              </g>
            );
          })}

          {/* Linea base */}
          <line
            x1={M.izquierda}
            x2={ancho - M.derecha}
            y1={aY(0)}
            y2={aY(0)}
            stroke="var(--eje)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
        </svg>
      ) : (
        <div style={{ height: alto }} className="grid place-items-center">
          <span className="text-tinta-3 text-[12px]">
            {puntos.length === 0 ? "Sin datos en este rango." : ""}
          </span>
        </div>
      )}

      {p && sobre !== null ? (
        <Tooltip
          x={M.izquierda + sobre * banda + banda / 2}
          y={8}
          ancho={ancho}
        >
          <p className="rotulo mb-1">{p.etiqueta}</p>
          {series
            .filter((s) => (p.valores[s.clave] ?? 0) > 0)
            .reverse()
            .map((s) => (
              <div key={s.clave} className="flex items-center gap-1.5 py-[1px]">
                <span
                  aria-hidden
                  style={{ background: s.color }}
                  className="w-2 h-2 rounded-[2px] shrink-0"
                />
                <span className="text-[11.5px] text-tinta-2 truncate">
                  {s.nombre}
                </span>
                <span className="ml-auto text-[11.5px] tabular-nums font-medium">
                  {numero(p.valores[s.clave] ?? 0)}
                </span>
              </div>
            ))}
          <div className="flex items-center gap-2 mt-1 pt-1 border-t border-borde">
            <span className="rotulo">Total {unidad}</span>
            <span className="ml-auto text-[12px] tabular-nums font-semibold">
              {numero(totales[sobre])}
            </span>
          </div>
        </Tooltip>
      ) : null}
    </div>
  );
}
