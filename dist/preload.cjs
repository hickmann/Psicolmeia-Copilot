"use strict";
try {
    console.log('🔧 Preload: Iniciando carregamento...');
    const { contextBridge, ipcRenderer } = require('electron');
    console.log('🔧 Preload: Electron modules carregados');
    contextBridge.exposeInMainWorld('overlay', {
        setIgnore: (ignore) => ipcRenderer.invoke('overlay:set-ignore', ignore),
        forceInteractive: () => ipcRenderer.invoke('overlay:force-interactive'),
        openExternal: (url) => {
            console.log('🔗 Preload: Enviando URL para main process:', url);
            console.log('🔗 Preload: ipcRenderer disponível:', !!ipcRenderer);
            console.log('🔗 Preload: Tentando invocar overlay:open-external');
            return ipcRenderer.invoke('overlay:open-external', url);
        },
        closeApp: () => ipcRenderer.invoke('overlay:close-app'),
        which: () => (location.hash.replace('#', '') || 'hud') // "hud" ou "panel"
    });
    // Expor função para abrir DevTools
    contextBridge.exposeInMainWorld('electronAPI', {
        openDevTools: () => ipcRenderer.invoke('open-devtools')
    });
    console.log('🔧 Preload: window.overlay exposto com sucesso');
}
catch (error) {
    console.error('❌ Preload: Erro ao carregar:', error);
}
