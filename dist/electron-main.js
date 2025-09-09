import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let hud = null;
let panel = null;
function centerX(winWidth) {
    const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
    return Math.round((sw - winWidth) / 2);
}
async function createWindows() {
    // Medidas pixel-perfect
    const HUD_W = 520, HUD_H = 48; // largura igual ao panel, altura original
    const PANEL_W = 520, PANEL_H = 300; // altura flexível; ajuste se quiser
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    // --- HUD (topo) ---
    hud = new BrowserWindow({
        width: HUD_W,
        height: HUD_H,
        x: centerX(HUD_W),
        y: 16, // 16px do topo
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        hasShadow: false,
        alwaysOnTop: true,
        focusable: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false
        }
    });
    if (devUrl)
        await hud.loadURL(devUrl + '#hud');
    else
        await hud.loadFile(path.join(__dirname, 'renderer/index.html'), { hash: 'hud' });
    hud.setIgnoreMouseEvents(true, { forward: true }); // click-through global
    // --- PANEL (abaixo do HUD) ---
    panel = new BrowserWindow({
        width: PANEL_W,
        height: PANEL_H,
        x: centerX(PANEL_W),
        y: 16 + HUD_H + 12, // 12px de gap após HUD
        frame: false,
        transparent: true,
        resizable: false,
        movable: false,
        hasShadow: false,
        alwaysOnTop: true,
        focusable: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true, nodeIntegration: false, sandbox: false
        }
    });
    if (devUrl)
        await panel.loadURL(devUrl + '#panel');
    else
        await panel.loadFile(path.join(__dirname, 'renderer/index.html'), { hash: 'panel' });
    panel.setIgnoreMouseEvents(true, { forward: true });
    // Recentrar ao trocar de monitor/resolução
    screen.on('display-metrics-changed', () => {
        if (hud)
            hud.setPosition(centerX(HUD_W), 16);
        if (panel)
            panel.setPosition(centerX(PANEL_W), 16 + HUD_H + 12);
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
    sender?.setIgnoreMouseEvents(ignore, { forward: true });
});
ipcMain.handle('overlay:open-external', (_evt, url) => shell.openExternal(url));
ipcMain.handle('overlay:close-app', () => app.quit());
