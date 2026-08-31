// Genera el valor de DASHBOARD_PASSWORD_HASH.
//   node scripts/hash.mjs "la clave que quieras"
import { randomBytes, scrypt } from "node:crypto";

const clave = process.argv[2];
if (!clave) {
  console.error('Uso: node scripts/hash.mjs "<clave>"');
  process.exit(1);
}

const sal = randomBytes(16);
scrypt(clave.normalize("NFKC"), sal, 64, (err, derivada) => {
  if (err) throw err;
  console.log("DASHBOARD_PASSWORD_HASH=" + sal.toString("hex") + ":" + derivada.toString("hex"));
  console.log("AUTH_SECRET=" + randomBytes(32).toString("hex"));
});
