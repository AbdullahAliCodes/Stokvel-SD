export function escapeCsvCell(value) {
  const text = value == null ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function buildCsvContent(headers, rows) {
  const headerLine = headers.map(escapeCsvCell).join(',')
  const bodyLines = (rows ?? []).map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(','),
  )
  return `\uFEFF${[headerLine, ...bodyLines].join('\r\n')}`
}

export function safeExportFilename(base) {
  const cleaned = String(base ?? 'report')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return cleaned.slice(0, 80) || 'report'
}

export function downloadCsv(filenameBase, headers, rows) {
  const filename = `${safeExportFilename(filenameBase)}.csv`
  const content = buildCsvContent(headers, rows)
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function downloadPdf({ title, subtitle, headers, rows, filenameBase }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const filename = `${safeExportFilename(filenameBase)}.pdf`
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const marginX = 14
  let cursorY = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(String(title ?? 'Report'), marginX, cursorY)
  cursorY += 8

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(String(subtitle), 180)
    doc.text(lines, marginX, cursorY)
    cursorY += lines.length * 5 + 2
  }

  autoTable(doc, {
    head: [headers],
    body: rows ?? [],
    startY: cursorY,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [5, 122, 85] },
    margin: { left: marginX, right: marginX },
  })

  doc.save(filename)
}
