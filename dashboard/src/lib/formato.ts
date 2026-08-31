const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** 'YYYY-MM-DD' -> '15 jul'. Sin pasar por Date: no hay zona horaria que corra el dia. */
export function fechaCorta(f: string): string {
  const [, m, d] = f.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? "?"}`;
}

/**
 * 'YYYY-MM-DD' -> '9 may 25'. Para ejes que cruzan de un ano a otro: sin el
 * ano, 2025-05-09 y 2026-02-28 se leen como '9 may' y '28 feb' y la serie
 * parece desordenada cuando en realidad esta bien.
 */
export function fechaCortaAno(f: string): string {
  const [a, m, d] = f.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? "?"} ${a.slice(2)}`;
}

/** 'YYYY-MM-DD' -> '15 jul 2026'. */
export function fechaLarga(f: string): string {
  const [a, m, d] = f.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1] ?? "?"} ${a}`;
}

/** 'YYYY-MM-DD' -> '2026-07'. */
export function mesDe(f: string): string {
  return f.slice(0, 7);
}

export function numero(n: number): string {
  return n.toLocaleString("es-CL");
}

/** RUT normalizado '18089941K' -> '18.089.941-K'. */
export function formatearRut(rut: string | null): string | null {
  if (!rut) return null;
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
