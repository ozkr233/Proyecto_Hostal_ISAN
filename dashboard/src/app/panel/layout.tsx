import { Cascaron } from "@/components/Cascaron";
import { DatosProvider } from "@/components/DatosProvider";
import { obtenerDatos } from "@/lib/queries";

// Se consulta en cada peticion y el cache de 5 minutos vive en el proceso.
// Asi `next build` no necesita base de datos.
export const dynamic = "force-dynamic";

export default async function LayoutPanel({
  children,
}: {
  children: React.ReactNode;
}) {
  const datos = await obtenerDatos();
  return (
    <DatosProvider datos={datos}>
      <Cascaron>{children}</Cascaron>
    </DatosProvider>
  );
}
