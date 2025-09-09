import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function centerX(winWidth: number) {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize
  return Math.round((sw - winWidth) / 2)
}

async function createWindows() {
  // Medidas pixel-perfect - janela única contendo ambos os componentes
  const HUD_W = 520, HUD_H = 78   // largura e altura do HUD
  const PANEL_W = 520, PANEL_H = 300   // largura e altura do panel
  const WINDOW_W = 600, WINDOW_H = HUD_H + PANEL_H + 100  // altura total com mais espaço para evitar cortes

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'

  // --- JANELA ÚNICA (contendo HUD e Panel) ---
  mainWindow = new BrowserWindow({
    width: WINDOW_W,
    height: WINDOW_H,
    x: centerX(WINDOW_W),
    y: 16,                                 // 16px do topo
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,                         // Habilitado para permitir interação
    hasShadow: true,                       // Reativar sombra para melhor visual
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: false,                    // Aparece na taskbar
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
  
  // Carregar a aplicação unificada
  if (devUrl) await mainWindow.loadURL(devUrl)
  else await mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  
  // Janela sempre clicável - click-through desabilitado
  mainWindow.setIgnoreMouseEvents(false) // click-through desabilitado
  
  // Garantir que a janela é totalmente interativa
  mainWindow.setAlwaysOnTop(true, 'screen-saver')
  mainWindow.focus()
  mainWindow.show()
  
  // Garantir interatividade
  setTimeout(() => {
    mainWindow?.setIgnoreMouseEvents(false)
    mainWindow?.focus()
  }, 100)

  // Recentrar ao trocar de monitor/resolução
  screen.on('display-metrics-changed', () => {
    if (mainWindow) mainWindow.setPosition(centerX(WINDOW_W), 16)
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
    
    // Aguardar um pouco antes de fechar o app
    setTimeout(() => {
      app.quit()
      console.log('app.quit() executado')
    }, 100)
    
  } catch (error) {
    console.error('Erro ao fechar app:', error)
    // Forçar fechamento
    process.exit(0)
  }
})