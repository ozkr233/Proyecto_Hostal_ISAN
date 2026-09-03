import Link from "next/link";
import { notFound } from "next/navigation";
import { hoy } from "@/lib/fechas";
import { fechaLarga, formatearRut } from "@/lib/formato";
import { catalogos, estadiaEnCurso } from "@/lib/recepcion";
import { FormularioAusencia } from "./FormularioAusencia";

export const dynamic = "force-dynamic";

export default async function PaginaAusencia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estadia = await estadiaEnCurso(Number(id));
  if (!estadia) notFound();

  const { tiposAusencia } = await catalogos();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-[12.5px] text-acento hover:underline">
          ← Volver a alojados
        </Link>
        <h2 className="text-[17px] font-semibold tracking-tight mt-1">
          Registrar permiso, vacaciones o licencia
        </h2>
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-relaxed max-w-[64ch]">
          Es para cuando el huesped se va unos dias y vuelve. Esos dias no se cobran
          como noche, pero la cama puede seguir reservada: no hay que cerrar la
          estadia ni abrirle otra al volver.
        </p>
      </div>

      <div className="tarjeta p-4">
        <p className="text-[15px] font-medium">{estadia.persona}</p>
        <p className="text-[12.5px] text-tinta-3 mt-0.5">
          <span className="codigo">{formatearRut(estadia.rut) ?? "sin RUT"}</span> ·{" "}
          {estadia.empresa} · hostal{" "}
          <span className="codigo">{estadia.hostal_codigo}</span>
          {estadia.habitacion ? (
            <>
              {" · hab. "}
              <span className="codigo">{estadia.habitacion}</span>
            </>
          ) : null}
        </p>
        <p className="text-[12.5px] text-tinta-3 mt-1.5">
          Ingreso el {fechaLarga(estadia.fecha_ingreso)} · {estadia.noches}{" "}
          {estadia.noches === 1 ? "noche" : "noches"} hasta hoy
        </p>
      </div>

      {estadia.ausencia_id ? (
        <p className="tarjeta p-3 border-[var(--aviso)] bg-superficie-2 text-[13px] leading-relaxed">
          Ya tiene una ausencia vigente ({estadia.ausencia_nombre}, desde el{" "}
          {estadia.ausencia_desde ? fechaLarga(estadia.ausencia_desde) : ""}). Registra
          primero su regreso desde la pantalla de alojados: dos ausencias no pueden
          solaparse.
        </p>
      ) : (
        <FormularioAusencia estadia={estadia} tipos={tiposAusencia} hoy={hoy()} />
      )}
    </div>
  );
}
