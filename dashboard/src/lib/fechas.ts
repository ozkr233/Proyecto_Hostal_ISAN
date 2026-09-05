/**
 * Fecha y hora en la zona del hostal, no en la del servidor.
 *
 * El mismo problema que core.hoy() resuelve en la base: Vercel corre en UTC y
 * el hostal esta en Chile (UTC-4/-3). Un ingreso registrado a las 21:00 de un
 * martes es del martes, no del miercoles. Sin esto, cada noche entre las 20:00
 * y la medianoche el formulario propondria el dia siguiente.
 *
 * Todo viaja como texto 'YYYY-MM-DD' y 'HH:MM', nunca como Date; ver el
 * comentario de lib/types.ts.
 */

export const ZONA = "America/Santiago";

const FMT_FECHA = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FMT_HORA = new Intl.DateTimeFormat("es-CL", {
  timeZone: ZONA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 'YYYY-MM-DD' de hoy en Chile. en-CA da justo ese formato. */
export function hoy(momento: Date = new Date()): string {
  return FMT_FECHA.format(momento);
}

/** 'HH:MM' de ahora en Chile. */
export function ahora(momento: Date = new Date()): string {
  // es-CL con hour12:false puede devolver '24:05' a la medianoche.
  return FMT_HORA.format(momento).replace(/^24:/, "00:");
}

/** Suma dias a una fecha 'YYYY-MM-DD' sin pasar por Date local. */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = Date.UTC(a, m - 1, d) + dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Dias entre dos fechas 'YYYY-MM-DD' (b - a). Negativo si b es anterior. */
export function diasEntre(a: string, b: string): number {
  const [aa, am, ad] = a.split("-").map(Number);
  const [ba, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(ba, bm - 1, bd) - Date.UTC(aa, am - 1, ad)) / 86_400_000,
  );
}

/** ¿Es una fecha 'YYYY-MM-DD' real? Descarta '2026-02-31' y '2026-13-01'. */
export function fechaValida(f: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [a, m, d] = f.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  return new Date(Date.UTC(a, m - 1, d)).getUTCDate() === d;
}

/** ¿Es una hora 'HH:MM' real? */
export function horaValida(h: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(h)) return false;
  const [hh, mm] = h.split(":").map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

/**
 * Dias consecutivos entre dos fechas, ambas incluidas.
 *
 * Se llama `rangoDeDias` y no `diasEntre` porque ese nombre ya esta tomado
 * arriba por la version que devuelve un numero. Aritmetica en UTC: sin zona
 * que corra el dia.
 *
 * Lo usan la matriz del registro oficial y la grilla de ocupacion, que tienen
 * que dibujar EXACTAMENTE el mismo eje de columnas.
 */
export function rangoDeDias(desde: string, hasta: string): string[] {
  const salida: string[] = [];
  const fin = Date.parse(hasta + "T00:00:00Z");
  for (let t = Date.parse(desde + "T00:00:00Z"); t <= fin; t += 86_400_000) {
    salida.push(new Date(t).toISOString().slice(0, 10));
  }
  return salida;
}

/** Ultimo dia del mes, sin pasar por Date local: 'YYYY-MM' -> 'YYYY-MM-DD'. */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, "0")}`;
}

/** Primer dia del mes: 'YYYY-MM' -> 'YYYY-MM-01'. */
export function inicioDeMes(mes: string): string {
  return `${mes}-01`;
}

/**
 * Dia de la semana de una fecha 'YYYY-MM-DD': 0 domingo … 6 sabado.
 * En UTC, igual que todo lo demas aqui.
 */
export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** Inicial del dia de la semana, para las cabeceras de las grillas de 31 columnas. */
export const INICIAL_DIA = ["D", "L", "M", "M", "J", "V", "S"] as const;

/** ¿Cae en sabado o domingo? Las grillas los sombrean para poder ubicarse. */
export function esFinDeSemana(fecha: string): boolean {
  const d = diaSemana(fecha);
  return d === 0 || d === 6;
}

export const NOMBRE_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

/** 'YYYY-MM' -> 'julio 2026'. */
export function nombreDeMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${NOMBRE_MES[Number(m) - 1]} ${a}`;
}
