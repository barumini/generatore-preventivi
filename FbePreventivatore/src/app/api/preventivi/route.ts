import { prisma } from '@/server/prisma'
import { creaPreventivoConBozza, elencaPreventivi } from '@/server/preventivi-repo'

export async function POST(request: Request) {
  const corpo = await request.json()
  try {
    const preventivo = await creaPreventivoConBozza(prisma, corpo)
    return Response.json(preventivo, { status: 201 })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 409 })
  }
}

export async function GET() {
  const elenco = await elencaPreventivi(prisma)
  return Response.json(elenco)
}
