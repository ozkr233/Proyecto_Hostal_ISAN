"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  AreaTexto,
  Aviso,
  Bloque,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Fila,
  OpcionSiNo,
  PieAcciones,
  ResumenErrores,
  Seleccion,
} from "@/components/formulario";
import { diasEntre } from "@/lib/fechas";
import { fechaLarga } from "@/lib/formato";
import type { EstadiaEnCurso, MotivoSalida } from "@/lib/recepcion";
import {
  esAnticipada,
  validarSalida,
  type DatosSalida,
  type Errores,
} from "@/lib/validacion";
import { registrarSalida, type Estado } from "../../acciones";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <BotonPrincipal type="submit" cargando={pending}>
      Registrar salida
    </BotonPrincipal>
  );
}

export function FormularioSalida({
  estadia,
  motivos,
  hoy,
  ahora,
}: {
  estadia: EstadiaEnCurso;
  motivos: MotivoSalida[];
  hoy: string;
  ahora: string;
}) {
  const [estado, accion] = useActionState<Estado, FormData>(registrarSalida, {});

  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState(ahora);
  const [llaves, setLlaves] = useState("");
  const [llavesEn, setLlavesEn] = useState(hoy);
  const [chip, setChip] = useState("");
  const [chipEn, setChipEn] = useState(hoy);
  const [motivoId, setMotivoId] = useState("");
  const [detalle, setDetalle] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const tieneChip = estadia.numero_chip !== null && estadia.numero_chip !== "";
  const anticipada = esAnticipada(fecha, estadia.fecha_salida_prevista);
  const diasAntes =
    anticipada && estadia.fecha_salida_prevista
      ? diasEntre(fecha, estadia.fecha_salida_prevista)
      : 0;

  const motivo = motivos.find((m) => String(m.id) === motivoId);

  // Cuando se va antes de lo previsto, solo tiene sentido ofrecer los motivos
  // que explican una salida anticipada. Al reves -salida normal- se ocultan.
  const motivosVisibles = useMemo(
    () => motivos.filter((m) => (anticipada ? true : !m.solo_anticipada)),
    [motivos, anticipada],
  );

  const datos: DatosSalida = {
    fecha_salida: fecha,
    hora_salida: hora,
    llaves_devueltas: llaves,
    llaves_devueltas_en: llavesEn,
    chip_devuelto: chip,
    chip_devuelto_en: chipEn,
    motivo_salida_id: motivoId,
    motivo_salida_detalle: detalle,
    observaciones,
  };

  const enVivo = validarSalida(datos, {
    hoy,
    fecha_ingreso: estadia.fecha_ingreso,
    fecha_salida_prevista: estadia.fecha_salida_prevista,
    tiene_chip: tieneChip,
    motivo_exige_detalle: motivo?.exige_detalle ?? false,
    motivo_solo_anticipada: motivo?.solo_anticipada ?? false,
  });

  const delServidor: Errores = estado.errores ?? {};
  const err = (c: string) => delServidor[c] ?? (tocado[c] ? enVivo[c] : undefined);
  const marcar = (c: string) => () => setTocado((t) => (t[c] ? t : { ...t, [c]: true }));

  // Noches que quedaran: la del dia de salida no se cuenta.
  const nochesFinales = Math.max(0, diasEntre(estadia.fecha_ingreso, fecha));

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="estadia_id" value={estadia.id} />
      {Object.entries({
        fecha_salida: fecha,
        hora_salida: hora,
        llaves_devueltas: llaves,
        llaves_devueltas_en: llavesEn,
        chip_devuelto: chip,
        chip_devuelto_en: chipEn,
        motivo_salida_id: motivoId,
        motivo_salida_detalle: detalle,
        observaciones,
      }).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {delServidor.general ? <Aviso tono="critico">{delServidor.general}</Aviso> : null}
      <ResumenErrores errores={delServidor} />

      {estadia.ausencia_id ? (
        <Aviso>
          Esta persona figura de <strong>{estadia.ausencia_nombre}</strong> desde el{" "}
          {estadia.ausencia_desde ? fechaLarga(estadia.ausencia_desde) : ""}. Si vuelve
          y se va de verdad, registra primero el regreso desde la pantalla de alojados.
        </Aviso>
      ) : null}

      <Bloque titulo="Cuando se va">
        <Fila>
          <Campo
            etiqueta="Fecha de salida"
            requerido
            tipo="date"
            max={hoy}
            min={estadia.fecha_ingreso}
            valor={fecha}
            onChange={(v) => {
              setFecha(v);
              setLlavesEn(v);
              setChipEn(v);
            }}
            error={err("fecha_salida")}
            onBlur={marcar("fecha_salida")}
          />
          <Campo
            etiqueta="Hora de salida"
            requerido
            tipo="time"
            valor={hora}
            onChange={setHora}
            error={err("hora_salida")}
            onBlur={marcar("hora_salida")}
          />
        </Fila>

        <p className="text-[12.5px] text-tinta-3 leading-relaxed">
          Quedan <strong className="text-tinta-2">{nochesFinales}</strong>{" "}
          {nochesFinales === 1 ? "noche" : "noches"} facturables: el dia de salida no
          se cuenta.
        </p>

        {anticipada ? (
          <Aviso>
            <strong>Salida anticipada.</strong> Se va {diasAntes}{" "}
            {diasAntes === 1 ? "dia" : "dias"} antes de lo previsto
            {estadia.fecha_salida_prevista
              ? ` (${fechaLarga(estadia.fecha_salida_prevista)})`
              : ""}
            . Hay que indicar el motivo y explicarlo.
          </Aviso>
        ) : null}
      </Bloque>

      <Bloque
        titulo="Que devuelve"
        descripcion={
          estadia.numero_llave
            ? `Se le entrego la llave ${estadia.numero_llave}${
                tieneChip ? ` y el chip ${estadia.numero_chip}` : ""
              }.`
            : undefined
        }
      >
        <OpcionSiNo
          etiqueta="Devolvio las llaves"
          valor={llaves}
          onChange={(v) => {
            setLlaves(v);
            marcar("llaves_devueltas")();
          }}
          valorSi="ENTREGADA"
          valorNo="NO_ENTREGADA"
          error={err("llaves_devueltas")}
        />

        {llaves === "ENTREGADA" ? (
          <Campo
            etiqueta="Fecha en que las devolvio"
            requerido
            tipo="date"
            max={hoy}
            valor={llavesEn}
            onChange={setLlavesEn}
            error={err("llaves_devueltas_en")}
            ayuda="Normalmente la misma de la salida, pero puede ser antes."
            onBlur={marcar("llaves_devueltas_en")}
          />
        ) : llaves === "NO_ENTREGADA" ? (
          <Aviso tono="critico">
            La salida se va a registrar igual, pero la llave queda como no devuelta y
            aparecera en el panel hasta que se resuelva. Anota abajo que paso.
          </Aviso>
        ) : null}

        {tieneChip ? (
          <>
            <OpcionSiNo
              etiqueta="Devolvio el chip"
              valor={chip}
              onChange={(v) => {
                setChip(v);
                marcar("chip_devuelto")();
              }}
              valorSi="ENTREGADA"
              valorNo="NO_ENTREGADA"
              error={err("chip_devuelto")}
            />
            {chip === "ENTREGADA" ? (
              <Campo
                etiqueta="Fecha en que devolvio el chip"
                requerido
                tipo="date"
                max={hoy}
                valor={chipEn}
                onChange={setChipEn}
                error={err("chip_devuelto_en")}
                onBlur={marcar("chip_devuelto_en")}
              />
            ) : null}
          </>
        ) : null}
      </Bloque>

      <Bloque titulo="Por que se va">
        <Seleccion
          etiqueta="Motivo"
          requerido
          valor={motivoId}
          onChange={(v) => {
            setMotivoId(v);
            marcar("motivo_salida_id")();
          }}
          opciones={motivosVisibles.map((m) => ({
            valor: String(m.id),
            texto: m.nombre,
          }))}
          error={err("motivo_salida_id")}
          ayuda="Si falta el motivo que necesitas, pideselo a un administrador: la lista se edita en Motivos."
        />

        {motivo?.es_temporal ? (
          <Aviso>
            <strong>¿Vuelve a este hostal?</strong> Entonces esto es un permiso, no una
            salida: registrarlo como salida obliga a crear una estadia nueva cuando
            vuelva, y es lo que hoy parte las estadias en tramos sueltos.
            <Link
              href={`/ausencia/${estadia.id}`}
              className="block mt-1.5 text-acento hover:underline font-medium"
            >
              Registrar una ausencia en vez de una salida →
            </Link>
          </Aviso>
        ) : null}

        <AreaTexto
          etiqueta="Explicacion"
          requerido={anticipada || (motivo?.exige_detalle ?? false)}
          valor={detalle}
          onChange={setDetalle}
          error={err("motivo_salida_detalle")}
          onBlur={marcar("motivo_salida_detalle")}
          placeholder={anticipada ? "Por que se va antes de lo previsto…" : ""}
        />

        <AreaTexto
          etiqueta="Observaciones"
          requerido={llaves === "NO_ENTREGADA"}
          valor={observaciones}
          onChange={setObservaciones}
          error={err("observaciones")}
          onBlur={marcar("observaciones")}
          ayuda="Se agrega a lo que ya estuviera anotado en la estadia."
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
