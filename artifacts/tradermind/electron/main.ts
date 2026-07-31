import { app, BrowserWindow, shell, Menu } from 'electron';
import path from 'path';

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // needed for file:// IndexedDB access
    },
    icon: isDev
      ? path.join(__dirname, '../public/icon.png')
      : path.join(app.getAppPath(), 'public/icon.png'),
    title: 'TraderMind OS',
    backgroundColor: '#0f1117',
    show: false,
  });

  // بارگذاری برنامه از dist
  // در حالت packaged: app.getAppPath() هم با ASAR و هم بدون آن کار می‌کند
  const indexPath = isDev
    ? path.join(__dirname, '../dist/public/index.html')
    : path.join(app.getAppPath(), 'dist/public/index.html');

  win.loadFile(indexPath);

  // نمایش پنجره پس از آماده شدن (بدون flash سفید)
  win.once('ready-to-show', () => {
    win.show();
    if (isDev) win.webContents.openDevTools();
  });

  // باز کردن لینک‌های خارجی در مرورگر سیستم
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// منو را مخفی کن (برنامه SPA است)
Menu.setApplicationMenu(null);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
