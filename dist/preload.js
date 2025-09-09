import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('overlay', {
    setIgnore: (ignore) => ipcRenderer.invoke('overlay:set-ignore', ignore),
    forceInteractive: () => ipcRenderer.invoke('overlay:force-interactive'),
    openExternal: (url) => ipcRenderer.invoke('overlay:open-external', url),
    closeApp: () => ipcRenderer.invoke('overlay:close-app'),
    which: () => (location.hash.replace('#', '') || 'hud') // "hud" ou "panel"
});
// Expor função para abrir DevTools
contextBridge.exposeInMainWorld('electronAPI', {
    openDevTools: () => ipcRenderer.invoke('open-devtools')
});
