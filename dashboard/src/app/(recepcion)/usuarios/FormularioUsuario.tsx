"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Bloque,
  BotonPrincipal,
  Campo,
  Fila,
  Seleccion,
} from "@/components/formulario";
import type { OpcionCatalogo } from "@/lib/recepcion";
import { crearUsuario, type Estado } from "../acciones";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <BotonPrincipal type="submit" cargando={pending}>
      Crear usuario
    </BotonPrincipal>
  );
}

export function FormularioUsuario({ hostales }: { hostales: OpcionCatalogo[] }) {
  const [estado, accion] = useActionState<Estado, FormData>(crearUsuario, {});
  const [usuario, setUsuario] = useState("");
  const [nombre, setNombre] = useState("");
  const [clave, setClave] = useState("");
  const [rol, setRol] = useState("RECEPCION");
  const [hostalId, setHostalId] = useState("");

  const err = estado.errores ?? {};

  return (
    <form action={accion} className="flex flex-col gap-3">
      {Object.entries({ usuario, nombre, clave, rol, hostal_id: hostalId }).map(
        ([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ),
      )}

      <Bloque titulo="Nuevo usuario">
        {estado.mensaje ? (
          <p role="status" className="text-[13px] text-bien">
            {estado.mensaje}
          </p>
        ) : null}

        <Fila>
          <Campo
            etiqueta="Usuario"
            requerido
            valor={usuario}
            onChange={(v) => setUsuario(v.toLowerCase())}
            error={err.usuario}
            ayuda="En minusculas, sin espacios. Es lo que teclea para entrar."
          />
          <Campo
            etiqueta="Nombre y apellido"
            requerido
            valor={nombre}
            onChange={setNombre}
            error={err.nombre}
            ayuda="Es lo que va a quedar en cada registro."
          />
        </Fila>

        <Fila>
          <Campo
            etiqueta="Clave"
            requerido
            tipo="password"
            valor={clave}
            onChange={setClave}
            error={err.clave}
            ayuda="Minimo 8 caracteres."
          />
          <Seleccion
            etiqueta="Hostal habitual"
            valor={hostalId}
            onChange={setHostalId}
            opciones={hostales.map((h) => ({ valor: String(h.id), texto: h.nombre }))}
            vacio="Sin hostal fijo"
            ayuda="Viene preseleccionado en el formulario de ingreso."
          />
        </Fila>

        <Seleccion
          etiqueta="Rol"
          requerido
          valor={rol}
          onChange={setRol}
          opciones={[
            { valor: "RECEPCION", texto: "Recepcion · registra ingresos y salidas" },
            { valor: "ADMIN", texto: "Administrador · ademas edita usuarios y motivos" },
          ]}
          vacio="Elegir…"
        />

        {err.general ? (
          <p role="alert" className="text-[13px] text-critico">
            {err.general}
          </p>
        ) : null}

        <div className="flex justify-end">
          <Guardar />
        </div>
      </Bloque>
    </form>
  );
}
