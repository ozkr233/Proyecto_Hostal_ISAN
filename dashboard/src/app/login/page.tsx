import { FormularioLogin } from "./FormularioLogin";

export const dynamic = "force-dynamic";

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>;
}) {
  const { destino } = await searchParams;

  return (
    <main className="min-h-screen grid place-items-center px-6 py-16">
      <div className="w-full max-w-[340px]">
        <div className="flex items-end gap-2 mb-1">
          <span className="marca marca-D">D</span>
          <span className="marca marca-N">N</span>
          <span className="marca marca-E">E</span>
        </div>
        <h1 className="text-[19px] font-semibold tracking-tight mt-4">
          Registro de hostales
        </h1>
        <p className="text-tinta-2 mt-1 mb-7 leading-relaxed">
          ISAM y ALMAR WATER. Ocupacion, pension y registro oficial.
        </p>
        <FormularioLogin destino={destino ?? "/"} />
      </div>
    </main>
  );
}
