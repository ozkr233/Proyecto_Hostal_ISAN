import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/**
 * IBM Plex: una superfamilia de origen industrial, no la neutralidad de
 * fabrica de system-ui. Encaja con lo que esto administra -alojamiento para
 * faenas- y le da al panel una voz propia.
 *
 * next/font las auto-hospeda en la build: no hay peticion a fonts.googleapis
 * en tiempo de ejecucion, que es lo que piden tanto la CSP como el uso con
 * conexion mala en el meson.
 */
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--plex-sans",
  display: "swap",
});

/** Solo para RUT y folio: identificadores que se cotejan caracter a caracter. */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Registro de hostales",
  description:
    "Ocupacion, pension y registro oficial de los hostales ISAM y ALMAR WATER.",
};

// Aplica el tema guardado antes del primer pintado; sin esto la pagina
// parpadea en claro antes de pasar a oscuro.
const temaTemprano = `try{var t=localStorage.getItem("tema");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function LayoutRaiz({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaTemprano }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
