import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Registro de hostales — ISAM / ALMAR WATER",
  description:
    "Ocupacion, pension y registro oficial del hostal, calculados sobre la base y no sobre formulas escritas a mano.",
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: temaTemprano }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
