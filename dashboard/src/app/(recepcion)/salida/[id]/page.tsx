import Link from "next/link";
import { notFound } from "next/navigation";
import { ahora, hoy } from "@/lib/fechas";
import { fechaLarga, formatearRut } from "@/lib/formato";
import { catalogos, estadiaEnCurso } from "@/lib/recepcion";
import { FormularioSalida } from "./FormularioSalida";

export const dynamic = "force-dynamic";

export default async function PaginaSalida({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estadia = await estadiaEnCurso(Number(id));
  if (!estadia) notFound();

  const { motivos } = await catalogos();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-[12.5px] text-acento hover:underline">
          ← Volver a alojados
        </Link>
        <h2 className="text-[17px] font-semibold tracking-tight mt-1">
          Registrar salida
        </h2>
      </div>

      {/* Resumen no editable: lo que se esta cerrando, para no equivocarse de
          persona cuando hay varios apellidos parecidos. */}
      <div className="tarjeta p-4">
        <p className="text-[15px] font-medium">{estadia.persona}</p>
        <p className="text-[12.5px] text-tinta-3 mt-0.5">
          <span className="codigo">{formatearRut(estadia.rut) ?? "sin RUT"}</span> ·{" "}
          {estadia.empresa}
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[12.5px]">
          <Dato rotulo="Hostal" valor={estadia.hostal_codigo} codigo />
          <Dato rotulo="Habitacion" valor={estadia.habitacion ?? "—"} codigo />
          <Dato rotulo="Ingreso" valor={fechaLarga(estadia.fecha_ingreso)} />
          <Dato
            rotulo="Salida prevista"
            valor={
              estadia.fecha_salida_prevista
                ? fechaLarga(estadia.fecha_salida_prevista)
                : "—"
            }
          />
          <Dato rotulo="Noches hasta hoy" valor={String(estadia.noches)} />
          <Dato rotulo="Llave" valor={estadia.numero_llave ?? "—"} codigo />
          <Dato rotulo="Chip" valor={estadia.numero_chip ?? "sin chip"} codigo />
          <Dato rotulo="Folio" valor={estadia.folio ?? "—"} codigo />
        </dl>
      </div>

      <FormularioSalida
        estadia={estadia}
        motivos={motivos}
        hoy={hoy()}
        ahora={ahora()}
      />
    </div>
  );
}

function Dato({
  rotulo,
  valor,
  codigo,
}: {
  rotulo: string;
  valor: string;
  codigo?: boolean;
}) {
  return (
    <div>
      <dt className="rotulo">{rotulo}</dt>
      <dd className={`mt-0.5 ${codigo ? "codigo" : ""}`}>{valor}</dd>
    </div>
  );
}
