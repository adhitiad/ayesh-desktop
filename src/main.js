const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

let mainWindow;
let grpcClient;
const GRPC_HOST = process.env.GRPC_HOST || 'localhost:50051';

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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

function setupIpcHandlers() {
  ipcMain.handle('chat:send', async (event, { message, sessionId }) => {
    return new Promise((resolve, reject) => {
      const stream = grpcClient.ChatStream();
      stream.on('data', (chunk) => {
        mainWindow.webContents.send('chat:chunk', {
          token: chunk.token,
          toolCalls: chunk.tool_calls.map(tc => ({
            name: tc.name,
            status: tc.status,
            progress: tc.progress,
            result: tc.result,
          })),
          done: chunk.done,
          usage: chunk.usage,
        });
        if (chunk.done) resolve(null);
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

  ipcMain.handle('files:write', async (event, { path, content }) => {
    return new Promise((resolve, reject) => {
      grpcClient.WriteFile({ path, content }, (err, response) => {
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
