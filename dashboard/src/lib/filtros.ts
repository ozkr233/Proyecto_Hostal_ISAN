/** Motor de filtrado generico. Sin React: solo datos adentro, boolean afuera. */

export type Valor = string | number | boolean | null;

export type TipoColumna = "texto" | "enum" | "booleano" | "fecha" | "numero";

/** Toda columna que admite NULL puede filtrarse por "solo vacios" / "solo con valor". */
export type EstadoNulos = "todos" | "vacios" | "con-valor";

export type FiltroTexto = { tipo: "texto"; texto: string; nulos: EstadoNulos };
export type FiltroEnum = { tipo: "enum"; seleccion: string[]; nulos: EstadoNulos };
export type FiltroBooleano = { tipo: "booleano"; valor: "todos" | "si" | "no" };
export type FiltroFecha = { tipo: "fecha"; desde: string; hasta: string; nulos: EstadoNulos };
export type FiltroNumero = { tipo: "numero"; min: string; max: string; nulos: EstadoNulos };

export type Filtro =
  | FiltroTexto
  | FiltroEnum
  | FiltroBooleano
  | FiltroFecha
  | FiltroNumero;

/**
 * Espeja core.norm_texto de la base: mayusculas, sin acentos, sin espacios
 * repetidos. Asi buscar "mecanico" encuentra "MANTENEDOR MECANICO".
 */
export function norm(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function esVacio(v: Valor): boolean {
  return v === null || v === undefined || v === "";
}

export function filtroInicial(tipo: TipoColumna): Filtro {
  switch (tipo) {
    case "texto":
      return { tipo: "texto", texto: "", nulos: "todos" };
    case "enum":
      return { tipo: "enum", seleccion: [], nulos: "todos" };
    case "booleano":
      return { tipo: "booleano", valor: "todos" };
    case "fecha":
      return { tipo: "fecha", desde: "", hasta: "", nulos: "todos" };
    case "numero":
      return { tipo: "numero", min: "", max: "", nulos: "todos" };
  }
}

/** ¿El filtro restringe algo? Se usa para marcar la columna en la cabecera. */
export function filtroActivo(f: Filtro): boolean {
  switch (f.tipo) {
    case "texto":
      return f.texto.trim() !== "" || f.nulos !== "todos";
    case "enum":
      return f.seleccion.length > 0 || f.nulos !== "todos";
    case "booleano":
      return f.valor !== "todos";
    case "fecha":
      return f.desde !== "" || f.hasta !== "" || f.nulos !== "todos";
    case "numero":
      return f.min !== "" || f.max !== "" || f.nulos !== "todos";
  }
}

function pasaNulos(nulos: EstadoNulos, vacio: boolean): boolean | null {
  if (nulos === "vacios") return vacio;
  if (nulos === "con-valor") return !vacio;
  // "todos": los vacios pasan de largo sin someterse al resto del filtro,
  // que es lo que espera quien no toco nada.
  return vacio ? true : null;
}

export function pasa(f: Filtro, v: Valor): boolean {
  if (f.tipo === "booleano") {
    if (f.valor === "todos") return true;
    return f.valor === "si" ? v === true : v === false || v === null;
  }

  const vacio = esVacio(v);
  const porNulos = pasaNulos(f.nulos, vacio);
  if (porNulos !== null) return porNulos;

  switch (f.tipo) {
    case "texto": {
      const buscado = norm(f.texto);
      if (buscado === "") return true;
      return norm(String(v)).includes(buscado);
    }
    case "enum":
      return f.seleccion.length === 0 || f.seleccion.includes(String(v));
    case "fecha": {
      const fecha = String(v);
      if (f.desde && fecha < f.desde) return false;
      if (f.hasta && fecha > f.hasta) return false;
      return true;
    }
    case "numero": {
      const n = Number(v);
      if (Number.isNaN(n)) return false;
      if (f.min !== "" && n < Number(f.min)) return false;
      if (f.max !== "" && n > Number(f.max)) return false;
      return true;
    }
  }
}

/** Orden estable: los vacios siempre al final, suban o bajen el resto. */
export function comparar(a: Valor, b: Valor): number {
  const va = esVacio(a);
  const vb = esVacio(b);
  if (va && vb) return 0;
  if (va) return 1;
  if (vb) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? -1 : 1;
  }
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

/** Valores distintos presentes, para poblar los multiselect de las columnas enum. */
export function valoresDistintos<T>(filas: T[], leer: (f: T) => Valor): string[] {
  const vistos = new Set<string>();
  for (const fila of filas) {
    const v = leer(fila);
    if (!esVacio(v)) vistos.add(String(v));
  }
  return [...vistos].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
}
