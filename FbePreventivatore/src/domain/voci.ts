// src/domain/voci.ts

export type Modulo = 'struttura' | 'involucro' | 'finiture'
export type Gruppo = 'grezzo' | 'post_sconto'
export type LivelloModulo = 'completo' | 'impoverito' | 'escluso'

export type Driver =
  | { tipo: 'mq_superficie_lorda'; eurMq: number }
  | { tipo: 'mq_superficie_sedime'; eurMq: number }
  | { tipo: 'mq_garage'; eurMq: number }
  | { tipo: 'ml_perimetro'; eurMl: number }
  | { tipo: 'mq_serramenti_lordi'; eurMq: number; extraCorpo?: number }
  | { tipo: 'numero_serramenti'; eurPezzo: number }
  | { tipo: 'percentuale_voce'; percentuale: number; vocePadreId: string }
  | { tipo: 'corpo_fisso'; importo: number }

export interface ConfigurazioneVoci {
  livelli: Record<Modulo, LivelloModulo>
  numeroPianiAbitativi: number
  superficieGarage: number
  chiaviInManoNelTotale: boolean
}

export interface VoceCatalogo {
  id: string
  modulo?: Modulo
  gruppo: Gruppo
  livelloRichiesto?: LivelloModulo
  sottovoceDi?: string
  descrizioneTemplate: string
  driver: Driver | null
  importoTestualeDefault?: 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'
  condizione?: (config: ConfigurazioneVoci) => boolean
}

const RANK: Record<LivelloModulo, number> = { escluso: 0, impoverito: 1, completo: 2 }

export function voceInclusa(voce: VoceCatalogo, config: ConfigurazioneVoci): boolean {
  if (voce.modulo && voce.livelloRichiesto) {
    if (RANK[config.livelli[voce.modulo]] < RANK[voce.livelloRichiesto]) return false
  }
  if (voce.condizione && !voce.condizione(config)) return false
  return true
}

export function vociIncluse(catalogo: VoceCatalogo[], config: ConfigurazioneVoci): VoceCatalogo[] {
  return catalogo.filter((voce) => voceInclusa(voce, config))
}

export interface VoceNumerata {
  numero: string
  voce: VoceCatalogo
}

export function numeraVoci(voci: VoceCatalogo[]): VoceNumerata[] {
  const risultato: VoceNumerata[] = []
  let contatore = 0
  let letteraCorrente = 0
  let padreCorrenteId: string | undefined

  for (const voce of voci) {
    if (voce.sottovoceDi && voce.sottovoceDi === padreCorrenteId) {
      letteraCorrente += 1
      risultato.push({ numero: `${contatore}.${String.fromCharCode(96 + letteraCorrente)}`, voce })
    } else {
      contatore += 1
      letteraCorrente = 0
      padreCorrenteId = voce.id
      risultato.push({ numero: `${contatore}`, voce })
    }
  }
  return risultato
}

// Ordine di catalogo = ordine di numerazione (cfr. spec §5.1: i numeri si rinumerano
// scorrendo le voci incluse in quest'ordine). Sottovoci sempre immediatamente dopo il padre.
export const CATALOGO_VOCI: VoceCatalogo[] = [
  {
    id: 'pareti-mhm',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Pareti strutturali in legno "M.H.M." esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}',
    driver: null,
  },
  {
    id: 'tracciamento-impianti',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate:
      'Tracciamento impianto idrosanitario ed elettrico come da tavola di "predisposizione impianti" sottoscritta',
    driver: null,
    importoTestualeDefault: 'comprese',
  },
  {
    id: 'pareti-telaio',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate:
      'Pareti non strutturali a telaio composta dalla struttura del telaio e da 2 lastre di cartongesso da un lato',
    driver: null,
    importoTestualeDefault: 'comprese',
  },
  {
    id: 'trave-larice',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate: 'Trave alla base in larice',
    driver: null,
  },
  {
    id: 'solaio-interpiano',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Solaio interpiano in legno lato inferiore a vista',
    driver: null,
    condizione: (config) => config.numeroPianiAbitativi > 1,
  },
  {
    id: 'copertura-falda',
    modulo: 'involucro',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Copertura a falda in travi e tavolato lato inferiore a vista compreso di coibentazione in fibra di legno sp. mm {{spessoreCoibente}}, teli traspiranti e freni, manto di copertura e lattoneria varia',
    driver: null,
  },
  {
    id: 'cappotto',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Cappotto esterno in fibra di legno sp. mm {{spessoreCappotto}} finito con rasante ed intonaco',
    driver: null,
  },
  {
    id: 'cartongesso-q2',
    modulo: 'finiture',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Cartongesso interno a placcatura diretta su pareti "M.H.M." con finitura "Q2" e il completamento delle pareti a telaio',
    driver: null,
  },
  {
    id: 'assistenza-cartongessisti',
    modulo: 'finiture',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    sottovoceDi: 'cartongesso-q2',
    descrizioneTemplate: 'Assistenza ai cartongessisti',
    driver: null,
  },
  {
    id: 'infissi-pvc',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Infissi esterni in PVC (escluso oscuranti) con un portoncino di ingresso',
    driver: null,
  },
  {
    id: 'monoblocchi',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'infissi-pvc',
    descrizioneTemplate: 'Monoblocchi lisci su 4 lati ditta Hella per posa infissi',
    driver: null,
  },
  {
    id: 'progettazione-esecutiva',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Consulenza progettazione esecutiva di produzione',
    driver: null,
  },
  {
    id: 'opere-chiavi-in-mano',
    modulo: 'finiture',
    gruppo: 'post_sconto',
    descrizioneTemplate: 'Stima opere chiavi in mano',
    driver: null,
    condizione: (config) => config.livelli.finiture !== 'completo' && config.chiaviInManoNelTotale,
  },
  {
    id: 'garage',
    gruppo: 'post_sconto',
    descrizioneTemplate: 'Garage realizzato con struttura a telaio portante',
    driver: null,
    condizione: (config) => config.superficieGarage > 0,
  },
]
