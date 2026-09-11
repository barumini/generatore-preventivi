import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `type: module` in package.json: niente __dirname CommonJS in questo file.
const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Suite E2E per lo step "4. Computo metrico" di /preventivi/nuovo-v3: carica un
 * PDF Primus reale nel browser (pdfjs-dist gira lato client, come per un utente
 * vero) e verifica i due golden case di dominio — vedi
 * docs/testing-computo-metrico-nuovo-v3.md per i numeri attesi e la loro origine
 * nei test Vitest di src/domain/computo/. Questi numeri sono al livello
 * "pipeline computo → conteggio", diversi da quelli — digitati a mano, tondi —
 * del golden case commerciale in CLAUDE.md e testing-golden-case-crivellaro.md.
 */

const FIXTURES = path.join(__dirname, 'fixtures')

interface CasoGolden {
  nome: string
  file: string
  vociLette: string
  categorie: string
  totaleComputo: string
  sommaVoci: string
  target: string
  delta: string
  importi: Record<string, string>
  avvisoSicurezza: string
  vociScartate: string[]
  vociEscluse: string[]
}

const CASI: CasoGolden[] = [
  {
    nome: 'Crivellaro rev.04',
    file: 'computo-crivellaro.pdf',
    vociLette: '166',
    categorie: '8',
    totaleComputo: '260 260,99 €',
    sommaVoci: '215 815,97 €',
    target: '236 960,99 €',
    delta: '21 145,02 €',
    importi: {
      'pareti-mhm': '100 645,84 €',
      'trave-larice': '5 843,70 €',
      'solaio-interpiano': 'compresa',
      'copertura-falda': '58 849,06 €',
      'cappotto': '21 253,32 €',
      'cartongesso-q2': '15 506,77 €',
      'assistenza-cartongessisti': '2 162,30 €',
      'infissi-pvc': '19 250,00 €',
      'monoblocchi': '9 450,00 €',
      'progettazione-esecutiva': '4 000,00 €',
    },
    avvisoSicurezza: '23 352,50',
    vociScartate: ['copertura-piana', 'veletta-perimetrale'],
    vociEscluse: ['solaio-interpiano'],
  },
  {
    nome: 'Da Croce rev.03',
    file: 'computo-dacroce.pdf',
    vociLette: '166',
    categorie: '8',
    totaleComputo: '323 643,58 €',
    sommaVoci: '278 787,93 €',
    target: '300 343,58 €',
    delta: '21 555,65 €',
    importi: {
      'pareti-mhm': '127 543,28 €',
      'trave-larice': '10 104,24 €',
      'solaio-interpiano': '15 240,96 €',
      'copertura-falda': '54 474,19 €',
      'cappotto': '21 624,51 €',
      'cartongesso-q2': '18 975,90 €',
      'assistenza-cartongessisti': '2 655,50 €',
      'infissi-pvc': '31 230,00 €',
      'monoblocchi': '14 495,00 €',
      'progettazione-esecutiva': '4 000,00 €',
    },
    avvisoSicurezza: '23 352,50',
    vociScartate: ['copertura-piana', 'veletta-perimetrale'],
    vociEscluse: ['solaio-interpiano'],
  },
]

async function apriStepComputoMetrico(page: Page) {
  await page.goto('/preventivi/nuovo-v3')
  await page.getByRole('button', { name: '4. Computo metrico' }).click()
}

for (const caso of CASI) {
  test.describe(`Computo metrico — golden case ${caso.nome}`, () => {
    test('estrae, conteggia e riconcilia i numeri attesi', async ({ page }) => {
      await apriStepComputoMetrico(page)

      await page.setInputFiles('input[type="file"]', path.join(FIXTURES, caso.file))

      // Estrazione: pdfjs-dist gira lato client, il parsing di un PDF di ~750 KB
      // può richiedere qualche secondo in più del timeout di default di expect().
      await expect(page.getByTestId('computo-voci-lette')).toContainText(caso.vociLette, {
        timeout: 15_000,
      })
      await expect(page.getByTestId('computo-categorie')).toContainText(caso.categorie)
      await expect(page.getByTestId('computo-totale')).toContainText(caso.totaleComputo)
      await expect(page.getByText('Verifica superata')).toBeVisible()

      // Riconciliazione pipeline computo -> conteggio
      await expect(page.getByTestId('riconciliazione-somma-voci')).toHaveText(caso.sommaVoci)
      await expect(page.getByTestId('riconciliazione-target')).toHaveText(caso.target)
      await expect(page.getByTestId('riconciliazione-delta')).toHaveText(caso.delta)

      // Importo calcolato per ogni voce del catalogo
      for (const [idMaster, importoAtteso] of Object.entries(caso.importi)) {
        await expect(page.getByTestId(`importo-voce-${idMaster}`)).toHaveText(importoAtteso)
      }

      // Avviso: sicurezza dichiarata nel computo diversa dal forfettario di conteggio
      await expect(page.getByTestId('avviso-sicurezza-diversa')).toContainText(caso.avvisoSicurezza)

      // Voci non applicate al preventivo (fuori catalogo o escluse dalla configurazione)
      const alertScartate = page.getByRole('alert').filter({ hasText: 'non hanno una voce corrispondente' })
      for (const idMaster of caso.vociScartate) {
        await expect(alertScartate).toContainText(idMaster)
      }
      const alertEscluse = page.getByRole('alert').filter({ hasText: 'escluse dalla configurazione' })
      for (const idMaster of caso.vociEscluse) {
        await expect(alertEscluse).toContainText(idMaster)
      }

      // Nessun errore bloccante: solo avvisi, mai un banner "errore" di livello critico
      // per un computo Primus reale e ben formato.
      await expect(page.getByText('Non riesco a leggere questo PDF')).toHaveCount(0)
    })
  })
}
