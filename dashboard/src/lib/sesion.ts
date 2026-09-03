import { SignJWT, jwtVerify } from "jose";

/**
 * Solo `jose`, nada de node:crypto: este modulo lo importa el middleware, que
 * corre en el runtime Edge. La verificacion de la clave vive aparte, en
 * password.ts, porque scrypt si necesita Node.
 */
export const COOKIE = "sesion_hostal";
const DURACION = "7d";

export type Rol = "RECEPCION" | "ADMIN";

/**
 * Lo que viaja en la cookie. Es el unico lugar del que salen `registrado_por` y
 * `salida_registrada_por`: el navegador nunca manda quien es, porque entonces
 * podria mentir.
 */
export type Sesion = {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  hostal_id: number | null;
};

function secreto(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "Falta AUTH_SECRET, o tiene menos de 32 caracteres. " +
        "Generalo con: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return new TextEncoder().encode(s);
}

export async function firmarSesion(sesion: Sesion): Promise<string> {
  return new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACION)
    .sign(secreto());
}

/** El payload de la cookie, o null si falta, expiro o la firma no cuadra. */
export async function leerSesion(
  token: string | undefined,
): Promise<Sesion | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secreto(), {
      algorithms: ["HS256"],
    });
    // Un token viejo -de antes de que existieran los usuarios- no trae id.
    // No se acepta a medias: se trata como sesion invalida y se vuelve a entrar.
    if (typeof payload.id !== "number" || typeof payload.usuario !== "string") {
      return null;
    }
    return {
      id: payload.id,
      usuario: payload.usuario,
      nombre: String(payload.nombre ?? payload.usuario),
      rol: payload.rol === "ADMIN" ? "ADMIN" : "RECEPCION",
      hostal_id:
        typeof payload.hostal_id === "number" ? payload.hostal_id : null,
    };
  } catch {
    return null;
  }
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  return (await leerSesion(token)) !== null;
}

export const DURACION_SEGUNDOS = 7 * 24 * 60 * 60;
