"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { salir } from "@/app/login/acciones";
import type { Rol } from "@/lib/sesion";

/* --------------------------------------------------------------------------
   Piezas compartidas por las dos areas: el mesón de recepcion y el panel.
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
    `px-2.5 h-7 grid place-items-center rounded text-[12px] transition-colors ${
      activo
        ? "bg-superficie text-tinta font-medium shadow-sm"
        : "text-tinta-3 hover:text-tinta-2"
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
        Dashboard
      </Link>
    </div>
  );
}

/** Quien esta usando el sistema, y el boton de salir. */
export function Usuario({ nombre, rol }: { nombre: string; rol: Rol }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[11.5px] text-tinta-3 hidden sm:inline max-w-[16ch] truncate"
        title={rol === "ADMIN" ? `${nombre} (administrador)` : nombre}
      >
        {nombre}
      </span>
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
  );
}
