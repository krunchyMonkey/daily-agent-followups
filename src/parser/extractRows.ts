import { isIgnoredColumn, normalizeColumn, parseRevenue } from './normalizeColumns'
import type { Cell, ColumnKey, Line, ParseResult, ReportRow } from './types'

export const UNKNOWN_AGENT = 'Unknown Agent'

type HeaderColumn = { label: string; key: ColumnKey | null; ignored: boolean; x0?: number; x1?: number }

/** "Agent: Sarah Johnson" / "Sales Rep - Mike Anderson" section headings, for reports grouped by agent. */
const AGENT_HEADING = /^(?:sales\s+)?(?:agent|rep)(?:\s+name)?\s*[:\-–]\s*(.+)$/i

/** Footer / summary lines that should never become rows. */
const NOISE_LINE = /^(?:grand\s+)?totals?\b|^page\s+\d+(?:\s+of\s+\d+)?$|^subtotal\b/i

const lineText = (line: Line) => line.cells.map((c) => c.text).join(' ').replace(/\s+/g, ' ').trim()

/**
 * A header line has a Status column plus at least one other known column.
 * TODO(real-pdf): if the real report has no "Status" header, relax this rule.
 */
function asHeader(line: Line): HeaderColumn[] | null {
  const columns = line.cells.map<HeaderColumn>((c) => ({
    label: c.text.trim(),
    key: normalizeColumn(c.text),
    ignored: isIgnoredColumn(c.text),
    x0: c.x0,
    x1: c.x1,
  }))
  const keys = new Set(columns.map((c) => c.key).filter(Boolean))
  return keys.has('status') && keys.size >= 2 ? columns : null
}

/** Finds the first date in a header line and returns it as YYYY-MM-DD. */
export function findDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) return `${iso[1]}-${iso[2]!.padStart(2, '0')}-${iso[3]!.padStart(2, '0')}`
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/)
  if (us) {
    const year = us[3]!.length === 2 ? `20${us[3]}` : us[3]
    return `${year}-${us[1]!.padStart(2, '0')}-${us[2]!.padStart(2, '0')}`
  }
  return undefined
}

/**
 * Assigns each data cell to a header column.
 * - PDF lines (cells have x positions): pick the column with the largest horizontal overlap, else the nearest one.
 *   Overlap handles both left-aligned text and right-aligned money columns.
 * - Text lines (no positions): match by index.
 */
function alignCells(header: HeaderColumn[], cells: Cell[]): Map<number, string> {
  const assigned = new Map<number, string>()
  const put = (index: number, text: string) => {
    const existing = assigned.get(index)
    assigned.set(index, existing ? `${existing} ${text}` : text)
  }

  const positioned = header.every((h) => h.x0 !== undefined) && cells.every((c) => c.x0 !== undefined)
  if (!positioned) {
    cells.forEach((cell, i) => i < header.length && put(i, cell.text))
    return assigned
  }

  for (const cell of cells) {
    let best = -1
    let bestScore = -Infinity
    header.forEach((h, i) => {
      const overlap = Math.min(cell.x1!, h.x1!) - Math.max(cell.x0!, h.x0!)
      const distance = Math.abs((cell.x0! + cell.x1!) / 2 - (h.x0! + h.x1!) / 2)
      const score = overlap > 0 ? 10_000 + overlap : -distance
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    })
    if (best >= 0) put(best, cell.text)
  }
  return assigned
}

/**
 * Turns visual lines (from a PDF or a text file) into report rows.
 * Supports multi-page reports with a repeated header, and reports grouped under "Agent: Name" headings.
 */
export function extractRows(lines: Line[]): ParseResult {
  const rows: ReportRow[] = []
  const detected = new Set<string>()
  const ignored = new Set<string>()
  let header: HeaderColumn[] | null = null
  let currentAgent: string | undefined
  let reportDate: string | undefined
  let skippedLines = 0

  for (const line of lines) {
    const text = lineText(line)
    if (!text) continue

    const headerColumns = asHeader(line)
    if (headerColumns) {
      header = headerColumns
      headerColumns.forEach((h) => (h.key ? detected.add(h.label) : h.ignored && ignored.add(h.label)))
      continue
    }

    const heading = text.match(AGENT_HEADING)
    if (heading && line.cells.length <= 2) {
      currentAgent = heading[1]!.trim()
      continue
    }

    if (!header) {
      reportDate ??= findDate(text)
      continue
    }

    if (NOISE_LINE.test(text)) continue

    const values: Partial<Record<ColumnKey, string>> = {}
    const raw: Record<string, string> = {}
    for (const [index, value] of alignCells(header, line.cells)) {
      const column = header[index]!
      if (column.ignored) continue // "Today's Rev" is dropped entirely
      raw[column.label] = value
      if (column.key) values[column.key] = value.trim()
    }

    if (!values.status) {
      skippedLines++
      continue
    }

    rows.push({
      agentName: values.agentName || currentAgent || UNKNOWN_AGENT,
      customerName: values.customerName || undefined,
      accountId: values.accountId || undefined,
      status: values.status,
      revenue: parseRevenue(values.revenue),
      raw,
    })
  }

  return { rows, detectedColumns: [...detected], ignoredColumns: [...ignored], reportDate, skippedLines }
}
