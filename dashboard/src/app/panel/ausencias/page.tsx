"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta } from "@/components/ui";
import { fechaLarga, formatearRut } from "@/lib/formato";
import type { Ausencia } from "@/lib/types";

export default function PaginaAusencias() {
  const { ausencias, todo } = useDatos();

  const columnas = useMemo<Columna<Ausencia>[]>(
    () => [
      { clave: "persona", titulo: "Nombre", tipo: "texto", ancho: 200, valor: (a) => a.persona },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 118,
        valor: (a) => a.rut,
        render: (a) =>
          a.rut ? (
            <span className="codigo">{formatearRut(a.rut)}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      {
        clave: "tipo_nombre",
        titulo: "Motivo",
        tipo: "enum",
        ancho: 150,
        valor: (a) => a.tipo_nombre,
      },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 130, valor: (a) => a.empresa },
      {
        clave: "hostal",
        titulo: "Hostal",
        tipo: "enum",
        ancho: 82,
        valor: (a) => a.hostal,
        render: (a) => <span className="codigo">{a.hostal}</span>,
      },
      {
        clave: "habitacion",
        titulo: "Hab.",
        tipo: "texto",
        ancho: 72,
        valor: (a) => a.habitacion,
        render: (a) =>
          a.habitacion ? (
            <span className="codigo">{a.habitacion}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      {
        clave: "desde",
        titulo: "Desde",
        tipo: "fecha",
        ancho: 104,
        valor: (a) => a.desde,
        render: (a) => <span className="codigo">{fechaLarga(a.desde)}</span>,
      },
      {
        clave: "hasta",
        titulo: "Hasta",
        tipo: "fecha",
        ancho: 118,
        valor: (a) => a.hasta,
        // Sin fecha de regreso no es un dato que falte: es alguien que la
        // operacion perdio de vista, y por eso se marca.
        render: (a) =>
          a.hasta ? (
            <span className="codigo">{fechaLarga(a.hasta)}</span>
          ) : (
            <Etiqueta tono="aviso">
              <span aria-hidden>▲</span> sin regreso
            </Etiqueta>
          ),
      },
      {
        clave: "dias",
        titulo: "Dias",
        tipo: "numero",
        ancho: 70,
        numerica: true,
        valor: (a) => a.dias,
      },
      {
        clave: "conserva_habitacion",
        titulo: "Cama",
        tipo: "booleano",
        ancho: 106,
        valor: (a) => a.conserva_habitacion,
        render: (a) =>
          a.conserva_habitacion ? (
            <span className="text-tinta-2">reservada</span>
          ) : (
            <span className="text-tinta-3">liberada</span>
          ),
      },
      { clave: "detalle", titulo: "Detalle", tipo: "texto", ancho: 240, oculta: true, valor: (a) => a.detalle },
      {
        clave: "registrado_por",
        titulo: "Registro",
        tipo: "enum",
        ancho: 140,
        oculta: true,
        valor: (a) => a.registrado_por,
      },
      { clave: "tipo", titulo: "Codigo", tipo: "enum", ancho: 130, oculta: true, valor: (a) => a.tipo },
      { clave: "estadia_id", titulo: "Estadia", tipo: "numero", ancho: 80, numerica: true, oculta: true, valor: (a) => a.estadia_id },
    ],
    [],
  );

  const diasPersona = ausencias.reduce((n, a) => n + a.dias, 0);
  const sinCerrar = ausencias.filter((a) => a.hasta === null).length;

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-[14px] font-semibold tracking-tight">Ausencias</h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[76ch] leading-relaxed">
          Permisos, vacaciones y licencias. En el Excel esto no existia como dato: en{" "}
          <span className="codigo">REGISTRO OFICIAL</span> de ALMAR WATER son las filas
          97 a 99, tres totales por dia <strong>escritos a mano</strong> —1, 20 y 40
          dias-persona en julio— sin ninguna fila detras que dijera de quien eran. Aqui
          cada ausencia tiene nombre, fechas y quien la registro, y sus dias se
          descuentan solos de las noches que se cobran.
        </p>
      </header>

      {ausencias.length > 0 ? (
        <p className="text-[12px] text-tinta-2">
          <strong>{diasPersona}</strong> dias-persona de ausencia
          {sinCerrar > 0 ? (
            <>
              {" · "}
              <span className="text-serio">
                {sinCerrar} {sinCerrar === 1 ? "sin fecha de regreso" : "sin fecha de regreso"}
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      <Tabla
        columnas={columnas}
        filas={ausencias}
        total={todo.ausencias.length}
        nombreArchivo="ausencias.csv"
        claveFila={(a) => a.id}
      />
    </div>
  );
}
