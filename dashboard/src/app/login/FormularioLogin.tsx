"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { entrar, type EstadoLogin } from "./acciones";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-9 rounded-md bg-acento text-acento-tinta font-semibold
                 disabled:opacity-60 transition-opacity"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <form action={accion} className="tarjeta p-5 flex flex-col gap-3">
      <input type="hidden" name="destino" value={destino} />
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Usuario</span>
        <input
          name="usuario"
          type="text"
          autoFocus
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="h-9 px-2.5 rounded-md bg-superficie-2 border border-borde
                     text-[13px]"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="rotulo">Clave</span>
        <input
          name="clave"
          type="password"
          autoComplete="current-password"
          required
          className="h-9 px-2.5 rounded-md bg-superficie-2 border border-borde
                     font-mono text-[13px]"
        />
      </label>

      {estado.error ? (
        <p role="alert" className="text-critico text-[12px] -mt-0.5">
          {estado.error}
        </p>
      ) : null}

      <Boton />
    </form>
  );
}
