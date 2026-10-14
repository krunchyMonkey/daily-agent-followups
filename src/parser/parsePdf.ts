import { extractRows } from './extractRows'
import { textToLines } from './parseText'
import type { Cell, Line, ParseResult } from './types'

export const PDF_PARSE_ERROR =
  'Unable to extract usable data from the PDF. The PDF may be scanned, image-based, or formatted in a way this first-pass parser does not support yet.'

/** The subset of the pdf.js API we use. Injected so tests can pass the Node build and the app the browser build. */
export type PdfJs = {
  getDocument: (src: { data: Uint8Array }) => { promise: Promise<PdfDocument> }
}
type PdfDocument = {
  numPages: number
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }>
  destroy?: () => Promise<void>
}
type TextItem = { str: string; transform: number[]; width: number; height: number }

const isTextItem = (item: unknown): item is TextItem =>
  typeof item === 'object' && item !== null && 'str' in item && 'transform' in item

/**
 * Rebuilds visual lines from positioned PDF text: items with (almost) the same baseline form a line,
 * and items close together on a line merge into one cell. Wide gaps separate columns.
 * TODO(real-pdf): tune the tolerances below once we see Ryan's real report.
 */
export async function extractPdfLines(pdfjs: PdfJs, data: ArrayBuffer): Promise<Line[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const lines: Line[] = []

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = content.items
        .filter(isTextItem)
        .filter((i) => i.str.trim())
        .map((i) => ({ text: i.str, x: i.transform[4]!, y: i.transform[5]!, width: i.width, height: i.height || 10 }))
        .sort((a, b) => b.y - a.y || a.x - b.x)

      const pageLines: (typeof items)[] = []
      for (const item of items) {
        const current = pageLines.at(-1)
        const tolerance = Math.max(2, item.height * 0.5)
        if (current && Math.abs(current[0]!.y - item.y) <= tolerance) current.push(item)
        else pageLines.push([item])
      }

      for (const lineItems of pageLines) {
        lineItems.sort((a, b) => a.x - b.x)
        const cells: Cell[] = []
        for (const item of lineItems) {
          const last = cells.at(-1)
          const gap = last ? item.x - last.x1! : Infinity
          if (last && gap < Math.max(2, item.height * 0.35)) {
            last.text += (gap > 0.5 ? ' ' : '') + item.text
            last.x1 = item.x + item.width
          } else {
            cells.push({ text: item.text, x0: item.x, x1: item.x + item.width })
          }
        }
        cells.forEach((c) => (c.text = c.text.replace(/\s+/g, ' ').trim()))
        lines.push({ cells: cells.filter((c) => c.text), page: pageNumber })
      }
    }
  } finally {
    await doc.destroy?.()
  }
  return lines
}

/** Parses a PDF (or a .txt/.csv export) into report rows. Throws PDF_PARSE_ERROR when nothing usable is found. */
export async function parseReportFile(
  file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> },
  pdfjs: PdfJs,
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer()
  let lines: Line[]
  try {
    lines = /\.(txt|csv|tsv)$/i.test(file.name)
      ? textToLines(new TextDecoder().decode(buffer))
      : await extractPdfLines(pdfjs, buffer)
  } catch {
    throw new Error(PDF_PARSE_ERROR)
  }

  const result = extractRows(lines)
  if (result.rows.length === 0) throw new Error(PDF_PARSE_ERROR)
  return result
}
