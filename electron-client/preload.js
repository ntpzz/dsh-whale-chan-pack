// preload: 安全地把“语音(whisper) + 设置”桥接给页面(主世界)。
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("whaleVoice", {
  getSettings: () => ipcRenderer.invoke("whale-settings-get"),
  setSettings: (s) => ipcRenderer.invoke("whale-settings-set", s),
  transcribe: (audio) => ipcRenderer.invoke("whale-transcribe", audio),
  download: () => ipcRenderer.invoke("whale-download"),
  pickDir: () => ipcRenderer.invoke("whale-pick-dir"),
  onStatus: (cb) => {
    const l = (_e, msg) => cb(msg);
    ipcRenderer.on("whale-status", l);
    return () => ipcRenderer.removeListener("whale-status", l);
  },
});
