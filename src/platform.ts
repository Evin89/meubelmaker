import { parseProject, serializeProject } from './lib/blocks'
import { toCSV, cutList } from './lib/cutlist'
import { download, slug } from './lib/format'
import { nestToSVG } from './lib/nesting'
import { useApp } from './store/useApp'

type FileFilter = { name: string; extensions: string[] }
type OpenedFile = { path: string; text: string }

/** Wat de Electron-preload (electron/preload.cjs) als `window.meubelmaker` beschikbaar maakt. */
export type DesktopAPI = {
  isDesktop: true
  saveFile(opts: { defaultName: string; data: string; filters: FileFilter[]; path?: string }): Promise<string | null>
  openProject(): Promise<OpenedFile | null>
  onMenu(cb: (cmd: string) => void): () => void
  onOpenFile(cb: (f: OpenedFile) => void): () => void
}

declare global {
  interface Window {
    meubelmaker?: DesktopAPI
  }
}

/** Alleen aanwezig in de desktopapp. */
export const desktop: DesktopAPI | undefined = typeof window !== 'undefined' ? window.meubelmaker : undefined

const PROJECT_FILTER: FileFilter[] = [{ name: 'Meubelmaker-project', extensions: ['meubel'] }]
const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p

/** Bewaar tekst als bestand: in de desktopapp met een opslaan-venster, in de browser als download. */
export async function saveText(filename: string, data: string, mime: string, filters: FileFilter[]): Promise<boolean> {
  if (desktop) return (await desktop.saveFile({ defaultName: filename, data, filters })) !== null
  download(filename, data, mime)
  return true
}

export const exportCSV = () => {
  const p = current()
  if (p) void saveText(`${slug(p.name)}-zaaglijst.csv`, toCSV(cutList(p.items)), 'text/csv', [{ name: 'CSV', extensions: ['csv'] }])
}
export const exportSVG = () => {
  const p = current()
  if (p) void saveText(`${slug(p.name)}-plaatindeling.svg`, nestToSVG(p), 'image/svg+xml', [{ name: 'SVG', extensions: ['svg'] }])
}
export const exportJSON = () => {
  const p = current()
  if (!p) return
  if (desktop) void saveProjectFile(true)
  else download(`${slug(p.name)}.json`, serializeProject(p), 'application/json')
}

const current = () => {
  const s = useApp.getState()
  return s.projects.find((p) => p.id === s.currentId)
}

/** Opslaan naar het eigen bestand van het project, of met `saveAs` (of zonder bestand) eerst een locatie kiezen. */
export async function saveProjectFile(saveAs = false) {
  const p = current()
  if (!p || !desktop) return
  const file = await desktop.saveFile({
    defaultName: p.filePath && saveAs ? p.filePath : `${slug(p.name)}.meubel`,
    data: serializeProject(p),
    filters: PROJECT_FILTER,
    path: saveAs ? undefined : p.filePath,
  })
  if (!file) return
  useApp.getState().setFilePath(file)
  useApp.getState().showToast(`Opgeslagen als ${baseName(file)}`)
}

export function openProjectText(f: OpenedFile) {
  try {
    useApp.getState().openFromFile(parseProject(JSON.parse(f.text), baseName(f.path).replace(/\.(meubel|json)$/i, '')), f.path)
  } catch {
    useApp.getState().showToast(`${baseName(f.path)} is geen Meubelmaker-project.`)
  }
}

export async function openProjectFile() {
  const f = await desktop?.openProject()
  if (f) openProjectText(f)
}

/** Koppelt het menu van de desktopapp aan de app. Geeft een opruimfunctie terug. */
export function connectDesktop(): () => void {
  if (!desktop) return () => {}
  const s = () => useApp.getState()
  const offMenu = desktop.onMenu((cmd) => {
    switch (cmd) {
      case 'nieuw':
        return s().createProject('leeg')
      case 'openen':
        return void openProjectFile()
      case 'opslaan':
        return void saveProjectFile(false)
      case 'opslaan-als':
        return void saveProjectFile(true)
      case 'export-csv':
        return exportCSV()
      case 'export-svg':
        return exportSVG()
      case 'undo':
        return s().undo()
      case 'redo':
        return s().redo()
    }
  })
  const offOpen = desktop.onOpenFile(openProjectText)
  return () => {
    offMenu()
    offOpen()
  }
}

export { baseName }
