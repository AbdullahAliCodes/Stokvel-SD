import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const LOGO_FILENAME = 'stokgeld-logo.png'
export const LOGO_CID = 'stokgeld-logo@stokgeld.app'

/** @type {string} */
const _logoPath = (() => {
  const inBackend = path.join(__dirname, '../../assets', LOGO_FILENAME)
  if (fs.existsSync(inBackend)) return inBackend
  const fromFrontend = path.join(__dirname, '../../../frontend/src/assets', LOGO_FILENAME)
  return fs.existsSync(fromFrontend) ? fromFrontend : inBackend
})()

const FOOTER_TEXT = `StokGeld management team
T +27 11 234 5678`

export const STOKGELD_TEXT_SIGNATURE = `—\n${FOOTER_TEXT}`

function logoAttachments() {
  if (!fs.existsSync(_logoPath)) {
    return []
  }
  return [
    {
      filename: LOGO_FILENAME,
      path: _logoPath,
      cid: LOGO_CID,
    },
  ]
}

export function htmlSignatureBlock() {
  const hasLogo = fs.existsSync(_logoPath)
  const img = hasLogo
    ? `<img src="cid:${LOGO_CID}" alt="StokGeld" width="220" style="display:block;border:0;max-width:220px;height:auto;margin-top:10px" />`
    : ''
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:520px;border-collapse:collapse;margin-top:20px">
  <tr>
    <td style="border-top:2px solid #1e4d2b;padding-top:14px;font-family:Arial,Helvetica,sans-serif">
      <p style="margin:0 0 2px;font-size:15px;font-weight:700;color:#1e4d2b;letter-spacing:0.01em">StokGeld management team</p>
      <p style="margin:0 0 10px;font-size:13px;color:#2d5a2d"><span style="color:#1e4d2b;font-weight:600">T</span> +27 11 234 5678</p>
      <div style="line-height:0;padding-bottom:8px">
        <div style="height:2px;width:70%;background:#2a2a2a;display:inline-block;vertical-align:top"></div><div style="height:2px;width:6%;background:#1e4d2b;display:inline-block;vertical-align:top"></div><div style="height:2px;width:6%;background:#2d6a3f;display:inline-block;vertical-align:top"></div><div style="height:2px;width:6%;background:#3d8b4a;display:inline-block;vertical-align:top"></div><div style="height:2px;width:6%;background:#5cb85c;display:inline-block;vertical-align:top"></div>
      </div>
      ${img}
    </td>
  </tr>
</table>`.trim()
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function textToMainHtmlBlock(mainText) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#222;white-space:pre-wrap;">${escapeHtml(
    mainText,
  )}</div>`
}

/**
 * @param {object} p
 * @param {string} p.from
 * @param {string} p.to
 * @param {string} p.subject
 * @param {string} p.mainText — body only (no signature)
 * @param {string} [p.mainHtml] — optional; defaults to pre-wrapped escaped mainText
 */
export function buildStokGeldEmail({ from, to, subject, mainText, mainHtml }) {
  const text = `${String(mainText).replace(/\s+$/u, '')}\n\n${STOKGELD_TEXT_SIGNATURE}`
  const body = mainHtml ?? textToMainHtmlBlock(mainText)
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:16px;background:#f9faf9">
  ${body}
  ${htmlSignatureBlock()}
</body>
</html>`.trim()
  return {
    from,
    to,
    subject,
    text,
    html,
    attachments: logoAttachments(),
  }
}
