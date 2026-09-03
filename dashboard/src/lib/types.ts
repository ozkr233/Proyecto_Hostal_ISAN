/**
 * Las fechas viajan SIEMPRE como texto 'YYYY-MM-DD', nunca como Date.
 *
 * Un `date` de Postgres convertido a Date de JS se interpreta como medianoche
 * UTC; al mostrarlo en la zona de Chile (UTC-4) retrocede un dia y toda la
 * ocupacion queda corrida. Por eso las consultas hacen to_char() y aqui el
 * tipo es string: el error deja de ser posible.
 */
export type Fecha = string;

export type Turno = "D" | "N" | "E";
export type TipoHabitacion = "DOBLE" | "SINGLE";
export type Grupo = "A" | "B";
export type EstadoEntrega = "ENTREGADA" | "NO_ENTREGADA" | "NO_APLICA";
/** De donde salio la fila: importada de los libros, o capturada en recepcion. */
export type OrigenRegistro = "ETL_EXCEL" | "WEB";
export type TipoServicio =
  | "DESAYUNO"
  | "ALMUERZO"
  | "CENA"
  | "COLACION_NORMAL"
  | "COLACION_ESPECIAL";
export type TipoEvento =
  | "CAMBIO_SABANAS"
  | "CAMBIO_HAB"
  | "ACREDITACION"
  | "AVISO_SALIDA"
  | "OTRO";

export type Estadia = {
  id: number;
  persona_id: number;
  persona: string;
  rut: string | null;
  rut_valido: boolean;
  celular: string | null;
  cargo: string | null;
  empresa: string;
  hostal: string;
  habitacion: string | null;
  habitacion_tipo: TipoHabitacion | null;
  tipo_habitacion: TipoHabitacion | null;
  grupo: Grupo | null;
  folio: string | null;
  fecha_ingreso: Fecha | null;
  hora_ingreso: string | null;
  fecha_salida: Fecha | null;
  hora_salida: string | null;
  motivo_salida: string | null;
  motivo_salida_nombre: string | null;
  motivo_salida_detalle: string | null;
  salida_anticipada: boolean;
  fecha_salida_prevista: Fecha | null;
  turno_habitual: Turno | null;
  chip_devuelto: EstadoEntrega;
  llaves_devueltas: EstadoEntrega;
  numero_llave: string | null;
  numero_chip: string | null;
  llaves_devueltas_en: Fecha | null;
  chip_devuelto_en: Fecha | null;
  origen: OrigenRegistro;
  registrado_por: string | null;
  salida_registrada_por: string | null;
  patente_vehiculo: string | null;
  usa_estacionamiento: boolean;
  observaciones: string | null;
  requiere_revision: boolean;
  nota_revision: string | null;
  origen_archivo: string | null;
  origen_hoja: string | null;
  origen_fila: number | null;
  origen_bloque: string | null;
};

export type Noche = {
  estadia_id: number;
  fecha: Fecha;
  turno: Turno | null;
  cambio_sabanas: boolean;
};

export type Servicio = {
  id: number;
  fecha: Fecha;
  estadia_id: number | null;
  persona_id: number | null;
  persona: string | null;
  rut: string | null;
  empresa: string | null;
  hostal: string;
  tipo_servicio: TipoServicio;
  cantidad: number;
  variante: string | null;
  es_extra: boolean;
  autorizado_por: string | null;
  origen_archivo: string | null;
  origen_hoja: string | null;
};

export type Persona = {
  id: number;
  nombre: string;
  rut: string | null;
  rut_valido: boolean;
  celular: string | null;
  cargo: string | null;
};

export type Evento = {
  id: number;
  estadia_id: number;
  fecha: Fecha;
  tipo: TipoEvento;
  detalle: string | null;
};

/**
 * Permiso, vacaciones o licencia. Lo que en el Excel eran las filas 97-99 de
 * R. OFICIAL: tres numeros tecleados a mano, sin persona detras.
 */
export type Ausencia = {
  id: number;
  estadia_id: number;
  persona_id: number;
  persona: string;
  rut: string | null;
  empresa: string;
  hostal: string;
  habitacion: string | null;
  tipo: string;
  tipo_nombre: string;
  desde: Fecha;
  /** null = todavia no vuelve. Es informacion, no un dato faltante. */
  hasta: Fecha | null;
  dias: number;
  conserva_habitacion: boolean;
  detalle: string | null;
  registrado_por: string | null;
};

export type Habitacion = {
  id: number;
  hostal: string;
  numero: string;
  tipo: TipoHabitacion | null;
  capacidad: number;
  activa: boolean;
};

export type Rechazo = {
  id: number;
  archivo_origen: string;
  hoja: string | null;
  fila: number | null;
  bloque: string | null;
  motivo: string;
  detalle: unknown;
};

export type Descuadre = {
  fecha: Fecha;
  noches_core: number;
  filas_hoja_diaria: number;
  diferencia: number;
};

export type Datos = {
  estadias: Estadia[];
  noches: Noche[];
  servicios: Servicio[];
  personas: Persona[];
  eventos: Evento[];
  ausencias: Ausencia[];
  habitaciones: Habitacion[];
  rechazos: Rechazo[];
  descuadre: Descuadre[];
  cargadoEn: string;
};
