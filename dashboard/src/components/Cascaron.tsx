"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { refrescar } from "@/app/panel/acciones";
import type { Rol } from "@/lib/sesion";
import { BarraFiltros } from "./BarraFiltros";
import { MarcaLibro, MenuCuenta } from "./cabecera";

const RUTAS = [
  { href: "/panel", texto: "Mes" },
  { href: "/panel/registro", texto: "Registro" },
  { href: "/panel/ocupacion", texto: "Ocupacion" },
  { href: "/panel/estadias", texto: "Huespedes" },
  { href: "/panel/servicios", texto: "Servicios" },
];

/**
 * La cabecera. Antes competian ocho cosas a la vez -marca, titulo, subtitulo,
 * conmutador de area, Actualizar, Datos, tema, usuario y salir-. Ahora solo
 * quedan a la vista la marca y la navegacion; lo demas vive en el menu de la
 * cuenta, que se abre una vez cada tanto y no cada minuto.
 */
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
        <div className="px-6 h-[57px] flex items-center gap-5">
          <Link
            href="/panel"
            className="flex items-center gap-2.5 shrink-0"
            title="Registro de hostales ISAM y ALMAR WATER"
          >
            <MarcaLibro />
            <span className="font-semibold tracking-tight hidden lg:inline">
              Hostales
            </span>
          </Link>

          <nav className="flex overflow-x-auto scroll-fino">
            {RUTAS.map((r) => {
              const activo = ruta === r.href;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  aria-current={activo ? "page" : undefined}
                  className={`relative px-3 h-[57px] flex items-center whitespace-nowrap
                              transition-colors ${
                                activo
                                  ? "text-tinta font-medium"
                                  : "text-tinta-2 hover:text-tinta"
                              }`}
                >
                  {r.texto}
                  {activo ? (
                    <span
                      aria-hidden
                      className="absolute left-3 right-3 bottom-0 h-[2px] bg-acento"
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto shrink-0">
            <MenuCuenta
              nombre={nombre}
              rol={rol}
              cargando={cargando}
              onActualizar={() =>
                iniciar(async () => {
                  await refrescar();
                  router.refresh();
                })
              }
            />
          </div>
        </div>
      </header>

      <BarraFiltros />

      <main className="flex-1 px-6 py-7">{children}</main>
    </div>
  );
}
