"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
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
import { hoy as hoyChile, sumarDias } from "@/lib/fechas";
import { fechaLarga } from "@/lib/formato";
import type { HabitacionLibre, OpcionCatalogo, PersonaConocida } from "@/lib/recepcion";
import {
  formatearRutParcial,
  normalizarRut,
  rutValido,
  validarIngreso,
  type DatosIngreso,
  type Errores,
} from "@/lib/validacion";
import { buscarPorRut, registrarIngreso, type Estado } from "../acciones";

type Props = {
  hostales: OpcionCatalogo[];
  empresas: OpcionCatalogo[];
  cargos: OpcionCatalogo[];
  habitacionesPorHostal: Record<string, HabitacionLibre[]>;
  hostalInicial: string;
  hoy: string;
  ahora: string;
};

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <BotonPrincipal type="submit" cargando={pending}>
      Registrar ingreso
    </BotonPrincipal>
  );
}

export function FormularioIngreso({
  hostales,
  empresas,
  cargos,
  habitacionesPorHostal,
  hostalInicial,
  hoy,
  ahora,
}: Props) {
  const [estado, accion] = useActionState<Estado, FormData>(registrarIngreso, {});

  // --- Estado del formulario -------------------------------------------------
  const [rut, setRut] = useState("");
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [cargoNuevo, setCargoNuevo] = useState("");

  const [hostalId, setHostalId] = useState(hostalInicial);
  const [empresaId, setEmpresaId] = useState("");
  const [habitacionId, setHabitacionId] = useState("");
  const [tipoHabitacion, setTipoHabitacion] = useState("");
  const [folio, setFolio] = useState("");
  const [grupo, setGrupo] = useState("");
  const [turno, setTurno] = useState("N");
  const [fechaIngreso, setFechaIngreso] = useState(hoy);
  const [horaIngreso, setHoraIngreso] = useState(ahora);
  const [prevista, setPrevista] = useState(sumarDias(hoy, 7));
  const [estaciona, setEstaciona] = useState(false);
  const [patente, setPatente] = useState("");
  const [llave, setLlave] = useState("");
  const [chip, setChip] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // --- Persona ya conocida ---------------------------------------------------
  const [conocida, setConocida] = useState<PersonaConocida | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();
  const [tocado, setTocado] = useState<Record<string, boolean>>({});

  const rutNorm = normalizarRut(rut);

  /** Al terminar de escribir el RUT: si ya existe, se rellena solo. */
  const buscar = () => {
    if (!rutValido(rutNorm)) {
      setConocida(null);
      return;
    }
    iniciarBusqueda(async () => {
      const p = await buscarPorRut(rutNorm);
      setConocida(p);
      if (p) {
        setNombre(p.nombre);
        // El celular solo se hereda si parece un telefono. Los libros traen
        // celdas de error del Excel cargadas tal cual -'#VALUE!'-, y arrastrar
        // eso al formulario hace que el recepcionista vea un error por un dato
        // que no escribio. Queda en la base, que es donde la auditoria lo mira.
        if (p.celular && /^[0-9]{8,11}$/.test(p.celular.replace(/[^0-9]/g, ""))) {
          setCelular(p.celular);
        }
        if (p.cargo_id) setCargoId(String(p.cargo_id));
      }
    });
  };

  // Si cambia el hostal, la habitacion elegida ya no sirve: es de otro edificio.
  useEffect(() => {
    setHabitacionId("");
  }, [hostalId]);

  const habitaciones = habitacionesPorHostal[hostalId] ?? [];
  const habitacionElegida = habitaciones.find((h) => String(h.id) === habitacionId);

  // --- Validacion en vivo ----------------------------------------------------
  const datos: DatosIngreso = {
    rut,
    nombre,
    celular,
    cargo_id: cargoId,
    hostal_id: hostalId,
    empresa_id: empresaId,
    habitacion_id: habitacionId,
    tipo_habitacion: tipoHabitacion,
    folio,
    grupo,
    turno_habitual: turno,
    fecha_ingreso: fechaIngreso,
    hora_ingreso: horaIngreso,
    fecha_salida_prevista: prevista,
    usa_estacionamiento: estaciona,
    patente_vehiculo: patente,
    numero_llave: llave,
    numero_chip: chip,
    observaciones,
  };

  const enVivo = useMemo(() => validarIngreso(datos, hoyChile()), [
    rut, nombre, celular, cargoId, hostalId, empresaId, habitacionId, tipoHabitacion,
    folio, grupo, turno, fechaIngreso, horaIngreso, prevista, estaciona, patente,
    llave, chip, observaciones,
  ]);

  // Un campo solo muestra su error cuando ya lo tocaron, o cuando el servidor
  // lo devolvio: molestar antes de que escriban es ruido.
  const delServidor: Errores = estado.errores ?? {};
  const err = (campo: string): string | undefined =>
    delServidor[campo] ?? (tocado[campo] ? enVivo[campo] : undefined);

  const marcar = (campo: string) => () =>
    setTocado((t) => (t[campo] ? t : { ...t, [campo]: true }));

  const noches = (() => {
    const d = new Date(`${prevista}T00:00:00Z`).getTime() -
      new Date(`${fechaIngreso}T00:00:00Z`).getTime();
    return Number.isFinite(d) ? Math.round(d / 86_400_000) : 0;
  })();

  return (
    <form action={accion} className="flex flex-col gap-4">
      {/* Los campos con estado propio viajan como hidden: asi el <form> manda
          exactamente lo que se valido, sin depender del name de cada input. */}
      {Object.entries({
        rut: rutNorm,
        nombre,
        celular,
        cargo_id: cargoId,
        cargo_nuevo: cargoNuevo,
        hostal_id: hostalId,
        empresa_id: empresaId,
        habitacion_id: habitacionId,
        tipo_habitacion: tipoHabitacion,
        folio,
        grupo,
        turno_habitual: turno,
        fecha_ingreso: fechaIngreso,
        hora_ingreso: horaIngreso,
        fecha_salida_prevista: prevista,
        usa_estacionamiento: estaciona ? "true" : "false",
        patente_vehiculo: patente,
        numero_llave: llave,
        numero_chip: chip,
        observaciones,
      }).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      {delServidor.general ? <Aviso tono="critico">{delServidor.general}</Aviso> : null}
      <ResumenErrores errores={delServidor} />

      <Bloque
        titulo="1 · Huesped"
        descripcion="Empieza por el RUT: si ya se alojo antes, el resto se rellena solo."
      >
        <Campo
          etiqueta="RUT"
          requerido
          autoFocus
          mono
          inputMode="text"
          placeholder="12.345.678-9"
          valor={formatearRutParcial(rutNorm)}
          onChange={(v) => {
            setRut(v);
            setConocida(null);
          }}
          error={err("rut")}
          ayuda="Sin puntos ni guion tambien vale."
          // La busqueda se dispara al salir del campo, no en cada tecla.
          onBlur={() => {
            marcar("rut")();
            buscar();
          }}
        />

        {buscando ? (
          <p className="text-[12.5px] text-tinta-3 -mt-2">Buscando…</p>
        ) : conocida ? (
          conocida.estadia_abierta_id ? (
            <Aviso tono="critico">
              <strong>{conocida.nombre}</strong> ya figura alojado en el hostal{" "}
              <span className="codigo">{conocida.estadia_abierta_hostal}</span>
              {conocida.estadia_abierta_desde
                ? ` desde el ${fechaLarga(conocida.estadia_abierta_desde)}`
                : ""}
              . Cierra esa salida antes de registrar un ingreso nuevo.
            </Aviso>
          ) : (
            <Aviso tono="info">
              Ya registrado ·{" "}
              {conocida.estadias_previas === 1
                ? "1 estadia previa"
                : `${conocida.estadias_previas} estadias previas`}
              . Revisa que los datos sigan al dia.
            </Aviso>
          )
        ) : null}

        <Campo
          etiqueta="Nombre completo"
          requerido
          valor={nombre}
          onChange={setNombre}
          error={err("nombre")}
          onBlur={marcar("nombre")}
        />

        <Fila>
          <Campo
            etiqueta="Celular"
            inputMode="tel"
            mono
            valor={celular}
            onChange={setCelular}
            error={err("celular")}
            onBlur={marcar("celular")}
          />
          <Seleccion
            etiqueta="Cargo"
            valor={cargoId}
            onChange={(v) => {
              setCargoId(v);
              if (v) setCargoNuevo("");
            }}
            opciones={cargos.map((c) => ({ valor: String(c.id), texto: c.nombre }))}
            vacio="Sin cargo / agregar uno nuevo…"
          />
        </Fila>

        {cargoId === "" ? (
          <Campo
            etiqueta="Cargo nuevo"
            ayuda="Solo si no esta en la lista de arriba."
            valor={cargoNuevo}
            onChange={setCargoNuevo}
          />
        ) : null}
      </Bloque>

      <Bloque titulo="2 · Estadia">
        <Fila>
          <Seleccion
            etiqueta="Hostal"
            requerido
            valor={hostalId}
            onChange={setHostalId}
            opciones={hostales.map((h) => ({ valor: String(h.id), texto: h.nombre }))}
            error={err("hostal_id")}
          />
          <Seleccion
            etiqueta="Empresa"
            requerido
            ayuda="A quien se le factura la estadia."
            valor={empresaId}
            onChange={setEmpresaId}
            opciones={empresas.map((e) => ({ valor: String(e.id), texto: e.nombre }))}
            error={err("empresa_id")}
          />
        </Fila>

        <Seleccion
          etiqueta="Habitacion"
          requerido
          valor={habitacionId}
          onChange={setHabitacionId}
          error={err("habitacion_id")}
          opciones={habitaciones.map((h) => ({
            valor: String(h.id),
            texto:
              `${h.numero}` +
              (h.tipo ? ` · ${h.tipo.toLowerCase()}` : "") +
              (h.ocupantes === 0
                ? " · libre"
                : ` · ${h.ocupantes} ${h.ocupantes === 1 ? "ocupante" : "ocupantes"}`),
          }))}
          vacio={habitaciones.length === 0 ? "Elige primero el hostal" : "Elegir…"}
        />

        {habitacionElegida && habitacionElegida.ocupantes >= habitacionElegida.capacidad ? (
          <Aviso>
            La habitacion {habitacionElegida.numero} ya tiene{" "}
            {habitacionElegida.ocupantes} de {habitacionElegida.capacidad} plazas
            ocupadas. Puedes continuar, pero revisa que quepa.
            <span className="block text-tinta-3 mt-1">
              La capacidad de las habitaciones nunca se cargo desde los Excel y hoy
              todas figuran con 2. Por eso esto avisa en vez de impedirlo.
            </span>
          </Aviso>
        ) : null}

        <Fila>
          <Seleccion
            etiqueta="Tipo cobrado"
            ayuda="Una doble se puede vender como single."
            valor={tipoHabitacion}
            onChange={setTipoHabitacion}
            opciones={[
              { valor: "DOBLE", texto: "Doble" },
              { valor: "SINGLE", texto: "Single" },
            ]}
          />
          <Seleccion
            etiqueta="Turno"
            requerido
            ayuda="Se copia a cada noche del registro oficial."
            valor={turno}
            onChange={setTurno}
            opciones={[
              { valor: "D", texto: "D · dia" },
              { valor: "N", texto: "N · noche" },
              { valor: "E", texto: "E · especial" },
            ]}
            error={err("turno_habitual")}
          />
        </Fila>

        <Fila>
          <Campo etiqueta="Folio" mono valor={folio} onChange={setFolio} error={err("folio")} />
          <Seleccion
            etiqueta="Grupo de rotacion"
            valor={grupo}
            onChange={setGrupo}
            opciones={[
              { valor: "A", texto: "A" },
              { valor: "B", texto: "B" },
            ]}
            vacio="Sin grupo"
          />
        </Fila>

        <Fila>
          <Campo
            etiqueta="Fecha de ingreso"
            requerido
            tipo="date"
            max={hoy}
            valor={fechaIngreso}
            onChange={setFechaIngreso}
            error={err("fecha_ingreso")}
            onBlur={marcar("fecha_ingreso")}
          />
          <Campo
            etiqueta="Hora de ingreso"
            requerido
            tipo="time"
            valor={horaIngreso}
            onChange={setHoraIngreso}
            error={err("hora_ingreso")}
            onBlur={marcar("hora_ingreso")}
          />
        </Fila>

        <Campo
          etiqueta="Hasta cuando se queda"
          requerido
          tipo="date"
          min={fechaIngreso}
          valor={prevista}
          onChange={setPrevista}
          error={err("fecha_salida_prevista")}
          ayuda={
            noches > 0
              ? `${noches} ${noches === 1 ? "noche" : "noches"}. Si se va antes, habra que decir por que.`
              : "Si no se sabe, pon una fecha estimada: se puede cambiar despues."
          }
          onBlur={marcar("fecha_salida_prevista")}
        />

        <Casilla
          etiqueta="Usa estacionamiento"
          activo={estaciona}
          onChange={(v) => {
            setEstaciona(v);
            if (!v) setPatente("");
          }}
        />
        {estaciona ? (
          <Campo
            etiqueta="Patente del vehiculo"
            requerido
            mono
            valor={patente}
            onChange={setPatente}
            error={err("patente_vehiculo")}
            onBlur={marcar("patente_vehiculo")}
          />
        ) : null}

        <AreaTexto
          etiqueta="Observaciones"
          valor={observaciones}
          onChange={setObservaciones}
        />
      </Bloque>

      <Bloque
        titulo="3 · Que se lleva"
        descripcion="Lo que se anote aqui es lo que se le va a pedir de vuelta al salir."
      >
        <Fila>
          <Campo
            etiqueta="Numero de llave"
            requerido
            mono
            valor={llave}
            onChange={setLlave}
            error={err("numero_llave")}
            onBlur={marcar("numero_llave")}
          />
          <Campo
            etiqueta="Numero de chip"
            mono
            ayuda="Dejalo vacio si no se le entrega chip."
            valor={chip}
            onChange={setChip}
          />
        </Fila>
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
