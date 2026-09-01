const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const dataFileName = 'trade-notebook-data.json';

function getDataFilePath() {
  return path.join(app.getPath('userData'), dataFileName);
}

async function readData() {
  try {
    const raw = await fs.readFile(getDataFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      sessions: [],
      activeSessionId: null,
      settings: {
        confluenceOptions: ['HTF trend', 'VWAP reclaim', 'Liquidity sweep', 'Order block', 'FVG']
      }
    };
  }
}

async function writeData(data) {
  await fs.mkdir(path.dirname(getDataFilePath()), { recursive: true });
  await fs.writeFile(getDataFilePath(), JSON.stringify(data, null, 2), 'utf8');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1200,
    minHeight: 800,
    backgroundColor: '#07111f',
    title: 'Trade Notebook',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  } else {
    win.loadURL('http://127.0.0.1:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  ipcMain.handle('trade-notebook:load', async () => readData());
  ipcMain.handle('trade-notebook:save', async (_event, data) => {
    await writeData(data);
    return true;
  });
  ipcMain.handle('trade-notebook:export-session', async (_event, { format, filename, content }) => {
    const ext = format === 'csv' ? 'csv' : 'json';
    const result = await dialog.showSaveDialog({
      title: format === 'csv' ? 'Export trading session as CSV' : 'Export trading session as JSON',
      defaultPath: filename || `trade-session.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await fs.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});