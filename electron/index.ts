// Native
import { join } from 'path';

// Packages
import { BrowserWindow, app, ipcMain, IpcMainEvent, shell, Notification } from 'electron';

// Fix without GPU: disable hardware acceleration to avoid GPU process crash
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

// Hide some warnings from terminal
app.commandLine.appendSwitch('log-level', '3');

// Content Security Policy, per environment.
//
// Development (Vite dev server over http://localhost): the HMR client is injected inline,
// React Refresh compiles module updates at runtime, and the client talks back over a
// websocket — so 'unsafe-inline', 'unsafe-eval' and ws: are unavoidable here.
//
// Production (static bundle loaded from file://): `yarn build` emits only external
// <script type="module"> and <link rel="stylesheet"> tags, so scripts need nothing beyond
// 'self' and eval stays blocked. Network access is narrowed to Scryfall, the only host the
// renderer ever calls. Trade-off: style-src keeps 'unsafe-inline' because the preload's
// loading spinner appends a <style> element and Google Fonts is loaded as a stylesheet
// link; dropping it would need those two moved into the bundle (out of scope here).
const CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https: ws:"
].join('; ');

const CSP_PROD = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.scryfall.com",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'"
].join('; ');

function createWindow() {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  // Create the browser window.
  const window = new BrowserWindow({
    title: 'MTG Deck Forge',
    width: 1600,
    height: 900,
    minWidth: 400,
    minHeight: 500,
    show: false, // Start hidden to prevent white flash before React renders
    resizable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    }
  });

  // Smooth fade-in of the application window once React is fully loaded and ready
  window.once('ready-to-show', () => {
    window.setMenu(null);
    window.show();
  });

  // Content Security Policy. The handler also fires for file:// responses, so the
  // production policy applies to the packaged app and not just to the dev server.
  window.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [devServerUrl ? CSP_DEV : CSP_PROD]
      }
    });
  });

  // Intercept default link navigation to open Scryfall and other external URLs in system browser
  window.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== window.webContents.getURL()) {
      event.preventDefault();
      // Basic check to ensure it's a valid protocol
      if (['http:', 'https:'].includes(parsedUrl.protocol)) {
        shell.openExternal(url);
      }
    }
  });

  // Intercept window opens (e.g. target="_blank") to open in system browser
  window.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    if (['http:', 'https:'].includes(parsedUrl.protocol)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' }; // Always deny new electron windows
  });

  const indexHtml = join(__dirname, '../dist-vite/index.html');

  // and load the index.html of the app.
  if (devServerUrl) {
    window?.loadURL(devServerUrl);
    window.webContents.openDevTools();
  } else {
    window?.loadFile(indexHtml);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// listen the channel `message` and resend the received message to the renderer process
ipcMain.on('message', (event: IpcMainEvent) => {
  setTimeout(() => event.sender.send('message', 'hi from electron'), 500);
});

ipcMain.on('show-notification', (_, { title, body }: { title: string; body: string }) => {
  new Notification({ title, body }).show();
});
