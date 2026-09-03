"use client";

import { useId } from "react";
import type { Errores } from "@/lib/validacion";

/* --------------------------------------------------------------------------
   Campos para el mesón de recepcion.

   El panel esta afinado para densidad -12,5 px, alto 8, todo en una pantalla-.
   Aqui la prioridad es la contraria: alguien tecleando con un huesped enfrente,
   a veces de pie. Por eso 15 px, alto 10, una sola columna y el error debajo
   del campo en vez de en un globo que tape lo siguiente.
   -------------------------------------------------------------------------- */

const BASE =
  "w-full h-10 px-3 rounded-md bg-superficie border text-[15px] " +
  "transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--acento)] focus:ring-offset-0";

function clases(hayError: boolean, extra = ""): string {
  return `${BASE} ${hayError ? "border-critico" : "border-borde"} ${extra}`;
}

export function Bloque({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="tarjeta p-4">
      <legend className="px-1.5 text-[12px] font-semibold tracking-wide uppercase text-tinta-2">
        {titulo}
      </legend>
      {descripcion ? (
        <p className="text-[12.5px] text-tinta-3 mb-3 leading-relaxed">{descripcion}</p>
      ) : null}
      <div className="flex flex-col gap-3.5">{children}</div>
    </fieldset>
  );
}

/** Dos campos cortos en la misma fila cuando van juntos (fecha y hora). */
export function Fila({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">{children}</div>;
}

type ComunProps = {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
};

function Envoltura({
  etiqueta,
  ayuda,
  error,
  requerido,
  id,
  children,
}: ComunProps & { id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[13px] font-medium text-tinta-2">
        {etiqueta}
        {requerido ? (
          <span className="text-critico ml-0.5" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-tinta-3 font-normal ml-1.5 text-[12px]">(opcional)</span>
        )}
      </label>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-[12px] text-tinta-3 leading-snug">
          {ayuda}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] text-critico leading-snug">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function descritoPor(id: string, ayuda?: string, error?: string): string | undefined {
  const partes = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean);
  return partes.length ? partes.join(" ") : undefined;
}

export function Campo({
  etiqueta,
  ayuda,
  error,
  requerido,
  tipo = "text",
  valor,
  onChange,
  placeholder,
  autoFocus,
  mono,
  max,
  min,
  inputMode,
  onBlur,
}: ComunProps & {
  tipo?: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  mono?: boolean;
  max?: string;
  min?: string;
  inputMode?: "text" | "numeric" | "tel";
  /** Se usa para no mostrar el error hasta que el campo se haya visitado. */
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} id={id}>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
        max={max}
        min={min}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        className={clases(!!error, mono ? "font-mono" : "")}
      />
    </Envoltura>
  );
}

export function AreaTexto({
  etiqueta,
  ayuda,
  error,
  requerido,
  valor,
  onChange,
  placeholder,
  filas = 3,
  onBlur,
}: ComunProps & {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  filas?: number;
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} id={id}>
      <textarea
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={filas}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        className={`w-full px-3 py-2 rounded-md bg-superficie border text-[15px] leading-relaxed
                    transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--acento)]
                    ${error ? "border-critico" : "border-borde"}`}
      />
    </Envoltura>
  );
}

/**
 * Desplegable. Las opciones SIEMPRE vienen de la base -catalogos-, nunca de una
 * lista escrita en el codigo: es lo que impide que el mismo motivo termine
 * escrito de cinco formas, como le paso a las empresas en el Excel.
 */
export function Seleccion({
  etiqueta,
  ayuda,
  error,
  requerido,
  valor,
  onChange,
  opciones,
  vacio = "Elegir…",
  onBlur,
}: ComunProps & {
  valor: string;
  onChange: (v: string) => void;
  opciones: { valor: string; texto: string; deshabilitada?: boolean }[];
  vacio?: string;
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <Envoltura etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} id={id}>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(id, ayuda, error)}
        className={clases(!!error)}
      >
        <option value="">{vacio}</option>
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor} disabled={o.deshabilitada}>
            {o.texto}
          </option>
        ))}
      </select>
    </Envoltura>
  );
}

/**
 * Si / No en botones grandes. Para las preguntas que no se pueden dejar sin
 * responder -si devolvio las llaves- una casilla no sirve: sin marcar parece
 * "no" y en realidad es "nadie contesto".
 */
export function OpcionSiNo({
  etiqueta,
  ayuda,
  error,
  valor,
  onChange,
  textoSi = "Si",
  textoNo = "No",
  valorSi = "SI",
  valorNo = "NO",
}: Omit<ComunProps, "requerido"> & {
  valor: string;
  onChange: (v: string) => void;
  textoSi?: string;
  textoNo?: string;
  valorSi?: string;
  valorNo?: string;
}) {
  const id = useId();
  const opciones = [
    { v: valorSi, t: textoSi },
    { v: valorNo, t: textoNo },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-tinta-2">
        {etiqueta}
        <span className="text-critico ml-0.5" aria-hidden>
          *
        </span>
      </span>
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-[12px] text-tinta-3 leading-snug">
          {ayuda}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label={etiqueta}
        aria-describedby={descritoPor(id, ayuda, error)}
        className="grid grid-cols-2 gap-2 mt-0.5"
      >
        {opciones.map((o) => {
          const activo = valor === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(o.v)}
              className={`h-11 rounded-md border text-[14px] font-medium transition-colors ${
                activo
                  ? "border-acento bg-acento-suave text-tinta"
                  : error
                    ? "border-critico text-tinta-2 hover:bg-superficie-2"
                    : "border-borde text-tinta-2 hover:bg-superficie-2"
              }`}
            >
              {o.t}
            </button>
          );
        })}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] text-critico leading-snug">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Casilla({
  etiqueta,
  ayuda,
  activo,
  onChange,
}: {
  etiqueta: string;
  ayuda?: string;
  activo: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex items-center gap-2.5 cursor-pointer">
        <input
          id={id}
          type="checkbox"
          checked={activo}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-[var(--acento)]"
        />
        <span className="text-[14px]">{etiqueta}</span>
      </label>
      {ayuda ? <p className="text-[12px] text-tinta-3 ml-7 leading-snug">{ayuda}</p> : null}
    </div>
  );
}

/**
 * Todos los errores arriba, con enlace al campo. En un formulario largo, el
 * unico error puede estar tres pantallas mas abajo y sin esto parece que el
 * boton no hace nada.
 */
export function ResumenErrores({ errores }: { errores: Errores }) {
  const lista = Object.entries(errores);
  if (lista.length === 0) return null;

  return (
    <div
      role="alert"
      className="tarjeta p-3.5 border-critico bg-superficie-2"
      // Al enviar con errores, el foco viene aqui.
      tabIndex={-1}
      id="resumen-errores"
    >
      <p className="text-[13.5px] font-semibold text-critico">
        {lista.length === 1
          ? "Falta un dato para poder guardar:"
          : `Faltan ${lista.length} datos para poder guardar:`}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {lista.map(([campo, mensaje]) => (
          <li key={campo} className="text-[13px] text-tinta-2 leading-snug">
            · {mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Aviso que no impide guardar, pero que hay que leer. */
export function Aviso({
  tono = "aviso",
  children,
}: {
  tono?: "aviso" | "critico" | "info";
  children: React.ReactNode;
}) {
  const borde =
    tono === "critico" ? "border-critico" : tono === "aviso" ? "border-[var(--aviso)]" : "border-acento";
  return (
    <div className={`tarjeta p-3 ${borde} bg-superficie-2 text-[13px] leading-relaxed`}>
      {children}
    </div>
  );
}

/** Barra fija al pie con la accion principal. */
export function PieAcciones({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-plano border-t border-borde flex gap-2 justify-end">
      {children}
    </div>
  );
}

export function BotonPrincipal({
  children,
  cargando,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { cargando?: boolean }) {
  return (
    <button
      {...resto}
      disabled={cargando || resto.disabled}
      className="h-11 px-5 rounded-md bg-acento text-acento-tinta text-[15px] font-semibold
                 disabled:opacity-60 transition-opacity"
    >
      {cargando ? "Guardando…" : children}
    </button>
  );
}

export function BotonSecundario({
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...resto}
      className="h-11 px-4 rounded-md border border-borde text-[15px] text-tinta-2
                 hover:bg-superficie-2 transition-colors"
    >
      {children}
    </button>
  );
}
