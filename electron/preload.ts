import { contextBridge, ipcRenderer } from 'electron'

// The only desktop capabilities the renderer gets. Everything else (PDF parsing included) runs in the page itself.
contextBridge.exposeInMainWorld('desktop', {
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('copy-text', text),
  saveTextFile: (defaultName: string, text: string): Promise<string | null> =>
    ipcRenderer.invoke('save-text-file', defaultName, text),
})
