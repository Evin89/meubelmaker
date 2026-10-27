// Electron-hoofdproces van de Meubelmaker-desktopapp.
// Laadt de Vite-build (dist/) of, met MEUBELMAKER_DEV_URL, de dev-server.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const DEV_URL = process.env.MEUBELMAKER_DEV_URL
const isMac = process.platform === 'darwin'
let win = null
/** Projectbestand dat bij het starten is meegegeven (dubbelklik op een .meubel-bestand). */
let pendingOpen = null

const fileArg = (argv) => argv.find((a) => a.toLowerCase().endsWith('.meubel'))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
    const f = fileArg(argv)
    if (f) void sendOpen(f)
  })
}

async function sendOpen(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8')
    win?.webContents.send('open-file', { path: filePath, text })
  } catch {
    dialog.showErrorBox('Openen mislukt', `Kan ${filePath} niet lezen.`)
  }
}

const send = (cmd) => () => win?.webContents.send('menu', cmd)

function buildMenu() {
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Bestand',
      submenu: [
        { label: 'Nieuw project', accelerator: 'CmdOrCtrl+N', click: send('nieuw') },
        { label: 'Openen…', accelerator: 'CmdOrCtrl+O', click: send('openen') },
        { type: 'separator' },
        { label: 'Opslaan', accelerator: 'CmdOrCtrl+S', click: send('opslaan') },
        { label: 'Opslaan als…', accelerator: 'CmdOrCtrl+Shift+S', click: send('opslaan-als') },
        { type: 'separator' },
        { label: 'Zaaglijst exporteren (CSV)…', click: send('export-csv') },
        { label: 'Plaatindeling exporteren (SVG)…', click: send('export-svg') },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Venster sluiten' } : { role: 'quit', label: 'Afsluiten' },
      ],
    },
    {
      label: 'Bewerken',
      submenu: [
        // De app vangt Ctrl+Z zelf af; registerAccelerator: false voorkomt dubbel ongedaan maken.
        { label: 'Ongedaan maken', accelerator: 'CmdOrCtrl+Z', registerAccelerator: false, click: send('undo') },
        { label: 'Opnieuw', accelerator: 'CmdOrCtrl+Shift+Z', registerAccelerator: false, click: send('redo') },
        { type: 'separator' },
        { role: 'cut', label: 'Knippen' },
        { role: 'copy', label: 'Kopiëren' },
        { role: 'paste', label: 'Plakken' },
        { role: 'selectAll', label: 'Alles selecteren' },
      ],
    },
    {
      label: 'Beeld',
      submenu: [
        { role: 'resetZoom', label: 'Normale grootte' },
        { role: 'zoomIn', label: 'Inzoomen' },
        { role: 'zoomOut', label: 'Uitzoomen' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Volledig scherm' },
        { type: 'separator' },
        { role: 'reload', label: 'Herladen' },
        { role: 'toggleDevTools', label: 'Ontwikkelaarstools' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Meubelmaker',
    backgroundColor: '#eef1f2',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())

  // Externe links in de standaardbrowser; nooit wegnavigeren uit de app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!DEV_URL || !url.startsWith(DEV_URL)) e.preventDefault()
  })
  win.webContents.on('did-finish-load', () => {
    if (pendingOpen) {
      void sendOpen(pendingOpen)
      pendingOpen = null
    }
  })

  if (DEV_URL) void win.loadURL(DEV_URL)
  else void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  win.on('closed', () => (win = null))
}

// Opslaan: met `path` direct schrijven, anders eerst een opslaan-venster tonen.
ipcMain.handle('save-file', async (_e, { defaultName, data, filters, path: target }) => {
  let file = target
  if (!file) {
    const res = await dialog.showSaveDialog(win, { defaultPath: defaultName, filters })
    if (res.canceled || !res.filePath) return null
    file = res.filePath
  }
  await fs.writeFile(file, data, 'utf8')
  return file
})

ipcMain.handle('open-project', async () => {
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: 'Meubelmaker-project', extensions: ['meubel', 'json'] },
      { name: 'Alle bestanden', extensions: ['*'] },
    ],
  })
  if (res.canceled || !res.filePaths[0]) return null
  const file = res.filePaths[0]
  return { path: file, text: await fs.readFile(file, 'utf8') }
})

app.on('open-file', (e, file) => {
  // macOS: bestand geopend via Finder
  e.preventDefault()
  if (win) void sendOpen(file)
  else pendingOpen = file
})

app.whenReady().then(() => {
  pendingOpen = pendingOpen ?? fileArg(process.argv.slice(1)) ?? null
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
