import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Accesso con utente e password unici (HTTP Basic Auth) per il deploy di prova su Vercel:
// l'app non ha login e la chat consuma la chiave OpenRouter. Senza le due variabili
// d'ambiente (sviluppo locale, test) il proxy lascia passare tutto.
export function proxy(request: NextRequest) {
  const utente = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASSWORD
  if (!utente || !password) return NextResponse.next()

  const intestazione = request.headers.get('authorization')
  if (intestazione?.startsWith('Basic ')) {
    const [u, ...resto] = atob(intestazione.slice(6)).split(':')
    if (u === utente && resto.join(':') === password) return NextResponse.next()
  }

  return new NextResponse('Accesso riservato', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="FBE Preventivatore", charset="UTF-8"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
