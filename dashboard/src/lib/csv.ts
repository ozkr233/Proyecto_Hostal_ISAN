import type { Valor } from "./filtros";

/**
 * Exportacion a CSV, compartida por la Tabla generica y por la matriz del
 * registro oficial.
 *
 * Vivia dentro de Tabla.tsx, privada del modulo. La matriz del registro no usa
 * la Tabla generica -es un pivote, no una lista- pero necesita bajar
 * exactamente el mismo formato, asi que el codigo se movio aqui en vez de
 * duplicarse.
 */

/** Una celda ya escapada. Los booleanos salen como SI/NO, no como true/false. */
function escapar(v: Valor): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "boolean" ? (v ? "SI" : "NO") : String(v);
  return /["\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Filas ya resueltas a valores. La cabecera es la primera fila.
 *
 * BOM para que Excel en Windows lea bien los acentos, y ';' porque es el
 * separador de lista de es-CL.
 */
export function filasACSV(filas: Valor[][]): string {
  return "\ufeff" + filas.map((f) => f.map(escapar).join(";")).join("\r\n");
}

/** Igual, pero extrayendo cada celda con la funcion `valor` de su columna. */
export function aCSV<T>(
  columnas: { titulo: string; valor: (fila: T) => Valor }[],
  filas: T[],
): string {
  return filasACSV([
    columnas.map((c) => c.titulo),
    ...filas.map((f) => columnas.map((c) => c.valor(f))),
  ]);
}

export function descargar(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(
    new Blob([contenido], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
