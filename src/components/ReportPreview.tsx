import { useState } from 'react'
import { exportText } from '../lib/desktop'
import { formatFullReport } from '../parser/formatReport'
import type { FollowUpReport, ParseResult } from '../parser/types'
import { AgentCard } from './AgentCard'
import { CopyButton } from './CopyButton'

export function ReportPreview({ report, parsed }: { report: FollowUpReport; parsed: ParseResult }) {
  const fullText = formatFullReport(report)
  const [exported, setExported] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const onExport = async () => {
    setExportError(null)
    try {
      const where = await exportText(`agent-follow-ups-${report.date}.txt`, fullText)
      if (where) setExported(where)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  const skippedStatuses = [...new Set(report.unmatchedRows.map((r) => r.status))]

  return (
    <>
      <section className="card">
        <header className="toolbar">
          <div>
            <h2>Full report</h2>
            <span className="muted">
              {report.agents.length} agents · {parsed.rows.length} rows read
              {report.unmatchedRows.length > 0 && ` · ${report.unmatchedRows.length} skipped (${skippedStatuses.join(', ')})`}
              {parsed.ignoredColumns.length > 0 && ` · ignored column: ${parsed.ignoredColumns.join(', ')}`}
            </span>
          </div>
          <div className="actions">
            <CopyButton text={fullText} label="Copy Full Report" primary />
            <button onClick={onExport}>Export TXT</button>
          </div>
        </header>
        {exported && <p className="notice">Saved {exported}</p>}
        {exportError && <p className="error">{exportError}</p>}
        <pre className="full-report">{fullText}</pre>
      </section>

      {report.agents.length > 0 && (
        <section>
          <h2 className="section-title">Agent messages</h2>
          <div className="agent-grid">
            {report.agents.map((a) => (
              <AgentCard key={a.agentName} agent={a} />
            ))}
          </div>
        </section>
      )}

      {/* Debug view: what the parser actually read. Handy when tuning the parser against Ryan's real PDF. */}
      <details className="card debug">
        <summary>Show extracted rows ({parsed.rows.length})</summary>
        <p className="muted">Detected columns: {parsed.detectedColumns.join(', ') || 'none'}</p>
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Customer</th>
              <th>Account</th>
              <th>Status</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.agentName}</td>
                <td>{r.customerName ?? ''}</td>
                <td>{r.accountId ?? ''}</td>
                <td>{r.status}</td>
                <td>{r.revenue ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  )
}
