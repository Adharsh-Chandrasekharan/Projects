import { app, BrowserWindow, Menu } from 'electron';
import path from 'node:path';
import * as fs from 'node:fs';
import { Ipc } from './ipc';

const distPath = path.join(__dirname, '../dist');
process.env.DIST = distPath;
process.env.VITE_PUBLIC = app.isPackaged ? distPath : path.join(distPath, '../public');

const envPath = app.isPackaged
  ? path.join(app.getPath('appData'), 'PlayStationManager', '.env')
  : path.resolve(process.cwd(), '.env');

function loadEnvironmentFile(filePath: string) {
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

    process.env[key] = value;
  }
}

loadEnvironmentFile(envPath);

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

let win: BrowserWindow | null = null;

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

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }

  win.once('ready-to-show', () => win?.show());
}

app.whenReady().then(() => {
  createWindow();
  new Ipc(win!, API_BASE_URL);
  console.log(`[API] Desktop application configured for ${API_BASE_URL}`);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
