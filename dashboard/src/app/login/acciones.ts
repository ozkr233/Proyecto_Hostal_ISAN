"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, dbEscritura } from "@/lib/db";
import { claveDeEmergenciaCorrecta, verificarClave } from "@/lib/password";
import {
  COOKIE,
  DURACION_SEGUNDOS,
  firmarSesion,
  type Rol,
  type Sesion,
} from "@/lib/sesion";

export type EstadoLogin = { error?: string };

/** Solo rutas internas: evita que ?destino=https://otro.sitio sirva de trampolin. */
function destinoSeguro(valor: string): string {
  return valor.startsWith("/") && !valor.startsWith("//") ? valor : "/";
}

type FilaUsuario = {
  id: number;
  usuario: string;
  nombre: string;
  clave_hash: string;
  rol: Rol;
  hostal_id: number | null;
};

export async function entrar(
  _previo: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const usuario = String(datos.get("usuario") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");
  const destino = destinoSeguro(String(datos.get("destino") ?? "/"));

  // Retardo fijo en todo intento: encarece el tanteo por fuerza bruta.
  await new Promise((r) => setTimeout(r, 400));

  if (usuario === "" || clave === "") {
    return { error: "Escribe tu usuario y tu clave." };
  }

  const sql = db();
  const filas = await sql<FilaUsuario[]>`
    SELECT id, usuario, nombre, clave_hash, rol::text AS rol, hostal_id
    FROM core.usuario
    WHERE lower(usuario) = lower(${usuario}) AND activo
  `;
  const fila = filas[0];

  let sesion: Sesion | null = null;

  if (fila && (await verificarClave(clave, fila.clave_hash))) {
    sesion = {
      id: fila.id,
      usuario: fila.usuario,
      nombre: fila.nombre,
      rol: fila.rol,
      hostal_id: fila.hostal_id,
    };
  } else if (!fila && (await claveDeEmergenciaCorrecta(clave))) {
    // Puerta de emergencia de DASHBOARD_PASSWORD_HASH: sirve para entrar la
    // primera vez, cuando core.usuario todavia esta vacia, y crear usuarios de
    // verdad desde /usuarios. id 0 no existe en la tabla, asi que lo que haga
    // no queda atribuido a nadie: es a proposito, para que se note.
    sesion = {
      id: 0,
      usuario,
      nombre: "Administrador",
      rol: "ADMIN",
      hostal_id: null,
    };
  }

  if (!sesion) {
    // Un solo mensaje para usuario inexistente y clave mala: decir cual de las
    // dos fallo es regalar la mitad del trabajo a quien tantea.
    return { error: "Usuario o clave incorrectos." };
  }

  if (sesion.id > 0) {
    // Sello de ultimo acceso. Si falla no se bloquea la entrada: es un dato de
    // apoyo, no parte de la autenticacion.
    try {
      await dbEscritura()`
        UPDATE core.usuario SET ultimo_acceso = now() WHERE id = ${sesion.id}
      `;
    } catch {
      /* sin ruido: entrar es mas importante que registrar cuando se entro */
    }
  }

  const galletas = await cookies();
  galletas.set(COOKIE, await firmarSesion(sesion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_SEGUNDOS,
  });

  redirect(destino);
}

export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
