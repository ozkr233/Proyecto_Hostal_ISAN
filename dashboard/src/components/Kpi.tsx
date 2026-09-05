"use client";

import { numero } from "@/lib/formato";

/**
 * Ficha de dato. Figuras proporcionales, no tabulares: a este tamano
 * `tabular-nums` deja los numeros sueltos.
 */
export function Kpi({
  rotulo,
  valor,
  nota,
  tono = "neutro",
}: {
  rotulo: string;
  valor: number | string;
  nota?: string;
  tono?: "neutro" | "aviso" | "critico";
}) {
  const color =
    tono === "critico"
      ? "text-critico"
      : tono === "aviso"
        ? "text-serio"
        : "text-tinta";

  return (
    <div
      className={`border-l-2 pl-3.5 ${
        tono === "neutro" ? "border-borde" : "border-serio"
      }`}
    >
      <p className="rotulo">{rotulo}</p>
      <p
        className={`text-[28px] font-semibold tracking-tight leading-tight cifras mt-0.5 ${color}`}
      >
        {typeof valor === "number" ? numero(valor) : valor}
      </p>
      {nota ? (
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-snug">{nota}</p>
      ) : null}
    </div>
  );
}

/**
 * La cifra que encabeza el tablero. Una sola por vista.
 *
 * En el Excel el total de noches es un COUNTA por fila, escrito a mano y
 * desincronizado: la hoja se contradice sola (701 en la fila 164, 707 en la
 * 184). Aqui es un count sobre las mismas filas que se muestran abajo.
 */
export function Hero({
  valor,
  rotulo,
  nota,
}: {
  valor: number;
  rotulo: string;
  nota: string;
}) {
  return (
    <div className="tarjeta px-5 py-4 flex flex-col justify-center h-full">
      <p className="rotulo">{rotulo}</p>
      <p className="text-[52px] font-semibold tracking-[-0.02em] leading-[1.02] mt-1 cifras">
        {numero(valor)}
      </p>
      <p className="text-[13px] text-tinta-3 mt-1.5 leading-snug">{nota}</p>
    </div>
  );
}
