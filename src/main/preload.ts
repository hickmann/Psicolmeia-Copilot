import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('overlay', {
  setIgnore: (ignore: boolean) => ipcRenderer.invoke('overlay:set-ignore', ignore),
  openExternal: (url: string) => ipcRenderer.invoke('overlay:open-external', url),
  closeApp: () => ipcRenderer.invoke('overlay:close-app'),
  which: () => (location.hash.replace('#','') || 'hud') // "hud" ou "panel"
})