const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

let mainWindow;

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

  // 移除顶部菜单栏（文件 / 编辑 / 视图 / 窗口 / 帮助）
  Menu.setApplicationMenu(null);
  mainWindow.removeMenu();
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile('index.html');

  // 监听置顶状态变化，同步给渲染进程
  mainWindow.on('always-on-top-changed', (event, isOnTop) => {
    mainWindow.webContents.send('always-on-top-changed', isOnTop);
  });
}

// IPC：切换置顶
ipcMain.handle('toggle-always-on-top', () => {
  const isOnTop = mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(!isOnTop, 'floating');
  return !isOnTop;
});

// IPC：获取当前置顶状态
ipcMain.handle('get-always-on-top', () => {
  return mainWindow.isAlwaysOnTop();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
