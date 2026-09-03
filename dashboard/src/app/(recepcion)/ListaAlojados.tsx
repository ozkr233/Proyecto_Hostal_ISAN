"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { diasEntre } from "@/lib/fechas";
import { norm } from "@/lib/filtros";
import { fechaLarga, formatearRut } from "@/lib/formato";
import type { Alojado } from "@/lib/recepcion";
import { registrarRegreso } from "./acciones";

/**
 * La lista de gente alojada, con buscador. En un hostal de 30 personas se
 * encuentra a ojo; con los tres hostales juntos, no. Filtra en el navegador
 * porque los datos ya estan aqui: escribir no vuelve a la base.
 */
export function ListaAlojados({ alojados, hoy }: { alojados: Alojado[]; hoy: string }) {
  const [busqueda, setBusqueda] = useState("");

  const visibles = useMemo(() => {
    const buscado = norm(busqueda);
    if (buscado === "") return alojados;
    return alojados.filter((a) =>
      [a.persona, a.rut, a.habitacion, a.empresa, a.hostal_codigo, a.numero_llave].some(
        (c) => c && norm(String(c)).includes(buscado),
      ),
    );
  }, [alojados, busqueda]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre, RUT, habitacion, empresa o llave…"
        className="w-full h-10 px-3 rounded-md bg-superficie border border-borde text-[15px]
                   placeholder:text-tinta-3 focus:outline-none focus:ring-2 focus:ring-[var(--acento)]"
      />

      {visibles.length === 0 ? (
        <p className="text-[13.5px] text-tinta-3 px-1 py-4">
          Nadie coincide con «{busqueda}».
        </p>
      ) : (
        <>
          {busqueda ? (
            <p className="text-[12px] text-tinta-3 px-1">
              {visibles.length} de {alojados.length}
            </p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {visibles.map((a) => (
              <Fila key={a.estadia_id} a={a} hoy={hoy} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Fila({ a, hoy }: { a: Alojado; hoy: string }) {
  const ausente = a.ausencia_id !== null;
  const atraso =
    a.fecha_salida_prevista !== null ? diasEntre(a.fecha_salida_prevista, hoy) : null;

  return (
    <li
      className={`tarjeta p-3 flex items-center gap-3 flex-wrap ${ausente ? "opacity-75" : ""}`}
    >
      <div className="min-w-[190px] flex-1">
        <p className="text-[14.5px] font-medium leading-tight">{a.persona}</p>
        <p className="text-[12px] text-tinta-3 mt-0.5">
          <span className="codigo">{formatearRut(a.rut) ?? "sin RUT"}</span> · {a.empresa}
        </p>
      </div>

      <div className="text-[12.5px] text-tinta-2 min-w-[130px]">
        <span className="codigo">{a.hostal_codigo}</span>
        {a.habitacion ? (
          <>
            {" · hab. "}
            <span className="codigo">{a.habitacion}</span>
          </>
        ) : null}
        {a.numero_llave ? (
          <span className="text-tinta-3"> · llave {a.numero_llave}</span>
        ) : null}
      </div>

      <div className="text-[12.5px] min-w-[150px]">
        <span className="text-tinta-2">
          {a.noches} {a.noches === 1 ? "noche" : "noches"}
        </span>
        {a.fecha_salida_prevista ? (
          <span className={atraso !== null && atraso > 0 ? "text-critico" : "text-tinta-3"}>
            {atraso !== null && atraso > 0
              ? ` · debio salir hace ${atraso} ${atraso === 1 ? "dia" : "dias"}`
              : ` · sale el ${fechaLarga(a.fecha_salida_prevista)}`}
          </span>
        ) : null}
      </div>

      {ausente ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11.5px]
                       font-medium bg-superficie-2 text-serio"
          >
            {a.ausencia_nombre}
            {a.ausencia_hasta
              ? ` · vuelve el ${fechaLarga(a.ausencia_hasta)}`
              : " · sin fecha de regreso"}
            {a.ausencia_conserva_habitacion === false ? " · cama liberada" : null}
          </span>
          <form action={registrarRegreso}>
            <input type="hidden" name="ausencia_id" value={a.ausencia_id ?? ""} />
            <button
              type="submit"
              className="h-8 px-2.5 rounded-md border border-borde text-[12.5px]
                         text-tinta-2 hover:bg-superficie-2 transition-colors"
            >
              Volvio
            </button>
          </form>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Link
            href={`/ausencia/${a.estadia_id}`}
            className="h-8 px-2.5 grid place-items-center rounded-md border border-borde
                       text-[12.5px] text-tinta-2 hover:bg-superficie-2 transition-colors"
          >
            Ausencia
          </Link>
          <Link
            href={`/salida/${a.estadia_id}`}
            className="h-8 px-3 grid place-items-center rounded-md border border-acento
                       bg-acento-suave text-[12.5px] font-medium text-tinta"
          >
            Registrar salida
          </Link>
        </div>
      )}
    </li>
  );
}
