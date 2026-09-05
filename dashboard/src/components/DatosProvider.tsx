"use client";

import { useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { finDeMes, hoy, inicioDeMes } from "@/lib/fechas";
import { norm } from "@/lib/filtros";
import type { Rol } from "@/lib/sesion";
import type {
  Ausencia,
  Datos,
  Estadia,
  Evento,
  Habitacion,
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
  /** Quien esta mirando. Lo usan las pantallas que ofrecen algo solo a ADMIN. */
  rol: Rol;
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
  habitaciones: Habitacion[];
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

  /**
   * Los meses que tienen al menos una noche, en formato YYYY-MM.
   *
   * Se calculan SOLO sobre las noches. Las fechas de servicio traen anos mal
   * tecleados -hay filas en 2027 y en 2025 que la pantalla Datos lista una por
   * una-, y el selector de mes las ofrecia como si fueran periodos reales.
   */
  mesesConMovimiento: string[];
  ultimoMesConMovimiento: string | null;
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

/* --------------------------------------------------------------------------
   Filtros y URL.

   Se leen una vez al montar y se escriben con history.replaceState, NO con
   router.replace: el layout del panel es force-dynamic, asi que una navegacion
   de Next volveria al servidor en cada tecla del buscador. La URL aqui es un
   marcador para poder recargar y compartir la vista; la fuente de verdad sigue
   siendo el estado de React.
   -------------------------------------------------------------------------- */

/**
 * El panel abre en el MES EN CURSO, siempre.
 *
 * No en el ultimo mes con datos: eso hacia que abriera en julio 2026 estando en
 * septiembre, presentando como "el mes" un cierre viejo. Un panel de gestion
 * tiene que decir en que va el mes que se esta viviendo, aunque la respuesta
 * sea que todavia no paso nada; para ese caso esta el estado vacio, que ofrece
 * saltar al ultimo mes con movimiento.
 *
 * Tampoco abre en "todas las fechas": el administrador cierra un mes a la vez,
 * y un resumen que mezcla junio con julio no resume nada.
 */
function filtrosPorDefecto(): FiltrosGlobales {
  const mes = hoy().slice(0, 7);
  return { ...FILTROS_VACIOS, desde: inicioDeMes(mes), hasta: finDeMes(mes) };
}

const CLAVES_URL = [
  "desde",
  "hasta",
  "empresa",
  "hostal",
  "archivo",
  "q",
  "revision",
];

function leerDeUrl(
  params: URLSearchParams,
  porDefecto: FiltrosGlobales,
): FiltrosGlobales {
  // Sin ningun parametro propio manda el mes por defecto. Con alguno, la URL
  // describe la vista entera: un "desde" ausente significa sin limite, no
  // "todavia no eligieron".
  if (!CLAVES_URL.some((c) => params.has(c))) return porDefecto;

  return {
    desde: params.get("desde") ?? "",
    hasta: params.get("hasta") ?? "",
    empresas: params.getAll("empresa"),
    hostales: params.getAll("hostal"),
    archivos: params.getAll("archivo"),
    busqueda: params.get("q") ?? "",
    soloRevision: params.get("revision") === "1",
  };
}

function aUrl(f: FiltrosGlobales): string {
  const p = new URLSearchParams();
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  for (const e of f.empresas) p.append("empresa", e);
  for (const h of f.hostales) p.append("hostal", h);
  for (const a of f.archivos) p.append("archivo", a);
  if (f.busqueda.trim()) p.set("q", f.busqueda);
  if (f.soloRevision) p.set("revision", "1");
  const qs = p.toString();
  return qs ? "?" + qs : window.location.pathname;
}

/* -------------------------------------------------------------------------- */

export function DatosProvider({
  datos,
  rol,
  children,
}: {
  datos: Datos;
  rol: Rol;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  // No depende de los datos: el mes en curso es el mes en curso.
  const porDefecto = useMemo(() => filtrosPorDefecto(), []);

  const [filtros, setFiltros] = useState<FiltrosGlobales>(() =>
    leerDeUrl(new URLSearchParams(params.toString()), porDefecto),
  );

  useEffect(() => {
    window.history.replaceState(null, "", aUrl(filtros));
  }, [filtros]);

  const ponerFiltros = useCallback((cambio: Partial<FiltrosGlobales>) => {
    setFiltros((f) => ({ ...f, ...cambio }));
  }, []);

  // "Limpiar todo" vuelve al mes por defecto, no a "todas las fechas": lo
  // segundo mezcla meses y no es un estado que nadie pida.
  const limpiar = useCallback(() => setFiltros(porDefecto), [porDefecto]);

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

  const { mesesConMovimiento, ultimoMesConMovimiento } = useMemo(() => {
    const set = new Set<string>();
    for (const n of datos.noches) set.add(n.fecha.slice(0, 7));
    const lista = [...set].sort();
    return {
      mesesConMovimiento: lista,
      ultimoMesConMovimiento: lista[lista.length - 1] ?? null,
    };
  }, [datos.noches]);

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
      buscado === "" || campos.some((c) => c && norm(c).includes(buscado));

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
    // registrada) no desapareceran de otro modo.
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
          ((!hasta || a.desde <= hasta) &&
            (!desde || (a.hasta ?? "9999-12-31") >= desde))),
    );

    // ---- Habitaciones ---------------------------------------------------
    // Solo responden al filtro de hostal: una habitacion no tiene empresa ni
    // fecha. La grilla de ocupacion necesita ver tambien las vacias, asi que
    // no se filtran por quien durmio en ellas.
    const habitaciones =
      hostales.length === 0
        ? datos.habitaciones
        : datos.habitaciones.filter((h) => hostales.includes(h.hostal));

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

    // El mes por defecto no cuenta como filtro puesto por alguien: si contara,
    // "Limpiar todo" estaria encendido desde que se abre el panel.
    const soloElMesPorDefecto =
      filtros.desde === porDefecto.desde &&
      filtros.hasta === porDefecto.hasta &&
      empresas.length === 0 &&
      hostales.length === 0 &&
      archivos.length === 0 &&
      !soloRevision;

    const hayFiltros =
      (hayDimension && !soloElMesPorDefecto) || filtros.busqueda.trim() !== "";

    return {
      todo: datos,
      rol,
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
      habitaciones,
      rechazos,
      nochesPorEstadia,
      catalogo,
      mesesConMovimiento,
      ultimoMesConMovimiento,
    };
  }, [
    datos,
    rol,
    filtros,
    nochesTodas,
    catalogo,
    ponerFiltros,
    limpiar,
    porDefecto,
    mesesConMovimiento,
    ultimoMesConMovimiento,
  ]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
