"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, dbEscritura } from "@/lib/db";
import { hoy } from "@/lib/fechas";
import { norm } from "@/lib/filtros";
import { hashear } from "@/lib/password";
import { invalidarCache } from "@/lib/queries";
import { personaPorRut, type PersonaConocida } from "@/lib/recepcion";
import { COOKIE, leerSesion, type Sesion } from "@/lib/sesion";
import {
  esAnticipada,
  hayErrores,
  normalizarRut,
  rutValido,
  validarAusencia,
  validarIngreso,
  validarSalida,
  type Errores,
} from "@/lib/validacion";

export type Estado = { errores?: Errores; mensaje?: string };

/* ==========================================================================
   Sesion
   ========================================================================== */

async function sesionActual(): Promise<Sesion> {
  const s = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!s) redirect("/login");
  return s;
}

/**
 * El id de usuario que se va a grabar. La sesion de emergencia tiene id 0, que
 * no existe en core.usuario: se graba NULL en vez de reventar contra la clave
 * foranea. Pero registrado_por es obligatorio para origen 'WEB', asi que ese
 * caso se rechaza antes con un mensaje que explica que hacer.
 */
function idUsuario(s: Sesion): number | null {
  return s.id > 0 ? s.id : null;
}

const SIN_USUARIO_REAL =
  "Estas dentro con la clave de emergencia, que no identifica a nadie. " +
  "Crea tu usuario en Usuarios y vuelve a entrar con el: cada registro tiene que quedar a nombre de alguien.";

async function soloAdmin(): Promise<Sesion> {
  const s = await sesionActual();
  if (s.rol !== "ADMIN") redirect("/");
  return s;
}

/* ==========================================================================
   Traduccion de los errores de la base
   ========================================================================== */

type ErrorPg = { code?: string; constraint_name?: string; message?: string };

/**
 * Las restricciones de db/09_recepcion.sql son la ultima red, y saltan cuando
 * dos recepcionistas hacen lo mismo a la vez -entre que se valida y se inserta
 * pasa tiempo-. Cuando saltan, el recepcionista tiene que leer algo util, no un
 * SQLSTATE.
 */
function traducirError(e: unknown): Errores {
  const { code, constraint_name: c } = (e ?? {}) as ErrorPg;

  if (code === "23505" && c === "estadia_abierta_por_persona_uk") {
    return {
      rut: "Esta persona ya figura alojada. Cierra su salida antes de registrar un ingreso nuevo.",
    };
  }
  if (code === "23505" && c === "estadia_folio_web_uk") {
    return { folio: "Ese folio ya esta usado en este hostal." };
  }
  if (code === "23505" && c === "persona_rut_uk") {
    return { rut: "Ese RUT ya esta registrado con otro nombre. Revisalo." };
  }
  if (code === "23505" && c === "usuario_login_uk") {
    return { usuario: "Ese nombre de usuario ya existe." };
  }
  if (code === "23P01" && c === "ausencia_sin_solape") {
    return {
      desde: "Esta persona ya tiene otra ausencia registrada que se cruza con esas fechas.",
    };
  }
  if (code === "23503" && c === "estadia_habitacion_del_hostal") {
    return { habitacion_id: "Esa habitacion no pertenece al hostal elegido." };
  }
  if (code === "23514" && c === "estadia_web_completa") {
    return { general: "Falta algun dato obligatorio del ingreso." };
  }
  if (code === "23514" && c === "estadia_web_salida_completa") {
    return { general: "Falta algun dato obligatorio de la salida." };
  }
  if (code === "23514" && c === "estadia_prevista_posterior") {
    return { fecha_salida_prevista: "La salida prevista tiene que ser posterior al ingreso." };
  }
  if (code === "23514" && c === "estadia_patente_si_estaciona") {
    return { patente_vehiculo: "Marcaste estacionamiento: falta la patente." };
  }

  console.error("Error no traducido al escribir:", e);
  return {
    general:
      "No se pudo guardar. Vuelve a intentarlo; si sigue fallando, avisa con la hora exacta.",
  };
}

/** Vacia lo que cachea el panel y refresca las pantallas de recepcion. */
function refrescarTodo() {
  invalidarCache();
  revalidatePath("/", "layout");
}

function texto(datos: FormData, campo: string): string {
  return String(datos.get(campo) ?? "").trim();
}

function marcado(datos: FormData, campo: string): boolean {
  return datos.get(campo) === "on" || datos.get(campo) === "true";
}

/** '' -> null, para las columnas que aceptan nulo. */
function oNulo(v: string): string | null {
  return v === "" ? null : v;
}

/* ==========================================================================
   Busqueda por RUT
   ========================================================================== */

/**
 * La llama el formulario de ingreso al salir del campo del RUT. Si la persona
 * ya existe -de otra estadia o de la carga del Excel- se rellena sola y el
 * recepcionista solo confirma; si arrastra una estadia abierta, se avisa ANTES
 * de que rellene el resto.
 *
 * Va como Server Action y no como endpoint publico para que herede la sesion:
 * son nombres y RUT de trabajadores, no algo que deba responderse a cualquiera.
 */
export async function buscarPorRut(
  rutEscrito: string,
): Promise<PersonaConocida | null> {
  await sesionActual();
  const rut = normalizarRut(rutEscrito);
  if (!rutValido(rut)) return null;
  return personaPorRut(rut);
}

/* ==========================================================================
   Ingreso
   ========================================================================== */

export async function registrarIngreso(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  const sesion = await sesionActual();
  if (idUsuario(sesion) === null) return { errores: { general: SIN_USUARIO_REAL } };

  const d = {
    rut: texto(datos, "rut"),
    nombre: texto(datos, "nombre"),
    celular: texto(datos, "celular"),
    cargo_id: texto(datos, "cargo_id"),
    hostal_id: texto(datos, "hostal_id"),
    empresa_id: texto(datos, "empresa_id"),
    habitacion_id: texto(datos, "habitacion_id"),
    tipo_habitacion: texto(datos, "tipo_habitacion"),
    folio: texto(datos, "folio"),
    grupo: texto(datos, "grupo"),
    turno_habitual: texto(datos, "turno_habitual"),
    fecha_ingreso: texto(datos, "fecha_ingreso"),
    hora_ingreso: texto(datos, "hora_ingreso"),
    fecha_salida_prevista: texto(datos, "fecha_salida_prevista"),
    usa_estacionamiento: marcado(datos, "usa_estacionamiento"),
    patente_vehiculo: texto(datos, "patente_vehiculo"),
    numero_llave: texto(datos, "numero_llave"),
    numero_chip: texto(datos, "numero_chip"),
    observaciones: texto(datos, "observaciones"),
  };

  const errores = validarIngreso(d, hoy());
  if (hayErrores(errores)) return { errores };

  const rut = normalizarRut(d.rut);
  const sql = dbEscritura();

  let estadiaId: number;
  try {
    estadiaId = (await sql.begin(async (tx) => {
      // El cargo se crea a demanda, igual que hace el ETL: son textos libres
      // del Excel que crecen con los datos.
      let cargoId: number | null = d.cargo_id ? Number(d.cargo_id) : null;
      const cargoNuevo = texto(datos, "cargo_nuevo");
      if (!cargoId && cargoNuevo !== "") {
        const [c] = await tx<{ id: number }[]>`
          INSERT INTO core.cargo (nombre) VALUES (${cargoNuevo})
          ON CONFLICT (core.norm_texto(nombre)) DO UPDATE SET nombre = core.cargo.nombre
          RETURNING id
        `;
        cargoId = c.id;
      }

      // La persona puede existir de una estadia anterior o de la carga del
      // Excel. Se actualiza lo que el recepcionista acaba de confirmar, sin
      // borrar lo que ya habia si viene vacio.
      const [persona] = await tx<{ id: number }[]>`
        INSERT INTO core.persona (rut_normalizado, rut_valido, nombre, celular, cargo_id)
        VALUES (${rut}, true, ${d.nombre}, ${oNulo(d.celular)}, ${cargoId})
        ON CONFLICT (rut_normalizado) WHERE rut_normalizado IS NOT NULL
        DO UPDATE SET nombre   = EXCLUDED.nombre,
                      celular  = COALESCE(EXCLUDED.celular, core.persona.celular),
                      cargo_id = COALESCE(EXCLUDED.cargo_id, core.persona.cargo_id)
        RETURNING id
      `;

      const [estadia] = await tx<{ id: number }[]>`
        INSERT INTO core.estadia (
            persona_id, empresa_id, hostal_id, habitacion_id,
            folio, tipo_habitacion, grupo, turno_habitual,
            fecha_ingreso, hora_ingreso, fecha_salida_prevista,
            usa_estacionamiento, patente_vehiculo,
            numero_llave, numero_chip,
            llaves_devueltas, chip_devuelto,
            observaciones, origen, registrado_por)
        VALUES (
            ${persona.id}, ${Number(d.empresa_id)}, ${Number(d.hostal_id)},
            ${Number(d.habitacion_id)},
            ${oNulo(d.folio)}, ${oNulo(d.tipo_habitacion)}, ${oNulo(d.grupo)},
            ${d.turno_habitual},
            ${d.fecha_ingreso}, ${d.hora_ingreso}, ${d.fecha_salida_prevista},
            ${d.usa_estacionamiento}, ${oNulo(d.patente_vehiculo)},
            ${oNulo(d.numero_llave)}, ${oNulo(d.numero_chip)},
            -- La llave sale con el huesped: queda pendiente hasta que la
            -- devuelva. El chip solo si de verdad se entrego uno.
            'NO_ENTREGADA',
            ${d.numero_chip !== "" ? "NO_ENTREGADA" : "NO_APLICA"},
            ${oNulo(d.observaciones)}, 'WEB', ${idUsuario(sesion)})
        RETURNING id
      `;

      return estadia.id;
    })) as number;
  } catch (e) {
    return { errores: traducirError(e) };
  }

  refrescarTodo();
  redirect(`/?ok=ingreso&estadia=${estadiaId}`);
}

/* ==========================================================================
   Salida
   ========================================================================== */

export async function registrarSalida(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  const sesion = await sesionActual();
  if (idUsuario(sesion) === null) return { errores: { general: SIN_USUARIO_REAL } };

  const estadiaId = Number(texto(datos, "estadia_id"));
  if (!estadiaId) return { errores: { general: "Estadia no valida." } };

  const d = {
    fecha_salida: texto(datos, "fecha_salida"),
    hora_salida: texto(datos, "hora_salida"),
    llaves_devueltas: texto(datos, "llaves_devueltas"),
    llaves_devueltas_en: texto(datos, "llaves_devueltas_en"),
    chip_devuelto: texto(datos, "chip_devuelto"),
    chip_devuelto_en: texto(datos, "chip_devuelto_en"),
    motivo_salida_id: texto(datos, "motivo_salida_id"),
    motivo_salida_detalle: texto(datos, "motivo_salida_detalle"),
    observaciones: texto(datos, "observaciones"),
  };

  // El contexto sale de la BASE, no del formulario: el navegador podria mandar
  // cualquier fecha de ingreso y con ella burlar las comprobaciones.
  const lectura = db();
  const [estadia] = await lectura<
    {
      fecha_ingreso: string;
      fecha_salida_prevista: string | null;
      numero_chip: string | null;
    }[]
  >`
    SELECT to_char(fecha_ingreso, 'YYYY-MM-DD')         AS fecha_ingreso,
           to_char(fecha_salida_prevista, 'YYYY-MM-DD') AS fecha_salida_prevista,
           numero_chip
    FROM core.estadia
    WHERE id = ${estadiaId} AND fecha_salida IS NULL AND origen = 'WEB'
  `;
  if (!estadia) {
    return { errores: { general: "Esa estadia ya esta cerrada o no existe." } };
  }

  // El motivo tiene que existir y estar activo: que el desplegable solo
  // ofreciera los validos no basta, el formulario se puede editar.
  const [motivo] = await lectura<
    { id: number; solo_anticipada: boolean; exige_detalle: boolean; es_temporal: boolean }[]
  >`
    SELECT id, solo_anticipada, exige_detalle, es_temporal
    FROM core.motivo_salida
    WHERE id = ${Number(d.motivo_salida_id) || 0} AND activo
  `;
  if (d.motivo_salida_id && !motivo) {
    return { errores: { motivo_salida_id: "Ese motivo ya no esta disponible. Elige otro." } };
  }

  const errores = validarSalida(d, {
    hoy: hoy(),
    fecha_ingreso: estadia.fecha_ingreso,
    fecha_salida_prevista: estadia.fecha_salida_prevista,
    tiene_chip: estadia.numero_chip !== null,
    motivo_exige_detalle: motivo?.exige_detalle ?? false,
    motivo_solo_anticipada: motivo?.solo_anticipada ?? false,
  });
  if (hayErrores(errores)) return { errores };

  const anticipada = esAnticipada(d.fecha_salida, estadia.fecha_salida_prevista);
  const sql = dbEscritura();

  try {
    await sql.begin(async (tx) => {
      await tx`
        UPDATE core.estadia SET
            fecha_salida          = ${d.fecha_salida},
            hora_salida           = ${d.hora_salida},
            motivo_salida_id      = ${Number(d.motivo_salida_id)},
            motivo_salida_detalle = ${oNulo(d.motivo_salida_detalle)},
            llaves_devueltas      = ${d.llaves_devueltas},
            llaves_devueltas_en   = ${d.llaves_devueltas === "ENTREGADA" ? d.llaves_devueltas_en : null},
            chip_devuelto         = ${estadia.numero_chip ? d.chip_devuelto : "NO_APLICA"},
            chip_devuelto_en      = ${estadia.numero_chip && d.chip_devuelto === "ENTREGADA" ? d.chip_devuelto_en : null},
            -- Se agrega a lo que ya hubiera, no lo reemplaza: lo anotado al
            -- ingreso sigue siendo cierto despues de la salida.
            observaciones         = NULLIF(TRIM(BOTH chr(10) FROM TRIM(
                                       COALESCE(observaciones, '') || chr(10) || ${d.observaciones})), ''),
            salida_registrada_por = ${idUsuario(sesion)}
        WHERE id = ${estadiaId} AND fecha_salida IS NULL
      `;

      // La bitacora guarda el porque en su propia fila, con fecha. Es lo que
      // hoy se escribe suelto en la columna MOTIVO de la hoja diaria.
      if (d.motivo_salida_detalle !== "" || anticipada) {
        await tx`
          INSERT INTO core.estadia_evento (estadia_id, fecha, tipo, detalle)
          VALUES (${estadiaId}, ${d.fecha_salida}, 'AVISO_SALIDA',
                  ${(anticipada ? "Salida anticipada. " : "") + d.motivo_salida_detalle})
        `;
      }
    });
  } catch (e) {
    return { errores: traducirError(e) };
  }

  refrescarTodo();
  redirect(`/?ok=salida&estadia=${estadiaId}`);
}

/* ==========================================================================
   Ausencia
   ========================================================================== */

export async function registrarAusencia(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  const sesion = await sesionActual();
  const estadiaId = Number(texto(datos, "estadia_id"));
  if (!estadiaId) return { errores: { general: "Estadia no valida." } };

  const d = {
    tipo_id: texto(datos, "tipo_id"),
    desde: texto(datos, "desde"),
    hasta: texto(datos, "hasta"),
    conserva_habitacion: marcado(datos, "conserva_habitacion"),
    detalle: texto(datos, "detalle"),
  };

  const lectura = db();
  const [estadia] = await lectura<{ fecha_ingreso: string }[]>`
    SELECT to_char(fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso
    FROM core.estadia
    WHERE id = ${estadiaId} AND fecha_salida IS NULL AND origen = 'WEB'
  `;
  if (!estadia) {
    return { errores: { general: "Esa estadia ya esta cerrada o no existe." } };
  }

  // Igual que con el motivo de salida: el tipo se vuelve a comprobar contra el
  // catalogo, activo incluido.
  const [tipo] = await lectura<{ id: number; exige_detalle: boolean }[]>`
    SELECT id, exige_detalle FROM core.tipo_ausencia
    WHERE id = ${Number(d.tipo_id) || 0} AND activo
  `;
  if (d.tipo_id && !tipo) {
    return { errores: { tipo_id: "Ese motivo ya no esta disponible. Elige otro." } };
  }

  const errores = validarAusencia(d, {
    hoy: hoy(),
    fecha_ingreso: estadia.fecha_ingreso,
    tipo_exige_detalle: tipo?.exige_detalle ?? false,
  });
  if (hayErrores(errores)) return { errores };

  try {
    await dbEscritura()`
      INSERT INTO core.estadia_ausencia
          (estadia_id, tipo_id, desde, hasta, conserva_habitacion, detalle, registrado_por)
      VALUES (${estadiaId}, ${Number(d.tipo_id)}, ${d.desde}, ${oNulo(d.hasta)},
              ${d.conserva_habitacion}, ${oNulo(d.detalle)}, ${idUsuario(sesion)})
    `;
  } catch (e) {
    return { errores: traducirError(e) };
  }

  refrescarTodo();
  redirect(`/?ok=ausencia&estadia=${estadiaId}`);
}

/**
 * El huesped volvio. Hay dos casos y son distintos de verdad:
 *
 *  - Se fue hace dias: la ausencia se cierra en AYER, porque la noche de hoy ya
 *    la duerme aqui y hay que cobrarla.
 *  - Se fue HOY y ya volvio: entonces no hubo ausencia. Cerrarla en ayer daria
 *    un rango invertido, y dejarla cubriendo hoy descontaria una noche que si
 *    se durmio. Se borra, que es lo unico cierto.
 *
 * El borrado esta acotado a ese caso -`desde >= hoy`-: una ausencia de la
 * semana pasada solo se puede cerrar, nunca hacer desaparecer.
 */
export async function registrarRegreso(datos: FormData): Promise<void> {
  await sesionActual();
  const ausenciaId = Number(String(datos.get("ausencia_id") ?? ""));
  if (!ausenciaId) return;

  const sql = dbEscritura();
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM core.estadia_ausencia
       WHERE id = ${ausenciaId} AND hasta IS NULL AND desde >= core.hoy()
    `;
    await tx`
      UPDATE core.estadia_ausencia
         SET hasta = core.hoy() - 1
       WHERE id = ${ausenciaId} AND hasta IS NULL AND desde < core.hoy()
    `;
  });

  refrescarTodo();
  redirect("/?ok=regreso");
}

/* ==========================================================================
   Administracion: usuarios
   ========================================================================== */

export async function crearUsuario(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  await soloAdmin();

  const usuario = texto(datos, "usuario").toLowerCase();
  const nombre = texto(datos, "nombre");
  const clave = String(datos.get("clave") ?? "");
  const rol = texto(datos, "rol") === "ADMIN" ? "ADMIN" : "RECEPCION";
  const hostalId = texto(datos, "hostal_id");

  const errores: Errores = {};
  if (!/^[a-z0-9._-]{3,20}$/.test(usuario)) {
    errores.usuario =
      "El usuario va en minusculas, sin espacios ni acentos, de 3 a 20 caracteres.";
  }
  if (nombre === "") errores.nombre = "Falta el nombre de la persona.";
  if (clave.length < 8) errores.clave = "La clave debe tener al menos 8 caracteres.";
  if (hayErrores(errores)) return { errores };

  try {
    await dbEscritura()`
      INSERT INTO core.usuario (usuario, nombre, clave_hash, rol, hostal_id)
      VALUES (${usuario}, ${nombre}, ${await hashear(clave)}, ${rol},
              ${hostalId ? Number(hostalId) : null})
    `;
  } catch (e) {
    return { errores: traducirError(e) };
  }

  refrescarTodo();
  return { mensaje: `Usuario ${usuario} creado.` };
}

export async function cambiarClave(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  await soloAdmin();
  const id = Number(texto(datos, "id"));
  const clave = String(datos.get("clave") ?? "");
  if (clave.length < 8) {
    return { errores: { clave: "La clave debe tener al menos 8 caracteres." } };
  }
  await dbEscritura()`
    UPDATE core.usuario SET clave_hash = ${await hashear(clave)} WHERE id = ${id}
  `;
  refrescarTodo();
  return { mensaje: "Clave cambiada." };
}

/** Nunca se borra un usuario: se desactiva, y sus registros siguen atribuidos. */
export async function alternarUsuario(datos: FormData): Promise<void> {
  await soloAdmin();
  const id = Number(String(datos.get("id") ?? ""));
  if (!id) return;
  await dbEscritura()`
    UPDATE core.usuario SET activo = NOT activo WHERE id = ${id}
  `;
  refrescarTodo();
}

/* ==========================================================================
   Administracion: catalogos
   ========================================================================== */

export async function crearMotivoSalida(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  await soloAdmin();
  const nombre = texto(datos, "nombre");
  if (nombre === "") return { errores: { nombre: "Falta el nombre del motivo." } };

  try {
    await dbEscritura()`
      INSERT INTO core.motivo_salida (codigo, nombre, solo_anticipada, exige_detalle, es_temporal, orden)
      VALUES (${codigoDesde(nombre)}, ${nombre},
              ${marcado(datos, "solo_anticipada")},
              ${marcado(datos, "exige_detalle")},
              ${marcado(datos, "es_temporal")},
              ${Number(texto(datos, "orden")) || 500})
    `;
  } catch (e) {
    return { errores: traducirError(e) };
  }
  refrescarTodo();
  return { mensaje: `Motivo "${nombre}" agregado.` };
}

export async function crearTipoAusencia(
  _previo: Estado,
  datos: FormData,
): Promise<Estado> {
  await soloAdmin();
  const nombre = texto(datos, "nombre");
  if (nombre === "") return { errores: { nombre: "Falta el nombre del motivo." } };

  try {
    await dbEscritura()`
      INSERT INTO core.tipo_ausencia (codigo, nombre, conserva_habitacion, exige_detalle, orden)
      VALUES (${codigoDesde(nombre)}, ${nombre},
              ${marcado(datos, "conserva_habitacion")},
              ${marcado(datos, "exige_detalle")},
              ${Number(texto(datos, "orden")) || 500})
    `;
  } catch (e) {
    return { errores: traducirError(e) };
  }
  refrescarTodo();
  return { mensaje: `Tipo de ausencia "${nombre}" agregado.` };
}

/**
 * Desactiva o reactiva una opcion. No hay borrado: si se borrara, las estadias
 * y ausencias que ya la usan se quedarian sin motivo.
 */
export async function alternarOpcion(datos: FormData): Promise<void> {
  await soloAdmin();
  const id = Number(String(datos.get("id") ?? ""));
  const tabla = String(datos.get("tabla") ?? "");
  if (!id) return;

  const sql = dbEscritura();
  // Sin interpolar el nombre de tabla en el SQL: dos ramas explicitas.
  if (tabla === "motivo_salida") {
    await sql`UPDATE core.motivo_salida SET activo = NOT activo WHERE id = ${id}`;
  } else if (tabla === "tipo_ausencia") {
    await sql`UPDATE core.tipo_ausencia SET activo = NOT activo WHERE id = ${id}`;
  } else {
    return;
  }
  refrescarTodo();
}

/**
 * 'Permiso sindical' -> 'PERMISO_SINDICAL'. El codigo es estable y lo usa el
 * codigo; el nombre lo puede reescribir un ADMIN cuando quiera.
 *
 * Reutiliza norm() de lib/filtros, que ya espeja core.norm_texto: mayusculas,
 * sin acentos y sin espacios repetidos.
 */
function codigoDesde(nombre: string): string {
  return norm(nombre)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}
