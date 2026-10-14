import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { classifyStatus } from '../src/parser/classifyStatus'
import { extractRows, UNKNOWN_AGENT } from '../src/parser/extractRows'
import {
  buildFollowUps,
  formatAgentMessage,
  formatCurrency,
  formatFullReport,
  NO_MATCHING_ROWS,
} from '../src/parser/formatReport'
import { normalizeColumn, parseRevenue } from '../src/parser/normalizeColumns'
import { parseReportFile, PDF_PARSE_ERROR, type PdfJs } from '../src/parser/parsePdf'
import { textToLines } from '../src/parser/parseText'
import type { ReportRow } from '../src/parser/types'

const fileFrom = (path: string) => ({
  name: path,
  arrayBuffer: async () => {
    const b = readFileSync(path)
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  },
})

const loadPdfJs = async () => (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJs

describe('classifyStatus', () => {
  it.each(['Pending Install', 'pending', 'Install Pending', 'Pending Installation', 'Scheduled', 'Awaiting Install', '  PENDING-install. '])(
    '%s -> pendingInstall',
    (s) => expect(classifyStatus(s)).toBe('pendingInstall'),
  )

  it.each(['Canceled', 'Cancelled', 'Cancel', 'Customer Canceled', 'Canceled Install', 'CANCELLED!'])('%s -> canceled', (s) =>
    expect(classifyStatus(s)).toBe('canceled'),
  )

  it.each(['Installed', 'Active', '', 'Complete'])('%s -> skipped', (s) => expect(classifyStatus(s)).toBeNull())
})

describe('normalizeColumn', () => {
  it.each([
    ['Agent', 'agentName'],
    ['Agent Name', 'agentName'],
    ['Sales Agent', 'agentName'],
    ['Customer', 'customerName'],
    ['Customer Name', 'customerName'],
    ['Account', 'accountId'],
    ['Account ID', 'accountId'],
    ['Revenue', 'revenue'],
    ['Rev', 'revenue'],
    ['Status', 'status'],
  ])('%s -> %s', (header, key) => expect(normalizeColumn(header)).toBe(key))

  it.each(["Today's Rev", 'Today’s Rev', 'Today Rev', 'todays_rev'])('ignores %s', (h) => expect(normalizeColumn(h)).toBeNull())
})

describe('parseRevenue', () => {
  it.each([
    ['$1,250.00', 1250],
    ['950', 950],
    ['($75.50)', -75.5],
    ['-$20', -20],
    ['', undefined],
    ['n/a', undefined],
  ])('%s -> %s', (text, value) => expect(parseRevenue(text)).toBe(value))
})

describe('buildFollowUps + formatting', () => {
  const rows: ReportRow[] = [
    { agentName: 'Sarah Johnson', customerName: 'Maria Garcia', status: 'Pending Install', revenue: 950 },
    { agentName: 'Sarah Johnson', customerName: 'Robert Lee', status: 'Canceled', revenue: 700 },
    { agentName: 'sarah  johnson', customerName: 'John Doe', status: 'Pending', revenue: 1250 },
    { agentName: 'Mike Anderson', customerName: 'James Wilson', status: 'Scheduled', revenue: 1100 },
    { agentName: 'Mike Anderson', customerName: 'Nobody', status: 'Installed', revenue: 5 },
    { agentName: 'Mike Anderson', customerName: 'No Rev', status: 'Pending', revenue: undefined },
    { agentName: UNKNOWN_AGENT, accountId: '999', status: 'Cancel', revenue: 10 },
  ]
  const report = buildFollowUps(rows, '2026-10-13')

  it('groups agents alphabetically (case-insensitive), Unknown Agent last', () => {
    expect(report.agents.map((a) => a.agentName)).toEqual(['Mike Anderson', 'Sarah Johnson', UNKNOWN_AGENT])
  })

  it('sorts by revenue descending with missing revenue last, and skips unmatched statuses', () => {
    const mike = report.agents[0]!
    expect(mike.pendingInstall.map((r) => r.customerName)).toEqual(['James Wilson', 'No Rev'])
    expect(report.unmatchedRows.map((r) => r.customerName)).toEqual(['Nobody'])
  })

  it('formats the full report like the spec', () => {
    const text = formatFullReport(report)
    expect(text).toContain(
      'DAILY FOLLOW-UP REPORT\nDate: 2026-10-13\n\nAgent: Mike Anderson\n\nPending Install:\n1. James Wilson - Revenue: $1,100\n2. No Rev - Revenue: Unknown\n\nCanceled:\nNone',
    )
    expect(text).toContain(
      'Agent: Sarah Johnson\n\nPending Install:\n1. John Doe - Revenue: $1,250\n2. Maria Garcia - Revenue: $950\n\nCanceled:\n1. Robert Lee - Revenue: $700',
    )
    expect(text).toContain('1. Account 999 - Revenue: $10')
  })

  it('formats a Teams-style agent message', () => {
    expect(formatAgentMessage(report.agents[1]!)).toBe(
      'Hey Sarah, here’s your follow-up list for today.\n\nPending Install:\n1. John Doe - Revenue: $1,250\n2. Maria Garcia - Revenue: $950\n\nCanceled:\n1. Robert Lee - Revenue: $700',
    )
  })

  it('reports when nothing matched', () => {
    expect(formatFullReport(buildFollowUps([rows[4]!], '2026-10-13'))).toContain(NO_MATCHING_ROWS)
  })

  it('formats cents only when needed', () => {
    expect(formatCurrency(675.5)).toBe('$675.50')
    expect(formatCurrency(1250)).toBe('$1,250')
  })
})

describe('extractRows', () => {
  it('supports reports grouped under "Agent:" headings without an agent column', () => {
    const lines = textToLines(
      ['Agent: Sarah Johnson', 'Customer|Status|Revenue', 'John Doe|Pending Install|$1,250', '', 'Agent: Mike Anderson', 'James Wilson|Scheduled|$1,100'].join('\n'),
    )
    const rows = extractRows(lines).rows
    expect(rows.map((r) => [r.agentName, r.customerName])).toEqual([
      ['Sarah Johnson', 'John Doe'],
      ['Mike Anderson', 'James Wilson'],
    ])
  })

  it('handles CSV and drops the Today’s Rev column', () => {
    const csv = 'Agent,Customer,Status,Revenue,Today’s Rev\n"Johnson, Sarah",John Doe,Pending,"$1,250",$999\n'
    const result = extractRows(textToLines(csv))
    expect(result.rows[0]).toMatchObject({ agentName: 'Johnson, Sarah', revenue: 1250 })
    expect(result.rows[0]!.raw).not.toHaveProperty('Today’s Rev')
    expect(result.ignoredColumns).toEqual(['Today’s Rev'])
  })

  it('uses Unknown Agent when no agent is available', () => {
    const rows = extractRows(textToLines('Customer|Status|Revenue\nJohn Doe|Pending|$5')).rows
    expect(rows[0]!.agentName).toBe(UNKNOWN_AGENT)
  })
})

describe('sample files', () => {
  const expectSample = (text: string) => {
    expect(text).toContain('Date: 2026-10-13')
    expect(text).toContain('Agent: Sarah Johnson\n\nPending Install:\n1. John Doe - Revenue: $1,250\n2. Maria Garcia - Revenue: $950\n\nCanceled:\n1. Robert Lee - Revenue: $700')
    expect(text).toContain('Agent: Mike Anderson\n\nPending Install:\n1. James Wilson - Revenue: $1,100\n\nCanceled:\nNone')
    expect(text).toContain('Grace Kim - Revenue: Unknown') // blank revenue must not pick up Today's Rev
    expect(text).toContain('Olivia Chen - Revenue: $675.50')
    expect(text).not.toMatch(/Linda Park|Paul Turner|Total/) // Installed / Active / totals skipped
    expect(text).not.toContain('-$')
  }

  it('parses samples/sample-report.pdf', async () => {
    const result = await parseReportFile(fileFrom('samples/sample-report.pdf'), await loadPdfJs())
    expect(result.rows).toHaveLength(18)
    expect(result.ignoredColumns).toEqual(["Today's Rev"])
    expectSample(formatFullReport(buildFollowUps(result.rows, result.reportDate!)))
  })

  it('parses samples/sample-report.txt', async () => {
    const result = await parseReportFile(fileFrom('samples/sample-report.txt'), await loadPdfJs())
    expect(result.rows).toHaveLength(18)
    expectSample(formatFullReport(buildFollowUps(result.rows, result.reportDate!)))
  })

  it('rejects a file with no usable table', async () => {
    const junk = { name: 'junk.pdf', arrayBuffer: async () => new TextEncoder().encode('not a pdf').buffer as ArrayBuffer }
    await expect(parseReportFile(junk, await loadPdfJs())).rejects.toThrow(PDF_PARSE_ERROR)
  })
})
