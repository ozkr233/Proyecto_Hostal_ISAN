import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BotonTema, MarcaLibro, SelectorArea, Usuario } from "@/components/cabecera";
import { COOKIE, leerSesion } from "@/lib/sesion";

/**
 * El area de recepcion no usa DatosProvider ni el cache de cinco minutos de
 * queries.ts: quien esta en el mesón necesita ver la habitacion que se acaba de
 * ocupar, no una foto de hace un rato.
 */
export const dynamic = "force-dynamic";

export default async function LayoutRecepcion({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await leerSesion((await cookies()).get(COOKIE)?.value);
  if (!sesion) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-plano border-b border-borde">
        <div className="px-4 py-2.5 flex items-center gap-3">
          <MarcaLibro />
          <div className="min-w-0">
            <h1 className="text-[13.5px] font-semibold tracking-tight leading-tight">
              Recepcion
            </h1>
            <p className="text-[11px] text-tinta-3 leading-tight">
              ISAM · ALMAR WATER
            </p>
          </div>

          <div className="ml-3">
            <SelectorArea />
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {sesion.rol === "ADMIN" ? (
              <>
                <Link
                  href="/usuarios"
                  className="h-7 px-2 grid place-items-center rounded-md border border-borde
                             text-[11.5px] text-tinta-2 hover:bg-superficie-2 transition-colors"
                >
                  Usuarios
                </Link>
                <Link
                  href="/catalogos"
                  className="h-7 px-2 grid place-items-center rounded-md border border-borde
                             text-[11.5px] text-tinta-2 hover:bg-superficie-2 transition-colors"
                >
                  Motivos
                </Link>
              </>
            ) : null}
            <BotonTema />
            <Usuario nombre={sesion.nombre} rol={sesion.rol} />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 w-full max-w-[860px] mx-auto">{children}</main>
    </div>
  );
}
