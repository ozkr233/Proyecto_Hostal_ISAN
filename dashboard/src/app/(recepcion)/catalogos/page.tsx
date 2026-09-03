import Link from "next/link";
import { db } from "@/lib/db";
import { alternarOpcion } from "../acciones";
import { FormularioMotivo, FormularioTipoAusencia } from "./Formularios";

export const dynamic = "force-dynamic";

type FilaMotivo = {
  id: number;
  codigo: string;
  nombre: string;
  solo_anticipada: boolean;
  exige_detalle: boolean;
  es_temporal: boolean;
  activo: boolean;
  usos: number;
};

type FilaTipo = {
  id: number;
  codigo: string;
  nombre: string;
  conserva_habitacion: boolean;
  exige_detalle: boolean;
  activo: boolean;
  usos: number;
};

export default async function PaginaCatalogos() {
  const sql = db();

  const motivos = await sql<FilaMotivo[]>`
    SELECT m.id, m.codigo, m.nombre, m.solo_anticipada, m.exige_detalle,
           m.es_temporal, m.activo,
           (SELECT count(*)::int FROM core.estadia e WHERE e.motivo_salida_id = m.id) AS usos
    FROM core.motivo_salida m ORDER BY m.orden, m.nombre
  `;

  const tipos = await sql<FilaTipo[]>`
    SELECT t.id, t.codigo, t.nombre, t.conserva_habitacion, t.exige_detalle, t.activo,
           (SELECT count(*)::int FROM core.estadia_ausencia a WHERE a.tipo_id = t.id) AS usos
    FROM core.tipo_ausencia t ORDER BY t.orden, t.nombre
  `;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/" className="text-[12.5px] text-acento hover:underline">
          ← Volver a alojados
        </Link>
        <h2 className="text-[17px] font-semibold tracking-tight mt-1">
          Motivos de salida y de ausencia
        </h2>
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-relaxed max-w-[68ch]">
          Estas son las listas que ve el recepcionista. No hay campo libre para el
          motivo: lo que no este aqui, no se puede registrar. Por eso se pueden agregar
          desde esta pantalla, sin esperar a que alguien toque el codigo.
        </p>
        <p className="text-[13px] text-tinta-3 mt-2 leading-relaxed max-w-[68ch]">
          Nada se borra: desactivar saca la opcion del desplegable y deja intactos los
          registros que ya la usan.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold">Motivos de salida</h3>
        <ul className="flex flex-col gap-2">
          {motivos.map((m) => (
            <Opcion
              key={m.id}
              id={m.id}
              tabla="motivo_salida"
              nombre={m.nombre}
              codigo={m.codigo}
              activo={m.activo}
              usos={m.usos}
              marcas={[
                m.solo_anticipada ? "solo si se va antes" : null,
                m.es_temporal ? "propone ausencia" : null,
                m.exige_detalle ? "exige explicacion" : null,
              ]}
            />
          ))}
        </ul>
        <FormularioMotivo />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-[14px] font-semibold">Tipos de ausencia</h3>
        <ul className="flex flex-col gap-2">
          {tipos.map((t) => (
            <Opcion
              key={t.id}
              id={t.id}
              tabla="tipo_ausencia"
              nombre={t.nombre}
              codigo={t.codigo}
              activo={t.activo}
              usos={t.usos}
              marcas={[
                t.conserva_habitacion ? "conserva la cama" : "libera la cama",
                t.exige_detalle ? "exige explicacion" : null,
              ]}
            />
          ))}
        </ul>
        <FormularioTipoAusencia />
      </section>
    </div>
  );
}

function Opcion({
  id,
  tabla,
  nombre,
  codigo,
  activo,
  usos,
  marcas,
}: {
  id: number;
  tabla: string;
  nombre: string;
  codigo: string;
  activo: boolean;
  usos: number;
  marcas: (string | null)[];
}) {
  const visibles = marcas.filter(Boolean) as string[];
  return (
    <li className={`tarjeta p-2.5 flex items-center gap-3 flex-wrap ${activo ? "" : "opacity-60"}`}>
      <div className="flex-1 min-w-[180px]">
        <p className="text-[13.5px] font-medium">
          {nombre}
          {!activo ? (
            <span className="text-[11.5px] font-normal text-tinta-3"> · desactivado</span>
          ) : null}
        </p>
        <p className="text-[11.5px] text-tinta-3 mt-0.5">
          <span className="codigo">{codigo}</span>
          {visibles.length ? ` · ${visibles.join(" · ")}` : ""}
        </p>
      </div>
      <span className="text-[12px] text-tinta-3">
        {usos === 0 ? "sin usar" : `${usos} ${usos === 1 ? "vez" : "veces"}`}
      </span>
      <form action={alternarOpcion}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="tabla" value={tabla} />
        <button
          type="submit"
          className="h-8 px-2.5 rounded-md border border-borde text-[12.5px]
                     text-tinta-2 hover:bg-superficie-2 transition-colors"
        >
          {activo ? "Desactivar" : "Reactivar"}
        </button>
      </form>
    </li>
  );
}
