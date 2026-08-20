import Link from 'next/link'

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col items-center justify-center px-6 py-12">
      <h1 className="mb-10 text-2xl font-bold text-text">FBE Preventivatore</h1>
      <div className="grid w-full max-w-2xl gap-6 sm:grid-cols-2">
        <Link
          href="/preventivi"
          className="flex flex-col gap-2 rounded-lg border border-border-warm bg-white p-6 transition-colors hover:border-accent"
        >
          <span className="text-lg font-semibold text-text">Consulta preventivi</span>
          <span className="text-sm text-text-secondary">Preventivi già realizzati e in bozza</span>
        </Link>
        <Link
          href="/preventivi/nuovo"
          className="flex flex-col gap-2 rounded-lg border border-border-warm bg-white p-6 transition-colors hover:border-accent"
        >
          <span className="text-lg font-semibold text-text">Nuovo preventivo</span>
          <span className="text-sm text-text-secondary">Avvia il wizard guidato per crearne uno</span>
        </Link>
        <Link
          href="/preventivi/nuovo-v2"
          className="flex flex-col gap-2 rounded-lg border border-border-warm bg-white p-6 transition-colors hover:border-accent"
        >
          <span className="text-lg font-semibold text-text">Nuovo preventivo (import Excel)</span>
          <span className="text-sm text-text-secondary">Carica il file dei conteggi invece di descrivere il progetto</span>
        </Link>
      </div>
    </div>
  )
}
