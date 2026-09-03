import { cookies } from "next/headers";
import Link from "next/link";
import { ahora, hoy } from "@/lib/fechas";
import { catalogos, habitacionesDe, type HabitacionLibre } from "@/lib/recepcion";
import { COOKIE, leerSesion } from "@/lib/sesion";
import { FormularioIngreso } from "./FormularioIngreso";

export const dynamic = "force-dynamic";

export default async function PaginaIngreso() {
  const sesion = await leerSesion((await cookies()).get(COOKIE)?.value);
  const { hostales, empresas, cargos } = await catalogos();

  // Se cargan las habitaciones de TODOS los hostales de una vez: son 67 filas y
  // asi cambiar de hostal en el desplegable no obliga a volver al servidor.
  const habitacionesPorHostal: Record<string, HabitacionLibre[]> = {};
  for (const h of hostales) {
    habitacionesPorHostal[String(h.id)] = await habitacionesDe(h.id);
  }

  const inicial =
    sesion?.hostal_id && habitacionesPorHostal[String(sesion.hostal_id)]
      ? String(sesion.hostal_id)
      : String(hostales[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-[12.5px] text-acento hover:underline">
          ← Volver a alojados
        </Link>
        <h2 className="text-[17px] font-semibold tracking-tight mt-1">
          Registrar ingreso
        </h2>
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-relaxed max-w-[64ch]">
          Los campos con <span className="text-critico">*</span> son obligatorios. Las
          noches se calculan solas a partir de las fechas: no hay que anotarlas.
        </p>
      </div>

      <FormularioIngreso
        hostales={hostales}
        empresas={empresas}
        cargos={cargos}
        habitacionesPorHostal={habitacionesPorHostal}
        hostalInicial={inicial}
        hoy={hoy()}
        ahora={ahora()}
      />
    </div>
  );
}
