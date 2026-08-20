import { prisma } from '@/server/prisma'
import { creaPreventivoConBozza, elencaPreventivi, eliminaPreventivi } from '@/server/preventivi-repo'

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

export async function DELETE(request: Request) {
  const { ids } = await request.json()
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'string')) {
    return Response.json({ errore: 'ids deve essere un array non vuoto di stringhe' }, { status: 400 })
  }
  await eliminaPreventivi(prisma, ids)
  return new Response(null, { status: 204 })
}
