import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Formato del hash: "<salt hex>:<derivada hex>". Es el que guarda
 * core.usuario.clave_hash y tambien el de DASHBOARD_PASSWORD_HASH.
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

/** Compara una clave contra un hash almacenado. */
export async function verificarClave(
  clave: string,
  almacenado: string | undefined,
): Promise<boolean> {
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

/**
 * Clave de emergencia de DASHBOARD_PASSWORD_HASH. Sirve para entrar como ADMIN
 * cuando core.usuario todavia esta vacia -o cuando alguien se quedo afuera- y
 * poder crear usuarios desde /usuarios. Si la variable no esta definida, esta
 * puerta simplemente no existe.
 */
export async function claveDeEmergenciaCorrecta(clave: string): Promise<boolean> {
  return verificarClave(clave, process.env.DASHBOARD_PASSWORD_HASH);
}
