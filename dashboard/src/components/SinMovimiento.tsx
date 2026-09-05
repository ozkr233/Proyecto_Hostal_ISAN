"use client";

import { finDeMes, inicioDeMes, nombreDeMes } from "@/lib/fechas";
import { useDatos } from "./DatosProvider";

/**
 * Lo que se ve cuando el mes elegido no tuvo movimiento.
 *
 * Existe porque el panel abre en el mes en curso, y el mes en curso puede
 * estar recien empezando o no tener nada cargado todavia. Un tablero con todas
 * las cifras en cero parece roto; esto dice que no es un fallo, que el mes esta
 * vacio, y ofrece el salto al ultimo mes que si tuvo gente alojada.
 */
export function SinMovimiento({ que = "movimiento" }: { que?: string }) {
  const { filtros, ponerFiltros, ultimoMesConMovimiento } = useDatos();

  const mes =
    filtros.desde && filtros.desde.endsWith("-01")
      ? nombreDeMes(filtros.desde.slice(0, 7))
      : null;

  return (
    <div className="tarjeta px-8 py-14 text-center">
      <p className="text-[19px] font-semibold tracking-tight">
        {mes ? `Sin ${que} en ${mes}` : `Sin ${que} en este periodo`}
      </p>
      <p className="text-tinta-2 mt-2 max-w-[46ch] mx-auto leading-relaxed">
        Nadie durmio en los hostales en estas fechas, o todavia no se ha
        registrado nada.
      </p>

      {ultimoMesConMovimiento ? (
        <button
          type="button"
          onClick={() =>
            ponerFiltros({
              desde: inicioDeMes(ultimoMesConMovimiento),
              hasta: finDeMes(ultimoMesConMovimiento),
            })
          }
          className="mt-6 h-10 px-4 rounded-md bg-acento text-acento-tinta
                     font-medium hover:opacity-90 transition-opacity"
        >
          Ver {nombreDeMes(ultimoMesConMovimiento)}
        </button>
      ) : null}
    </div>
  );
}
