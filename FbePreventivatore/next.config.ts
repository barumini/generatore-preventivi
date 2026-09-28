import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Il master .docx è letto con un percorso costruito a runtime (process.cwd()), che il
  // tracing non vede: va incluso a mano nella funzione di export. La cartella dello spike
  // (~116 MB di copie di lavoro) non serve a nessuna route e sfonderebbe il limite di Vercel.
  outputFileTracingIncludes: {
    '/api/preventivi/**/export': ['./template/Offerta MHM master.docx'],
  },
  outputFileTracingExcludes: {
    '/*': ['./template/spike/**/*', './Documentazione addestramento/**/*', './e2e/**/*'],
  },
}

export default nextConfig
