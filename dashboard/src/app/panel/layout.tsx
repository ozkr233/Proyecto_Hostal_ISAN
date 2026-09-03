import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Cascaron } from "@/components/Cascaron";
import { DatosProvider } from "@/components/DatosProvider";
import { obtenerDatos } from "@/lib/queries";
import { COOKIE, leerSesion } from "@/lib/sesion";

// Se consulta en cada peticion y el cache de 5 minutos vive en el proceso.
// Asi `next build` no necesita base de datos.
export const dynamic = "force-dynamic";

export default async function LayoutPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  // El middleware ya bloqueo el paso sin sesion; esto es para saber QUIEN es y
  // para no quedarse sin nombre si la cookie caduco entre medio.
  const sesion = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!sesion) redirect("/login?destino=/panel");

  const datos = await obtenerDatos();
  return (
    <DatosProvider datos={datos}>
      <Cascaron nombre={sesion.nombre} rol={sesion.rol}>
        {children}
      </Cascaron>
    </DatosProvider>
  );
}
