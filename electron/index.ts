// Native
import { join } from 'path';

// Packages
import { BrowserWindow, app, ipcMain, IpcMainEvent, nativeTheme } from 'electron';

function createWindow() {
  // Create the browser window.
  const window = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 765,
    minHeight: 720,
    show: true,
    resizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const url = process.env.VITE_DEV_SERVER_URL;
  const indexHtml = join(__dirname, '../dist-vite/index.html');

  // and load the index.html of the app.
  if (url) {
    window?.loadURL(url);
    window.webContents.openDevTools();
  } else {
    window?.loadFile(indexHtml);
  }

  nativeTheme.themeSource = 'dark';
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
