const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ayesh', {
  sendMessage: (message, sessionId) =>
    ipcRenderer.invoke('chat:send', { message, sessionId }),

  interruptChat: (sessionId) =>
    ipcRenderer.invoke('chat:interrupt', { sessionId }),

  onChunk: (callback) => {
    ipcRenderer.on('chat:chunk', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('chat:chunk');
  },

  listFiles: (path) => ipcRenderer.invoke('files:list', path),
  readFile: (path) => ipcRenderer.invoke('files:read', path),
  writeFile: (path, content) => ipcRenderer.invoke('files:write', { path, content }),

  listSessions: () => ipcRenderer.invoke('sessions:list'),
  listSkills: () => ipcRenderer.invoke('skills:list'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config) => ipcRenderer.invoke('config:set', config),

  healthCheck: () => ipcRenderer.invoke('health:check'),
});
