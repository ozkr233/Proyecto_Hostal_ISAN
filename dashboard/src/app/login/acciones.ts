"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { claveCorrecta } from "@/lib/password";
import { COOKIE, DURACION_SEGUNDOS, firmarSesion } from "@/lib/sesion";

export type EstadoLogin = { error?: string };

/** Solo rutas internas: evita que ?destino=https://otro.sitio sirva de trampolin. */
function destinoSeguro(valor: string): string {
  return valor.startsWith("/") && !valor.startsWith("//") ? valor : "/";
}

export async function entrar(
  _previo: EstadoLogin,
  datos: FormData,
): Promise<EstadoLogin> {
  const clave = String(datos.get("clave") ?? "");
  const destino = destinoSeguro(String(datos.get("destino") ?? "/"));

  // Retardo fijo en todo intento: encarece el tanteo por fuerza bruta.
  await new Promise((r) => setTimeout(r, 400));

  if (!(await claveCorrecta(clave))) {
    return { error: "Clave incorrecta." };
  }

  const galletas = await cookies();
  galletas.set(COOKIE, await firmarSesion(), {
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
