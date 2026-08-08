import type { PrismaClient } from '@prisma/client'

export class RisorsaNonTrovata extends Error {}

export interface DatiRevisione {
  statoForm: string
  inputCalcolo: string
  risultatoCalcolo: string
}

export interface DatiBozza extends DatiRevisione {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  oggetto: string
  progettista: string
  data: string
  luogo: string
}

export async function creaPreventivoConBozza(db: PrismaClient, dati: DatiBozza) {
  const esistente = await db.preventivo.findUnique({ where: { protocollo: dati.protocollo } })
  if (esistente) {
    throw new Error(
      `Esiste già un preventivo con protocollo ${dati.protocollo} — usa aggiungiRevisione per aggiungere una revisione, non crearne uno nuovo.`,
    )
  }

  let cliente = await db.cliente.findFirst({
    where: { nome: dati.cliente.nome, comune: dati.cliente.comune, provincia: dati.cliente.provincia },
  })
  if (!cliente) {
    cliente = await db.cliente.create({ data: dati.cliente })
  }

  return db.preventivo.create({
    data: {
      protocollo: dati.protocollo,
      oggetto: dati.oggetto,
      progettista: dati.progettista || null,
      clienteId: cliente.id,
      revisioni: {
        create: {
          numero: 1,
          data: new Date(dati.data),
          luogo: dati.luogo,
          stato: 'bozza',
          statoForm: dati.statoForm,
          inputCalcolo: dati.inputCalcolo,
          risultatoCalcolo: dati.risultatoCalcolo,
        },
      },
    },
    include: { revisioni: true, cliente: true },
  })
}

export async function aggiungiRevisione(
  db: PrismaClient,
  preventivoId: string,
  dati: DatiRevisione & { data: string; luogo: string },
) {
  const ultima = await db.revisione.findFirst({ where: { preventivoId }, orderBy: { numero: 'desc' } })
  if (!ultima) throw new RisorsaNonTrovata(`Nessun preventivo trovato con id ${preventivoId}`)

  return db.revisione.create({
    data: {
      preventivoId,
      numero: ultima.numero + 1,
      data: new Date(dati.data),
      luogo: dati.luogo,
      stato: 'bozza',
      statoForm: dati.statoForm,
      inputCalcolo: dati.inputCalcolo,
      risultatoCalcolo: dati.risultatoCalcolo,
    },
  })
}

export async function aggiornaBozza(db: PrismaClient, preventivoId: string, numero: number, dati: DatiBozza) {
  const revisione = await db.revisione.findUnique({
    where: { preventivoId_numero: { preventivoId, numero } },
    include: { preventivo: true },
  })
  if (!revisione) throw new RisorsaNonTrovata(`Revisione ${numero} non trovata per il preventivo ${preventivoId}`)
  if (revisione.stato !== 'bozza') {
    throw new Error(
      `La revisione ${numero} è "${revisione.stato}", non modificabile — crea una nuova revisione con aggiungiRevisione.`,
    )
  }

  if (dati.protocollo !== revisione.preventivo.protocollo) {
    const conflitto = await db.preventivo.findUnique({ where: { protocollo: dati.protocollo } })
    if (conflitto && conflitto.id !== preventivoId) {
      throw new Error(`Esiste già un altro preventivo con protocollo ${dati.protocollo}.`)
    }
  }

  await db.preventivo.update({
    where: { id: preventivoId },
    data: {
      protocollo: dati.protocollo,
      oggetto: dati.oggetto,
      progettista: dati.progettista || null,
      cliente: { update: dati.cliente },
    },
  })

  return db.revisione.update({
    where: { preventivoId_numero: { preventivoId, numero } },
    data: {
      data: new Date(dati.data),
      luogo: dati.luogo,
      statoForm: dati.statoForm,
      inputCalcolo: dati.inputCalcolo,
      risultatoCalcolo: dati.risultatoCalcolo,
    },
  })
}

export async function elencaPreventivi(db: PrismaClient) {
  const preventivi = await db.preventivo.findMany({
    include: { cliente: true, revisioni: { orderBy: { numero: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  return preventivi.map((p) => ({
    id: p.id,
    protocollo: p.protocollo,
    cliente: p.cliente,
    ultimaRevisione: p.revisioni[0]
      ? { numero: p.revisioni[0].numero, stato: p.revisioni[0].stato, data: p.revisioni[0].data }
      : null,
  }))
}

export async function caricaRevisione(db: PrismaClient, preventivoId: string, numero: number) {
  return db.revisione.findUnique({
    where: { preventivoId_numero: { preventivoId, numero } },
    include: { preventivo: { include: { cliente: true } } },
  })
}
