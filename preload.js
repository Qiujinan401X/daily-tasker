const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  onAlwaysOnTopChanged: (callback) =>
    ipcRenderer.on('always-on-top-changed', (_event, isOnTop) => callback(isOnTop)),
  getStartupInfo: () => ipcRenderer.invoke('get-startup-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) =>
    ipcRenderer.on('update-status', (_event, payload) => callback(payload))
});
