import { useRef, useState, type DragEvent } from 'react'

const ACCEPTED = /\.(pdf|txt|csv|tsv)$/i

type Props = {
  file: File | null
  onFile: (file: File) => void
  onReject: (message: string) => void
}

export function FileDropZone({ file, onFile, onReject }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (candidate: File | undefined) => {
    if (!candidate) return
    if (!ACCEPTED.test(candidate.name)) {
      onReject(`"${candidate.name}" is not a PDF. Drop the daily report PDF (or a .txt/.csv export).`)
      return
    }
    onFile(candidate)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    accept(e.dataTransfer.files[0])
  }

  return (
    <div
      className={`dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        accept=".pdf,.txt,.csv,.tsv,application/pdf"
        hidden
        onChange={(e) => {
          accept(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {file ? (
        <>
          <strong>{file.name}</strong>
          <span className="muted">{(file.size / 1024).toFixed(1)} KB · click or drop to choose a different file</span>
        </>
      ) : (
        <>
          <strong>Drop the daily report PDF here</strong>
          <span className="muted">or click to choose a file</span>
        </>
      )}
    </div>
  )
}
