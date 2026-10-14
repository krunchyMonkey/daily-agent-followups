/** One normalized row from the daily report. */
export type ReportRow = {
  agentName: string
  customerName?: string
  accountId?: string
  status: string
  revenue?: number
  /** Original cell values keyed by the header text, for debugging the parser against real PDFs. */
  raw?: Record<string, string>
}

export type AgentFollowUp = {
  agentName: string
  pendingInstall: ReportRow[]
  canceled: ReportRow[]
}

/** Canonical columns the parser understands. Anything else is kept only in `raw`. */
export type ColumnKey = 'agentName' | 'customerName' | 'accountId' | 'status' | 'revenue'

/** A run of text on one line. `x0`/`x1` are page coordinates when the source is a PDF. */
export type Cell = {
  text: string
  x0?: number
  x1?: number
}

/** One visual line of the source document, already split into cells. */
export type Line = {
  cells: Cell[]
  page?: number
}

export type ParseResult = {
  rows: ReportRow[]
  /** Header labels that were recognized, e.g. ["Agent", "Customer", "Status", "Revenue"]. */
  detectedColumns: string[]
  /** Header labels deliberately dropped (e.g. "Today's Rev"). */
  ignoredColumns: string[]
  /** Date found in the document header, if any (YYYY-MM-DD). */
  reportDate?: string
  /** Number of data lines that could not be turned into a row. */
  skippedLines: number
}

export type FollowUpReport = {
  date: string
  agents: AgentFollowUp[]
  /** Rows whose status matched neither bucket. */
  unmatchedRows: ReportRow[]
}
