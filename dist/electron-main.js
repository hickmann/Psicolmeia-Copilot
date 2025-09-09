import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow = null;
function centerX(winWidth) {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
    return Math.round((sw - winWidth) / 2);
}
async function createWindows() {
    // Medidas pixel-perfect - janela única contendo ambos os componentes
    const HUD_W = 520, HUD_H = 78; // largura e altura do HUD
    const PANEL_W = 520, PANEL_H = 300; // largura e altura do panel
    const WINDOW_W = 600, WINDOW_H = HUD_H + PANEL_H + 100; // altura total com mais espaço para evitar cortes
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    // --- JANELA ÚNICA (contendo HUD e Panel) ---
    mainWindow = new BrowserWindow({
        width: WINDOW_W,
        height: WINDOW_H,
        x: centerX(WINDOW_W),
        y: 16, // 16px do topo
        frame: false,
        transparent: true,
        resizable: false,
        movable: true, // Habilitado para permitir interação
        hasShadow: false, // Remover sombra para transparência completa
        alwaysOnTop: true,
        focusable: true,
        skipTaskbar: false, // Aparece na taskbar
        show: true, // Garantir que é visível
        backgroundColor: '#00000000', // Transparente
        roundedCorners: true, // Garantir cantos arredondados
        opacity: 1.0, // Opacidade total
        titleBarStyle: 'hidden', // Esconder barra de título
        titleBarOverlay: false, // Desabilitar overlay da barra de título
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
            webSecurity: false // Desabilitar para evitar problemas de CORS
        }
    });
    console.log('🔧 Main: Janela criada, preload path:', path.join(__dirname, 'preload.cjs'));
    // Carregar a aplicação unificada
    if (devUrl)
        await mainWindow.loadURL(devUrl);
    else
        await mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    // Verificar se o preload foi carregado
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('🔧 Main: Página carregada, verificando preload...');
        mainWindow?.webContents.executeJavaScript(`
      console.log('🔧 Renderer: window.overlay disponível:', !!window.overlay)
      console.log('🔧 Renderer: window.overlay.openExternal disponível:', !!window.overlay?.openExternal)
      if (window.overlay) {
        console.log('✅ Preload carregado com sucesso!')
      } else {
        console.error('❌ Preload NÃO foi carregado!')
      }
    `);
    });
    // Log quando o preload for carregado
    mainWindow.webContents.on('preload-error', (event, preloadPath, error) => {
        console.error('❌ Erro ao carregar preload:', preloadPath, error);
    });
    // Janela sempre clicável - click-through desabilitado
    mainWindow.setIgnoreMouseEvents(false); // click-through desabilitado
    // Garantir que a janela é totalmente interativa
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.focus();
    mainWindow.show();
    // Garantir interatividade
    setTimeout(() => {
        mainWindow?.setIgnoreMouseEvents(false);
        mainWindow?.focus();
    }, 100);
    // Recentrar ao trocar de monitor/resolução
    screen.on('display-metrics-changed', () => {
        if (mainWindow)
            mainWindow.setPosition(centerX(WINDOW_W), 16);
    });
}
app.whenReady().then(createWindows);
app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    app.quit(); });
app.on('activate', async () => { if (BrowserWindow.getAllWindows().length === 0)
    await createWindows(); });
// IPC utilitários
ipcMain.handle('overlay:set-ignore', (_evt, ignore) => {
    const sender = BrowserWindow.fromWebContents(_evt.sender);
    console.log(`overlay:set-ignore chamado com ignore=${ignore}`);
    sender?.setIgnoreMouseEvents(ignore, { forward: true });
});
// Handler para forçar desativação do click-through
ipcMain.handle('overlay:force-interactive', () => {
    console.log('overlay:force-interactive chamado - forçando interatividade');
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
        win.setIgnoreMouseEvents(false);
        win.focus();
    });
});
ipcMain.handle('overlay:open-external', (_evt, url) => {
    console.log('🌐 IPC openExternal chamado com URL:', url);
    console.log('🌐 Event sender:', _evt.sender);
    try {
        const result = shell.openExternal(url);
        console.log('✅ shell.openExternal retornou:', result);
        console.log('✅ URL aberta com sucesso no navegador');
        return result;
    }
    catch (error) {
        console.error('❌ Erro ao abrir URL:', error);
        throw error;
    }
});
ipcMain.handle('open-devtools', (_evt) => {
    const sender = BrowserWindow.fromWebContents(_evt.sender);
    sender?.webContents.openDevTools();
});
ipcMain.handle('overlay:close-app', () => {
    console.log('overlay:close-app chamado - fechando aplicação');
    try {
        // Fechar todas as janelas primeiro
        const windows = BrowserWindow.getAllWindows();
        console.log(`Fechando ${windows.length} janelas`);
        windows.forEach((win, index) => {
            console.log(`Fechando janela ${index + 1}`);
            win.close();
        });
        // Aguardar um pouco antes de fechar o app
        setTimeout(() => {
            app.quit();
            console.log('app.quit() executado');
        }, 100);
    }
    catch (error) {
        console.error('Erro ao fechar app:', error);
        // Forçar fechamento
        process.exit(0);
    }
});
