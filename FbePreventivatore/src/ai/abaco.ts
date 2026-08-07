import type { Serramento } from '@/domain/geometria'

function formattaCm(metri: number): string {
  return String(Math.round(metri * 100))
}

interface OpzioniAbaco {
  prefisso?: string // usa {n} e {dim} come placeholder, es. 'n. {n} portoncini di ingresso dim. standard {dim}'
}

export function generaAbacoSerramenti(serramenti: Serramento[], opzioni: OpzioniAbaco = {}): string {
  const gruppi = new Map<string, number>()

  for (const s of serramenti) {
    const dim = `${formattaCm(s.b)}x${formattaCm(s.h)}`
    gruppi.set(dim, (gruppi.get(dim) ?? 0) + 1)
  }

  const righe = [...gruppi.entries()].map(([dim, quantita]) => {
    if (opzioni.prefisso) {
      return opzioni.prefisso.replace('{n}', String(quantita)).replace('{dim}', dim)
    }
    return `n. ${quantita} dim. ${dim}`
  })

  return righe.join('; ') + (righe.length > 0 && !opzioni.prefisso ? ';' : '')
}

export interface AbacoPerCategoria {
  tutti: string
  finestreBattente: string
  portefinestreBattente: string
  fissiVetrate: string
  alzantiScorrevoli: string
  portoncini: string
}

export function generaAbacoPerCategoria(serramenti: Serramento[]): AbacoPerCategoria {
  const perCategoria = (categoria: Serramento['categoria']) =>
    generaAbacoSerramenti(serramenti.filter((s) => s.categoria === categoria))

  return {
    tutti: generaAbacoSerramenti(serramenti),
    finestreBattente: perCategoria('finestra-battente'),
    portefinestreBattente: perCategoria('portafinestra-battente'),
    fissiVetrate: perCategoria('fisso-vetrata'),
    alzantiScorrevoli: perCategoria('alzante-scorrevole'),
    portoncini: perCategoria('portoncino'),
  }
}
