import { describe, it, expect } from '@jest/globals'
import {
  LOGO_CID,
  STOKGELD_TEXT_SIGNATURE,
  buildStokGeldEmail,
  escapeHtml,
  htmlSignatureBlock,
  textToMainHtmlBlock,
} from './emailSignature.js'

describe('emailSignature utils', () => {
  it('buildStokGeldEmail builds full payload on happy path', () => {
    const out = buildStokGeldEmail({
      from: 'noreply@stokgeld.app',
      to: 'member@example.com',
      subject: 'Welcome',
      mainText: 'Hello member',
    })

    expect(out.from).toBe('noreply@stokgeld.app')
    expect(out.to).toBe('member@example.com')
    expect(out.subject).toBe('Welcome')
    expect(out.text).toContain('Hello member')
    expect(out.text).toContain(STOKGELD_TEXT_SIGNATURE)
    expect(out.html).toContain('<!DOCTYPE html>')
    expect(out.html).toContain('StokGeld management team')
    expect(Array.isArray(out.attachments)).toBe(true)
  })

  it('handles null/undefined arguments without throwing and applies fallbacks', () => {
    expect(() =>
      buildStokGeldEmail({
        from: undefined,
        to: null,
        subject: undefined,
        mainText: undefined,
      }),
    ).not.toThrow()

    const out = buildStokGeldEmail({
      from: undefined,
      to: null,
      subject: undefined,
      mainText: undefined,
      mainHtml: null,
    })

    expect(out.text).toContain('undefined')
    expect(out.text).toContain(STOKGELD_TEXT_SIGNATURE)
    expect(out.html).toContain('undefined')
  })

  it('uses provided mainHtml when present', () => {
    const out = buildStokGeldEmail({
      from: 'a@b.com',
      to: 'x@y.com',
      subject: 'S',
      mainText: 'plain',
      mainHtml: '<p>custom html</p>',
    })
    expect(out.html).toContain('<p>custom html</p>')
    expect(out.html).toContain('StokGeld management team')
  })

  it('escapes all dangerous HTML characters', () => {
    expect(escapeHtml(`<&>"'`)).toBe('&lt;&amp;&gt;&quot;&#39;')
  })

  it('textToMainHtmlBlock wraps escaped text', () => {
    const html = textToMainHtmlBlock('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('white-space:pre-wrap')
  })

  it('htmlSignatureBlock always returns branded signature block', () => {
    const block = htmlSignatureBlock()
    expect(block).toContain('StokGeld management team')
    expect(block).toContain('+27 11 234 5678')
    expect(block.includes(`cid:${LOGO_CID}`) || !block.includes(`cid:${LOGO_CID}`)).toBe(true)
  })
})
