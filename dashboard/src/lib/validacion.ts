/**
 * Validacion compartida entre el navegador y el servidor.
 *
 * El cliente la corre para dar respuesta inmediata mientras se escribe; la
 * Server Action la vuelve a correr y ESA es la que manda -el navegador se puede
 * saltar-. Las restricciones de db/09_recepcion.sql son la tercera red.
 *
 * Sin dependencias: funciones planas que devuelven { campo: mensaje }. Los
 * mensajes estan escritos para un recepcionista, no para un programador.
 */

import { diasEntre, fechaValida, horaValida } from "./fechas";

export type Errores = Record<string, string>;

/* ==========================================================================
   RUT
   ========================================================================== */

/** Digito verificador por modulo 11. Espejo de core.rut_es_valido y de nz.rut(). */
function dvEsperado(cuerpo: string): string {
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return String(resto);
}

/**
 * '18.089.941-k' -> '18089941K'. Solo digitos y DV, sin puntos ni guion, que es
 * como lo guarda core.persona.rut_normalizado.
 */
export function normalizarRut(entrada: string): string {
  return entrada.toUpperCase().replace(/[^0-9K]/g, "");
}

/** ¿El RUT ya normalizado pasa el modulo 11? */
export function rutValido(rut: string): boolean {
  // El CHECK de core.persona acepta 6 a 9 digitos mas DV; el modulo 11 solo
  // tiene sentido desde 7. Se exige lo mismo que la funcion de la base.
  if (!/^[0-9]{7,8}[0-9K]$/.test(rut)) return false;
  return dvEsperado(rut.slice(0, -1)) === rut.slice(-1);
}

/** '18089941K' -> '18.089.941-K'. Para mostrar mientras se escribe. */
export function formatearRutParcial(rut: string): string {
  if (rut.length <= 1) return rut;
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/* ==========================================================================
   Ingreso
   ========================================================================== */

export type DatosIngreso = {
  rut: string;
  nombre: string;
  celular: string;
  cargo_id: string;
  hostal_id: string;
  empresa_id: string;
  habitacion_id: string;
  tipo_habitacion: string;
  folio: string;
  grupo: string;
  turno_habitual: string;
  fecha_ingreso: string;
  hora_ingreso: string;
  fecha_salida_prevista: string;
  usa_estacionamiento: boolean;
  patente_vehiculo: string;
  numero_llave: string;
  numero_chip: string;
  observaciones: string;
};

const TURNOS = ["D", "N", "E"];
const TIPOS_HAB = ["DOBLE", "SINGLE"];
const GRUPOS = ["", "A", "B"];

export function validarIngreso(d: DatosIngreso, hoy: string): Errores {
  const e: Errores = {};

  // --- Huesped ---
  const rut = normalizarRut(d.rut);
  if (rut === "") {
    e.rut = "Falta el RUT. Es obligatorio para registrar a un huesped.";
  } else if (!rutValido(rut)) {
    e.rut = "Ese RUT no es valido. Revisa el digito verificador.";
  }

  if (d.nombre.trim() === "") {
    e.nombre = "Falta el nombre del huesped.";
  } else if (d.nombre.trim().length < 3) {
    e.nombre = "El nombre parece incompleto.";
  }

  // El celular es opcional, pero si lo escriben tiene que parecer un telefono.
  const celular = d.celular.replace(/[^0-9]/g, "");
  if (d.celular.trim() !== "" && (celular.length < 8 || celular.length > 11)) {
    e.celular = "El celular deberia tener entre 8 y 11 digitos.";
  }

  // --- Estadia ---
  if (!d.hostal_id) e.hostal_id = "Elige el hostal.";
  if (!d.empresa_id) e.empresa_id = "Elige la empresa que paga la estadia.";
  if (!d.habitacion_id) e.habitacion_id = "Asigna una habitacion.";

  if (d.tipo_habitacion && !TIPOS_HAB.includes(d.tipo_habitacion)) {
    e.tipo_habitacion = "Tipo de habitacion no valido.";
  }
  if (!TURNOS.includes(d.turno_habitual)) {
    e.turno_habitual = "Elige el turno: dia, noche o especial.";
  }
  if (!GRUPOS.includes(d.grupo)) {
    e.grupo = "Grupo no valido.";
  }

  // --- Fechas ---
  if (!fechaValida(d.fecha_ingreso)) {
    e.fecha_ingreso = "Falta la fecha de ingreso.";
  } else if (diasEntre(hoy, d.fecha_ingreso) > 0) {
    e.fecha_ingreso = "La fecha de ingreso no puede estar en el futuro.";
  } else if (diasEntre(d.fecha_ingreso, hoy) > 30) {
    e.fecha_ingreso =
      "Esa fecha de ingreso tiene mas de un mes. Si es correcta, corrigela a mano en el panel.";
  }

  if (!horaValida(d.hora_ingreso)) {
    e.hora_ingreso = "Falta la hora de ingreso.";
  }

  if (!fechaValida(d.fecha_salida_prevista)) {
    e.fecha_salida_prevista =
      "Falta hasta cuando se queda. Si no se sabe, pon una fecha estimada: se puede cambiar despues.";
  } else if (
    fechaValida(d.fecha_ingreso) &&
    diasEntre(d.fecha_ingreso, d.fecha_salida_prevista) <= 0
  ) {
    e.fecha_salida_prevista =
      "La salida prevista tiene que ser posterior al ingreso.";
  } else if (
    fechaValida(d.fecha_ingreso) &&
    diasEntre(d.fecha_ingreso, d.fecha_salida_prevista) > 365
  ) {
    e.fecha_salida_prevista = "Mas de un ano de estadia: revisa la fecha.";
  }

  // --- Vehiculo y entrega ---
  if (d.usa_estacionamiento && d.patente_vehiculo.trim() === "") {
    e.patente_vehiculo = "Marcaste estacionamiento: falta la patente del vehiculo.";
  }
  if (d.numero_llave.trim() === "") {
    e.numero_llave = "Anota que llave se le entrego. Es lo que se le va a pedir de vuelta.";
  }

  return e;
}

/* ==========================================================================
   Salida
   ========================================================================== */

export type DatosSalida = {
  fecha_salida: string;
  hora_salida: string;
  llaves_devueltas: string;
  llaves_devueltas_en: string;
  chip_devuelto: string;
  chip_devuelto_en: string;
  motivo_salida_id: string;
  motivo_salida_detalle: string;
  observaciones: string;
};

export type ContextoSalida = {
  hoy: string;
  fecha_ingreso: string;
  fecha_salida_prevista: string | null;
  /** Si en el ingreso se anoto un chip, en la salida hay que responder por el. */
  tiene_chip: boolean;
  /** Del catalogo: el motivo elegido exige explicacion. */
  motivo_exige_detalle: boolean;
  /** Del catalogo: el motivo solo aplica a salidas anticipadas. */
  motivo_solo_anticipada: boolean;
};

const ENTREGA = ["ENTREGADA", "NO_ENTREGADA"];

export function validarSalida(d: DatosSalida, c: ContextoSalida): Errores {
  const e: Errores = {};

  if (!fechaValida(d.fecha_salida)) {
    e.fecha_salida = "Falta la fecha de salida.";
  } else if (diasEntre(c.fecha_ingreso, d.fecha_salida) < 0) {
    e.fecha_salida = `La salida no puede ser anterior al ingreso (${c.fecha_ingreso}).`;
  } else if (diasEntre(c.hoy, d.fecha_salida) > 0) {
    e.fecha_salida = "La salida no puede estar en el futuro.";
  }

  if (!horaValida(d.hora_salida)) {
    e.hora_salida = "Falta la hora de salida.";
  }

  if (!ENTREGA.includes(d.llaves_devueltas)) {
    e.llaves_devueltas = "Indica si devolvio las llaves.";
  } else if (d.llaves_devueltas === "ENTREGADA") {
    if (!fechaValida(d.llaves_devueltas_en)) {
      e.llaves_devueltas_en = "Falta la fecha en que devolvio las llaves.";
    } else if (diasEntre(c.fecha_ingreso, d.llaves_devueltas_en) < 0) {
      e.llaves_devueltas_en = "Esa fecha es anterior al ingreso.";
    } else if (diasEntre(c.hoy, d.llaves_devueltas_en) > 0) {
      e.llaves_devueltas_en = "Esa fecha esta en el futuro.";
    }
  }

  if (c.tiene_chip) {
    if (!ENTREGA.includes(d.chip_devuelto)) {
      e.chip_devuelto = "Indica si devolvio el chip.";
    } else if (d.chip_devuelto === "ENTREGADA" && !fechaValida(d.chip_devuelto_en)) {
      e.chip_devuelto_en = "Falta la fecha en que devolvio el chip.";
    }
  }

  if (!d.motivo_salida_id) {
    e.motivo_salida_id = "Indica por que se va.";
  } else {
    const anticipada = esAnticipada(d.fecha_salida, c.fecha_salida_prevista);
    if (c.motivo_solo_anticipada && !anticipada) {
      e.motivo_salida_id =
        "Ese motivo es para quien se va antes de lo previsto. Elige otro.";
    }
    // Un motivo con exige_detalle, o una salida anticipada, tienen que
    // explicarse: es justamente lo que hoy no queda escrito en ninguna parte.
    if (
      (c.motivo_exige_detalle || anticipada) &&
      d.motivo_salida_detalle.trim() === ""
    ) {
      e.motivo_salida_detalle = anticipada
        ? "Se va antes de lo previsto: explica brevemente por que."
        : "Ese motivo necesita una explicacion.";
    }
  }

  if (d.llaves_devueltas === "NO_ENTREGADA" && d.observaciones.trim() === "") {
    e.observaciones =
      "No devolvio las llaves: deja anotado que paso, para poder reclamarlas despues.";
  }

  return e;
}

/** La salida ocurre antes de lo previsto. Espeja core.estadia.salida_anticipada. */
export function esAnticipada(
  fechaSalida: string,
  prevista: string | null,
): boolean {
  if (!prevista || !fechaValida(fechaSalida) || !fechaValida(prevista)) {
    return false;
  }
  return diasEntre(fechaSalida, prevista) > 0;
}

/* ==========================================================================
   Ausencia
   ========================================================================== */

export type DatosAusencia = {
  tipo_id: string;
  desde: string;
  hasta: string;
  conserva_habitacion: boolean;
  detalle: string;
};

export type ContextoAusencia = {
  hoy: string;
  fecha_ingreso: string;
  tipo_exige_detalle: boolean;
};

export function validarAusencia(d: DatosAusencia, c: ContextoAusencia): Errores {
  const e: Errores = {};

  if (!d.tipo_id) {
    e.tipo_id = "Elige el motivo de la ausencia.";
  }

  if (!fechaValida(d.desde)) {
    e.desde = "Falta desde cuando se ausenta.";
  } else if (diasEntre(c.fecha_ingreso, d.desde) < 0) {
    e.desde = `La ausencia no puede empezar antes del ingreso (${c.fecha_ingreso}).`;
  }

  // 'hasta' vacio es informacion valida: "se fue y no se sabe cuando vuelve".
  if (d.hasta.trim() !== "") {
    if (!fechaValida(d.hasta)) {
      e.hasta = "Esa fecha de regreso no es valida.";
    } else if (fechaValida(d.desde) && diasEntre(d.desde, d.hasta) < 0) {
      e.hasta = "El regreso no puede ser anterior al inicio de la ausencia.";
    } else if (fechaValida(d.desde) && diasEntre(d.desde, d.hasta) > 180) {
      e.hasta = "Mas de seis meses de ausencia: revisa las fechas.";
    }
  }

  if (c.tipo_exige_detalle && d.detalle.trim() === "") {
    e.detalle = "Ese motivo necesita una explicacion.";
  }

  return e;
}

/* ========================================================================== */

export function hayErrores(e: Errores): boolean {
  return Object.keys(e).length > 0;
}
