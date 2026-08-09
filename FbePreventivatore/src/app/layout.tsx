// CSS globale non-module: in App Router va importato nel root layout perché si
// applichi a ogni route (cfr. node_modules/next/dist/docs/01-app/01-getting-started/11-css.md).
import './globals.css'
// Definisce `.pagina-a4` e il blocco @media print usati da tutte le pagine di preview.
// Le regole di print.css sono CSS unlayered, mentre il preflight di Tailwind sta in
// `@layer base`: l'unlayered vince sempre sul layered (non è questione di specificità),
// quindi ciò che print.css dichiara non viene mai sovrascritto. Attenzione però:
// tutto ciò che print.css NON ristila (titoli, paragrafi, liste) subisce comunque il
// reset del preflight — per questo `.pagina-a4` ha bisogno delle regole aggiuntive
// su heading/paragrafi/liste definite in globals.css.
import '@/documento/preview/print.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
