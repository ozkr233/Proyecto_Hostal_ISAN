import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, leerSesion } from "@/lib/sesion";

/** Rutas que solo puede abrir un ADMIN. */
const SOLO_ADMIN = ["/usuarios", "/catalogos"];

export async function middleware(peticion: NextRequest) {
  const sesion = await leerSesion(peticion.cookies.get(COOKIE)?.value);
  const ruta = peticion.nextUrl.pathname;

  if (!sesion) {
    const destino = ruta + peticion.nextUrl.search;
    const url = peticion.nextUrl.clone();
    url.pathname = "/login";
    url.search = destino === "/" ? "" : `?destino=${encodeURIComponent(destino)}`;
    return NextResponse.redirect(url);
  }

  // Un recepcionista que llega a una ruta de administracion -por enlace viejo o
  // escribiendo la URL- vuelve al inicio, no ve un error. La comprobacion se
  // repite dentro de cada Server Action: el middleware protege la navegacion,
  // no las escrituras.
  if (sesion.rol !== "ADMIN" && SOLO_ADMIN.some((p) => ruta.startsWith(p))) {
    const url = peticion.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Todo queda protegido salvo /login (y su Server Action, que hace POST a la
// misma ruta) y los estaticos de Next.
export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
