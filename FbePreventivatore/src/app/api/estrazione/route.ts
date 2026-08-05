// src/app/api/estrazione/route.ts
import { NextResponse } from 'next/server'
import { estraiCampi, ClienteEstrazioneAnthropic } from '@/ai/estrazione'

export async function POST(richiesta: Request) {
  const { testo } = await richiesta.json()
  try {
    const campi = await estraiCampi(testo, new ClienteEstrazioneAnthropic())
    return NextResponse.json(campi)
  } catch (errore) {
    return NextResponse.json({ errore: errore instanceof Error ? errore.message : 'Errore' }, { status: 400 })
  }
}
