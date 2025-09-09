import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let hud: BrowserWindow | null = null
let panel: BrowserWindow | null = null

function centerX(winWidth: number) {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize
  return Math.round((sw - winWidth) / 2)
}

async function createWindows() {
  // Medidas pixel-perfect
  const HUD_W = 520, HUD_H = 78   // largura igual ao panel, altura original
  const PANEL_W = 520, PANEL_H = 300   // altura flexível; ajuste se quiser

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

  // --- HUD (topo) ---
  hud = new BrowserWindow({
    width: HUD_W,
    height: HUD_H,
    x: centerX(HUD_W),
    y: 16,                                 // 16px do topo
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,                         // Habilitado para permitir interação
    hasShadow: true,                       // Reativar sombra para melhor visual
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,                    // Garantir que aparece na taskbar
    show: true,                            // Garantir que é visível
    backgroundColor: '#00000000',
    roundedCorners: true,                  // Garantir cantos arredondados
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false, 
      sandbox: false,
      webSecurity: false                   // Desabilitar para evitar problemas de CORS
    }
  })
  if (devUrl) await hud.loadURL(devUrl + '#hud')
  else await hud.loadFile(path.join(__dirname, 'renderer/index.html'), { hash: 'hud' })
  // FORÇAR desativação do click-through
  hud.setIgnoreMouseEvents(false) // click-through desabilitado - janela sempre clicável
  
  // Garantir que a janela é totalmente interativa
  hud.setAlwaysOnTop(true, 'screen-saver')
  hud.focus()
  hud.show()
  
  // Forçar interatividade - garantir que não há click-through
  setTimeout(() => {
    hud?.setIgnoreMouseEvents(false)
    hud?.focus()
  }, 100)

  // --- PANEL (abaixo do HUD) ---
  panel = new BrowserWindow({
    width: PANEL_W,
    height: PANEL_H,
    x: centerX(PANEL_W),
    y: 16 + HUD_H + 12,                    // 12px de gap após HUD
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,                         // Habilitado para permitir interação
    hasShadow: false,                       // Reativar sombra para melhor visual
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: false,                    // Garantir que aparece na taskbar
    show: true,                            // Garantir que é visível
    backgroundColor: '#00000000',
    roundedCorners: true,                  // Garantir cantos arredondados
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, 
      nodeIntegration: false, 
      sandbox: false,
      webSecurity: false                   // Desabilitar para evitar problemas de CORS
    }
  })
  if (devUrl) await panel.loadURL(devUrl + '#panel')
  else await panel.loadFile(path.join(__dirname, 'renderer/index.html'), { hash: 'panel' })
  // FORÇAR desativação do click-through
  panel.setIgnoreMouseEvents(false) // click-through desabilitado - janela sempre clicável
  
  // Garantir que a janela é totalmente interativa
  panel.setAlwaysOnTop(true, 'screen-saver')
  panel.focus()
  panel.show()
  
  // Forçar interatividade - garantir que não há click-through
  setTimeout(() => {
    panel?.setIgnoreMouseEvents(false)
    panel?.focus()
  }, 100)

  // Recentrar ao trocar de monitor/resolução
  screen.on('display-metrics-changed', () => {
    if (hud) hud.setPosition(centerX(HUD_W), 16)
    if (panel) panel.setPosition(centerX(PANEL_W), 16 + HUD_H + 12)
  })
}

app.whenReady().then(createWindows)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0) await createWindows() })

// IPC utilitários
ipcMain.handle('overlay:set-ignore', (_evt, ignore: boolean) => {
  const sender = BrowserWindow.fromWebContents(_evt.sender)
  console.log(`overlay:set-ignore chamado com ignore=${ignore}`)
  sender?.setIgnoreMouseEvents(ignore, { forward: true })
})

// Handler para forçar desativação do click-through
ipcMain.handle('overlay:force-interactive', () => {
  console.log('overlay:force-interactive chamado - forçando interatividade')
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.setIgnoreMouseEvents(false)
    win.focus()
  })
})
ipcMain.handle('overlay:open-external', (_evt, url: string) => shell.openExternal(url))
ipcMain.handle('open-devtools', (_evt) => {
  const sender = BrowserWindow.fromWebContents(_evt.sender)
  sender?.webContents.openDevTools()
})
ipcMain.handle('overlay:close-app', () => {
  console.log('overlay:close-app chamado - fechando aplicação')
  try {
    // Fechar todas as janelas primeiro
    const windows = BrowserWindow.getAllWindows()
    console.log(`Fechando ${windows.length} janelas`)
    
    windows.forEach((win, index) => {
      console.log(`Fechando janela ${index + 1}`)
      win.close()
    })
    
    // Depois fechar o app
    app.quit()
    console.log('app.quit() executado')
  } catch (error) {
    console.error('Erro ao fechar app:', error)
    // Forçar fechamento
    process.exit(0)
  }
})