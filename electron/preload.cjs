// Brug tussen de app (renderer) en het hoofdproces. Alleen deze functies zijn zichtbaar als window.meubelmaker.
const { contextBridge, ipcRenderer } = require('electron')

const listen = (channel) => (cb) => {
  const fn = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, fn)
  return () => ipcRenderer.removeListener(channel, fn)
}

contextBridge.exposeInMainWorld('meubelmaker', {
  isDesktop: true,
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
  openProject: () => ipcRenderer.invoke('open-project'),
  onMenu: listen('menu'),
  onOpenFile: listen('open-file'),
})
