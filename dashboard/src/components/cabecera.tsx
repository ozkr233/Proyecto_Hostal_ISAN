"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { salir } from "@/app/login/acciones";
import type { Rol } from "@/lib/sesion";
import { Menu } from "./ui";

/* --------------------------------------------------------------------------
   Piezas compartidas por las dos areas: el meson de recepcion y el panel.
   -------------------------------------------------------------------------- */

export function BotonTema() {
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
      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-superficie-2
                 flex items-center gap-2.5 transition-colors"
    >
      <span aria-hidden className="w-4 text-center text-tinta-3">
        {tema === "oscuro" ? "☀" : "☾"}
      </span>
      {tema === "oscuro" ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}

/** La marca del libro: cada celda de R. OFICIAL es una letra. */
export function MarcaLibro() {
  return (
    <span aria-hidden className="flex gap-[3px]">
      <span className="marca marca-D">D</span>
      <span className="marca marca-N">N</span>
      <span className="marca marca-E">E</span>
    </span>
  );
}

/**
 * Conmutador entre las dos mitades del sistema. Recepcion escribe; el panel
 * solo lee. Son trabajos distintos y conviene que se vea que lo son.
 */
export function SelectorArea() {
  const ruta = usePathname();
  const enPanel = ruta.startsWith("/panel");

  const clase = (activo: boolean) =>
    `px-3 h-8 grid place-items-center rounded text-[14px] transition-colors ${
      activo
        ? "bg-superficie text-tinta font-medium shadow-sm"
        : "text-tinta-2 hover:text-tinta"
    }`;

  return (
    <div
      role="group"
      aria-label="Area de trabajo"
      className="flex gap-0.5 p-0.5 rounded-md bg-superficie-2 border border-borde"
    >
      <Link href="/" aria-current={!enPanel ? "page" : undefined} className={clase(!enPanel)}>
        Recepcion
      </Link>
      <Link href="/panel" aria-current={enPanel ? "page" : undefined} className={clase(enPanel)}>
        Informes
      </Link>
    </div>
  );
}

/** Quien esta usando el sistema, y el boton de salir. */
export function Usuario({ nombre, rol }: { nombre: string; rol: Rol }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[13px] text-tinta-2 hidden sm:inline max-w-[16ch] truncate"
        title={rol === "ADMIN" ? `${nombre} (administrador)` : nombre}
      >
        {nombre}
      </span>
      <form action={salir}>
        <button
          type="submit"
          className="h-9 px-3 rounded-md border border-borde text-[14px]
                     text-tinta-2 hover:bg-superficie-2 transition-colors"
        >
          Salir
        </button>
      </form>
    </div>
  );
}

/**
 * Todo lo que no es navegar, en un solo sitio: actualizar los datos, ir a la
 * recepcion, revisar la calidad de la carga, cambiar el tema y salir.
 *
 * Estaban los cinco sueltos en la cabecera, compitiendo con las pestanas por
 * la atencion. Ninguno se usa mas de un par de veces al dia.
 */
export function MenuCuenta({
  nombre,
  rol,
  cargando,
  onActualizar,
}: {
  nombre: string;
  rol: Rol;
  cargando: boolean;
  onActualizar: () => void;
}) {
  const item =
    "w-full text-left px-2 py-1.5 rounded-md hover:bg-superficie-2 flex items-center gap-2.5 transition-colors";
  const icono = "w-4 text-center text-tinta-3";

  return (
    <Menu
      resumen={
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-7 w-7 rounded-full bg-superficie-2 border border-borde
                       grid place-items-center text-[13px] font-semibold"
          >
            {nombre.trim().charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:inline max-w-[14ch] truncate text-[14px]">
            {nombre}
          </span>
        </span>
      }
      ancho={230}
      alinear="der"
      sinBorde
    >
      <p className="px-2 pb-1.5 mb-1 border-b border-borde">
        <span className="block truncate font-medium">{nombre}</span>
        <span className="block text-[13px] text-tinta-3">
          {rol === "ADMIN" ? "Administrador" : "Recepcion"}
        </span>
      </p>

      <button type="button" onClick={onActualizar} disabled={cargando} className={item}>
        <span aria-hidden className={icono}>
          {"↻"}
        </span>
        {cargando ? "Actualizando..." : "Actualizar datos"}
      </button>

      <Link href="/" className={item}>
        <span aria-hidden className={icono}>
          {"⌂"}
        </span>
        Ir a recepcion
      </Link>

      <Link href="/panel/calidad" className={item}>
        <span aria-hidden className={icono}>
          {"⚠"}
        </span>
        Revisar la carga
      </Link>

      <BotonTema />

      <form action={salir} className="mt-1 pt-1 border-t border-borde">
        <button type="submit" className={item}>
          <span aria-hidden className={icono}>
            {"→"}
          </span>
          Cerrar sesion
        </button>
      </form>
    </Menu>
  );
}
