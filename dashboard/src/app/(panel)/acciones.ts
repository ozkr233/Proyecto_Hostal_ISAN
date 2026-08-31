"use server";

import { obtenerDatos } from "@/lib/queries";

/** Vacia el cache de 5 minutos y vuelve a consultar Supabase. */
export async function refrescar(): Promise<void> {
  await obtenerDatos(true);
}
