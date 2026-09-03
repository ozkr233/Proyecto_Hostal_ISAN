import Link from "next/link";
import { db } from "@/lib/db";
import { catalogos } from "@/lib/recepcion";
import { alternarUsuario } from "../acciones";
import { FormularioUsuario } from "./FormularioUsuario";

export const dynamic = "force-dynamic";

type FilaUsuario = {
  id: number;
  usuario: string;
  nombre: string;
  rol: string;
  hostal: string | null;
  activo: boolean;
  ultimo_acceso: string | null;
  registros: number;
};

export default async function PaginaUsuarios() {
  const { hostales } = await catalogos();

  const usuarios = await db()<FilaUsuario[]>`
    SELECT u.id, u.usuario, u.nombre, u.rol::text AS rol,
           h.codigo AS hostal, u.activo,
           to_char(u.ultimo_acceso AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY HH24:MI') AS ultimo_acceso,
           (SELECT count(*)::int FROM core.estadia e
             WHERE e.registrado_por = u.id OR e.salida_registrada_por = u.id) AS registros
    FROM core.usuario u
    LEFT JOIN core.hostal h ON h.id = u.hostal_id
    ORDER BY u.activo DESC, u.nombre
  `;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/" className="text-[12.5px] text-acento hover:underline">
          ← Volver a alojados
        </Link>
        <h2 className="text-[17px] font-semibold tracking-tight mt-1">Usuarios</h2>
        <p className="text-[13px] text-tinta-3 mt-0.5 leading-relaxed max-w-[64ch]">
          Cada ingreso y cada salida quedan a nombre de quien los registro. Por eso los
          usuarios no se borran nunca: se desactivan, y lo que hicieron sigue
          atribuido.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {usuarios.map((u) => (
          <li key={u.id} className="tarjeta p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <p className="text-[14px] font-medium">
                {u.nombre}{" "}
                {!u.activo ? (
                  <span className="text-[11.5px] font-normal text-tinta-3">
                    · desactivado
                  </span>
                ) : null}
              </p>
              <p className="text-[12px] text-tinta-3 mt-0.5">
                <span className="codigo">{u.usuario}</span>
                {u.rol === "ADMIN" ? " · administrador" : ""}
                {u.hostal ? ` · hostal ${u.hostal}` : ""}
              </p>
            </div>
            <div className="text-[12px] text-tinta-3 min-w-[150px]">
              {u.registros > 0
                ? `${u.registros} ${u.registros === 1 ? "registro" : "registros"}`
                : "sin registros"}
              {u.ultimo_acceso ? ` · entro el ${u.ultimo_acceso}` : " · nunca entro"}
            </div>
            <form action={alternarUsuario}>
              <input type="hidden" name="id" value={u.id} />
              <button
                type="submit"
                className="h-8 px-2.5 rounded-md border border-borde text-[12.5px]
                           text-tinta-2 hover:bg-superficie-2 transition-colors"
              >
                {u.activo ? "Desactivar" : "Reactivar"}
              </button>
            </form>
          </li>
        ))}
        {usuarios.length === 0 ? (
          <li className="tarjeta p-4 text-[13.5px] text-tinta-2">
            Todavia no hay usuarios. Crea el primero aqui abajo y vuelve a entrar con
            el: la clave de emergencia no identifica a nadie, y sin usuario real no se
            puede registrar un ingreso.
          </li>
        ) : null}
      </ul>

      <FormularioUsuario hostales={hostales} />
    </div>
  );
}
