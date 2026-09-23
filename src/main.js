import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let grpcClient;
const activeStreams = new Map();
let grpcTarget = process.env.GRPC_HOST || 'localhost:50051';
const DEV_SERVER_URL = 'http://localhost:5173';
let cachedRawConfig = null;

function maskSecret(value) {
  if (typeof value !== 'string' || !value) return '';
  if (value.length < 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function createGrpcClient() {
  const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, '..', 'proto', 'ayesh.proto'),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    }
  );
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const ayesh = protoDescriptor.ayesh;
  return new ayesh.AyeshService(grpcTarget, grpc.credentials.createInsecure());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      sandbox: true,
    },
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  const useDevServer = process.env.NODE_ENV === 'development';

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = useDevServer ? url.startsWith(DEV_SERVER_URL) : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  if (useDevServer) {
    mainWindow.loadURL(DEV_SERVER_URL).catch(() => mainWindow.loadFile(distIndex));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(distIndex);
  }
}

function setupIpcHandlers() {
  ipcMain.handle('chat:send', async (event, args) => {
    const { message, sessionId } = args || {};
    if (typeof message !== 'string' || !message.trim() || typeof sessionId !== 'string' || !sessionId) {
      throw new Error('chat:send: argumen tidak valid');
    }
    return new Promise((resolve, reject) => {
      const stream = grpcClient.ChatStream();
      activeStreams.set(sessionId, stream);
      const cleanup = () => activeStreams.delete(sessionId);
      stream.on('data', (chunk) => {
        mainWindow.webContents.send('chat:chunk', {
          token: chunk.token,
          toolCalls: (chunk.tool_calls || []).map((tc) => ({
            name: tc.name,
            status: tc.status,
            progress: tc.progress,
            result: tc.result,
          })),
          done: chunk.done,
          usage: chunk.usage,
        });
        if (chunk.done) {
          cleanup();
          stream.end();
          resolve(null);
        }
      });
      stream.on('error', (err) => {
        cleanup();
        reject(err);
      });
      stream.on('end', cleanup);
      stream.write({ message, session_id: sessionId, interrupt: false });
    });
  });

  ipcMain.handle('chat:interrupt', async (event, args) => {
    const { sessionId } = args || {};
    if (typeof sessionId !== 'string' || !sessionId) {
      throw new Error('chat:interrupt: argumen tidak valid');
    }
    const stream = activeStreams.get(sessionId);
    if (!stream) return { interrupted: false };
    activeStreams.delete(sessionId);
    stream.write({ message: '', session_id: sessionId, interrupt: true });
    stream.end();
    return { interrupted: true };
  });

  ipcMain.handle('files:list', async (event, dirPath) => {
    if (typeof dirPath !== 'string' || !dirPath.trim()) throw new Error('files:list: path tidak valid');
    return new Promise((resolve, reject) => {
      grpcClient.ListFiles({ path: dirPath }, (err, response) => {
        if (err) reject(err);
        else resolve(response.files);
      });
    });
  });

  ipcMain.handle('files:read', async (event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) throw new Error('files:read: path tidak valid');
    return new Promise((resolve, reject) => {
      grpcClient.ReadFile({ path: filePath }, (err, response) => {
        if (err) reject(err);
        else resolve(response.content);
      });
    });
  });

  ipcMain.handle('files:write', async (event, payload) => {
    const { path: filePath, content } = payload || {};
    if (typeof filePath !== 'string' || !filePath || typeof content !== 'string') {
      throw new Error('files:write: argumen tidak valid');
    }
    return new Promise((resolve, reject) => {
      grpcClient.WriteFile({ path: filePath, content }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  });

  ipcMain.handle('sessions:list', async () => {
    return new Promise((resolve, reject) => {
      grpcClient.ListSessions({}, (err, response) => {
        if (err) reject(err);
        else resolve(response.sessions);
      });
    });
  });

  ipcMain.handle('sessions:get', async (event, sessionId) => {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new Error('sessions:get: id tidak valid');
    }
    return new Promise((resolve, reject) => {
      grpcClient.GetSession({ id: sessionId }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  });

  ipcMain.handle('skills:list', async () => {
    return new Promise((resolve, reject) => {
      grpcClient.ListSkills({}, (err, response) => {
        if (err) reject(err);
        else resolve(response.skills);
      });
    });
  });

  ipcMain.handle('config:get', async () => {
    return new Promise((resolve, reject) => {
      grpcClient.GetConfig({}, (err, response) => {
        if (err) reject(err);
        else {
          cachedRawConfig = response;
          resolve({ ...response, api_key: maskSecret(response.api_key) });
        }
      });
    });
  });

  ipcMain.handle('config:set', async (event, config) => {
    if (!config || typeof config !== 'object') throw new Error('config:set: argumen tidak valid');
    for (const key of ['provider', 'model', 'host', 'grpc_host', 'api_key']) {
      if (config[key] !== undefined && typeof config[key] !== 'string') {
        throw new Error(`config:set: ${key} harus string`);
      }
    }
    for (const key of ['port', 'grpc_port']) {
      if (config[key] !== undefined) {
        const n = Number(config[key]);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
          throw new Error(`config:set: ${key} tidak valid`);
        }
        config[key] = n;
      }
    }
    const payload = { ...config };
    if (!payload.api_key) {
      if (cachedRawConfig && cachedRawConfig.api_key) {
        payload.api_key = cachedRawConfig.api_key;
      } else {
        throw new Error('config:set: api_key kosong dan belum pernah diambil — isi API key (fail-closed)');
      }
    }
    return new Promise((resolve, reject) => {
      grpcClient.SetConfig({ config: payload }, (err, response) => {
        if (err) reject(err);
        else {
          cachedRawConfig = { ...(cachedRawConfig || {}), ...payload };
          let reconnected = false;
          if (payload.grpc_host && payload.grpc_port) {
            const target = `${payload.grpc_host}:${payload.grpc_port}`;
            if (target !== grpcTarget) {
              grpcTarget = target;
              grpcClient.close();
              grpcClient = createGrpcClient();
              reconnected = true;
            }
          }
          resolve({ ...response, reconnected });
        }
      });
    });
  });

  ipcMain.handle('health:check', async () => {
    return new Promise((resolve, reject) => {
      grpcClient.HealthCheck({}, (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  });
}

async function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') return;
  try {
    const { autoUpdater } = await import('electron-updater');
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error('auto-update:', err?.message || err);
  }
}

app.whenReady().then(() => {
  grpcClient = createGrpcClient();
  setupIpcHandlers();
  createWindow();
  checkForUpdates();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
