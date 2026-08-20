function nomeFileDaContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename="([^"]+)"/)
  return match ? match[1] : null
}

// Lancia il download dal Content-Disposition della risposta, o lancia un errore
// leggibile se la risposta non è ok — chiamante deve gestire lo stato di caricamento.
export async function scaricaDocumentoDaRisposta(risposta: Response, nomeFileDiFallback: string) {
  if (!risposta.ok) {
    const corpo = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
    throw new Error(corpo.errore ?? `Errore ${risposta.status}`)
  }

  const blob = await risposta.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeFileDaContentDisposition(risposta.headers.get('Content-Disposition')) ?? nomeFileDiFallback
  link.click()
  URL.revokeObjectURL(url)
}
