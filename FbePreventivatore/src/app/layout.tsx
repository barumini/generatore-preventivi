// CSS globale non-module: in App Router va importato nel root layout perché si
// applichi a ogni route (cfr. node_modules/next/dist/docs/01-app/01-getting-started/11-css.md).
import './globals.css'
// Definisce `.pagina-a4` e il blocco @media print usati da tutte le pagine di preview.
// Importato dopo globals.css: le sue regole (tutte scoped a `.pagina-a4`) hanno
// specificità maggiore del preflight di Tailwind e non vanno mai sovrascritte.
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
