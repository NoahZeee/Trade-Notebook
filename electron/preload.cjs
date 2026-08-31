const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tradeNotebook', {
  loadData: () => ipcRenderer.invoke('trade-notebook:load'),
  saveData: (data) => ipcRenderer.invoke('trade-notebook:save', data)
});