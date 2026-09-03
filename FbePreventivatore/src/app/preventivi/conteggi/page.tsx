'use client'

import { useState } from 'react'
import { CaricamentoComputo } from './CaricamentoComputo'
import { Breadcrumb } from '../ui/Breadcrumb'
import type { Computo } from '@/domain/computo/estrai-voci'

export default function PaginaConteggi() {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Breadcrumb
        voci={[
          { label: 'Home', href: '/' },
          { label: 'Preventivi', href: '/preventivi' },
          { label: 'Conteggi da computo' },
        ]}
      />

      <div className="mb-6">
        <h1 className="text-lg font-bold text-text">Conteggi da computo metrico</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Ricava gli importi delle voci dell&apos;offerta dal computo Primus, mostrando ogni
          passaggio. Non modifica i preventivi esistenti.
        </p>
      </div>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
        }}
      />
    </div>
  )
}
