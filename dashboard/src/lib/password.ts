import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Formato almacenado en DASHBOARD_PASSWORD_HASH: "<salt hex>:<derivada hex>".
 * Solo se usa desde Server Actions (runtime Node), nunca desde el middleware.
 */
const LARGO = 64;

function derivar(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(clave.normalize("NFKC"), sal, LARGO, (err, derivada) =>
      err ? rechazar(err) : resolver(derivada),
    );
  });
}

export async function hashear(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = await derivar(clave, sal);
  return `${sal.toString("hex")}:${derivada.toString("hex")}`;
}

export async function claveCorrecta(clave: string): Promise<boolean> {
  const almacenado = process.env.DASHBOARD_PASSWORD_HASH;
  if (!almacenado) return false;

  const [salHex, hashHex] = almacenado.split(":");
  if (!salHex || !hashHex) return false;

  let esperado: Buffer;
  try {
    esperado = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (esperado.length !== LARGO) return false;

  const obtenido = await derivar(clave, Buffer.from(salHex, "hex"));
  // Comparacion en tiempo constante: ambos buffers miden LARGO, asi que
  // timingSafeEqual nunca lanza por longitudes distintas.
  return timingSafeEqual(esperado, obtenido);
}
