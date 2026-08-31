/**
 * Paleta categorica validada (skill dataviz): adyacentes CVD ΔE 9.1 en claro y
 * 8.4 en oscuro, vision normal 19.6 / 19.3. No agregar un noveno tono: pasado
 * el octavo, lo que corresponde es agrupar en "Otras" o separar en paneles.
 *
 * El color sigue a la ENTIDAD, nunca a su posicion en el ranking. Por eso el
 * mapa se arma sobre el catalogo completo y sin filtrar: al filtrar empresas,
 * las que quedan conservan su tono.
 */
export const SERIES = [
  "var(--s1)",
  "var(--s2)",
  "var(--s3)",
  "var(--s4)",
  "var(--s5)",
  "var(--s6)",
  "var(--s7)",
  "var(--s8)",
] as const;

export function mapaColores(claves: string[]): Map<string, string> {
  const m = new Map<string, string>();
  claves.forEach((c, i) => m.set(c, SERIES[i % SERIES.length]));
  return m;
}

export const COLOR_TURNO: Record<string, string> = {
  D: "var(--s1)",
  N: "var(--s7)",
  E: "var(--s4)",
};

/** Mismo orden que el enum core.tipo_servicio. */
export const SERVICIOS_ORDEN = [
  "DESAYUNO",
  "ALMUERZO",
  "CENA",
  "COLACION_NORMAL",
  "COLACION_ESPECIAL",
] as const;

export const COLOR_SERVICIO: Record<string, string> = {
  DESAYUNO: "var(--s1)",
  ALMUERZO: "var(--s2)",
  CENA: "var(--s3)",
  COLACION_NORMAL: "var(--s4)",
  COLACION_ESPECIAL: "var(--s5)",
};

export const NOMBRE_SERVICIO: Record<string, string> = {
  DESAYUNO: "Desayuno",
  ALMUERZO: "Almuerzo",
  CENA: "Cena",
  COLACION_NORMAL: "Colacion normal",
  COLACION_ESPECIAL: "Colacion especial",
};

export const NOMBRE_EVENTO: Record<string, string> = {
  CAMBIO_SABANAS: "Cambio de sabanas",
  CAMBIO_HAB: "Cambio de habitacion",
  ACREDITACION: "Acreditacion",
  AVISO_SALIDA: "Aviso de salida",
  OTRO: "Otro",
};

export const NOMBRE_ENTREGA: Record<string, string> = {
  ENTREGADA: "Entregada",
  NO_ENTREGADA: "No entregada",
  NO_APLICA: "No aplica",
};
