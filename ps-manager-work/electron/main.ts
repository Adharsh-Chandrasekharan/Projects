import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import { Ipc } from './ipc';
import { SqlServer } from './sqlServer';

const storage = require('electron-json-storage');

const distPath = path.join(__dirname, '../dist');
process.env.DIST = distPath;
process.env.VITE_PUBLIC = app.isPackaged ? distPath : path.join(distPath, '../public');

const envPath = app.isPackaged
  ? path.join(app.getPath('appData'), 'PlayStationManager', '.env')
  : path.resolve(process.cwd(), '.env');

function loadEnvironmentFile(filePath: string) {
  console.log('[Azure SQL] Environment file:', {
    path: filePath,
    exists: fs.existsSync(filePath),
  });

  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Always prefer values from the project .env in development.
    process.env[key] = value;
  }

}

loadEnvironmentFile(envPath);

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
let win: BrowserWindow | null = null;
const database = new SqlServer();

function createWindow() {
  win = new BrowserWindow({
    minHeight: 780,
    minWidth: 1180,
    show: false,
    icon: path.join(process.env.VITE_PUBLIC || '', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: !app.isPackaged,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  Menu.setApplicationMenu(null);
  if (VITE_DEV_SERVER_URL) win.loadURL(VITE_DEV_SERVER_URL);
  else win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  win.once('ready-to-show', () => win?.show());
}

app.whenReady().then(() => {
  createWindow();
  new Ipc(win!, database);

  storage.has('myData', (error: unknown, hasData: boolean) => {
    if (error) {
      console.error('[Storage] Could not read local settings:', error);
      return;
    }
    if (!hasData) {
      storage.set('myData', { credentials: { userName: 'admin', password: 'password' } }, (writeError: unknown) => {
        if (writeError) console.error('[Storage] Could not initialize settings:', writeError);
      });
    }
  });

  database.connect().catch((error) => {
    console.error('[Azure SQL] Initial connection failed. The app will retry when it loads data:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

let isClosing = false;

app.on('before-quit', (event) => {
  if (isClosing) return;

  event.preventDefault();
  isClosing = true;

  database.close()
    .catch((error) => {
      console.error('[Azure SQL] Error while closing connection pool:', error);
    })
    .finally(() => {
      app.quit();
    });
});
