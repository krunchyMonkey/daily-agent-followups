import { classifyStatus } from './classifyStatus'
import { UNKNOWN_AGENT } from './extractRows'
import type { AgentFollowUp, FollowUpReport, ReportRow } from './types'

export const NO_MATCHING_ROWS = 'No Pending Install or Canceled rows were found in this PDF.'

/** Revenue descending; rows without revenue go last. */
function byRevenueDesc(a: ReportRow, b: ReportRow): number {
  if (a.revenue === undefined && b.revenue === undefined) return 0
  if (a.revenue === undefined) return 1
  if (b.revenue === undefined) return -1
  return b.revenue - a.revenue
}

/** Groups rows by agent (case/space-insensitive) into Pending Install and Canceled buckets. */
export function buildFollowUps(rows: ReportRow[], date: string): FollowUpReport {
  const agents = new Map<string, AgentFollowUp>()
  const unmatchedRows: ReportRow[] = []

  for (const row of rows) {
    const bucket = classifyStatus(row.status)
    if (!bucket) {
      unmatchedRows.push(row)
      continue
    }
    const name = row.agentName.replace(/\s+/g, ' ').trim() || UNKNOWN_AGENT
    const key = name.toLowerCase()
    let agent = agents.get(key)
    if (!agent) {
      agent = { agentName: name, pendingInstall: [], canceled: [] }
      agents.set(key, agent)
    }
    agent[bucket].push(row)
  }

  const sorted = [...agents.values()]
    .map((a) => ({ ...a, pendingInstall: [...a.pendingInstall].sort(byRevenueDesc), canceled: [...a.canceled].sort(byRevenueDesc) }))
    .sort((a, b) => {
      // Unknown Agent always last, everyone else alphabetical.
      if (a.agentName === UNKNOWN_AGENT) return 1
      if (b.agentName === UNKNOWN_AGENT) return -1
      return a.agentName.localeCompare(b.agentName, 'en', { sensitivity: 'base' })
    })

  return { date, agents: sorted, unmatchedRows }
}

export function formatCurrency(value: number | undefined): string {
  if (value === undefined) return 'Unknown'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/** "John Doe - Revenue: $1,250". Falls back to the account id when there is no customer name. */
export function formatItem(row: ReportRow, index: number): string {
  const label = row.customerName ?? (row.accountId ? `Account ${row.accountId}` : 'Unknown Customer')
  return `${index + 1}. ${label} - Revenue: ${formatCurrency(row.revenue)}`
}

function formatList(title: string, rows: ReportRow[]): string {
  const body = rows.length ? rows.map(formatItem).join('\n') : 'None'
  return `${title}:\n${body}`
}

function formatLists(agent: AgentFollowUp): string {
  return `${formatList('Pending Install', agent.pendingInstall)}\n\n${formatList('Canceled', agent.canceled)}`
}

/** One agent's section of the full report. */
export function formatAgentSection(agent: AgentFollowUp): string {
  return `Agent: ${agent.agentName}\n\n${formatLists(agent)}`
}

/** Teams-style message for one agent. */
export function formatAgentMessage(agent: AgentFollowUp): string {
  const firstName = agent.agentName === UNKNOWN_AGENT ? 'there' : agent.agentName.split(' ')[0]
  return `Hey ${firstName}, here’s your follow-up list for today.\n\n${formatLists(agent)}`
}

export function formatFullReport(report: FollowUpReport): string {
  const header = `DAILY FOLLOW-UP REPORT\nDate: ${report.date}`
  if (report.agents.length === 0) return `${header}\n\n${NO_MATCHING_ROWS}`
  return `${header}\n\n${report.agents.map(formatAgentSection).join('\n\n\n')}\n`
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
