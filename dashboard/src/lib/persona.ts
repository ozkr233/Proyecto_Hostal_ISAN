import type {
  Ausencia,
  Datos,
  Estadia,
  Evento,
  Noche,
  Persona,
  Servicio,
} from "./types";

/**
 * Todo lo que se sabe de una persona, cruzado de una pasada.
 *
 * Vivia como useMemo dentro de la pestana Personas, que era un catalogo de 397
 * filas con cuatro agregados por fila. El agregado importa, la lista no: se
 * mira a una persona cuando se pregunta por ELLA. Asi que el calculo se quedo
 * y la tabla se fue.
 *
 * La identidad es el RUT; quien no lo trae se identifica por nombre
 * normalizado desde el ETL, y aqui ya llega resuelto a un persona_id.
 */
export type ResumenPersona = {
  persona: Persona;
  estadias: Estadia[];
  noches: Noche[];
  servicios: Servicio[];
  eventos: Evento[];
  ausencias: Ausencia[];
  /** Noches de cada estadia de esta persona, para la columna del calendario. */
  nochesPorEstadia: Map<number, Noche[]>;
  totalNoches: number;
  totalServicios: number;
  primeraNoche: string | null;
  ultimaNoche: string | null;
  empresas: string[];
  hostales: string[];
  habitaciones: string[];
  diasAusencia: number;
  /** Cantidad por tipo de servicio: DESAYUNO, ALMUERZO, … */
  porTipoServicio: Map<string, number>;
};

function ordenados(s: Set<string>): string[] {
  return [...s].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}

/**
 * `datos` es SIEMPRE el conjunto completo, nunca la rebanada filtrada: la
 * ficha de alguien es su historia entera, no su parte del mes que se este
 * mirando en el resto del panel.
 */
export function resumenDe(
  personaId: number,
  datos: Datos,
): ResumenPersona | null {
  const persona = datos.personas.find((p) => p.id === personaId);
  if (!persona) return null;

  const estadias = datos.estadias.filter((e) => e.persona_id === personaId);
  const ids = new Set(estadias.map((e) => e.id));

  const noches = datos.noches.filter((n) => ids.has(n.estadia_id));
  const nochesPorEstadia = new Map<number, Noche[]>();
  for (const n of noches) {
    const lista = nochesPorEstadia.get(n.estadia_id);
    if (lista) lista.push(n);
    else nochesPorEstadia.set(n.estadia_id, [n]);
  }

  // Los servicios se buscan por persona_id, no por estadia: en ALMUERZOS ISAM
  // come gente que ese dia no se alojaba, y esas filas son suyas igual.
  const servicios = datos.servicios.filter((s) => s.persona_id === personaId);

  const eventos = datos.eventos.filter((ev) => ids.has(ev.estadia_id));
  const ausencias = datos.ausencias.filter((a) => ids.has(a.estadia_id));

  const empresas = new Set<string>();
  const hostales = new Set<string>();
  const habitaciones = new Set<string>();
  for (const e of estadias) {
    empresas.add(e.empresa);
    hostales.add(e.hostal);
    if (e.habitacion) habitaciones.add(`${e.hostal}-${e.habitacion}`);
  }

  const porTipoServicio = new Map<string, number>();
  let totalServicios = 0;
  for (const s of servicios) {
    porTipoServicio.set(
      s.tipo_servicio,
      (porTipoServicio.get(s.tipo_servicio) ?? 0) + s.cantidad,
    );
    totalServicios += s.cantidad;
  }

  const fechas = noches.map((n) => n.fecha).sort();

  return {
    persona,
    estadias,
    noches,
    servicios,
    eventos,
    ausencias,
    nochesPorEstadia,
    totalNoches: noches.length,
    totalServicios,
    primeraNoche: fechas[0] ?? null,
    ultimaNoche: fechas[fechas.length - 1] ?? null,
    empresas: ordenados(empresas),
    hostales: ordenados(hostales),
    habitaciones: ordenados(habitaciones),
    diasAusencia: ausencias.reduce((n, a) => n + a.dias, 0),
    porTipoServicio,
  };
}

/** Estado del RUT, tal como se rotula en pantalla. */
export function estadoRut(p: Persona): "Valido" | "Invalido" | "Sin RUT" {
  return !p.rut ? "Sin RUT" : p.rut_valido ? "Valido" : "Invalido";
}
