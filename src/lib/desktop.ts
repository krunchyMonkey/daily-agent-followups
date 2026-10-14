/** Bridge exposed by electron/preload.ts. Absent when the UI runs in a plain browser (`npm run dev`). */
type DesktopBridge = {
  copyText: (text: string) => Promise<boolean>
  saveTextFile: (defaultName: string, text: string) => Promise<string | null>
}

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

export async function copyText(text: string): Promise<void> {
  if (window.desktop) {
    await window.desktop.copyText(text)
    return
  }
  await navigator.clipboard.writeText(text)
}

/** Saves via the native dialog in Electron; downloads a file in the browser. Returns a description of where it went. */
export async function exportText(fileName: string, text: string): Promise<string | null> {
  if (window.desktop) return window.desktop.saveTextFile(fileName, text)

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
  return fileName
}
