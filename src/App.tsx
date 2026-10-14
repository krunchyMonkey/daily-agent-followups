import { useEffect, useMemo, useState } from 'react'
import { FileDropZone } from './components/FileDropZone'
import { ReportPreview } from './components/ReportPreview'
import { pdfjs } from './lib/pdfjs'
import { buildFollowUps, NO_MATCHING_ROWS, todayIso } from './parser/formatReport'
import { parseReportFile, PDF_PARSE_ERROR } from './parser/parsePdf'
import type { ParseResult } from './parser/types'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Never let a stray drop navigate the window away from the app.
  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', stop)
    window.addEventListener('drop', stop)
    return () => {
      window.removeEventListener('dragover', stop)
      window.removeEventListener('drop', stop)
    }
  }, [])

  const report = useMemo(() => (parsed ? buildFollowUps(parsed.rows, date) : null), [parsed, date])

  const chooseFile = (f: File) => {
    setFile(f)
    setParsed(null)
    setError(null)
  }

  const generate = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const result = await parseReportFile(file, pdfjs)
      setParsed(result)
      if (result.reportDate) setDate(result.reportDate)
    } catch (e) {
      setParsed(null)
      setError(e instanceof Error ? e.message : PDF_PARSE_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Daily Agent Follow-Ups</h1>
        <p className="muted">Turn the daily PDF report into a follow-up list for each agent. Everything is processed on this computer.</p>
      </header>

      <section className="card upload">
        <FileDropZone file={file} onFile={chooseFile} onReject={setError} />
        <div className="upload-actions">
          <label>
            Report date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="primary" disabled={!file || busy} onClick={generate}>
            {busy ? 'Reading PDF…' : 'Generate Report'}
          </button>
        </div>
      </section>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {report && parsed && report.agents.length === 0 && <div className="notice">{NO_MATCHING_ROWS}</div>}
      {report && parsed && <ReportPreview report={report} parsed={parsed} />}
    </div>
  )
}
