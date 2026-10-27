// Start de Vite-dev-server en daarna Electron, dat de dev-server laadt (met hot reload).
import { spawn } from 'node:child_process'
import { createServer } from 'vite'

const server = await createServer()
await server.listen()
const url = server.resolvedUrls?.local[0]
if (!url) throw new Error('Geen dev-server-adres')
const electron = (await import('electron')).default
const child = spawn(electron, ['.'], { stdio: 'inherit', env: { ...process.env, MEUBELMAKER_DEV_URL: url } })
child.on('close', async (code) => {
  await server.close()
  process.exit(code ?? 0)
})
