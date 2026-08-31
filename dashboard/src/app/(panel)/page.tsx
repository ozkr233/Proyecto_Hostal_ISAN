"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Hero, Kpi } from "@/components/Kpi";
import { BarrasH, type ItemBarra } from "@/components/graficos/BarrasH";
import {
  ColumnasApiladas,
  type PuntoApilado,
} from "@/components/graficos/ColumnasApiladas";
import {
  TablaSimple,
  TarjetaGrafico,
  type Serie,
} from "@/components/graficos/comun";
import { fechaCorta, fechaCortaAno, fechaLarga } from "@/lib/formato";
import {
  COLOR_SERVICIO,
  COLOR_TURNO,
  NOMBRE_SERVICIO,
  SERVICIOS_ORDEN,
  mapaColores,
} from "@/lib/paleta";
import { nombreTurno } from "@/components/ui";

/** Etiqueta de eje: agrega el ano solo si el rango cruza de uno a otro. */
function rotulador(fechas: string[]): (f: string) => string {
  const anos = new Set(fechas.map((f) => f.slice(0, 4)));
  return anos.size > 1 ? fechaCortaAno : fechaCorta;
}

export default function Resumen() {
  const { todo, estadias, noches, servicios, personas, catalogo } = useDatos();

  // El color se asigna sobre el catalogo completo, nunca sobre lo filtrado:
  // al quitar una empresa, las demas conservan su tono.
  const colorEmpresa = useMemo(
    () => mapaColores(catalogo.empresas),
    [catalogo.empresas],
  );

  const empresaDe = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of todo.estadias) m.set(e.id, e.empresa);
    return m;
  }, [todo.estadias]);

  const hostalDe = useMemo(() => {
    const m = new Map<number, string>();
    for (const e of todo.estadias) m.set(e.id, e.hostal);
    return m;
  }, [todo.estadias]);

  /* ---- Ocupacion diaria por empresa ------------------------------------ */
  const ocupacion = useMemo(() => {
    const porFecha = new Map<string, Record<string, number>>();
    for (const n of noches) {
      const empresa = empresaDe.get(n.estadia_id);
      if (!empresa) continue;
      let fila = porFecha.get(n.fecha);
      if (!fila) porFecha.set(n.fecha, (fila = {}));
      fila[empresa] = (fila[empresa] ?? 0) + 1;
    }
    const ordenadas = [...porFecha.entries()].sort(([a], [b]) => a.localeCompare(b));
    const etiquetar = rotulador(ordenadas.map(([x]) => x));
    const puntos: PuntoApilado[] = ordenadas.map(([x, valores]) => ({
      x,
      etiqueta: etiquetar(x),
      valores,
    }));

    const presentes = new Set<string>();
    for (const p of puntos) for (const k of Object.keys(p.valores)) presentes.add(k);

    const series: Serie[] = catalogo.empresas
      .filter((e) => presentes.has(e))
      .map((e) => ({
        clave: e,
        nombre: e,
        color: colorEmpresa.get(e) ?? "var(--s1)",
      }));

    return { puntos, series };
  }, [noches, empresaDe, catalogo.empresas, colorEmpresa]);

  /* ---- Noches por empresa y por hostal ---------------------------------- */
  const porEmpresa = useMemo(() => {
    const cuenta = new Map<string, number>();
    const estadiasPorEmpresa = new Map<string, Set<number>>();
    for (const n of noches) {
      const e = empresaDe.get(n.estadia_id);
      if (!e) continue;
      cuenta.set(e, (cuenta.get(e) ?? 0) + 1);
      const s = estadiasPorEmpresa.get(e) ?? new Set<number>();
      s.add(n.estadia_id);
      estadiasPorEmpresa.set(e, s);
    }
    const items: ItemBarra[] = [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([clave, valor]) => ({
        clave,
        nombre: clave,
        valor,
        color: colorEmpresa.get(clave) ?? "var(--s1)",
        nota: `${estadiasPorEmpresa.get(clave)?.size ?? 0} estadias`,
      }));
    return items;
  }, [noches, empresaDe, colorEmpresa]);

  const porHostal = useMemo(() => {
    const colorHostal = mapaColores(catalogo.hostales);
    const cuenta = new Map<string, number>();
    for (const n of noches) {
      const h = hostalDe.get(n.estadia_id);
      if (!h) continue;
      cuenta.set(h, (cuenta.get(h) ?? 0) + 1);
    }
    return [...cuenta.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([clave, valor]) => ({
        clave,
        nombre: `Hostal ${clave}`,
        valor,
        color: colorHostal.get(clave) ?? "var(--s1)",
      }));
  }, [noches, hostalDe, catalogo.hostales]);

  /* ---- Turnos ----------------------------------------------------------- */
  const turnos = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const n of noches) {
      const t = n.turno ?? "sin marca";
      cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
    }
    return ["D", "N", "E", "sin marca"]
      .filter((t) => cuenta.has(t))
      .map((t) => ({
        clave: t,
        nombre: t === "sin marca" ? "Sin marca" : `${t} · ${nombreTurno(t)}`,
        valor: cuenta.get(t) ?? 0,
        color: COLOR_TURNO[t] ?? "var(--eje)",
      }));
  }, [noches]);

  /* ---- Servicios por dia ------------------------------------------------ */
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

  /* ---- Cifras ----------------------------------------------------------- */
  const dias = new Set(noches.map((n) => n.fecha)).size;
  const habitaciones = new Set(
    estadias.map((e) => e.habitacion).filter(Boolean),
  ).size;
  const enRevision = estadias.filter((e) => e.requiere_revision).length;
  const totalServicios = servicios.reduce((s, x) => s + x.cantidad, 0);
  const mediaPorNoche = dias > 0 ? noches.length / dias : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
        <div className="col-span-2">
          <Hero
            valor={noches.length}
            rotulo="Noches"
            nota={
              dias > 0
                ? `${dias} dias con registro · ${mediaPorNoche.toLocaleString("es-CL", { maximumFractionDigits: 1 })} personas por noche`
                : "Sin noches en este rango"
            }
          />
        </div>
        <Kpi rotulo="Estadias" valor={estadias.length} nota={`de ${todo.estadias.length}`} />
        <Kpi rotulo="Personas" valor={personas.length} nota={`de ${todo.personas.length}`} />
        <Kpi
          rotulo="Servicios"
          valor={totalServicios}
          nota={`${servicios.length} registros`}
        />
        <Kpi
          rotulo="Requieren revision"
          valor={enRevision}
          tono={enRevision > 0 ? "aviso" : "neutro"}
          nota={
            estadias.length > 0
              ? `${Math.round((enRevision / estadias.length) * 100)}% de las estadias`
              : undefined
          }
        />
      </div>

      <TarjetaGrafico
        titulo="Ocupacion diaria por empresa"
        subtitulo="Una noche es una persona alojada esa fecha. Reemplaza los COUNTIFS del bloque M171:AS183 de R. OFICIAL."
        series={ocupacion.series}
        tabla={() => (
          <TablaSimple
            cabeceras={["Fecha", ...ocupacion.series.map((s) => s.nombre), "Total"]}
            filas={ocupacion.puntos.map((p) => [
              fechaLarga(p.x),
              ...ocupacion.series.map((s) => p.valores[s.clave] ?? 0),
              ocupacion.series.reduce((t, s) => t + (p.valores[s.clave] ?? 0), 0),
            ])}
          />
        )}
      >
        <ColumnasApiladas
          puntos={ocupacion.puntos}
          series={ocupacion.series}
          alto={215}
          unidad="noches"
        />
      </TarjetaGrafico>

      <div className="grid gap-3 lg:grid-cols-3">
        <TarjetaGrafico
          titulo="Noches por empresa"
          subtitulo="Base de cobro del periodo."
          tabla={() => (
            <TablaSimple
              cabeceras={["Empresa", "Noches"]}
              filas={porEmpresa.map((i) => [i.nombre, i.valor])}
            />
          )}
        >
          <BarrasH items={porEmpresa} />
        </TarjetaGrafico>

        <TarjetaGrafico
          titulo="Noches por hostal"
          subtitulo={`${habitaciones} habitaciones distintas ocupadas.`}
          tabla={() => (
            <TablaSimple
              cabeceras={["Hostal", "Noches"]}
              filas={porHostal.map((i) => [i.nombre, i.valor])}
            />
          )}
        >
          <BarrasH items={porHostal} />
        </TarjetaGrafico>

        <TarjetaGrafico
          titulo="Marcas de turno"
          subtitulo="D dia, N noche, E especial. Es la letra escrita en cada celda."
          tabla={() => (
            <TablaSimple
              cabeceras={["Turno", "Noches"]}
              filas={turnos.map((i) => [i.nombre, i.valor])}
            />
          )}
        >
          <BarrasH items={turnos} />
        </TarjetaGrafico>
      </div>

      <TarjetaGrafico
        titulo="Pension por dia"
        subtitulo="Desayunos, almuerzos, cenas y colaciones. Suma las hojas diarias y ALMUERZOS ISAM, que en el Excel se cuentan por separado."
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
          unidad="servicios"
        />
      </TarjetaGrafico>
    </div>
  );
}
