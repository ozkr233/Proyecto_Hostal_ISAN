"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Kpi } from "@/components/Kpi";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta, MultiSelect } from "@/components/ui";
import { fechaLarga, formatearRut, numero } from "@/lib/formato";
import { NOMBRE_SERVICIO } from "@/lib/paleta";
import type { Descuadre, Rechazo, Servicio } from "@/lib/types";

/**
 * El periodo que los libros de julio 2026 dicen cubrir. ALMUERZOS ISAM se sale
 * a proposito -va de febrero a julio-, pero nada deberia caer fuera de eso.
 */
const VENTANA = { desde: "2026-02-01", hasta: "2026-07-31" };

export default function PaginaCalidad() {
  const { estadias, personas, rechazos, servicios, todo, filtros, ponerFiltros, catalogo } =
    useDatos();

  const indicadores = useMemo(
    () => [
      {
        rotulo: "Sin RUT",
        valor: personas.filter((p) => !p.rut).length,
        nota: "se identifican por su nombre",
      },
      {
        rotulo: "RUT invalido",
        valor: personas.filter((p) => p.rut && !p.rut_valido).length,
        nota: "el digito verificador no calza",
      },
      {
        rotulo: "Sin fecha de ingreso",
        valor: estadias.filter((e) => !e.fecha_ingreso).length,
        nota: "solo se anoto la salida",
      },
      {
        rotulo: "Sin fecha de salida",
        valor: estadias.filter((e) => !e.fecha_salida).length,
        nota: "siguen alojados, o no se anoto",
      },
      {
        rotulo: "Marcados para revisar",
        valor: estadias.filter((e) => e.requiere_revision).length,
        nota: "el registro quedo a medias",
      },
      {
        rotulo: "Sin cuarto anotado",
        valor: estadias.filter((e) => !e.habitacion).length,
        nota: "no se anoto donde durmieron",
      },
      {
        rotulo: "No se pudieron cargar",
        valor: rechazos.length,
        nota: "quedaron fuera de la base",
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
        titulo: "Comida",
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
    <div className="flex flex-col gap-7 max-w-[1500px]">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight">
          Estado de los datos
        </h1>
        <p className="text-tinta-2 mt-1 max-w-[74ch]">
          Lo que quedo por revisar a mano. Nada se invento al cargar los libros:
          cada registro que no se pudo resolver esta aqui con su motivo, y cada
          dia que no cuadra aparece con su fecha.
        </p>
      </header>

      {/* El filtro de archivo de origen vive aqui y no en la barra global: es
          una pregunta sobre de que libro salio la fila, y solo importa cuando
          se esta auditando la carga. */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rotulo">Libro de origen</span>
        <MultiSelect
          titulo="Archivo"
          opciones={catalogo.archivos}
          seleccion={filtros.archivos}
          onChange={(archivos) => ponerFiltros({ archivos })}
          ancho={300}
        />
        {filtros.archivos.length > 0 ? (
          <button
            type="button"
            onClick={() => ponerFiltros({ archivos: [] })}
            className="text-[12px] text-acento hover:underline"
          >
            todos los archivos
          </button>
        ) : null}
      </div>

      <section>
        
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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
          <h3 className="text-[19px] font-semibold tracking-tight">
            Registros que no se pudieron cargar
          </h3>
          <p className="text-tinta-2 mt-0.5 max-w-[74ch]">
            Casi todos por lo mismo: no dice en que hostal fue, y no habia
            un alojamiento abierto del que deducirlo.
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
          <h3 className="text-[19px] font-semibold tracking-tight">
            Dias que no cuadran
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
        <p className="text-tinta-2 max-w-[74ch]">
          Compara las noches que quedaron cargadas contra los ingresos que se
          anotaron ese dia. Cuando no coinciden, falta o sobra una firma en el
          libro de origen. Es una revision de toda la carga, asi que no responde
          a los filtros de arriba.
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
          <h3 className="text-[19px] font-semibold tracking-tight">
            Comidas con fecha imposible
          </h3>
          {fueraDeRango.length > 0 ? (
            <Etiqueta tono="critico">
              <span aria-hidden>▲</span> {numero(fueraDeRango.length)} comidas
            </Etiqueta>
          ) : (
            <Etiqueta tono="bien">ninguno</Etiqueta>
          )}
        </div>
        <p className="text-tinta-2 max-w-[74ch]">
          Comidas fechadas fuera de{" "}
          <span className="cifras">{fechaLarga(VENTANA.desde)}</span> y{" "}
          <span className="cifras">{fechaLarga(VENTANA.hasta)}</span>, que es
          todo el periodo que cubren los libros. Casi con seguridad son anos mal
          tecleados al anotarlas: la fecha se carga tal como venia, sin
          corregirla. Son las que hacen que aparezcan meses que no existen, asi
          que vale la pena arreglarlas en el origen.
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
