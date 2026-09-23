import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let grpcClient;
const GRPC_HOST = process.env.GRPC_HOST || 'localhost:50051';
const DEV_SERVER_URL = 'http://localhost:5173';

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
  return new ayesh.AyeshService(GRPC_HOST, grpc.credentials.createInsecure());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  const useDevServer = process.env.NODE_ENV === 'development';

  if (useDevServer) {
    mainWindow.loadURL(DEV_SERVER_URL).catch(() => mainWindow.loadFile(distIndex));
    mainWindow.webContents.openDevTools();
  } else {
    // Fallback: bila vite dev server tidak jalan, muat build statis
    mainWindow.loadURL(DEV_SERVER_URL).catch(() => mainWindow.loadFile(distIndex));
  }
}

function setupIpcHandlers() {
  ipcMain.handle('chat:send', async (event, { message, sessionId }) => {
    return new Promise((resolve, reject) => {
      const stream = grpcClient.ChatStream();
      stream.on('data', (chunk) => {
        mainWindow.webContents.send('chat:chunk', {
          token: chunk.token,
          toolCalls: chunk.tool_calls.map((tc) => ({
            name: tc.name,
            status: tc.status,
            progress: tc.progress,
            result: tc.result,
          })),
          done: chunk.done,
          usage: chunk.usage,
        });
        if (chunk.done) {
          stream.end();
          resolve(null);
        }
      });
      stream.on('error', reject);
      stream.write({ message, session_id: sessionId, interrupt: false });
    });
  });

  ipcMain.handle('chat:interrupt', async (event, { sessionId }) => {
    const stream = grpcClient.ChatStream();
    stream.write({ message: '', session_id: sessionId, interrupt: true });
    stream.end();
  });

  ipcMain.handle('files:list', async (event, dirPath) => {
    return new Promise((resolve, reject) => {
      grpcClient.ListFiles({ path: dirPath }, (err, response) => {
        if (err) reject(err);
        else resolve(response.files);
      });
    });
  });

  ipcMain.handle('files:read', async (event, filePath) => {
    return new Promise((resolve, reject) => {
      grpcClient.ReadFile({ path: filePath }, (err, response) => {
        if (err) reject(err);
        else resolve(response.content);
      });
    });
  });

  ipcMain.handle('files:write', async (event, { path: filePath, content }) => {
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
        else resolve(response);
      });
    });
  });

  ipcMain.handle('config:set', async (event, config) => {
    return new Promise((resolve, reject) => {
      grpcClient.SetConfig({ config }, (err, response) => {
        if (err) reject(err);
        else resolve(response);
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

app.whenReady().then(() => {
  grpcClient = createGrpcClient();
  setupIpcHandlers();
  createWindow();
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
