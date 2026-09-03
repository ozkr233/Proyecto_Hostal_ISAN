"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Kpi } from "@/components/Kpi";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta } from "@/components/ui";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import { NOMBRE_SERVICIO } from "@/lib/paleta";
import type { Descuadre, Rechazo, Servicio } from "@/lib/types";

/**
 * El periodo que los libros de julio 2026 dicen cubrir. ALMUERZOS ISAM se sale
 * a proposito -va de febrero a julio-, pero nada deberia caer fuera de eso.
 */
const VENTANA = { desde: "2026-02-01", hasta: "2026-07-31" };

export default function PaginaCalidad() {
  const { estadias, personas, rechazos, servicios, todo } = useDatos();

  const indicadores = useMemo(
    () => [
      {
        rotulo: "Personas sin RUT",
        valor: personas.filter((p) => !p.rut).length,
        nota: "se identifican por nombre normalizado",
      },
      {
        rotulo: "RUT invalido",
        valor: personas.filter((p) => p.rut && !p.rut_valido).length,
        nota: "no pasan el modulo 11; se cargan igual",
      },
      {
        rotulo: "Sin fecha de ingreso",
        valor: estadias.filter((e) => !e.fecha_ingreso).length,
        nota: "el Excel solo trae la salida",
      },
      {
        rotulo: "Sin fecha de salida",
        valor: estadias.filter((e) => !e.fecha_salida).length,
        nota: "siguen alojados o no se anoto",
      },
      {
        rotulo: "Marcadas para revision",
        valor: estadias.filter((e) => e.requiere_revision).length,
        nota: "la fila no se resolvio del todo",
      },
      {
        rotulo: "Sin habitacion",
        valor: estadias.filter((e) => !e.habitacion).length,
        nota: "la celda venia vacia",
      },
      {
        rotulo: "Filas rechazadas",
        valor: rechazos.length,
        nota: "no se pudieron promover a core",
      },
    ],
    [estadias, personas, rechazos],
  );

  // El descuadre y las fechas fuera de rango son auditoria de la carga, no del
  // periodo que se este mirando: van siempre sobre el total.
  const descuadres = useMemo(
    () => todo.descuadre.filter((d) => d.diferencia !== 0),
    [todo.descuadre],
  );

  const fueraDeRango = useMemo(
    () =>
      todo.servicios.filter(
        (s) => s.fecha < VENTANA.desde || s.fecha > VENTANA.hasta,
      ),
    [todo.servicios],
  );

  const colsRechazo = useMemo<Columna<Rechazo>[]>(
    () => [
      { clave: "motivo", titulo: "Motivo", tipo: "enum", ancho: 320, valor: (r) => r.motivo },
      { clave: "archivo_origen", titulo: "Archivo", tipo: "enum", ancho: 190, valor: (r) => r.archivo_origen },
      { clave: "hoja", titulo: "Hoja", tipo: "enum", ancho: 130, valor: (r) => r.hoja },
      { clave: "fila", titulo: "Fila", tipo: "numero", ancho: 66, numerica: true, valor: (r) => r.fila },
      { clave: "bloque", titulo: "Bloque", tipo: "enum", ancho: 86, valor: (r) => r.bloque },
      {
        clave: "detalle",
        titulo: "Detalle",
        tipo: "texto",
        ancho: 300,
        valor: (r) => (r.detalle ? JSON.stringify(r.detalle) : null),
        render: (r) =>
          r.detalle ? (
            <span className="codigo text-[11px] text-tinta-2 break-all">
              {JSON.stringify(r.detalle)}
            </span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
    ],
    [],
  );

  const colsDescuadre = useMemo<Columna<Descuadre>[]>(
    () => [
      {
        clave: "fecha",
        titulo: "Fecha",
        tipo: "fecha",
        ancho: 110,
        valor: (d) => d.fecha,
        render: (d) => <span className="codigo">{fechaLarga(d.fecha)}</span>,
      },
      { clave: "noches_core", titulo: "Noches en la base", tipo: "numero", ancho: 130, numerica: true, valor: (d) => d.noches_core },
      { clave: "filas_hoja_diaria", titulo: "Ingresos en la hoja", tipo: "numero", ancho: 140, numerica: true, valor: (d) => d.filas_hoja_diaria },
      {
        clave: "diferencia",
        titulo: "Diferencia",
        tipo: "numero",
        ancho: 100,
        numerica: true,
        valor: (d) => d.diferencia,
        render: (d) => (
          <span
            className={`tabular-nums font-semibold ${
              d.diferencia === 0 ? "text-tinta-3" : "text-critico"
            }`}
          >
            {d.diferencia > 0 ? `+${d.diferencia}` : d.diferencia}
          </span>
        ),
      },
    ],
    [],
  );

  const colsFuera = useMemo<Columna<Servicio>[]>(
    () => [
      {
        clave: "fecha",
        titulo: "Fecha",
        tipo: "fecha",
        ancho: 110,
        valor: (s) => s.fecha,
        render: (s) => (
          <span className="codigo text-critico">{fechaLarga(s.fecha)}</span>
        ),
      },
      {
        clave: "tipo_servicio",
        titulo: "Servicio",
        tipo: "enum",
        ancho: 118,
        valor: (s) => s.tipo_servicio,
        render: (s) => NOMBRE_SERVICIO[s.tipo_servicio] ?? s.tipo_servicio,
      },
      { clave: "persona", titulo: "Nombre", tipo: "texto", ancho: 190, valor: (s) => s.persona },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 118,
        valor: (s) => s.rut,
        render: (s) =>
          s.rut ? <span className="codigo">{formatearRut(s.rut)}</span> : <span className="text-tinta-3">—</span>,
      },
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 128, valor: (s) => s.empresa },
      { clave: "origen_hoja", titulo: "Hoja", tipo: "enum", ancho: 130, valor: (s) => s.origen_hoja },
      { clave: "origen_archivo", titulo: "Archivo", tipo: "enum", ancho: 190, oculta: true, valor: (s) => s.origen_archivo },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="text-[14px] font-semibold tracking-tight">
          Calidad de datos
        </h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[80ch] leading-relaxed">
          Lo que quedo para revision humana. Nada se invento al cargar: cada
          fila que no se pudo resolver esta listada con su motivo, y cada
          descuadre entre el libro y la base aparece con su fecha.
        </p>
      </header>

      <section>
        <h3 className="rotulo mb-2">Indicadores</h3>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {indicadores.map((i) => (
            <Kpi
              key={i.rotulo}
              rotulo={i.rotulo}
              valor={i.valor}
              nota={i.nota}
              tono={i.valor > 0 ? "aviso" : "neutro"}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">
            Filas rechazadas
          </h3>
          <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[80ch] leading-relaxed">
            Casi todas por la misma causa de fondo: la celda de hostal esta
            vacia y no hay alojamiento vigente del cual deducirla. Responden al
            filtro de archivo de la barra superior.
          </p>
        </div>
        <Tabla
          columnas={colsRechazo}
          filas={rechazos}
          total={todo.rechazos.length}
          nombreArchivo="rechazos.csv"
          claveFila={(r) => r.id}
          vacio="Ninguna fila rechazada con este filtro."
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Descuadre por fecha
          </h3>
          {descuadres.length > 0 ? (
            <Etiqueta tono="aviso">
              <span aria-hidden>▲</span> {numero(descuadres.length)} fechas no
              cuadran
            </Etiqueta>
          ) : (
            <Etiqueta tono="bien">todo cuadra</Etiqueta>
          )}
        </div>
        <p className="text-[11.5px] text-tinta-3 max-w-[80ch] leading-relaxed">
          Compara las noches promovidas desde{" "}
          <span className="codigo">R. OFICIAL</span> contra las filas de ingreso
          que registro cada hoja diaria. En el Excel esto vive escondido en la
          fila 168; aqui queda con nombre y fecha. Es auditoria de la carga
          completa, asi que no responde a los filtros.
        </p>
        <Tabla
          columnas={colsDescuadre}
          filas={todo.descuadre}
          total={todo.descuadre.length}
          nombreArchivo="descuadre.csv"
          claveFila={(d) => d.fecha}
        />
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="text-[13px] font-semibold tracking-tight">
            Fechas fuera del periodo
          </h3>
          {fueraDeRango.length > 0 ? (
            <Etiqueta tono="critico">
              <span aria-hidden>▲</span> {numero(fueraDeRango.length)} servicios
            </Etiqueta>
          ) : (
            <Etiqueta tono="bien">ninguno</Etiqueta>
          )}
        </div>
        <p className="text-[11.5px] text-tinta-3 max-w-[80ch] leading-relaxed">
          Servicios fechados fuera de{" "}
          <span className="codigo">{fechaLarga(VENTANA.desde)}</span> —{" "}
          <span className="codigo">{fechaLarga(VENTANA.hasta)}</span>, que es
          todo lo que los libros de julio 2026 dicen cubrir contando ALMUERZOS
          ISAM. Casi con seguridad son anos mal tecleados en la celda de origen:
          el ETL carga la fecha que trae el libro, sin corregirla. Vale revisar
          la hoja y la fila.
        </p>
        <Tabla
          columnas={colsFuera}
          filas={fueraDeRango}
          total={todo.servicios.length}
          nombreArchivo="fechas-fuera-de-rango.csv"
          claveFila={(s) => s.id}
          vacio="Ningun servicio cae fuera del periodo."
        />
      </section>
    </div>
  );
}
