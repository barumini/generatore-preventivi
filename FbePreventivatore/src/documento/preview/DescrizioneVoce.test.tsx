import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DescrizioneVoce } from './DescrizioneVoce'

describe('DescrizioneVoce', () => {
  it('renderizza testo semplice senza alcuna classe quando non ci sono placeholder', () => {
    const html = renderToStaticMarkup(<DescrizioneVoce descrizione="Trave alla base in larice" />)
    expect(html).toContain('Trave alla base in larice')
    expect(html).not.toContain('placeholder-non-interpolato')
  })

  it('applica la classe placeholder-non-interpolato solo al token residuo', () => {
    const html = renderToStaticMarkup(
      <DescrizioneVoce descrizione="Cappotto esterno in fibra di legno sp. mm {{spessoreCappotto}} finito con rasante ed intonaco" />,
    )
    expect(html).toContain('<span>Cappotto esterno in fibra di legno sp. mm </span>')
    expect(html).toContain('<span class="placeholder-non-interpolato">{{spessoreCappotto}}</span>')
    expect(html).toContain('<span> finito con rasante ed intonaco</span>')
  })
})
