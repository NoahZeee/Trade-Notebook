const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tradeNotebook', {
  loadData: () => ipcRenderer.invoke('trade-notebook:load'),
  saveData: (data) => ipcRenderer.invoke('trade-notebook:save', data),
  exportSession: (format, filename, content) => ipcRenderer.invoke('trade-notebook:export-session', { format, filename, content })
});