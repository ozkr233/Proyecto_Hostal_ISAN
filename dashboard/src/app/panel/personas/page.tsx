"use client";

import { useMemo } from "react";
import { useDatos } from "@/components/DatosProvider";
import { Tabla, type Columna } from "@/components/Tabla";
import { Etiqueta } from "@/components/ui";
import { formatearRut } from "@/lib/formato";
import type { Persona } from "@/lib/types";

type FilaPersona = Persona & {
  estadias: number;
  nochesTotal: number;
  serviciosTotal: number;
  empresas: string;
  estadoRut: "Valido" | "Invalido" | "Sin RUT";
};

export default function PaginaPersonas() {
  const { personas, estadias, noches, servicios, todo } = useDatos();

  const filas = useMemo<FilaPersona[]>(() => {
    const porPersona = new Map<
      number,
      { estadias: number; noches: number; servicios: number; empresas: Set<string> }
    >();

    const acumular = (id: number) => {
      let a = porPersona.get(id);
      if (!a) {
        a = { estadias: 0, noches: 0, servicios: 0, empresas: new Set() };
        porPersona.set(id, a);
      }
      return a;
    };

    const personaDeEstadia = new Map<number, number>();
    for (const e of estadias) {
      const a = acumular(e.persona_id);
      a.estadias += 1;
      a.empresas.add(e.empresa);
      personaDeEstadia.set(e.id, e.persona_id);
    }
    for (const n of noches) {
      const pid = personaDeEstadia.get(n.estadia_id);
      if (pid !== undefined) acumular(pid).noches += 1;
    }
    for (const s of servicios) {
      if (s.persona_id !== null) acumular(s.persona_id).servicios += s.cantidad;
    }

    return personas.map((p) => {
      const a = porPersona.get(p.id);
      return {
        ...p,
        estadias: a?.estadias ?? 0,
        nochesTotal: a?.noches ?? 0,
        serviciosTotal: a?.servicios ?? 0,
        empresas: [...(a?.empresas ?? [])].sort().join(", "),
        estadoRut: !p.rut ? "Sin RUT" : p.rut_valido ? "Valido" : "Invalido",
      };
    });
  }, [personas, estadias, noches, servicios]);

  const columnas = useMemo<Columna<FilaPersona>[]>(
    () => [
      { clave: "nombre", titulo: "Nombre", tipo: "texto", ancho: 210, valor: (p) => p.nombre },
      {
        clave: "rut",
        titulo: "RUT",
        tipo: "texto",
        ancho: 120,
        valor: (p) => p.rut,
        render: (p) =>
          p.rut ? (
            <span className={`codigo ${p.rut_valido ? "" : "text-critico"}`}>
              {formatearRut(p.rut)}
            </span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      {
        clave: "estadoRut",
        titulo: "Estado RUT",
        tipo: "enum",
        ancho: 106,
        valor: (p) => p.estadoRut,
        render: (p) =>
          p.estadoRut === "Valido" ? (
            <span className="text-tinta-3">Valido</span>
          ) : (
            <Etiqueta tono={p.estadoRut === "Invalido" ? "critico" : "aviso"}>
              <span aria-hidden>▲</span> {p.estadoRut}
            </Etiqueta>
          ),
      },
      { clave: "cargo", titulo: "Cargo", tipo: "enum", ancho: 200, valor: (p) => p.cargo },
      { clave: "empresas", titulo: "Empresas", tipo: "texto", ancho: 160, valor: (p) => p.empresas },
      { clave: "estadias", titulo: "Estadias", tipo: "numero", ancho: 82, numerica: true, valor: (p) => p.estadias },
      { clave: "nochesTotal", titulo: "Noches", tipo: "numero", ancho: 78, numerica: true, valor: (p) => p.nochesTotal },
      { clave: "serviciosTotal", titulo: "Servicios", tipo: "numero", ancho: 86, numerica: true, valor: (p) => p.serviciosTotal },
      {
        clave: "celular",
        titulo: "Celular",
        tipo: "texto",
        ancho: 110,
        valor: (p) => p.celular,
        render: (p) =>
          p.celular ? (
            <span className="codigo">{p.celular}</span>
          ) : (
            <span className="text-tinta-3">—</span>
          ),
      },
      { clave: "id", titulo: "ID", tipo: "numero", ancho: 62, numerica: true, oculta: true, valor: (p) => p.id },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h2 className="text-[14px] font-semibold tracking-tight">Personas</h2>
        <p className="text-[11.5px] text-tinta-3 mt-0.5 max-w-[80ch] leading-relaxed">
          El trabajador, no la reserva: la misma persona vuelve en distintos
          meses y a veces con otra empresa. La identidad es el RUT; quien no lo
          trae se identifica por nombre normalizado, y aparece marcado.
        </p>
      </header>

      <Tabla
        columnas={columnas}
        filas={filas}
        total={todo.personas.length}
        nombreArchivo="personas.csv"
        claveFila={(p) => p.id}
      />
    </div>
  );
}
