const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("examLazyTool", {
  miniMode: () => ipcRenderer.invoke("window:mini"),
  restore: () => ipcRenderer.invoke("window:restore"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
});
