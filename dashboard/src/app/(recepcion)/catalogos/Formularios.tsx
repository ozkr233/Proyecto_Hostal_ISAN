"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { BotonPrincipal, Campo, Casilla } from "@/components/formulario";
import { crearMotivoSalida, crearTipoAusencia, type Estado } from "../acciones";

function Guardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <BotonPrincipal type="submit" cargando={pending}>
      {texto}
    </BotonPrincipal>
  );
}

/** El codigo se deriva del nombre en el servidor; aqui solo se escribe el nombre. */
export function FormularioMotivo() {
  const [estado, accion] = useActionState<Estado, FormData>(crearMotivoSalida, {});
  const [nombre, setNombre] = useState("");
  const [soloAnticipada, setSoloAnticipada] = useState(false);
  const [exigeDetalle, setExigeDetalle] = useState(false);
  const [esTemporal, setEsTemporal] = useState(false);

  return (
    <form action={accion} className="tarjeta p-3.5 flex flex-col gap-3">
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="solo_anticipada" value={String(soloAnticipada)} />
      <input type="hidden" name="exige_detalle" value={String(exigeDetalle)} />
      <input type="hidden" name="es_temporal" value={String(esTemporal)} />

      <p className="text-[13px] font-semibold">Agregar motivo de salida</p>
      {estado.mensaje ? (
        <p role="status" className="text-[12.5px] text-bien">
          {estado.mensaje}
        </p>
      ) : null}

      <Campo
        etiqueta="Nombre"
        requerido
        valor={nombre}
        onChange={setNombre}
        error={estado.errores?.nombre ?? estado.errores?.general}
        ayuda="Tal como quieres que lo lea el recepcionista."
      />

      <Casilla
        etiqueta="Solo cuando se va antes de lo previsto"
        activo={soloAnticipada}
        onChange={setSoloAnticipada}
      />
      <Casilla
        etiqueta="Exige una explicacion escrita"
        activo={exigeDetalle}
        onChange={setExigeDetalle}
      />
      <Casilla
        etiqueta="El huesped vuelve"
        ayuda="Con esto marcado, el formulario propone registrar una ausencia en vez de una salida."
        activo={esTemporal}
        onChange={setEsTemporal}
      />

      <div className="flex justify-end">
        <Guardar texto="Agregar motivo" />
      </div>
    </form>
  );
}

export function FormularioTipoAusencia() {
  const [estado, accion] = useActionState<Estado, FormData>(crearTipoAusencia, {});
  const [nombre, setNombre] = useState("");
  const [conserva, setConserva] = useState(true);
  const [exigeDetalle, setExigeDetalle] = useState(false);

  return (
    <form action={accion} className="tarjeta p-3.5 flex flex-col gap-3">
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="conserva_habitacion" value={String(conserva)} />
      <input type="hidden" name="exige_detalle" value={String(exigeDetalle)} />

      <p className="text-[13px] font-semibold">Agregar tipo de ausencia</p>
      {estado.mensaje ? (
        <p role="status" className="text-[12.5px] text-bien">
          {estado.mensaje}
        </p>
      ) : null}

      <Campo
        etiqueta="Nombre"
        requerido
        valor={nombre}
        onChange={setNombre}
        error={estado.errores?.nombre ?? estado.errores?.general}
      />

      <Casilla
        etiqueta="Le guarda la habitacion"
        ayuda="Es solo el valor que viene marcado por defecto; el recepcionista puede cambiarlo caso a caso."
        activo={conserva}
        onChange={setConserva}
      />
      <Casilla
        etiqueta="Exige una explicacion escrita"
        activo={exigeDetalle}
        onChange={setExigeDetalle}
      />

      <div className="flex justify-end">
        <Guardar texto="Agregar tipo" />
      </div>
    </form>
  );
}
