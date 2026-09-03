"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* --------------------------------------------------------------------------
   Menu desplegable. Cierra al hacer clic fuera y con Escape, y devuelve el
   foco al disparador: sin eso el teclado queda atrapado en la pagina.

   El panel se dibuja en un PORTAL sobre <body>, con position: fixed. No es
   capricho: los menus de cabecera viven dentro del contenedor con
   `overflow-auto` de la tabla, y un hijo absoluto lo recorta. Con la tabla
   filtrada a dos filas, el desplegable de EMPRESA se cortaba despues de la
   primera opcion. Ademas, cualquier ancestro `sticky` con z-index crea un
   contexto de apilamiento propio, asi que un menu anidado nunca podia
   garantizar quedar por encima del resto. En <body> no hay nada que lo
   recorte ni que lo tape.
   -------------------------------------------------------------------------- */
export function Menu({
  resumen,
  activo,
  children,
  ancho = 240,
  alinear = "izq",
}: {
  resumen: React.ReactNode;
  activo?: boolean;
  children: React.ReactNode;
  ancho?: number;
  alinear?: "izq" | "der";
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxAlto: number }>({
    top: 0,
    left: 0,
    maxAlto: 320,
  });
  const panel = useRef<HTMLDivElement>(null);
  const disparador = useRef<HTMLButtonElement>(null);

  const MARGEN = 8;

  const colocar = useCallback(() => {
    const t = disparador.current?.getBoundingClientRect();
    if (!t) return;

    const left =
      alinear === "der"
        ? Math.max(MARGEN, t.right - ancho)
        : Math.min(t.left, window.innerWidth - ancho - MARGEN);

    // Si abajo no cabe pero arriba si, se abre hacia arriba.
    const abajo = window.innerHeight - t.bottom - MARGEN;
    const arriba = t.top - MARGEN;
    const haciaArriba = abajo < 180 && arriba > abajo;

    setPos({
      top: haciaArriba ? Math.max(MARGEN, t.top - Math.min(320, arriba) - 4) : t.bottom + 4,
      left: Math.max(MARGEN, left),
      maxAlto: Math.min(320, haciaArriba ? arriba : abajo),
    });
  }, [alinear, ancho]);

  // Antes de pintar, para que no se vea saltar desde la esquina.
  useLayoutEffect(() => {
    if (abierto) colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return;

    const fuera = (e: MouseEvent) => {
      const destino = e.target as Node;
      if (
        !panel.current?.contains(destino) &&
        !disparador.current?.contains(destino)
      ) {
        setAbierto(false);
      }
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        disparador.current?.focus();
      }
    };
    // Al ser `fixed`, el panel no sigue solo a su disparador cuando algo se
    // desplaza. `true` para capturar tambien el scroll de la tabla, que no
    // burbujea.
    const seguir = () => colocar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", seguir, true);
    window.addEventListener("resize", seguir);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", seguir, true);
      window.removeEventListener("resize", seguir);
    };
  }, [abierto, colocar]);

  return (
    <>
      <button
        ref={disparador}
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
        className={`h-8 px-2.5 rounded-md border text-[12.5px] flex items-center gap-1.5
                    whitespace-nowrap transition-colors
                    ${
                      activo
                        ? "border-acento bg-acento-suave text-tinta"
                        : "border-borde bg-superficie hover:bg-superficie-2 text-tinta-2"
                    }`}
      >
        {resumen}
        <span aria-hidden className="text-tinta-3 text-[9px] leading-none">
          ▼
        </span>
      </button>

      {abierto && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panel}
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: ancho,
                maxHeight: pos.maxAlto,
              }}
              className="z-50 tarjeta shadow-lg p-2 overflow-auto scroll-fino"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
export function MultiSelect({
  titulo,
  opciones,
  seleccion,
  onChange,
  ancho,
}: {
  titulo: string;
  opciones: string[];
  seleccion: string[];
  onChange: (v: string[]) => void;
  ancho?: number;
}) {
  const resumen =
    seleccion.length === 0
      ? `${titulo}: todas`
      : seleccion.length === 1
        ? `${titulo}: ${seleccion[0]}`
        : `${titulo}: ${seleccion.length}`;

  const alternar = (v: string) =>
    onChange(
      seleccion.includes(v)
        ? seleccion.filter((x) => x !== v)
        : [...seleccion, v],
    );

  return (
    <Menu resumen={resumen} activo={seleccion.length > 0} ancho={ancho ?? 230}>
      <div className="flex items-center justify-between px-1 pb-1.5 mb-1 border-b border-borde">
        <span className="rotulo">{titulo}</span>
        {seleccion.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] text-acento hover:underline"
          >
            limpiar
          </button>
        ) : null}
      </div>
      {opciones.length === 0 ? (
        <p className="px-1 py-2 text-tinta-3 text-[12px]">Sin valores.</p>
      ) : (
        opciones.map((o) => (
          <label
            key={o}
            className="flex items-center gap-2 px-1 py-[5px] rounded hover:bg-superficie-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={seleccion.includes(o)}
              onChange={() => alternar(o)}
              className="accent-[var(--acento)]"
            />
            <span className="text-[12.5px] truncate">{o}</span>
          </label>
        ))
      )}
    </Menu>
  );
}

/* -------------------------------------------------------------------------- */
export function Interruptor({
  etiqueta,
  activo,
  onChange,
}: {
  etiqueta: string;
  activo: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`h-8 px-2.5 rounded-md border text-[12.5px] flex items-center gap-2
                  cursor-pointer whitespace-nowrap transition-colors
                  ${
                    activo
                      ? "border-acento bg-acento-suave text-tinta"
                      : "border-borde bg-superficie hover:bg-superficie-2 text-tinta-2"
                  }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={activo}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--acento)]"
      />
      {etiqueta}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
export function CampoTexto({
  valor,
  onChange,
  placeholder,
  ancho = 220,
  tipo = "text",
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ancho?: number;
  tipo?: string;
}) {
  return (
    <input
      type={tipo}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: ancho }}
      className={`h-8 px-2.5 rounded-md border bg-superficie text-[12.5px]
                  placeholder:text-tinta-3 transition-colors
                  ${valor ? "border-acento" : "border-borde"}`}
    />
  );
}

/* -------------------------------------------------------------------------- */
export function Marca({ turno }: { turno: string | null }) {
  if (!turno) return <span className="marca marca-vacia" aria-hidden />;
  return (
    <span className={`marca marca-${turno}`} title={nombreTurno(turno)}>
      {turno}
    </span>
  );
}

export function nombreTurno(t: string): string {
  return t === "D" ? "Dia" : t === "N" ? "Noche" : t === "E" ? "Especial" : t;
}

/* -------------------------------------------------------------------------- */
export function Etiqueta({
  children,
  tono = "neutro",
}: {
  children: React.ReactNode;
  tono?: "neutro" | "bien" | "aviso" | "critico";
}) {
  const colores = {
    neutro: "bg-superficie-2 text-tinta-2",
    bien: "bg-superficie-2 text-bien",
    aviso: "bg-superficie-2 text-serio",
    critico: "bg-superficie-2 text-critico",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${colores[tono]}`}
    >
      {children}
    </span>
  );
}

/* Numero grande: figuras proporcionales, nunca tabulares. */
export function Cifra({
  valor,
  tamano = 30,
}: {
  valor: number | string;
  tamano?: number;
}) {
  return (
    <span
      style={{ fontSize: tamano, lineHeight: 1.05 }}
      className="font-semibold tracking-tight"
    >
      {typeof valor === "number" ? valor.toLocaleString("es-CL") : valor}
    </span>
  );
}
