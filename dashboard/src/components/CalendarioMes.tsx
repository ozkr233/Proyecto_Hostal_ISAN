"use client";

import { useMemo } from "react";
import { finDeMes, hoy, rangoDeDias } from "@/lib/fechas";
import { fechaLarga, numero } from "@/lib/formato";

/** Lunes primero, como se lee un calendario en Chile. */
const DIAS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

/** diaSemana() da 0=domingo; aqui la semana empieza en lunes. */
function columnaDe(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
}

/**
 * El paso de la rampa para un valor. Cuatro pasos sobre el maximo del mes: es
 * una escala relativa, no absoluta, porque lo que interesa es la forma del mes
 * -que dias se llena y cuales se vacia-, no comparar julio contra agosto.
 */
function pasoDe(n: number, max: number): number {
  if (n <= 0) return 0;
  if (max <= 0) return 1;
  const p = Math.ceil((n / max) * 4);
  return Math.min(4, Math.max(1, p));
}

/**
 * El mes como un mes: semanas en filas, dias de la semana en columnas.
 *
 * Sustituye al grafico de columnas de 31 barras. Un administrador no piensa el
 * mes como una serie temporal, lo piensa como un calendario -"el fin de semana
 * largo se vacio", "la semana del 20 estuvo llena"-, y esa forma solo aparece
 * cuando los dias se apilan en semanas. De paso deja de parecerse a las otras
 * dos pantallas, que si son rejillas de 31 columnas.
 */
export function CalendarioMes({
  mes,
  porDia,
  onDia,
  diaActivo,
}: {
  /** 'YYYY-MM' */
  mes: string;
  /** Personas que durmieron cada fecha. */
  porDia: Map<string, number>;
  onDia?: (fecha: string) => void;
  diaActivo?: string | null;
}) {
  const semanas = useMemo(() => {
    const dias = rangoDeDias(`${mes}-01`, finDeMes(mes));
    if (dias.length === 0) return [];

    const filas: (string | null)[][] = [];
    let fila: (string | null)[] = Array(columnaDe(dias[0])).fill(null);

    for (const f of dias) {
      fila.push(f);
      if (fila.length === 7) {
        filas.push(fila);
        fila = [];
      }
    }
    if (fila.length > 0) {
      while (fila.length < 7) fila.push(null);
      filas.push(fila);
    }
    return filas;
  }, [mes]);

  const max = useMemo(() => {
    let m = 0;
    for (const [f, n] of porDia) if (f.slice(0, 7) === mes && n > m) m = n;
    return m;
  }, [porDia, mes]);

  const hoyStr = hoy();

  return (
    <div className="tarjeta p-4">
      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DIAS.map((d) => (
          <div key={d} className="rotulo text-center">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d.slice(0, 1)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {semanas.flat().map((f, i) => {
          if (f === null) {
            return <div key={`v${i}`} aria-hidden className="min-h-[86px]" />;
          }

          const n = porDia.get(f) ?? 0;
          const paso = pasoDe(n, max);
          const finde = columnaDe(f) >= 5;
          const esHoy = f === hoyStr;
          const activo = f === diaActivo;

          const contenido = (
            <>
              <span
                className={`text-[13px] cifras ${
                  paso >= 3 ? "opacity-80" : "text-tinta-3"
                }`}
              >
                {Number(f.slice(8, 10))}
              </span>
              {n > 0 ? (
                <span className="text-[26px] font-semibold cifras leading-none mt-auto">
                  {numero(n)}
                </span>
              ) : (
                <span className="text-[13px] text-tinta-3 mt-auto">&mdash;</span>
              )}
            </>
          );

          const clases = `min-h-[86px] rounded-md p-2 flex flex-col items-start
                          text-left transition-shadow ${
                            esHoy || activo
                              ? "ring-2 ring-acento"
                              : finde && paso === 0
                                ? "ring-1 ring-inset ring-[var(--linea)]"
                                : ""
                          }`;

          const estilo = {
            background: `var(--rampa-${paso})`,
            color: paso >= 3 ? "var(--rampa-ink-alto)" : "var(--tinta)",
          };

          const titulo = `${fechaLarga(f)}: ${
            n === 0 ? "sin nadie alojado" : `${numero(n)} personas`
          }`;

          return onDia ? (
            <button
              key={f}
              type="button"
              onClick={() => onDia(f)}
              style={estilo}
              title={titulo}
              aria-pressed={activo}
              className={`${clases} hover:ring-2 hover:ring-acento cursor-pointer`}
            >
              {contenido}
            </button>
          ) : (
            <div key={f} style={estilo} title={titulo} className={clases}>
              {contenido}
            </div>
          );
        })}
      </div>
    </div>
  );
}
