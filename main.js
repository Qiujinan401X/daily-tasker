const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let installScheduled = false;

function sendUpdateStatus(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', payload);
  }
}

function scheduleInstallAndRelaunch() {
  if (installScheduled) return;
  installScheduled = true;
  // 稍等让加载页显示「正在安装并重启」
  setTimeout(() => {
    autoUpdater.quitAndInstall(false, true);
  }, 800);
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus({ type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus({
      type: 'available',
      version: info.version
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus({
      type: 'not-available',
      version: info && info.version
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      type: 'progress',
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred,
      total: progress.total
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({
      type: 'downloaded',
      version: info.version
    });
    scheduleInstallAndRelaunch();
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus({
      type: 'error',
      message: err && err.message ? err.message : String(err)
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 420,
    maxWidth: 420,
    minHeight: 600,
    maxHeight: 600,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    title: '今日任务',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');

  mainWindow.on('always-on-top-changed', (event, isOnTop) => {
    mainWindow.webContents.send('always-on-top-changed', isOnTop);
  });
}

ipcMain.handle('toggle-always-on-top', () => {
  const isOnTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isOnTop, 'floating');
  return !isOnTop;
});

ipcMain.handle('get-always-on-top', () => {
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle('get-startup-info', () => ({
  version: app.getVersion(),
  isPackaged: app.isPackaged
}));

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { ok: false, reason: 'dev' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, updateInfo: result && result.updateInfo };
  } catch (err) {
    return { ok: false, reason: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('install-update', () => {
  if (!app.isPackaged) return false;
  scheduleInstallAndRelaunch();
  return true;
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
