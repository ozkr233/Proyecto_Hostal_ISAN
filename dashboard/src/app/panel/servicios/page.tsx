"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Tabla, type Columna } from "@/components/Tabla";
import { Kpi } from "@/components/Kpi";
import { Etiqueta } from "@/components/ui";
import { fechaLarga, formatearRut } from "@/lib/formato";
import { NOMBRE_SERVICIO, SERVICIOS_ORDEN } from "@/lib/paleta";
import type { Servicio } from "@/lib/types";

export default function PaginaServicios() {
  const { servicios, todo } = useDatos();

  const totales = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of servicios) {
      m.set(s.tipo_servicio, (m.get(s.tipo_servicio) ?? 0) + s.cantidad);
    }
    return m;
  }, [servicios]);

  const columnas = useMemo<Columna<Servicio>[]>(
    () => [
      {
        clave: "fecha",
        titulo: "Fecha",
        tipo: "fecha",
        ancho: 104,
        valor: (s) => s.fecha,
        render: (s) => <span className="codigo">{fechaLarga(s.fecha)}</span>,
      },
      {
        clave: "tipo_servicio",
        titulo: "Servicio",
        tipo: "enum",
        ancho: 128,
        valor: (s) => s.tipo_servicio,
        render: (s) => NOMBRE_SERVICIO[s.tipo_servicio] ?? s.tipo_servicio,
      },
      {
        clave: "cantidad",
        titulo: "Cantidad",
        tipo: "numero",
        ancho: 86,
        numerica: true,
        valor: (s) => s.cantidad,
      },
      {
        clave: "persona",
        titulo: "Nombre",
        tipo: "texto",
        ancho: 190,
        valor: (s) => s.persona,
      },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 118,
        valor: (s) => s.rut,
        render: (s) =>
          s.rut ? (
            <span className="codigo">{formatearRut(s.rut)}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 130, valor: (s) => s.empresa },
      {
        clave: "hostal",
        titulo: "Hostal",
        tipo: "enum",
        ancho: 80,
        valor: (s) => s.hostal,
        render: (s) => <span className="codigo">{s.hostal}</span>,
      },
      { clave: "variante", titulo: "Variante", tipo: "enum", ancho: 128, valor: (s) => s.variante },
      {
        clave: "es_extra",
        titulo: "Extra",
        tipo: "booleano",
        ancho: 76,
        valor: (s) => s.es_extra,
        render: (s) =>
          s.es_extra ? <Etiqueta>extra</Etiqueta> : <span className="text-tinta-3">No</span>,
      },
      { clave: "autorizado_por", titulo: "Autorizado por", tipo: "enum", ancho: 140, oculta: true, valor: (s) => s.autorizado_por },
      { clave: "origen_archivo", titulo: "Archivo", tipo: "enum", ancho: 190, oculta: true, valor: (s) => s.origen_archivo },
      { clave: "origen_hoja", titulo: "Hoja", tipo: "enum", ancho: 130, oculta: true, valor: (s) => s.origen_hoja },
      { clave: "estadia_id", titulo: "Estadia", tipo: "numero", ancho: 78, numerica: true, oculta: true, valor: (s) => s.estadia_id },
      { clave: "id", titulo: "ID", tipo: "numero", ancho: 68, numerica: true, oculta: true, valor: (s) => s.id },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-[14px] font-semibold tracking-tight">Servicios</h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[80ch] leading-relaxed">
          Pension de las hojas diarias y la hoja{" "}
          <span className="codigo">ALMUERZOS ISAM</span>, en un solo registro.
          Hay filas sin estadia: en ALMUERZOS come gente que no se aloja, y por
          eso estos filtros miran las columnas del servicio y no la reserva.
        </p>
      </header>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {SERVICIOS_ORDEN.filter((t) => totales.has(t)).map((t) => (
          <Kpi key={t} rotulo={NOMBRE_SERVICIO[t]} valor={totales.get(t) ?? 0} />
        ))}
      </div>

      <Tabla
        columnas={columnas}
        filas={servicios}
        total={todo.servicios.length}
        nombreArchivo="servicios.csv"
        claveFila={(s) => s.id}
      />
    </div>
  );
}
