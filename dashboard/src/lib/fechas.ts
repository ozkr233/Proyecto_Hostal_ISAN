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
