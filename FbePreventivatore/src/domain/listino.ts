import type { Driver } from './voci'

export interface ListinoAnno {
  anno: number
  driver: Record<string, Driver>
}

export const LISTINO_2026: ListinoAnno = {
  anno: 2026,
  driver: {
    'pareti-mhm': { tipo: 'mq_superficie_lorda', eurMq: 597 },
    'trave-larice': { tipo: 'ml_perimetro', eurMl: 97 },
    'solaio-interpiano': { tipo: 'mq_superficie_lorda', eurMq: 280 },
    'copertura-falda': { tipo: 'mq_superficie_lorda', eurMq: 395 },
    cappotto: { tipo: 'mq_superficie_lorda', eurMq: 126 },
    'cartongesso-q2': { tipo: 'mq_superficie_lorda', eurMq: 96 },
    'assistenza-cartongessisti': { tipo: 'percentuale_voce', percentuale: 0.142, vocePadreId: 'cartongesso-q2' },
    'infissi-pvc': { tipo: 'mq_serramenti_lordi', eurMq: 502, extraCorpo: 4000 },
    monoblocchi: { tipo: 'numero_serramenti', eurPezzo: 927 },
    'progettazione-esecutiva': { tipo: 'corpo_fisso', importo: 4000 },
    'opere-chiavi-in-mano': { tipo: 'mq_superficie_lorda', eurMq: 553 },
    garage: { tipo: 'mq_garage', eurMq: 488 },
  },
}

export function driverPer(listino: ListinoAnno, voceId: string): Driver | undefined {
  return listino.driver[voceId]
}

export interface InputGeometricoListino {
  superficiLordeTotale: number
  superficieGarage: number
  perimetro: number
  serramenti: { areaLordaTotale: number; numero: number }
}

export function proponiValore(
  driver: Driver,
  input: InputGeometricoListino,
  vociGiaValorizzate: Map<string, number>,
): number {
  switch (driver.tipo) {
    case 'mq_superficie_lorda':
      return arrotonda2(driver.eurMq * input.superficiLordeTotale)
    case 'mq_garage':
      return arrotonda2(driver.eurMq * input.superficieGarage)
    case 'ml_perimetro':
      return arrotonda2(driver.eurMl * input.perimetro)
    case 'mq_serramenti_lordi':
      return arrotonda2(driver.eurMq * input.serramenti.areaLordaTotale + (driver.extraCorpo ?? 0))
    case 'numero_serramenti':
      return arrotonda2(driver.eurPezzo * input.serramenti.numero)
    case 'corpo_fisso':
      return driver.importo
    case 'percentuale_voce': {
      const valorePadre = vociGiaValorizzate.get(driver.vocePadreId) ?? 0
      return arrotonda2(valorePadre * driver.percentuale)
    }
    default:
      return 0
  }
}

function arrotonda2(valore: number): number {
  return Math.round(valore * 100) / 100
}
