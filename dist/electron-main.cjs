"use strict";
const { app, BrowserWindow, ipcMain, screen: electronScreen, shell, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs/promises');
let mainWindow = null;
function centerX(winWidth) {
    const { width: sw } = electronScreen.getPrimaryDisplay().workAreaSize;
    return Math.round((sw - winWidth) / 2);
}
function topY(winHeight) {
    // Posicionar no topo da tela com uma margem pequena
    return 50; // 50px do topo
}
function createWindow() {
    console.log('🔧 Main: Criando janela...');
    console.log('🔧 Main: NODE_ENV:', process.env.NODE_ENV);
    console.log('🔧 Main: VITE_DEV_SERVER_URL:', process.env.VITE_DEV_SERVER_URL);
    const preloadPath = path.join(__dirname, 'preload.cjs');
    console.log('🔧 Main: Janela criada, preload path:', preloadPath);
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        x: centerX(1200),
        y: topY(800),
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            webSecurity: false
        }
    });
    // Carregar a aplicação
    const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
    if (isDev) {
        const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
        console.log('🔧 Main: Carregando URL de desenvolvimento:', devServerUrl);
        mainWindow.loadURL(devServerUrl);
        mainWindow.webContents.openDevTools();
    }
    else {
        console.log('🔧 Main: Carregando arquivo de produção');
        mainWindow.loadFile('dist/index.html');
    }
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('🔧 Main: Página carregada, verificando preload...');
        // Verificar se o preload foi carregado
        mainWindow.webContents.executeJavaScript(`
      console.log('🔍 window.overlay disponível:', !!window.overlay)
      if (window.overlay) {
        console.log('✅ Preload carregado com sucesso')
      } else {
        console.error('❌ Preload não carregado')
      }
    `);
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// IPC Handlers
ipcMain.handle('overlay:set-ignore', async (event, ignore) => {
    console.log('🔧 Main: set-ignore chamado:', ignore);
    return { success: true };
});
ipcMain.handle('overlay:force-interactive', async (event) => {
    console.log('🔧 Main: force-interactive chamado');
    return { success: true };
});
ipcMain.handle('overlay:open-external', async (event, url) => {
    console.log('🔧 Main: Abrindo URL externa:', url);
    try {
        await shell.openExternal(url);
        return { success: true };
    }
    catch (error) {
        console.error('❌ Main: Erro ao abrir URL:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
});
ipcMain.handle('overlay:close-app', async (event) => {
    console.log('🔧 Main: Fechando aplicação');
    app.quit();
    return { success: true };
});
ipcMain.handle('recorder:save', async (event, data) => {
    try {
        console.log('💾 Main: Salvando gravação...', data);
        const userDataPath = app.getPath('userData');
        const recordingsDir = path.join(userDataPath, 'recordings');
        const timestamp = new Date(data.timestamp).toISOString().replace(/[:.]/g, '-');
        const sessionDir = path.join(recordingsDir, timestamp);
        // Criar diretório da sessão
        await fs.mkdir(sessionDir, { recursive: true });
        // Salvar transcript.json
        const transcriptPath = path.join(sessionDir, 'transcript.json');
        await fs.writeFile(transcriptPath, JSON.stringify(data.transcript, null, 2));
        // Salvar transcript.srt
        const srtPath = path.join(sessionDir, 'transcript.srt');
        const srtContent = generateSRT(data.transcript);
        await fs.writeFile(srtPath, srtContent);
        console.log('✅ Main: Arquivos salvos em:', sessionDir);
        return {
            success: true,
            path: sessionDir,
            files: ['transcript.json', 'transcript.srt']
        };
    }
    catch (error) {
        console.error('❌ Main: Erro ao salvar gravação:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
});
ipcMain.handle('audio:capture-system', async () => {
    try {
        console.log('🔊 Main: Capturando áudio do sistema...');
        const sources = await desktopCapturer.getSources({
            types: ['screen', 'window'],
            fetchWindowIcons: false,
            thumbnailSize: { width: 0, height: 0 }
        });
        console.log('🔊 Main: Fontes encontradas:', sources.length);
        const formattedSources = sources.map((source) => ({
            id: source.id,
            name: source.name,
            display_id: source.display_id
        }));
        return {
            success: true,
            sources: formattedSources
        };
    }
    catch (error) {
        console.error('❌ Main: Erro ao capturar áudio do sistema:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        };
    }
});
// Função para gerar SRT
function generateSRT(transcript) {
    return transcript.map((segment, index) => {
        const startTime = formatSRTTime(segment.start);
        const endTime = formatSRTTime(segment.end);
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.speaker}: ${segment.text}\n`;
    }).join('\n');
}
function formatSRTTime(ms) {
    const date = new Date(ms);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds},${milliseconds}`;
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
