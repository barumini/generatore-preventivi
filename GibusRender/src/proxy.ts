import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type AuthResult = "ok" | "unauthorized" | "misconfigured";

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  // Confronto a tempo costante rispetto alla lunghezza massima.
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function checkBasicAuth(
  header: string | null,
  usersEnv: string | undefined,
  isProd: boolean,
): AuthResult {
  const users = (usersEnv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes(":"));
  if (users.length === 0) return isProd ? "misconfigured" : "ok";

  if (!header || !header.startsWith("Basic ")) return "unauthorized";
  let decoded: string;
  try {
    const bin = atob(header.slice(6).trim());
    decoded = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return "unauthorized";
  }
  if (!decoded.includes(":")) return "unauthorized";

  let ok = false;
  for (const u of users) {
    if (safeEqual(u, decoded)) ok = true; // nessuna uscita anticipata
  }
  return ok ? "ok" : "unauthorized";
}

export function proxy(request: NextRequest) {
  const result = checkBasicAuth(
    request.headers.get("authorization"),
    process.env.BASIC_AUTH_USERS,
    process.env.NODE_ENV === "production",
  );
  if (result === "ok") return NextResponse.next();
  if (result === "misconfigured") {
    return new NextResponse("Accesso non configurato", { status: 503 });
  }
  return new NextResponse("Autenticazione richiesta", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GibusRender"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
