"use client";

import { useMemo } from "react";
import { SelectorMes } from "@/components/BarraFiltros";
import { CalendarioMes } from "@/components/CalendarioMes";
import { useDatos } from "@/components/DatosProvider";
import { SinMovimiento } from "@/components/SinMovimiento";
import { Tabla, type Columna } from "@/components/Tabla";
import {
  ColumnasApiladas,
  type PuntoApilado,
} from "@/components/graficos/ColumnasApiladas";
import {
  TablaSimple,
  TarjetaGrafico,
  type Serie,
} from "@/components/graficos/comun";
import { fechaCorta, fechaCortaAno, fechaLarga, numero } from "@/lib/formato";
import { COLOR_SERVICIO, NOMBRE_SERVICIO, SERVICIOS_ORDEN } from "@/lib/paleta";

/** Etiqueta de eje: agrega el ano solo si el rango cruza de uno a otro. */
function rotulador(fechas: string[]): (f: string) => string {
  const anos = new Set(fechas.map((f) => f.slice(0, 4)));
  return anos.size > 1 ? fechaCortaAno : fechaCorta;
}

/** Una fila del cierre: lo que se le cobra a cada empresa en el periodo. */
type FilaCierre = {
  empresa: string;
  noches: number;
  huespedes: number;
  DESAYUNO: number;
  ALMUERZO: number;
  CENA: number;
  COLACION_NORMAL: number;
  COLACION_ESPECIAL: number;
  extras: number;
};

export default function Mes() {
  const { todo, estadias, noches, servicios, habitaciones, filtros } = useDatos();

  const dimensionDe = useMemo(() => {
    const m = new Map<
      number,
      { empresa: string; hostal: string; persona_id: number; cuarto: string | null }
    >();
    for (const e of todo.estadias) {
      m.set(e.id, {
        empresa: e.empresa,
        hostal: e.hostal,
        persona_id: e.persona_id,
        // El numero de habitacion se repite entre hostales: la 12 del 1724 y
        // la 12 del 2163 son dos cuartos, no uno.
        cuarto: e.habitacion ? `${e.hostal}-${e.habitacion}` : null,
      });
    }
    return m;
  }, [todo.estadias]);

  /* ---- Cuanta gente durmio cada noche ----------------------------------- */
  const porDia = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of noches) m.set(n.fecha, (m.get(n.fecha) ?? 0) + 1);
    return m;
  }, [noches]);

  /* ---- Cierre por empresa ------------------------------------------------ */
  const cierre = useMemo<FilaCierre[]>(() => {
    const m = new Map<string, FilaCierre & { personas: Set<number> }>();
    const fila = (empresa: string) => {
      let f = m.get(empresa);
      if (!f) {
        f = {
          empresa,
          noches: 0,
          huespedes: 0,
          DESAYUNO: 0,
          ALMUERZO: 0,
          CENA: 0,
          COLACION_NORMAL: 0,
          COLACION_ESPECIAL: 0,
          extras: 0,
          personas: new Set(),
        };
        m.set(empresa, f);
      }
      return f;
    };

    for (const n of noches) {
      const d = dimensionDe.get(n.estadia_id);
      if (!d) continue;
      const f = fila(d.empresa);
      f.noches += 1;
      f.personas.add(d.persona_id);
    }

    // Las raciones entran por su propia columna de empresa: hay gente que come
    // sin alojarse, y esas cantidades se cobran igual.
    for (const s of servicios) {
      const f = fila(s.empresa ?? "Sin empresa");
      f[s.tipo_servicio] += s.cantidad;
      if (s.es_extra) f.extras += s.cantidad;
    }

    return [...m.values()]
      .map(({ personas, ...f }) => ({ ...f, huespedes: personas.size }))
      .sort(
        (a, b) => b.noches - a.noches || a.empresa.localeCompare(b.empresa, "es"),
      );
  }, [noches, servicios, dimensionDe]);

  const columnasCierre = useMemo<Columna<FilaCierre>[]>(
    () => [
      { clave: "empresa", titulo: "Empresa", tipo: "enum", ancho: 180, valor: (f) => f.empresa },
      { clave: "noches", titulo: "Noches", tipo: "numero", ancho: 92, numerica: true, valor: (f) => f.noches },
      { clave: "huespedes", titulo: "Huespedes", tipo: "numero", ancho: 104, numerica: true, valor: (f) => f.huespedes },
      ...SERVICIOS_ORDEN.map((t) => ({
        clave: t,
        titulo: NOMBRE_SERVICIO[t],
        tipo: "numero" as const,
        ancho: t.startsWith("COLACION") ? 128 : 104,
        numerica: true,
        valor: (f: FilaCierre) => f[t],
      })),
      { clave: "extras", titulo: "Extras", tipo: "numero", ancho: 92, numerica: true, valor: (f) => f.extras },
    ],
    [],
  );

  /* ---- Raciones por dia -------------------------------------------------- */
  const pension = useMemo(() => {
    const porFecha = new Map<string, Record<string, number>>();
    for (const s of servicios) {
      let fila = porFecha.get(s.fecha);
      if (!fila) porFecha.set(s.fecha, (fila = {}));
      fila[s.tipo_servicio] = (fila[s.tipo_servicio] ?? 0) + s.cantidad;
    }
    const ordenadas = [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b));
    const etiquetar = rotulador(ordenadas.map(([x]) => x));
    const puntos: PuntoApilado[] = ordenadas.map(([x, valores]) => ({
      x,
      etiqueta: etiquetar(x),
      valores,
    }));

    const presentes = new Set(servicios.map((s) => s.tipo_servicio));
    const series: Serie[] = SERVICIOS_ORDEN.filter((t) => presentes.has(t)).map(
      (t) => ({ clave: t, nombre: NOMBRE_SERVICIO[t], color: COLOR_SERVICIO[t] }),
    );
    return { puntos, series };
  }, [servicios]);

  /* ---- Cifras ------------------------------------------------------------ */
  const dias = porDia.size;
  const totalServicios = servicios.reduce((s, x) => s + x.cantidad, 0);
  const mediaPorNoche = dias > 0 ? noches.length / dias : 0;
  const cuartosActivos = habitaciones.filter((h) => h.activa).length;

  /**
   * Huespedes y cuartos se cuentan sobre las NOCHES del rango, no sobre los
   * alojamientos que lo tocan.
   *
   * Uno que entro en junio y salio en agosto aparece igual en el filtro de
   * julio, pero si ninguna de sus noches cae en julio, ni durmio aqui en julio
   * ni su cuarto estuvo en uso. Contarlo inflaba las dos cifras y las hacia
   * discrepar de la pantalla de Ocupacion, que cuenta desde las noches.
   */
  const { huespedes, cuartosEnUso } = useMemo(() => {
    const personas = new Set<number>();
    const cuartos = new Set<string>();
    for (const n of noches) {
      const d = dimensionDe.get(n.estadia_id);
      if (!d) continue;
      personas.add(d.persona_id);
      if (d.cuarto) cuartos.add(d.cuarto);
    }
    return { huespedes: personas.size, cuartosEnUso: cuartos.size };
  }, [noches, dimensionDe]);

  const turnos = useMemo(() => {
    const c = { D: 0, N: 0, E: 0, sin: 0 };
    for (const n of noches) {
      if (n.turno === "D") c.D += 1;
      else if (n.turno === "N") c.N += 1;
      else if (n.turno === "E") c.E += 1;
      else c.sin += 1;
    }
    return c;
  }, [noches]);

  const mes =
    filtros.desde && filtros.desde.endsWith("-01")
      ? filtros.desde.slice(0, 7)
      : null;

  return (
    <div className="flex flex-col gap-7 max-w-[1400px]">
      <header>
        <SelectorMes />
        <p className="text-tinta-2 mt-1 ml-1.5">
          Cuanta gente durmio cada noche, y que se le cobra a cada empresa.
        </p>
      </header>

      {noches.length === 0 ? (
        <SinMovimiento que="alojamientos" />
      ) : (
        <>
          {mes ? (
            <section className="flex flex-col gap-3">
              <CalendarioMes mes={mes} porDia={porDia} />
              <p className="text-[13px] text-tinta-3 ml-1">
                Cada casilla es la gente que durmio esa noche. Turno de dia{" "}
                <strong className="text-tinta-2 cifras">{numero(turnos.D)}</strong>,
                de noche{" "}
                <strong className="text-tinta-2 cifras">{numero(turnos.N)}</strong>
                {turnos.E > 0 ? (
                  <>
                    , especial{" "}
                    <strong className="text-tinta-2 cifras">{numero(turnos.E)}</strong>
                  </>
                ) : null}
                {turnos.sin > 0 ? (
                  <>
                    , sin turno anotado{" "}
                    <strong className="text-tinta-2 cifras">{numero(turnos.sin)}</strong>
                  </>
                ) : null}
                .
              </p>
            </section>
          ) : null}

          <section className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Cifra
              rotulo="Noches vendidas"
              valor={numero(noches.length)}
              nota={`${dias} noches con gente, ${mediaPorNoche.toLocaleString("es-CL", { maximumFractionDigits: 1 })} personas por noche`}
            />
            <Cifra
              rotulo="Huespedes"
              valor={numero(huespedes)}
              nota={`en ${numero(estadias.length)} ${estadias.length === 1 ? "alojamiento" : "alojamientos"}`}
            />
            <Cifra
              rotulo="Cuartos ocupados"
              valor={numero(cuartosEnUso)}
              nota={cuartosActivos > 0 ? `de ${cuartosActivos} disponibles` : undefined}
            />
            <Cifra
              rotulo="Raciones servidas"
              valor={numero(totalServicios)}
              nota="desayunos, almuerzos, cenas y colaciones"
            />
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-[19px] font-semibold tracking-tight">
                Cierre por empresa
              </h2>
              <p className="text-tinta-2 mt-0.5 max-w-[70ch]">
                La base de cobro del mes: noches de alojamiento y raciones
                servidas por cada empresa mandante.
              </p>
            </div>
            <Tabla
              columnas={columnasCierre}
              filas={cierre}
              total={cierre.length}
              nombreArchivo="cierre-por-empresa.csv"
              claveFila={(f) => f.empresa}
              vacio="Sin movimiento en este periodo."
            />
          </section>

          <TarjetaGrafico
            titulo="Raciones por dia"
            subtitulo="Desayunos, almuerzos, cenas y colaciones."
            series={pension.series}
            tabla={() => (
              <TablaSimple
                cabeceras={["Fecha", ...pension.series.map((s) => s.nombre), "Total"]}
                filas={pension.puntos.map((p) => [
                  fechaLarga(p.x),
                  ...pension.series.map((s) => p.valores[s.clave] ?? 0),
                  pension.series.reduce((t, s) => t + (p.valores[s.clave] ?? 0), 0),
                ])}
              />
            )}
          >
            <ColumnasApiladas
              puntos={pension.puntos}
              series={pension.series}
              alto={200}
              unidad="raciones"
            />
          </TarjetaGrafico>
        </>
      )}
    </div>
  );
}

/** Cifra de apoyo. Sin caja: el calendario es lo unico enmarcado de la pagina. */
function Cifra({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="border-l-2 border-borde pl-3.5">
      <p className="rotulo">{rotulo}</p>
      <p className="text-[32px] font-semibold tracking-tight leading-tight cifras mt-0.5">
        {valor}
      </p>
      {nota ? (
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-snug">{nota}</p>
      ) : null}
    </div>
  );
}
