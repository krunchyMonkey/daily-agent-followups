import type { ColumnKey } from './types'

/** "Today’s Rev" -> "todaysrev". Lower-case, curly quotes folded, everything but letters/digits removed. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Header variants that must never be used — checked before the aliases so that
 * "Today's Rev" is not mistaken for the "Rev" column.
 */
const IGNORED_HEADERS = new Set(['todaysrev', 'todayrev', 'todaysrevenue', 'todayrevenue'])

// TODO(real-pdf): once we have the report owner's actual PDF, add any extra header spellings here.
const ALIASES: Record<string, ColumnKey> = {
  agent: 'agentName',
  agentname: 'agentName',
  salesagent: 'agentName',
  salesrep: 'agentName',
  rep: 'agentName',
  repname: 'agentName',

  customer: 'customerName',
  customername: 'customerName',
  client: 'customerName',
  clientname: 'customerName',

  account: 'accountId',
  accountid: 'accountId',
  accountnumber: 'accountId',
  accountno: 'accountId',
  acct: 'accountId',
  acctid: 'accountId',
  acctnumber: 'accountId',

  revenue: 'revenue',
  rev: 'revenue',
  totalrev: 'revenue',
  totalrevenue: 'revenue',

  status: 'status',
  orderstatus: 'status',
  installstatus: 'status',
}

export function isIgnoredColumn(header: string): boolean {
  return IGNORED_HEADERS.has(normalizeHeader(header))
}

/** Maps a header label to a canonical column, or null if it is unknown or ignored. */
export function normalizeColumn(header: string): ColumnKey | null {
  const key = normalizeHeader(header)
  if (!key || IGNORED_HEADERS.has(key)) return null
  return ALIASES[key] ?? null
}

/**
 * Parses money-ish text: "$1,250", "1250.00", "($75.50)" (negative), "-$20".
 * Returns undefined for empty or non-numeric text.
 */
export function parseRevenue(text: string | undefined): number | undefined {
  if (!text) return undefined
  const trimmed = text.trim()
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith('-')
  const digits = trimmed.replace(/[^0-9.]/g, '')
  if (!digits || !/\d/.test(digits)) return undefined
  const value = Number.parseFloat(digits)
  if (Number.isNaN(value)) return undefined
  return negative ? -value : value
}
