"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AreaTexto,
  Aviso,
  Bloque,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Casilla,
  Fila,
  PieAcciones,
  ResumenErrores,
  Seleccion,
} from "@/components/formulario";
import { diasEntre } from "@/lib/fechas";
import type { EstadiaEnCurso, TipoAusencia } from "@/lib/recepcion";
import { validarAusencia, type DatosAusencia, type Errores } from "@/lib/validacion";
import { registrarAusencia, type Estado } from "../../acciones";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <BotonPrincipal type="submit" cargando={pending}>
      Registrar ausencia
    </BotonPrincipal>
  );
}

export function FormularioAusencia({
  estadia,
  tipos,
  hoy,
}: {
  estadia: EstadiaEnCurso;
  tipos: TipoAusencia[];
  hoy: string;
}) {
  const [estado, accion] = useActionState<Estado, FormData>(registrarAusencia, {});

  const [tipoId, setTipoId] = useState("");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState("");
  const [conserva, setConserva] = useState(true);
  const [detalle, setDetalle] = useState("");
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const tipo = tipos.find((t) => String(t.id) === tipoId);

  const datos: DatosAusencia = {
    tipo_id: tipoId,
    desde,
    hasta,
    conserva_habitacion: conserva,
    detalle,
  };

  const enVivo = validarAusencia(datos, {
    hoy,
    fecha_ingreso: estadia.fecha_ingreso,
    tipo_exige_detalle: tipo?.exige_detalle ?? false,
  });

  const delServidor: Errores = estado.errores ?? {};
  const err = (c: string) => delServidor[c] ?? (tocado[c] ? enVivo[c] : undefined);
  const marcar = (c: string) => () => setTocado((t) => (t[c] ? t : { ...t, [c]: true }));

  const dias = hasta ? diasEntre(desde, hasta) + 1 : null;

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="estadia_id" value={estadia.id} />
      {Object.entries({
        tipo_id: tipoId,
        desde,
        hasta,
        conserva_habitacion: conserva ? "true" : "false",
        detalle,
      }).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {delServidor.general ? <Aviso tono="critico">{delServidor.general}</Aviso> : null}
      <ResumenErrores errores={delServidor} />

      <Bloque titulo="Ausencia">
        <Seleccion
          etiqueta="Motivo"
          requerido
          valor={tipoId}
          onChange={(v) => {
            setTipoId(v);
            marcar("tipo_id")();
            // Cada motivo trae su comportamiento habitual con la habitacion:
            // unas vacaciones la conservan, un turno en campamento no.
            const t = tipos.find((x) => String(x.id) === v);
            if (t) setConserva(t.conserva_habitacion);
          }}
          opciones={tipos.map((t) => ({ valor: String(t.id), texto: t.nombre }))}
          error={err("tipo_id")}
          ayuda="La lista sale del catalogo de la base. Un administrador puede agregar motivos en Motivos."
        />

        <Fila>
          <Campo
            etiqueta="Desde"
            requerido
            tipo="date"
            min={estadia.fecha_ingreso}
            valor={desde}
            onChange={setDesde}
            error={err("desde")}
            onBlur={marcar("desde")}
          />
          <Campo
            etiqueta="Hasta"
            tipo="date"
            min={desde}
            valor={hasta}
            onChange={setHasta}
            error={err("hasta")}
            ayuda="Dejalo vacio si no se sabe cuando vuelve."
            onBlur={marcar("hasta")}
          />
        </Fila>

        <p className="text-[12.5px] text-tinta-3 leading-relaxed">
          {dias !== null && dias > 0 ? (
            <>
              Son <strong className="text-tinta-2">{dias}</strong>{" "}
              {dias === 1 ? "dia" : "dias"} que dejan de contar como noches.
            </>
          ) : (
            <>
              Mientras no tenga fecha de regreso, los dias dejan de contar como
              noches y la ausencia queda pendiente en el panel.
            </>
          )}
        </p>

        <Casilla
          etiqueta="Le guardamos la habitacion"
          activo={conserva}
          onChange={setConserva}
          ayuda={
            conserva
              ? "La cama sigue ocupada: no se le va a ofrecer a nadie mas."
              : "La cama queda libre para otro huesped mientras esta fuera."
          }
        />

        <AreaTexto
          etiqueta="Detalle"
          requerido={tipo?.exige_detalle ?? false}
          valor={detalle}
          onChange={setDetalle}
          error={err("detalle")}
          onBlur={marcar("detalle")}
        />
      </Bloque>

      <PieAcciones>
        <Link href="/">
          <BotonSecundario type="button">Cancelar</BotonSecundario>
        </Link>
        <Guardar />
      </PieAcciones>
    </form>
  );
}
