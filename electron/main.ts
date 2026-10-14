import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'

// Set by `npm run electron:dev`; when absent we load the built renderer from dist/.
const devServerUrl = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    title: 'Daily Agent Follow-Ups',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Dropping a file outside the drop zone would otherwise navigate the window to it.
  win.webContents.on('will-navigate', (event, url) => {
    if (!devServerUrl || !url.startsWith(devServerUrl)) event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (devServerUrl) void win.loadURL(devServerUrl)
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

ipcMain.handle('copy-text', (_event, text: string) => {
  clipboard.writeText(String(text))
  return true
})

ipcMain.handle('save-text-file', async (event, defaultName: string, text: string) => {
  const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
  const options = {
    title: 'Export report',
    defaultPath: path.join(app.getPath('documents'), path.basename(String(defaultName))),
    filters: [{ name: 'Text files', extensions: ['txt'] }],
  }
  const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return null
  await writeFile(result.filePath, String(text), 'utf8')
  return result.filePath
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
