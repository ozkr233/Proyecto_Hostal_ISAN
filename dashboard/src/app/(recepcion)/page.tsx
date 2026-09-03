import Link from "next/link";
import { diasEntre, hoy } from "@/lib/fechas";
import { alojados } from "@/lib/recepcion";
import { ListaAlojados } from "./ListaAlojados";

export const dynamic = "force-dynamic";

const CONFIRMACIONES: Record<string, string> = {
  ingreso: "Ingreso registrado.",
  salida: "Salida registrada.",
  ausencia: "Ausencia registrada. Esos dias no cuentan como noches.",
  regreso: "Regreso registrado: vuelve a contar noches desde hoy.",
};

export default async function PaginaRecepcion({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const lista = await alojados();
  const dia = hoy();

  const ausentes = lista.filter((a) => a.ausencia_id !== null).length;
  const atrasados = lista.filter(
    (a) => a.fecha_salida_prevista !== null && diasEntre(a.fecha_salida_prevista, dia) > 0,
  ).length;

  const resumen =
    `${lista.length} ${lista.length === 1 ? "persona alojada" : "personas alojadas"}` +
    (ausentes > 0 ? ` · ${ausentes} de permiso, vacaciones o licencia` : "") +
    (atrasados > 0 ? ` · ${atrasados} pasada su salida prevista` : "");

  return (
    <div className="flex flex-col gap-4">
      {ok && CONFIRMACIONES[ok] ? (
        <p
          role="status"
          className="tarjeta px-3 py-2.5 border-acento bg-acento-suave text-[13.5px]"
        >
          {CONFIRMACIONES[ok]}
        </p>
      ) : null}

      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h2 className="text-[17px] font-semibold tracking-tight">Alojados ahora</h2>
          <p className="text-[13px] text-tinta-3 mt-0.5 leading-relaxed">
            {lista.length === 0 ? "Todavia no hay nadie registrado desde la web." : resumen}
          </p>
        </div>

        <Link
          href="/ingreso"
          className="h-11 px-5 grid place-items-center rounded-md bg-acento text-acento-tinta
                     text-[15px] font-semibold"
        >
          Registrar ingreso
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="tarjeta p-6 text-center">
          <p className="text-[14px] text-tinta-2">
            Cuando registres el primer ingreso, aparecera aqui.
          </p>
          <p className="text-[12.5px] text-tinta-3 mt-2 leading-relaxed max-w-[54ch] mx-auto">
            Las estadias que vienen de los Excel no se muestran en esta pantalla: son de
            julio de 2026 y estan abiertas porque nadie anoto la salida, no porque haya
            alguien durmiendo ahi. Se siguen viendo en el{" "}
            <Link href="/panel/estadias" className="text-acento hover:underline">
              panel
            </Link>
            .
          </p>
        </div>
      ) : (
        <ListaAlojados alojados={lista} hoy={dia} />
      )}
    </div>
  );
}
