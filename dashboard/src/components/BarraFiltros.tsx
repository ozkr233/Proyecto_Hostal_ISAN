"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { finDeMes, hoy, inicioDeMes, NOMBRE_MES, nombreDeMes } from "@/lib/fechas";
import { norm } from "@/lib/filtros";
import { fechaLarga, formatearRut } from "@/lib/formato";
import type { Persona } from "@/lib/types";
import { useDatos } from "./DatosProvider";
import { Menu, MultiSelect } from "./ui";

const MAX_SUGERENCIAS = 8;

/** 'YYYY-MM' desplazado n meses, sin pasar por Date local. */
function mesMas(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const t = (a * 12 + (m - 1)) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

/**
 * Los filtros que alcanzan a todas las pantallas. El mes NO esta aqui: subio a
 * la cabecera de la pagina, porque es el encuadre de lo que se mira y no un
 * filtro mas de la fila.
 */
export function BarraFiltros() {
  const { filtros, ponerFiltros, limpiar, hayFiltros, catalogo } = useDatos();

  return (
    <div className="sticky top-[57px] z-40 bg-plano border-b border-borde px-6 py-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <SegmentosHostal
          opciones={catalogo.hostales}
          seleccion={filtros.hostales}
          onChange={(hostales) => ponerFiltros({ hostales })}
        />

        <MultiSelect
          titulo="Empresa"
          opciones={catalogo.empresas}
          seleccion={filtros.empresas}
          onChange={(empresas) => ponerFiltros({ empresas })}
        />

        <BuscadorHuesped />

        {hayFiltros ? (
          <button
            type="button"
            onClick={limpiar}
            className="text-acento hover:underline"
          >
            Quitar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Selector de mes. Va en la cabecera de cada pantalla, como titulo vivo.

   Antes listaba "los meses presentes en los datos", y los datos incluyen
   fechas de servicio con el ano mal tecleado: el desplegable llegaba a ofrecer
   mayo 2025 y julio 2027 como si fueran periodos de operacion. Ahora es un
   selector de calendario de verdad -ano y doce meses- y el punto marca cuales
   tuvieron gente alojada.
   -------------------------------------------------------------------------- */

export function SelectorMes() {
  const { filtros, ponerFiltros, mesesConMovimiento } = useDatos();

  const mesActual =
    filtros.desde &&
    filtros.desde.endsWith("-01") &&
    filtros.hasta === finDeMes(filtros.desde.slice(0, 7))
      ? filtros.desde.slice(0, 7)
      : null;

  const [ano, setAno] = useState(() =>
    Number((mesActual ?? hoy()).slice(0, 4)),
  );

  const conMovimiento = useMemo(
    () => new Set(mesesConMovimiento),
    [mesesConMovimiento],
  );

  const ir = (mes: string) =>
    ponerFiltros({ desde: inicioDeMes(mes), hasta: finDeMes(mes) });

  const titulo = mesActual
    ? nombreDeMes(mesActual)
    : filtros.desde || filtros.hasta
      ? `${filtros.desde ? fechaLarga(filtros.desde) : "el inicio"} a ${filtros.hasta ? fechaLarga(filtros.hasta) : "el final"}`
      : "Todas las fechas";

  const flecha =
    "h-9 w-9 grid place-items-center rounded-md text-tinta-2 hover:bg-superficie-2 hover:text-tinta disabled:opacity-30 transition-colors";

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        disabled={!mesActual}
        onClick={() => mesActual && ir(mesMas(mesActual, -1))}
        className={flecha}
        title="Mes anterior"
      >
        <span aria-hidden className="text-[18px] leading-none">
          &#8249;
        </span>
        <span className="sr-only">Mes anterior</span>
      </button>

      <Menu
        resumen={
          <span className="text-[24px] font-semibold tracking-tight capitalize">
            {titulo}
          </span>
        }
        ancho={280}
        sinBorde
      >
        <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-borde">
          <button
            type="button"
            onClick={() => setAno((a) => a - 1)}
            className="h-8 w-8 grid place-items-center rounded hover:bg-superficie-2"
            title="Ano anterior"
          >
            <span aria-hidden>&#8249;</span>
            <span className="sr-only">Ano anterior</span>
          </button>
          <span className="font-semibold cifras">{ano}</span>
          <button
            type="button"
            onClick={() => setAno((a) => a + 1)}
            className="h-8 w-8 grid place-items-center rounded hover:bg-superficie-2"
            title="Ano siguiente"
          >
            <span aria-hidden>&#8250;</span>
            <span className="sr-only">Ano siguiente</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {NOMBRE_MES.map((nombre, i) => {
            const mes = `${ano}-${String(i + 1).padStart(2, "0")}`;
            const elegido = mes === mesActual;
            const tuvo = conMovimiento.has(mes);
            return (
              <button
                key={mes}
                type="button"
                onClick={() => ir(mes)}
                className={`h-9 rounded-md text-[14px] capitalize transition-colors
                            flex flex-col items-center justify-center gap-0.5 ${
                              elegido
                                ? "bg-acento text-acento-tinta font-medium"
                                : "text-tinta-2 hover:bg-superficie-2"
                            }`}
              >
                {nombre.slice(0, 3)}
                <span
                  aria-hidden
                  className={`h-1 w-1 rounded-full ${
                    tuvo
                      ? elegido
                        ? "bg-acento-tinta"
                        : "bg-acento"
                      : "bg-transparent"
                  }`}
                />
                {tuvo ? <span className="sr-only">con movimiento</span> : null}
              </button>
            );
          })}
        </div>

        <p className="text-[13px] text-tinta-3 mt-2.5 pt-2 border-t border-borde leading-snug">
          El punto marca los meses con gente alojada.
        </p>
      </Menu>

      <button
        type="button"
        disabled={!mesActual}
        onClick={() => mesActual && ir(mesMas(mesActual, 1))}
        className={flecha}
        title="Mes siguiente"
      >
        <span aria-hidden className="text-[18px] leading-none">
          &#8250;
        </span>
        <span className="sr-only">Mes siguiente</span>
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SegmentosHostal({
  opciones,
  seleccion,
  onChange,
}: {
  opciones: string[];
  seleccion: string[];
  onChange: (v: string[]) => void;
}) {
  const alternar = (v: string) =>
    onChange(
      seleccion.includes(v) ? seleccion.filter((x) => x !== v) : [...seleccion, v],
    );

  const base =
    "h-full px-3 text-[14px] border-r border-borde last:border-r-0 transition-colors";

  return (
    <div className="flex items-center h-9 rounded-md border border-borde overflow-hidden bg-superficie">
      <span className="rotulo pl-3 pr-2">Hostal</span>
      <button
        type="button"
        onClick={() => onChange([])}
        className={`${base} border-l border-borde ${
          seleccion.length === 0
            ? "bg-acento-suave text-tinta font-medium"
            : "text-tinta-2 hover:bg-superficie-2"
        }`}
      >
        Todos
      </button>
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => alternar(o)}
          aria-pressed={seleccion.includes(o)}
          className={`${base} cifras ${
            seleccion.includes(o)
              ? "bg-acento-suave text-tinta font-medium"
              : "text-tinta-2 hover:bg-superficie-2"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Buscador de huesped.

   Un solo cuadro de busqueda en toda la aplicacion: escribir sigue filtrando
   el panel entero, y ademas ofrece las personas que coinciden para saltar
   directo a su ficha. Dos cajas parecidas que hacen cosas distintas serian
   peor que una sola que hace las dos.

   La lista va en un portal sobre <body>, por el mismo motivo que el Menu de
   ui.tsx: cualquier ancestro sticky con z-index la recortaria.
   -------------------------------------------------------------------------- */

function BuscadorHuesped() {
  const { filtros, ponerFiltros, todo } = useDatos();
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, ancho: 280 });
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const sugerencias = useMemo<Persona[]>(() => {
    const buscado = norm(filtros.busqueda);
    if (buscado.length < 2) return [];
    const salida: Persona[] = [];
    for (const p of todo.personas) {
      if (norm(p.nombre).includes(buscado) || (p.rut ?? "").includes(buscado)) {
        salida.push(p);
        if (salida.length === MAX_SUGERENCIAS) break;
      }
    }
    return salida;
  }, [filtros.busqueda, todo.personas]);

  const colocar = useCallback(() => {
    const t = campo.current?.getBoundingClientRect();
    if (t) setPos({ top: t.bottom + 4, left: t.left, ancho: t.width });
  }, []);

  useLayoutEffect(() => {
    if (abierto) colocar();
  }, [abierto, colocar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const d = e.target as Node;
      if (!lista.current?.contains(d) && !campo.current?.contains(d)) {
        setAbierto(false);
      }
    };
    const seguir = () => colocar();
    document.addEventListener("mousedown", fuera);
    window.addEventListener("scroll", seguir, true);
    window.addEventListener("resize", seguir);
    return () => {
      document.removeEventListener("mousedown", fuera);
      window.removeEventListener("scroll", seguir, true);
      window.removeEventListener("resize", seguir);
    };
  }, [abierto, colocar]);

  const abrirFicha = (p: Persona) => {
    setAbierto(false);
    campo.current?.blur();
    router.push(`/panel/huesped/${p.id}`);
  };

  const teclas = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setAbierto(false);
      return;
    }
    if (sugerencias.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter" && activo >= 0) {
      // Enter sin nada resaltado no navega: deja el comportamiento de
      // siempre, que es filtrar el panel con lo escrito.
      e.preventDefault();
      abrirFicha(sugerencias[activo]);
    }
  };

  return (
    <>
      <input
        ref={campo}
        type="search"
        role="combobox"
        aria-expanded={abierto && sugerencias.length > 0}
        aria-autocomplete="list"
        aria-label="Buscar huesped"
        value={filtros.busqueda}
        placeholder="Buscar por nombre, RUT o habitacion"
        onChange={(e) => {
          ponerFiltros({ busqueda: e.target.value });
          setActivo(-1);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        style={{ width: 300 }}
        className={`h-9 px-3 rounded-md border bg-superficie text-[14px]
                    placeholder:text-tinta-3 transition-colors
                    ${filtros.busqueda ? "border-acento" : "border-borde"}`}
      />

      {abierto && sugerencias.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={lista}
              role="listbox"
              style={{
                position: "fixed",
                top: pos.top,
                left: pos.left,
                width: Math.max(pos.ancho, 300),
              }}
              className="z-50 tarjeta shadow-lg p-1.5 overflow-auto scroll-fino max-h-[340px]"
            >
              <p className="rotulo px-2 py-1">Ver ficha de</p>
              {sugerencias.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={i === activo}
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => abrirFicha(p)}
                  className={`w-full text-left px-2 py-1.5 rounded-md flex items-baseline gap-2 ${
                    i === activo ? "bg-superficie-2" : ""
                  }`}
                >
                  <span className="text-[14px] truncate">{p.nombre}</span>
                  {p.rut ? (
                    <span className="codigo text-[12.5px] text-tinta-3 ml-auto shrink-0">
                      {formatearRut(p.rut)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
