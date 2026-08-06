// CSS globale non-module: in App Router va importato nel root layout perché si
// applichi a ogni route (cfr. node_modules/next/dist/docs/01-app/01-getting-started/11-css.md).
// Definisce `.pagina-a4` e il blocco @media print usati da tutte le pagine di preview.
import '@/documento/preview/print.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
