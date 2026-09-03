"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta } from "@/components/ui";
import { fechaLarga, formatearRut } from "@/lib/formato";
import { NOMBRE_ENTREGA } from "@/lib/paleta";
import type { Estadia } from "@/lib/types";

export default function PaginaEstadias() {
  const { estadias, nochesPorEstadia, todo } = useDatos();

  const columnas = useMemo<Columna<Estadia>[]>(
    () => [
      {
        clave: "persona",
        titulo: "Nombre",
        tipo: "texto",
        ancho: 200,
        valor: (e) => e.persona,
      },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 118,
        valor: (e) => e.rut,
        render: (e) =>
          e.rut ? (
            <span
              className={`codigo ${e.rut_valido ? "" : "text-critico"}`}
              title={e.rut_valido ? undefined : "Digito verificador invalido"}
            >
              {formatearRut(e.rut)}
            </span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 130, valor: (e) => e.empresa },
      { clave: "hostal", titulo: "Hostal", tipo: "enum", ancho: 82, valor: (e) => e.hostal,
        render: (e) => <span className="codigo">{e.hostal}</span> },
      {
        clave: "habitacion",
        titulo: "Hab.",
        tipo: "texto",
        ancho: 72,
        valor: (e) => e.habitacion,
        render: (e) =>
          e.habitacion ? (
            <span className="codigo">{e.habitacion}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      {
        clave: "tipo_habitacion",
        titulo: "Tipo",
        tipo: "enum",
        ancho: 84,
        valor: (e) => e.tipo_habitacion,
      },
      {
        clave: "noches",
        titulo: "Noches",
        tipo: "numero",
        ancho: 78,
        numerica: true,
        // count() sobre las mismas filas que se muestran, no el COUNTA a mano
        // de la columna N del Excel.
        valor: (e) => nochesPorEstadia.get(e.id)?.length ?? 0,
      },
      {
        clave: "fecha_ingreso",
        titulo: "Ingreso",
        tipo: "fecha",
        ancho: 104,
        valor: (e) => e.fecha_ingreso,
        render: (e) =>
          e.fecha_ingreso ? (
            <span className="codigo">{fechaLarga(e.fecha_ingreso)}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      { clave: "hora_ingreso", titulo: "Hora ing.", tipo: "texto", ancho: 84, oculta: true,
        valor: (e) => e.hora_ingreso,
        render: (e) => e.hora_ingreso ? <span className="codigo">{e.hora_ingreso}</span> : <span className="text-tinta-3">—</span> },
      {
        clave: "fecha_salida",
        titulo: "Salida",
        tipo: "fecha",
        ancho: 104,
        valor: (e) => e.fecha_salida,
        render: (e) =>
          e.fecha_salida ? (
            <span className="codigo">{fechaLarga(e.fecha_salida)}</span>
          ) : (
            <Etiqueta>alojado</Etiqueta>
          ),
      },
      { clave: "hora_salida", titulo: "Hora sal.", tipo: "texto", ancho: 84, oculta: true,
        valor: (e) => e.hora_salida,
        render: (e) => e.hora_salida ? <span className="codigo">{e.hora_salida}</span> : <span className="text-tinta-3">—</span> },
      { clave: "motivo_salida", titulo: "Motivo salida", tipo: "enum", ancho: 118, valor: (e) => e.motivo_salida },
      { clave: "grupo", titulo: "Grupo", tipo: "enum", ancho: 74, valor: (e) => e.grupo },
      {
        clave: "folio",
        titulo: "Folio",
        tipo: "texto",
        ancho: 88,
        valor: (e) => e.folio,
        render: (e) =>
          e.folio ? <span className="codigo">{e.folio}</span> : <span className="text-tinta-3">—</span>,
      },
      { clave: "cargo", titulo: "Cargo", tipo: "enum", ancho: 180, oculta: true, valor: (e) => e.cargo },
      { clave: "celular", titulo: "Celular", tipo: "texto", ancho: 104, oculta: true, valor: (e) => e.celular,
        render: (e) => e.celular ? <span className="codigo">{e.celular}</span> : <span className="text-tinta-3">—</span> },
      {
        clave: "chip_devuelto",
        titulo: "Chip",
        tipo: "enum",
        ancho: 104,
        oculta: true,
        valor: (e) => e.chip_devuelto,
        render: (e) => NOMBRE_ENTREGA[e.chip_devuelto] ?? e.chip_devuelto,
      },
      {
        clave: "llaves_devueltas",
        titulo: "Llaves",
        tipo: "enum",
        ancho: 104,
        oculta: true,
        valor: (e) => e.llaves_devueltas,
        render: (e) => NOMBRE_ENTREGA[e.llaves_devueltas] ?? e.llaves_devueltas,
      },
      { clave: "usa_estacionamiento", titulo: "Estacionam.", tipo: "booleano", ancho: 100, oculta: true, valor: (e) => e.usa_estacionamiento },
      { clave: "patente_vehiculo", titulo: "Patente", tipo: "texto", ancho: 88, oculta: true, valor: (e) => e.patente_vehiculo },
      { clave: "observaciones", titulo: "Observaciones", tipo: "texto", ancho: 220, oculta: true, valor: (e) => e.observaciones },
      {
        clave: "requiere_revision",
        titulo: "Revision",
        tipo: "booleano",
        ancho: 92,
        valor: (e) => e.requiere_revision,
        render: (e) =>
          e.requiere_revision ? (
            <Etiqueta tono="aviso">
              <span aria-hidden>▲</span> Si
            </Etiqueta>
          ) : (
            <span className="text-tinta-3">No</span>
          ),
      },
      { clave: "nota_revision", titulo: "Nota de revision", tipo: "texto", ancho: 240, oculta: true, valor: (e) => e.nota_revision },
      { clave: "rut_valido", titulo: "RUT valido", tipo: "booleano", ancho: 96, oculta: true, valor: (e) => e.rut_valido },
      { clave: "origen_archivo", titulo: "Archivo", tipo: "enum", ancho: 190, oculta: true, valor: (e) => e.origen_archivo },
      { clave: "origen_hoja", titulo: "Hoja", tipo: "enum", ancho: 118, oculta: true, valor: (e) => e.origen_hoja },
      { clave: "origen_fila", titulo: "Fila", tipo: "numero", ancho: 68, numerica: true, oculta: true, valor: (e) => e.origen_fila },
      { clave: "origen_bloque", titulo: "Bloque", tipo: "enum", ancho: 88, oculta: true, valor: (e) => e.origen_bloque },
      { clave: "id", titulo: "ID", tipo: "numero", ancho: 62, numerica: true, oculta: true, valor: (e) => e.id },
    ],
    [nochesPorEstadia],
  );

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-[14px] font-semibold tracking-tight">Estadias</h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[76ch] leading-relaxed">
          Una fila por reserva. Cada columna se filtra desde el menu <span aria-hidden>⋯</span> de
          su cabecera, y las columnas ocultas (cargo, chip, llaves, patente,
          procedencia en el Excel) se activan en <strong>Columnas</strong>. El
          CSV baja lo filtrado, no la tabla entera.
        </p>
      </header>

      <Tabla
        columnas={columnas}
        filas={estadias}
        total={todo.estadias.length}
        nombreArchivo="estadias.csv"
        claveFila={(e) => e.id}
      />
    </div>
  );
}
