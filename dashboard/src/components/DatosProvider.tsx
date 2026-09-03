"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { norm } from "@/lib/filtros";
import type {
  Ausencia,
  Datos,
  Estadia,
  Evento,
  Noche,
  Persona,
  Rechazo,
  Servicio,
} from "@/lib/types";

export type FiltrosGlobales = {
  desde: string;
  hasta: string;
  empresas: string[];
  hostales: string[];
  archivos: string[];
  busqueda: string;
  soloRevision: boolean;
};

export const FILTROS_VACIOS: FiltrosGlobales = {
  desde: "",
  hasta: "",
  empresas: [],
  hostales: [],
  archivos: [],
  busqueda: "",
  soloRevision: false,
};

type Contexto = {
  /** Todo lo cargado, sin filtrar. Sirve de denominador en "X de N". */
  todo: Datos;
  filtros: FiltrosGlobales;
  ponerFiltros: (cambio: Partial<FiltrosGlobales>) => void;
  limpiar: () => void;
  hayFiltros: boolean;

  estadias: Estadia[];
  noches: Noche[];
  servicios: Servicio[];
  personas: Persona[];
  eventos: Evento[];
  ausencias: Ausencia[];
  rechazos: Rechazo[];

  /** Noches de cada estadia, ya filtradas. La usa la grilla del registro oficial. */
  nochesPorEstadia: Map<number, Noche[]>;

  catalogo: {
    empresas: string[];
    hostales: string[];
    archivos: string[];
    fechaMin: string;
    fechaMax: string;
  };
};

const Ctx = createContext<Contexto | null>(null);

export function useDatos(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDatos fuera de <DatosProvider>");
  return ctx;
}

function distintos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v))].sort((a, b) =>
    a.localeCompare(b, "es", { numeric: true }),
  );
}

export function DatosProvider({
  datos,
  children,
}: {
  datos: Datos;
  children: React.ReactNode;
}) {
  const [filtros, setFiltros] = useState<FiltrosGlobales>(FILTROS_VACIOS);

  const ponerFiltros = useCallback((cambio: Partial<FiltrosGlobales>) => {
    setFiltros((f) => ({ ...f, ...cambio }));
  }, []);

  const limpiar = useCallback(() => setFiltros(FILTROS_VACIOS), []);

  const catalogo = useMemo(() => {
    const fechas = [
      ...datos.noches.map((n) => n.fecha),
      ...datos.servicios.map((s) => s.fecha),
    ].sort();
    return {
      empresas: distintos(datos.estadias.map((e) => e.empresa)),
      hostales: distintos(datos.estadias.map((e) => e.hostal)),
      archivos: distintos(datos.estadias.map((e) => e.origen_archivo)),
      fechaMin: fechas[0] ?? "",
      fechaMax: fechas[fechas.length - 1] ?? "",
    };
  }, [datos]);

  const nochesTodas = useMemo(() => {
    const m = new Map<number, Noche[]>();
    for (const n of datos.noches) {
      const lista = m.get(n.estadia_id);
      if (lista) lista.push(n);
      else m.set(n.estadia_id, [n]);
    }
    return m;
  }, [datos.noches]);

  const valor = useMemo<Contexto>(() => {
    const { desde, hasta, empresas, hostales, archivos, soloRevision } = filtros;
    const buscado = norm(filtros.busqueda);

    const enRango = (f: string | null | undefined): boolean =>
      !!f && (!desde || f >= desde) && (!hasta || f <= hasta);
    const hayRango = desde !== "" || hasta !== "";

    const coincide = (...campos: (string | null)[]) =>
      buscado === "" ||
      campos.some((c) => c && norm(c).includes(buscado));

    // ---- Estadias -------------------------------------------------------
    // Primero todo salvo la fecha: ese conjunto define que noches, eventos y
    // personas siguen en juego, y evita recorrer dos veces.
    const base = datos.estadias.filter(
      (e) =>
        (empresas.length === 0 || empresas.includes(e.empresa)) &&
        (hostales.length === 0 || hostales.includes(e.hostal)) &&
        (archivos.length === 0 ||
          (e.origen_archivo !== null && archivos.includes(e.origen_archivo))) &&
        (!soloRevision || e.requiere_revision) &&
        coincide(e.persona, e.rut, e.folio, e.habitacion),
    );
    const idsBase = new Set(base.map((e) => e.id));

    // Una estadia entra si alguna de sus noches cae en el rango, o si su
    // ingreso o su salida caen dentro. Las estadias sin noches (solo salida
    // registrada) no desaparecerian de otro modo.
    const estadias = !hayRango
      ? base
      : base.filter(
          (e) =>
            (nochesTodas.get(e.id) ?? []).some((n) => enRango(n.fecha)) ||
            enRango(e.fecha_ingreso) ||
            enRango(e.fecha_salida),
        );

    // ---- Noches ---------------------------------------------------------
    const noches = datos.noches.filter(
      (n) => idsBase.has(n.estadia_id) && (!hayRango || enRango(n.fecha)),
    );

    const nochesPorEstadia = new Map<number, Noche[]>();
    for (const n of noches) {
      const lista = nochesPorEstadia.get(n.estadia_id);
      if (lista) lista.push(n);
      else nochesPorEstadia.set(n.estadia_id, [n]);
    }

    // ---- Servicios ------------------------------------------------------
    // Filtran por SUS columnas, no a traves de la estadia: estadia_id es
    // nullable a proposito (ALMUERZOS ISAM incluye gente que come sin
    // alojarse) y filtrar por pertenencia haria desaparecer esas filas.
    const servicios = datos.servicios.filter(
      (s) =>
        (!hayRango || enRango(s.fecha)) &&
        (empresas.length === 0 ||
          (s.empresa !== null && empresas.includes(s.empresa))) &&
        (hostales.length === 0 || hostales.includes(s.hostal)) &&
        (archivos.length === 0 ||
          (s.origen_archivo !== null && archivos.includes(s.origen_archivo))) &&
        coincide(s.persona, s.rut),
    );

    // ---- Eventos --------------------------------------------------------
    const idsEstadia = new Set(estadias.map((e) => e.id));
    const eventos = datos.eventos.filter(
      (ev) => idsEstadia.has(ev.estadia_id) && (!hayRango || enRango(ev.fecha)),
    );

    // ---- Ausencias ------------------------------------------------------
    // Igual que los eventos: cuelgan de una estadia, asi que siguen a la
    // estadia. Una ausencia entra en el rango si se solapa con el, no solo si
    // empieza dentro: unas vacaciones de julio a agosto son parte de los dos.
    const ausencias = datos.ausencias.filter(
      (a) =>
        idsEstadia.has(a.estadia_id) &&
        (!hayRango ||
          ((!hasta || a.desde <= hasta) && (!desde || (a.hasta ?? "9999-12-31") >= desde))),
    );

    // ---- Personas -------------------------------------------------------
    // Sin filtros de dimension se muestran las 397. Con alguno, solo quienes
    // aparecen en lo que quedo a la vista.
    const hayDimension =
      hayRango ||
      empresas.length > 0 ||
      hostales.length > 0 ||
      archivos.length > 0 ||
      soloRevision;

    let personas = datos.personas;
    if (hayDimension) {
      const ids = new Set<number>();
      for (const e of estadias) ids.add(e.persona_id);
      for (const s of servicios) if (s.persona_id !== null) ids.add(s.persona_id);
      personas = personas.filter((p) => ids.has(p.id));
    }
    personas = personas.filter((p) => coincide(p.nombre, p.rut, p.cargo));

    // ---- Rechazos -------------------------------------------------------
    // No tienen empresa ni fecha fiables: es justamente lo que les falta.
    const rechazos = datos.rechazos.filter(
      (r) =>
        (archivos.length === 0 || archivos.includes(r.archivo_origen)) &&
        coincide(r.motivo, r.hoja),
    );

    const hayFiltros =
      hayDimension || filtros.busqueda.trim() !== "";

    return {
      todo: datos,
      filtros,
      ponerFiltros,
      limpiar,
      hayFiltros,
      estadias,
      noches,
      servicios,
      personas,
      eventos,
      ausencias,
      rechazos,
      nochesPorEstadia,
      catalogo,
    };
  }, [datos, filtros, nochesTodas, catalogo, ponerFiltros, limpiar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
