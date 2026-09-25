// Casi AVVERSARI (scritti dopo lo sviluppo dei sistemi, mai visti da nessun candidato durante
// la messa a punto) — angolo FORMATI NUMERICI E UNITÀ.
// Misure scritte come le scrive davvero un commerciale in chat: "120x240 cm", "b 90 h 140 cm",
// "larghezza 0.8 m altezza 2.3 m", "L=2,50 H=2,70", "600x600 mm"; superfici in m2 / m² / mq,
// anche come somma scritta; spessori composti ("160+60") e intervalli ("120-100"); falde con
// notazione complessa. Ogni controllo segue in modo univoco da PROMPT_SISTEMA e dalle
// convenzioni già fissate dai casi esistenti:
//   - serramenti: b/h in METRI come numeri (anche se scritti in cm o mm); un serramento con un
//     dato mancante (qui: l'altezza) non compare; categoria dalla mappa del prompt; mai "n";
//   - pareti: b/h in metri, spessore in mm come numero; parete senza spessore omessa;
//   - superfici: valoreLordo nella forma scritta SENZA unità, somme non risolte;
//   - spessori: stringa come scritta, senza "mm", niente normalizzazione di "+" e "-";
//   - falde: notazione testuale (confronto a meno degli spazi);
//   - conversazione a turni: vale l'ultima menzione.
// Numeri decimali confrontati con tolleranza 1e-9; nomi piano confrontati a meno di
// maiuscole (la canonicità esatta è già misurata altrove, qui si misura il formato).
import type { CampiEstratti } from '../estrazione'
import type { CasoValutazione } from '../valutazione-estrazione'

type Categoria = NonNullable<CampiEstratti['serramenti']>[number]['categoria']
type VoceLibera = NonNullable<CampiEstratti['falde']>[number]

const TOLLERANZA = 1e-9
const vicino = (a: number, b: number) => Math.abs(a - b) < TOLLERANZA

// "luogo" non conta mai (si deduce dal comune, vedi ChatApertura.tsx).
const mancanti = (c: CampiEstratti) => c.campiMancanti.filter((x) => x !== 'luogo')
const parla = (c: CampiEstratti, campo: string) => mancanti(c).some((x) => x.toLowerCase().includes(campo.toLowerCase()))

const senzaSpazi = (v: string | undefined) => (v ?? '').replace(/\s/g, '')

const haSerramento = (c: CampiEstratti, categoria: Categoria, b: number, h: number) =>
  (c.serramenti ?? []).some((s) => s.categoria === categoria && vicino(s.b, b) && vicino(s.h, h))

const haParete = (c: CampiEstratti, tipo: 'I' | 'E', b: number, h: number, spessore: number) =>
  (c.pareti ?? []).some((p) => p.tipo === tipo && vicino(p.b, b) && vicino(p.h, h) && vicino(p.spessore, spessore))

const haNotazione = (voci: VoceLibera[] | undefined, attesa: string) =>
  (voci ?? []).some((v) => senzaSpazi(v.notazione) === senzaSpazi(attesa))

const superficie = (c: CampiEstratti, piano: string) =>
  c.superfici.find((s) => s.piano.trim().toLowerCase() === piano.toLowerCase())?.valoreLordo

// Forma scritta senza unità: solo cifre, separatori decimali e "+" (niente "mq", "m2", "m²").
const senzaUnita = (v: string | undefined) => v !== undefined && /^[0-9.,+]+$/.test(senzaSpazi(v))

// Confronto numerico addendo per addendo: accetta "96,40", "96.40" o "96,4", ma non una somma
// risolta né un'unità rimasta attaccata al valore.
const valeAddendi = (v: string | undefined, attesi: number[]) => {
  if (!senzaUnita(v)) return false
  const addendi = senzaSpazi(v).split('+').map((p) => Number(p.replace(',', '.')))
  return addendi.length === attesi.length && addendi.every((x, i) => vicino(x, attesi[i]))
}

export const CASI_AVVERSARI_FORMATI: CasoValutazione[] = [
  {
    id: 'R-F1-serramenti-formati-misti',
    testo: `Cliente Pegoraro Silvana, Montecchio Precalcino (VI), prot. 2026114
Serramenti:
- PT porta d'ingresso 120x240 cm
- PT finestra cucina b 90 h 140 cm
- P1 portafinestra camera larghezza 0.8 m altezza 2.3 m
- PT vetrata fissa soggiorno L=2,50 H=2,70
- P1 finestra bagno 600x600 mm
- PT alzante scorrevole largo 3,20 m, altezza ancora da decidre`,
    controlli: [
      {
        nome: 'portoncino "120x240 cm" riportato in metri: 1.2 x 2.4',
        verifica: (c) => haSerramento(c, 'portoncino', 1.2, 2.4),
      },
      {
        nome: 'finestra "b 90 h 140 cm" riportata in metri: 0.9 x 1.4',
        verifica: (c) => haSerramento(c, 'finestra-battente', 0.9, 1.4),
      },
      {
        nome: 'portafinestra "larghezza 0.8 m altezza 2.3 m" con punto decimale: 0.8 x 2.3',
        verifica: (c) => haSerramento(c, 'portafinestra-battente', 0.8, 2.3),
      },
      {
        nome: 'vetrata fissa "L=2,50 H=2,70" con virgola decimale: 2.5 x 2.7',
        verifica: (c) => haSerramento(c, 'fisso-vetrata', 2.5, 2.7),
      },
      {
        nome: 'finestra "600x600 mm" riportata in metri: 0.6 x 0.6',
        verifica: (c) => haSerramento(c, 'finestra-battente', 0.6, 0.6),
      },
      {
        nome: 'alzante con la sola larghezza omesso',
        verifica: (c) =>
          !(c.serramenti ?? []).some(
            (s) => s.categoria === 'alzante-scorrevole' || vicino(s.b, 3.2) || vicino(s.b, 320),
          ),
      },
      { nome: 'esattamente cinque serramenti', verifica: (c) => (c.serramenti ?? []).length === 5 },
    ],
  },
  {
    id: 'R-F2-superfici-unita-e-spessori-composti',
    testo: `nuovo prev. Lovato Ermes - Sarcedo (VI) - prot 2026131
sup. lorde: piano terra 20+15+8 m2, primo piano 96,40 m², portico 12 mq, terrazzo 7.5 m2
spess.: parete est. 160+60 mm, int. 120-100 mm, coibente 140 mm, cappotto 80+60mm`,
    controlli: [
      {
        nome: 'Piano Terra "20+15+8 m2": somma conservata, senza unità',
        verifica: (c) => senzaSpazi(superficie(c, 'Piano Terra')) === '20+15+8',
      },
      {
        nome: 'Piano Primo "96,40 m²": decimale conservato, senza unità',
        verifica: (c) => valeAddendi(superficie(c, 'Piano Primo'), [96.4]),
      },
      {
        nome: 'Portico "12 mq" -> "12" e Terrazzo "7.5 m2" -> 7.5, senza unità',
        verifica: (c) => senzaSpazi(superficie(c, 'Portico')) === '12' && valeAddendi(superficie(c, 'Terrazzo'), [7.5]),
      },
      {
        nome: 'quattro superfici, nessuna con l\'unità nel valore',
        verifica: (c) => c.superfici.length === 4 && c.superfici.every((s) => senzaUnita(s.valoreLordo)),
      },
      {
        nome: 'spessori composti con "+" come scritti, senza "mm"',
        verifica: (c) => senzaSpazi(c.spessoreEsterno) === '160+60' && senzaSpazi(c.spessoreCappotto) === '80+60',
      },
      {
        nome: 'intervallo "120-100" non risolto, coibente semplice "140"',
        verifica: (c) => senzaSpazi(c.spessoreInterno) === '120-100' && senzaSpazi(c.spessoreCoibente) === '140',
      },
      {
        nome: 'superfici e spessori non segnalati mancanti',
        verifica: (c) => !parla(c, 'superfici') && !parla(c, 'spessore'),
      },
    ],
  },
  {
    id: 'R-F3-pareti-formati-e-falde-complesse',
    testo: `Rif. Cecchetto Loris, Breganze VI. Copertura a falde.
Pareti (dal progetto):
par. 1 esterna L=3,00 H=2,50 sp. 205 mm
par. 2 esterna 7.40 x 2.80 m, spessore 160 mm
par. 3 interna L=4,15 H=2,50, spessore da verificare col progettista
par. 4 interna b 3,6 m h 2,5 m sp 100 mm
Falde:
falda A: (8,40+2x0,60) x 5,95
falda B: 4,20x5,95 + 1/2x2,10x1,80
trave di colmo 20x28 cm lunghezza 10,60 m`,
    controlli: [
      {
        nome: 'parete "L=3,00 H=2,50 sp. 205 mm": E 3 x 2.5, spessore 205',
        verifica: (c) => haParete(c, 'E', 3, 2.5, 205),
      },
      {
        nome: 'parete "7.40 x 2.80 m" con punto decimale: E 7.4 x 2.8, spessore 160',
        verifica: (c) => haParete(c, 'E', 7.4, 2.8, 160),
      },
      {
        nome: 'parete "b 3,6 m h 2,5 m sp 100 mm": I 3.6 x 2.5, spessore 100',
        verifica: (c) => haParete(c, 'I', 3.6, 2.5, 100),
      },
      {
        nome: 'parete interna senza spessore omessa',
        verifica: (c) => !(c.pareti ?? []).some((p) => vicino(p.b, 4.15)),
      },
      { nome: 'esattamente tre pareti (la trave non è una parete)', verifica: (c) => (c.pareti ?? []).length === 3 },
      {
        nome: 'falda con parentesi e moltiplicatore riportata testualmente',
        verifica: (c) => haNotazione(c.falde, '(8,40+2x0,60)x5,95'),
      },
      {
        nome: 'falda con somma e frazione riportata testualmente',
        verifica: (c) => haNotazione(c.falde, '4,20x5,95+1/2x2,10x1,80'),
      },
    ],
  },
  {
    id: 'R-F4-misure-corrette-a-turni',
    testo: [
      'prev. Marangon Tiziano, Caldogno (VI), prog. geom. Walter Faggion. PT 110 mq, garage 28 mq. Serramenti: PT portoncino 100x220 cm, P1 portafinestra larga 1,60. Spess. esterno 200 mm',
      'correggo il portoncino: è 1,10 x 2,30 m. la portafinestra al P1 è alta 2,40',
      "PT in realtà 110+6 mq (c'è il bow window). e spessore esterno 160+40 mm, non 200",
    ].join('\n'),
    controlli: [
      {
        nome: 'un solo portoncino, con l\'ultima misura "1,10 x 2,30 m"',
        verifica: (c) => {
          const portoncini = (c.serramenti ?? []).filter((s) => s.categoria === 'portoncino')
          return portoncini.length === 1 && vicino(portoncini[0].b, 1.1) && vicino(portoncini[0].h, 2.3)
        },
      },
      {
        nome: 'portafinestra completata al secondo turno: 1.6 x 2.4',
        verifica: (c) => haSerramento(c, 'portafinestra-battente', 1.6, 2.4),
      },
      { nome: 'esattamente due serramenti', verifica: (c) => (c.serramenti ?? []).length === 2 },
      {
        nome: 'Piano Terra aggiornato alla somma scritta "110+6"',
        verifica: (c) => senzaSpazi(superficie(c, 'Piano Terra')) === '110+6',
      },
      {
        nome: 'Garage "28 mq" -> "28" e nessun piano duplicato',
        verifica: (c) => senzaSpazi(superficie(c, 'Garage')) === '28' && c.superfici.length === 2,
      },
      {
        nome: 'spessore esterno corretto a "160+40"',
        verifica: (c) => senzaSpazi(c.spessoreEsterno) === '160+40',
      },
    ],
  },
]
