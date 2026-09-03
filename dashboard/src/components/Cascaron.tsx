"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { refrescar } from "@/app/panel/acciones";
import type { Rol } from "@/lib/sesion";
import { BarraFiltros } from "./BarraFiltros";
import { BotonTema, MarcaLibro, SelectorArea, Usuario } from "./cabecera";

const RUTAS = [
  { href: "/panel", texto: "Resumen" },
  { href: "/panel/estadias", texto: "Estadias" },
  { href: "/panel/registro", texto: "Registro oficial" },
  { href: "/panel/ausencias", texto: "Ausencias" },
  { href: "/panel/servicios", texto: "Servicios" },
  { href: "/panel/personas", texto: "Personas" },
  { href: "/panel/calidad", texto: "Calidad" },
];

export function Cascaron({
  children,
  nombre,
  rol,
}: {
  children: React.ReactNode;
  nombre: string;
  rol: Rol;
}) {
  const ruta = usePathname();
  const router = useRouter();
  const [cargando, iniciar] = useTransition();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-plano border-b border-borde">
        <div className="px-4 pt-2.5 pb-2 flex items-center gap-3">
          <MarcaLibro />
          <div className="min-w-0">
            <h1 className="text-[13.5px] font-semibold tracking-tight leading-tight">
              Registro de hostales
            </h1>
            <p className="text-[11px] text-tinta-3 leading-tight">
              ISAM · ALMAR WATER
            </p>
          </div>

          <div className="ml-3">
            <SelectorArea />
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
            <Usuario nombre={nombre} rol={rol} />
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
