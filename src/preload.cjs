const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ayesh", {
  sendMessage: (message, sessionId) =>
    ipcRenderer.invoke("chat:send", { message, sessionId }),

  interruptChat: (sessionId) =>
    ipcRenderer.invoke("chat:interrupt", { sessionId }),

  onChunk: (callback) => {
    // Listener per-subscriber: unsubscribe tidak mematikan listener milik komponen lain.
    const listener = (event, data) => callback(data);
    ipcRenderer.on("chat:chunk", listener);
    return () => ipcRenderer.removeListener("chat:chunk", listener);
  },

  listFiles: (path) => ipcRenderer.invoke("files:list", path),
  readFile: (path) => ipcRenderer.invoke("files:read", path),
  writeFile: (path, content) =>
    ipcRenderer.invoke("files:write", { path, content }),

  listSessions: () => ipcRenderer.invoke("sessions:list"),
  getSession: (id) => ipcRenderer.invoke("sessions:get", id),
  listSkills: () => ipcRenderer.invoke("skills:list"),
  installSkill: (name, uninstall) =>
    ipcRenderer.invoke("skills:install", { name, uninstall }),

  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (config) => ipcRenderer.invoke("config:set", config),

  healthCheck: () => ipcRenderer.invoke("health:check"),
});
