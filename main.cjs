const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require("electron");
const path = require("path");

let mainWindow;
let miniWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    title: "考試懶人工具",
    backgroundColor: "#f6f7f2",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) return miniWindow;

  miniWindow = new BrowserWindow({
    width: 82,
    height: 330,
    frame: false,
    resizable: true,
    minWidth: 64,
    minHeight: 240,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: "考試懶人工具側邊模式",
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  miniWindow.loadFile(path.join(__dirname, "mini.html"));
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniWindow.setAlwaysOnTop(true, "floating");
  miniWindow.hide();
  return miniWindow;
}

function positionMiniWindow() {
  const win = createMiniWindow();
  const area = screen.getPrimaryDisplay().workArea;
  const [width, height] = win.getSize();
  win.setPosition(area.x + area.width - width - 12, area.y + area.height - height - 12);
}

function resizeMiniWindow(width, height) {
  const win = createMiniWindow();
  win.setSize(width, height);
  positionMiniWindow();
}

function showMiniMode() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  const win = createMiniWindow();
  positionMiniWindow();
  win.showInactive();
}

function restoreMainWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.hide();
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
}

ipcMain.handle("window:mini", () => showMiniMode());
ipcMain.handle("window:restore", () => restoreMainWindow());
ipcMain.handle("mini:expand", () => resizeMiniWindow(410, 650));
ipcMain.handle("mini:collapse", () => resizeMiniWindow(64, 260));
ipcMain.handle("window:minimize", () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createMiniWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    restoreMainWindow();
  });
});

app.on("before-quit", () => {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
