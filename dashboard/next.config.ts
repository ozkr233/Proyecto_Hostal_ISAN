import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres.js es un paquete de Node puro; que no lo intente empaquetar.
  serverExternalPackages: ["postgres"],
  // Sin esto Next sube por el arbol buscando lockfiles y elige la carpeta del
  // usuario como raiz, lo que rompe el rastreo de archivos al desplegar.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
