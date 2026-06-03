const { app, BrowserWindow, Menu, ipcMain, screen, shell, Tray, nativeImage } = require("electron");
const path = require("path");

let mainWindow;
let miniWindow;
let tray;

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

  mainWindow.on("minimize", (event) => {
    event.preventDefault();
    minimizeToTray();
  });
}

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="8" fill="#157a6e"/>
      <path fill="#ffffff" d="M9 9h14v3H9V9Zm0 5h14v3H9v-3Zm0 5h9v3H9v-3Z"/>
    </svg>
  `;
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`);
}

function createTray() {
  if (tray) return tray;
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Exam Lazy Tool");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "打開", click: restoreMainWindow },
      { label: "側邊模式", click: showMiniMode },
      { type: "separator" },
      {
        label: "結束",
        click: () => {
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", restoreMainWindow);
  tray.on("double-click", restoreMainWindow);
  return tray;
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
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
  destroyTray();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  }
  const win = createMiniWindow();
  positionMiniWindow();
  win.showInactive();
}

function restoreMainWindow() {
  destroyTray();
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.hide();
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  mainWindow.setSkipTaskbar(false);
  mainWindow.show();
  mainWindow.restore();
  mainWindow.focus();
}

function minimizeToTray() {
  createTray();
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.hide();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setSkipTaskbar(true);
  mainWindow.hide();
}

ipcMain.handle("window:mini", () => showMiniMode());
ipcMain.handle("window:restore", () => restoreMainWindow());
ipcMain.handle("mini:expand", () => resizeMiniWindow(410, 650));
ipcMain.handle("mini:collapse", () => resizeMiniWindow(64, 260));
ipcMain.handle("window:minimize", () => minimizeToTray());

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
  destroyTray();
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
