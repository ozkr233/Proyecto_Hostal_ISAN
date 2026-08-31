import { SignJWT, jwtVerify } from "jose";

/**
 * Solo `jose`, nada de node:crypto: este modulo lo importa el middleware, que
 * corre en el runtime Edge. La verificacion de la clave vive aparte, en
 * password.ts, porque scrypt si necesita Node.
 */
export const COOKIE = "sesion_hostal";
const DURACION = "7d";

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

export async function firmarSesion(): Promise<string> {
  return new SignJWT({ rol: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(DURACION)
    .sign(secreto());
}

export async function sesionValida(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secreto(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export const DURACION_SEGUNDOS = 7 * 24 * 60 * 60;
