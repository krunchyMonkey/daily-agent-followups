// Launches Electron with a clean environment.
// Terminals inside VS Code (itself an Electron app) export ELECTRON_RUN_AS_NODE=1, which makes `electron .`
// start as plain Node and crash on `ipcMain` being undefined. Removing it here makes `npm start` work everywhere.
import { spawn } from 'node:child_process'
import electron from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
