"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { salir } from "@/app/login/acciones";
import { refrescar } from "@/app/(panel)/acciones";
import { BarraFiltros } from "./BarraFiltros";

const RUTAS = [
  { href: "/", texto: "Resumen" },
  { href: "/estadias", texto: "Estadias" },
  { href: "/registro", texto: "Registro oficial" },
  { href: "/servicios", texto: "Servicios" },
  { href: "/personas", texto: "Personas" },
  { href: "/calidad", texto: "Calidad" },
];

function BotonTema() {
  const [tema, setTema] = useState<"claro" | "oscuro" | null>(null);

  useEffect(() => {
    const guardado = localStorage.getItem("tema");
    if (guardado === "dark") setTema("oscuro");
    else if (guardado === "light") setTema("claro");
    else
      setTema(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "oscuro"
          : "claro",
      );
  }, []);

  const cambiar = () => {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    const valor = nuevo === "oscuro" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", valor);
    localStorage.setItem("tema", valor);
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      title={tema === "oscuro" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="h-7 w-7 grid place-items-center rounded-md border border-borde
                 text-tinta-2 hover:bg-superficie-2 transition-colors"
    >
      <span aria-hidden className="text-[12px]">
        {tema === "oscuro" ? "☀" : "☾"}
      </span>
      <span className="sr-only">Cambiar tema</span>
    </button>
  );
}

export function Cascaron({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const router = useRouter();
  const [cargando, iniciar] = useTransition();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-plano border-b border-borde">
        <div className="px-4 pt-2.5 pb-2 flex items-center gap-3">
          {/* La marca del libro: cada celda de R. OFICIAL es una letra. */}
          <span aria-hidden className="flex gap-[3px]">
            <span className="marca marca-D">D</span>
            <span className="marca marca-N">N</span>
            <span className="marca marca-E">E</span>
          </span>
          <div className="min-w-0">
            <h1 className="text-[13.5px] font-semibold tracking-tight leading-tight">
              Registro de hostales
            </h1>
            <p className="text-[11px] text-tinta-3 leading-tight">
              ISAM · ALMAR WATER
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              disabled={cargando}
              onClick={() =>
                iniciar(async () => {
                  await refrescar();
                  router.refresh();
                })
              }
              className="h-7 px-2 rounded-md border border-borde text-[11.5px]
                         text-tinta-2 hover:bg-superficie-2 transition-colors
                         disabled:opacity-60"
            >
              {cargando ? "Actualizando…" : "Actualizar"}
            </button>
            <BotonTema />
            <form action={salir}>
              <button
                type="submit"
                className="h-7 px-2 rounded-md border border-borde text-[11.5px]
                           text-tinta-2 hover:bg-superficie-2 transition-colors"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        <nav className="px-4 flex gap-0.5 overflow-x-auto scroll-fino">
          {RUTAS.map((r) => {
            const activo = ruta === r.href;
            return (
              <Link
                key={r.href}
                href={r.href}
                aria-current={activo ? "page" : undefined}
                className={`relative px-2.5 py-1.5 text-[12.5px] whitespace-nowrap rounded-t
                            transition-colors ${
                              activo
                                ? "text-tinta font-medium"
                                : "text-tinta-3 hover:text-tinta-2"
                            }`}
              >
                {r.texto}
                {activo ? (
                  <span
                    aria-hidden
                    className="absolute left-2.5 right-2.5 -bottom-px h-[2px] bg-acento rounded-t"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
      </header>

      <BarraFiltros />

      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
