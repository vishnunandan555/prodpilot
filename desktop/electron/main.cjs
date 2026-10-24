const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    resizable: true,
    backgroundColor: '#080b11',
    title: 'ProdPilot',
    icon: path.join(__dirname, '../public/logo.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Allows SSE & local APIs without CORS restrictions in dev
    },
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(startUrl).catch((err) => {
      console.warn(`[Electron] Failed to load ${startUrl}, trying fallback to 127.0.0.1:`, err?.message);
      mainWindow.loadURL('http://127.0.0.1:5173').catch(() => {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      });
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
