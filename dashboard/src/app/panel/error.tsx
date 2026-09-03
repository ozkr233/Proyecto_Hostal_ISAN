"use client";

export default function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen grid place-items-center px-6">
      <div className="tarjeta p-5 max-w-[460px]">
        <h1 className="text-[15px] font-semibold mb-1">
          No se pudo leer la base
        </h1>
        <p className="text-tinta-2 leading-relaxed mb-3">
          El dashboard no escribe nada, asi que no hay datos a medio guardar.
          Las causas habituales, en orden:
        </p>
        <ul className="text-tinta-2 leading-relaxed list-disc pl-4 mb-4 flex flex-col gap-1">
          <li>
            El proyecto de Supabase esta en pausa. Los planes free se pausan
            tras una semana sin uso; se reactiva desde su panel.
          </li>
          <li>
            <code className="codigo">DATABASE_URL</code> falta o quedo mal. Debe
            apuntar al transaction pooler, puerto 6543.
          </li>
        </ul>
        <p className="text-[11.5px] text-tinta-3 font-mono break-words mb-4">
          {error.message}
        </p>
        <button
          type="button"
          onClick={reset}
          className="h-8 px-3 rounded-md bg-acento text-acento-tinta font-semibold text-[12.5px]"
        >
          Reintentar
        </button>
      </div>
    </main>
  );
}
