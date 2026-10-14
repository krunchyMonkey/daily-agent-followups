import type { Cell, Line } from './types'

/** Splits one CSV line, honouring double-quoted fields. */
function splitCsv(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else quoted = !quoted
    } else if (ch === ',' && !quoted) {
      cells.push(current)
      current = ''
    } else current += ch
  }
  cells.push(current)
  return cells
}

/**
 * Fixed-width text: runs separated by 2+ spaces are cells, and the character offset is used as the x position.
 * That lets the same overlap-based column alignment as PDFs handle blank cells (e.g. a missing revenue).
 */
function splitFixedWidth(line: string): Cell[] {
  return [...line.matchAll(/\S+(?: \S+)*/g)].map((m) => ({ text: m[0], x0: m.index, x1: m.index + m[0].length }))
}

type Splitter = (line: string) => Cell[]

const delimited = (split: (l: string) => string[]): Splitter => (l) => split(l).map((text) => ({ text: text.trim() }))

/** Picks one format for the whole file based on the header line (the first line mentioning "status"). */
function chooseSplitter(lines: string[]): Splitter {
  const header = lines.find((l) => /status/i.test(l)) ?? lines[0] ?? ''
  if (header.includes('\t')) return delimited((l) => l.split('\t'))
  if (header.includes('|')) return delimited((l) => l.split('|'))
  if (header.includes(',')) return delimited(splitCsv)
  return splitFixedWidth
}

/**
 * Text / CSV / TSV input -> lines of cells. Used for samples/sample-report.txt and as a fallback when a PDF
 * cannot be read (export the report as text instead). Delimited formats keep empty cells so columns stay aligned.
 */
export function textToLines(content: string): Line[] {
  const raw = content.split(/\r?\n/)
  const split = chooseSplitter(raw.filter((l) => l.trim()))
  return raw.map((l) => ({ cells: l.trim() ? split(l) : [] }))
}
