import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sesionValida } from "@/lib/sesion";

export async function middleware(peticion: NextRequest) {
  const token = peticion.cookies.get(COOKIE)?.value;
  if (await sesionValida(token)) return NextResponse.next();

  const destino = peticion.nextUrl.pathname + peticion.nextUrl.search;
  const url = peticion.nextUrl.clone();
  url.pathname = "/login";
  url.search = destino === "/" ? "" : `?destino=${encodeURIComponent(destino)}`;
  return NextResponse.redirect(url);
}

// Todo queda protegido salvo /login (y su Server Action, que hace POST a la
// misma ruta) y los estaticos de Next.
export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
};
