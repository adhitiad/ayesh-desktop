import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let grpcClient;
const activeStreams = new Map();
const RPC_DEADLINE_MS = 15000;
const HOST_RE = /^[a-zA-Z0-9._-]{1,253}$|^\[[0-9a-fA-F:]+\]$/;
const rpcOpts = () => ({ deadline: Date.now() + RPC_DEADLINE_MS });

function parseTarget(str) {
  const m = /^([^:]+):(\d+)$/.exec(String(str || ""));
  if (!m) return null;
  const port = Number(m[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: m[1], port };
}

const envTarget = parseTarget(process.env.GRPC_HOST) || {
  host: "localhost",
  port: 50051,
};
let grpcHost = envTarget.host;
let grpcPort = envTarget.port;
const DEV_SERVER_URL = "http://localhost:5173";
let cachedRawConfig = null;
let grpcTls = false;
let grpcTlsCa = "";
let tray = null;
let isQuitting = false;

function localSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadLocalSettings() {
  try {
    const data = JSON.parse(fs.readFileSync(localSettingsPath(), "utf8"));
    if (typeof data.grpc_tls === "boolean") grpcTls = data.grpc_tls;
    if (
      typeof data.grpc_tls_ca === "string" &&
      data.grpc_tls_ca.length <= 4096 &&
      !data.grpc_tls_ca.includes("\0")
    ) {
      grpcTlsCa = data.grpc_tls_ca;
    }
    // Target gRPC lokal menang atas env; pilihan user di Settings harus bertahan restart.
    if (typeof data.grpc_host === "string" && HOST_RE.test(data.grpc_host))
      grpcHost = data.grpc_host;
    if (
      Number.isInteger(data.grpc_port) &&
      data.grpc_port >= 1 &&
      data.grpc_port <= 65535
    ) {
      grpcPort = data.grpc_port;
    }
  } catch {
    /* file belum ada / rusak → default insecure (dev lokal) */
  }
}

function saveLocalSettings() {
  try {
    fs.mkdirSync(path.dirname(localSettingsPath()), { recursive: true });
    fs.writeFileSync(
      localSettingsPath(),
      JSON.stringify(
        {
          grpc_host: grpcHost,
          grpc_port: grpcPort,
          grpc_tls: grpcTls,
          grpc_tls_ca: grpcTlsCa,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    logger.error?.("settings lokal gagal disimpan:", err?.message || err);
  }
}

function maskSecret(value) {
  if (typeof value !== "string" || !value) return "";
  if (value.length < 8) return "***";
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function createGrpcCreds() {
  if (!grpcTls) return grpc.credentials.createInsecure();
  let rootCerts;
  if (grpcTlsCa) {
    try {
      rootCerts = fs.readFileSync(grpcTlsCa);
    } catch (err) {
      // CA hilang: tetap TLS terenkripsi pakai system roots (tidak pernah jatuh insecure);
      // self-signed tanpa CA → handshake gagal (fail-closed), jangan simpan path rusak.
      logger.error?.(
        "CA TLS hilang/tak terbaca, pakai system roots:",
        err?.message || err,
      );
      rootCerts = undefined;
    }
  }
  return grpc.credentials.createSsl(rootCerts);
}

function createGrpcClient() {
  const packageDefinition = protoLoader.loadSync(
    path.join(__dirname, "..", "proto", "ayesh.proto"),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  );
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
  const ayesh = protoDescriptor.ayesh;
  return new ayesh.AyeshService(`${grpcHost}:${grpcPort}`, createGrpcCreds());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      sandbox: true,
    },
  });

  const distIndex = path.join(__dirname, "..", "dist", "index.html");
  const useDevServer = process.env.NODE_ENV === "development";

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = useDevServer
      ? url.startsWith(DEV_SERVER_URL)
      : url.startsWith("file://");
    if (!allowed) event.preventDefault();
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting && tray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  if (useDevServer) {
    mainWindow
      .loadURL(DEV_SERVER_URL)
      .catch(() => mainWindow.loadFile(distIndex));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(distIndex);
  }
}

function setupIpcHandlers() {
  ipcMain.handle("chat:send", async (event, args) => {
    const { message, sessionId } = args || {};
    if (
      typeof message !== "string" ||
      !message.trim() ||
      typeof sessionId !== "string" ||
      !sessionId
    ) {
      throw new Error("chat:send: argumen tidak valid");
    }
    // Satu stream per sesi: pesan baru menggantikan stream lama yang masih jalan.
    const prev = activeStreams.get(sessionId);
    if (prev && !prev.settled) {
      prev.settled = true;
      activeStreams.delete(sessionId);
      try {
        prev.stream.end();
      } catch {
        /* stream lama sudah mati */
      }
      prev.reject(new Error("stream digantikan pesan baru"));
    }
    return new Promise((resolve, reject) => {
      const stream = grpcClient.ChatStream();
      const entry = { stream, settled: false, resolve, reject };
      activeStreams.set(sessionId, entry);
      const settle = (fn, value) => {
        if (entry.settled) return;
        entry.settled = true;
        activeStreams.delete(sessionId);
        fn(value);
      };
      stream.on("data", (chunk) => {
        if (entry.settled) return;
        mainWindow.webContents.send("chat:chunk", {
          sessionId,
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
          settle(resolve, null);
          try {
            stream.end();
          } catch {
            /* stream sudah tertutup */
          }
        }
      });
      stream.on("error", (err) => settle(reject, err));
      stream.on("end", () =>
        settle(
          reject,
          new Error("stream berakhir tanpa done (server terputus)"),
        ),
      );
      stream.write({ message, session_id: sessionId, interrupt: false });
    });
  });

  ipcMain.handle("chat:interrupt", async (event, args) => {
    const { sessionId } = args || {};
    if (typeof sessionId !== "string" || !sessionId) {
      throw new Error("chat:interrupt: argumen tidak valid");
    }
    const entry = activeStreams.get(sessionId);
    if (!entry || entry.settled) return { interrupted: false };
    entry.settled = true;
    activeStreams.delete(sessionId);
    try {
      entry.stream.write({
        message: "",
        session_id: sessionId,
        interrupt: true,
      });
      entry.stream.end();
    } catch {
      /* stream sudah mati */
    }
    entry.reject(new Error("DIINTERUPSI"));
    return { interrupted: true };
  });

  ipcMain.handle("files:list", async (event, dirPath) => {
    if (typeof dirPath !== "string" || !dirPath.trim())
      throw new Error("files:list: path tidak valid");
    return new Promise((resolve, reject) => {
      grpcClient.ListFiles({ path: dirPath }, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response.files);
      });
    });
  });

  ipcMain.handle("files:read", async (event, filePath) => {
    if (typeof filePath !== "string" || !filePath)
      throw new Error("files:read: path tidak valid");
    return new Promise((resolve, reject) => {
      grpcClient.ReadFile({ path: filePath }, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response.content);
      });
    });
  });

  ipcMain.handle("files:write", async (event, payload) => {
    const { path: filePath, content } = payload || {};
    if (
      typeof filePath !== "string" ||
      !filePath ||
      typeof content !== "string"
    ) {
      throw new Error("files:write: argumen tidak valid");
    }
    return new Promise((resolve, reject) => {
      grpcClient.WriteFile(
        { path: filePath, content },
        rpcOpts(),
        (err, response) => {
          if (err) reject(err);
          else resolve(response);
        },
      );
    });
  });

  ipcMain.handle("sessions:list", async () => {
    return new Promise((resolve, reject) => {
      grpcClient.ListSessions({}, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response.sessions);
      });
    });
  });

  ipcMain.handle("sessions:get", async (event, sessionId) => {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("sessions:get: id tidak valid");
    }
    return new Promise((resolve, reject) => {
      grpcClient.GetSession({ id: sessionId }, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  });

  ipcMain.handle("skills:list", async () => {
    return new Promise((resolve, reject) => {
      grpcClient.ListSkills({}, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response.skills);
      });
    });
  });

  ipcMain.handle("skills:install", async (event, args) => {
    const { name, uninstall } = args || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
      throw new Error("skills:install: argumen tidak valid");
    }
    return new Promise((resolve, reject) => {
      grpcClient.InstallSkill(
        { name: name.trim(), uninstall: uninstall === true },
        rpcOpts(),
        (err, response) => {
          if (err) reject(err);
          else resolve(response);
        },
      );
    });
  });

  ipcMain.handle("config:get", async () => {
    return new Promise((resolve, reject) => {
      grpcClient.GetConfig({}, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else {
          cachedRawConfig = response;
          resolve({
            ...response,
            api_key: maskSecret(response.api_key),
            grpc_tls_enabled: grpcTls,
            grpc_tls_ca: grpcTlsCa,
          });
        }
      });
    });
  });

  ipcMain.handle("config:set", async (event, config) => {
    if (!config || typeof config !== "object")
      throw new Error("config:set: argumen tidak valid");
    for (const key of ["provider", "model", "host", "grpc_host", "api_key"]) {
      if (config[key] !== undefined && typeof config[key] !== "string") {
        throw new Error(`config:set: ${key} harus string`);
      }
    }
    for (const key of ["host", "grpc_host"]) {
      if (config[key] && !HOST_RE.test(config[key])) {
        throw new Error(`config:set: ${key} tidak valid (fail-closed)`);
      }
    }
    for (const key of ["port", "grpc_port"]) {
      if (config[key] !== undefined) {
        const n = Number(config[key]);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
          throw new Error(`config:set: ${key} tidak valid`);
        }
        config[key] = n;
      }
    }
    if (config.grpc_tls !== undefined && typeof config.grpc_tls !== "boolean") {
      throw new Error("config:set: grpc_tls harus boolean");
    }
    if (config.grpc_tls_ca !== undefined) {
      const ca = config.grpc_tls_ca;
      if (typeof ca !== "string" || ca.length > 4096 || ca.includes("\0")) {
        throw new Error("config:set: grpc_tls_ca tidak valid (fail-closed)");
      }
      config.grpc_tls_ca = ca.trim();
    }
    const nextTls = config.grpc_tls !== undefined ? config.grpc_tls : grpcTls;
    const nextCa =
      config.grpc_tls_ca !== undefined ? config.grpc_tls_ca : grpcTlsCa;
    if (nextTls && nextCa && !fs.existsSync(nextCa)) {
      throw new Error("config:set: file CA TLS tidak ditemukan (fail-closed)");
    }
    const payload = { ...config };
    delete payload.grpc_tls;
    delete payload.grpc_tls_ca;
    // api_key opsional: server SetConfig hanya membaca provider/model; pakai cache bila ada.
    if (!payload.api_key && cachedRawConfig && cachedRawConfig.api_key) {
      payload.api_key = cachedRawConfig.api_key;
    }
    // Urutan: validasi (atas) → simpan lokal → reconnect → SetConfig best-effort.
    // Target & TLS disimpan lokal lebih dulu agar deadlock "server mati → SetConfig gagal
    // → retarget tak pernah tersimpan" tidak terjadi; SetConfig gagal = resolve + warning.
    let reconnected = false;
    if (nextTls !== grpcTls || nextCa !== grpcTlsCa) {
      grpcTls = nextTls;
      grpcTlsCa = nextCa;
      reconnected = true;
    }
    if (
      payload.grpc_host &&
      payload.grpc_port &&
      (payload.grpc_host !== grpcHost || payload.grpc_port !== grpcPort)
    ) {
      grpcHost = payload.grpc_host;
      grpcPort = payload.grpc_port;
      reconnected = true;
    }
    saveLocalSettings();
    if (reconnected) {
      try {
        grpcClient.close();
        grpcClient = createGrpcClient();
      } catch (e) {
        return {
          success: false,
          reconnected: false,
          warning: `reconnect gagal: ${e?.message || e}`,
          grpc_tls_enabled: grpcTls,
          grpc_tls_ca: grpcTlsCa,
        };
      }
    }
    return new Promise((resolve) => {
      grpcClient.SetConfig({ config: payload }, rpcOpts(), (err, response) => {
        cachedRawConfig = { ...(cachedRawConfig || {}), ...payload };
        if (err) {
          resolve({
            success: false,
            reconnected,
            warning: `server tak merespons: ${err?.message || err}`,
            grpc_tls_enabled: grpcTls,
            grpc_tls_ca: grpcTlsCa,
          });
        } else {
          resolve({
            ...response,
            reconnected,
            grpc_tls_enabled: grpcTls,
            grpc_tls_ca: grpcTlsCa,
          });
        }
      });
    });
  });

  ipcMain.handle("health:check", async () => {
    return new Promise((resolve, reject) => {
      grpcClient.HealthCheck({}, rpcOpts(), (err, response) => {
        if (err) reject(err);
        else resolve(response);
      });
    });
  });
}

let logger = console;

async function initLogger() {
  try {
    logger = (await import("electron-log/main")).default;
  } catch {
    logger = console;
  }
}

async function checkForUpdates() {
  // Hanya di aplikasi ter-packaged; dev/smoke jangan memicu electron-updater.
  if (!app.isPackaged || process.env.NODE_ENV === "development") return;
  try {
    const { autoUpdater } = await import("electron-updater");
    await autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    logger.error?.("auto-update:", err?.message || err);
  }
}

function setupTray() {
  try {
    const iconPath = path.join(__dirname, "..", "assets", "icon.png");
    // Buffer-based: createFromPath bisa gagal membaca dari dalam asar.
    const image = nativeImage.createFromBuffer(fs.readFileSync(iconPath));
    if (!image || image.isEmpty())
      throw new Error("ikon tray kosong/tidak terbaca");
    tray = new Tray(image);
    tray.setToolTip("Ayesh");
    const showWindow = () => {
      if (!mainWindow) return;
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    };
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Buka Ayesh", click: showWindow },
        { type: "separator" },
        {
          label: "Keluar",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]),
    );
    // Linux hanya meng-klik; macOS/Windows pakai double-click.
    tray.on("click", showWindow);
    tray.on("double-click", showWindow);
  } catch (err) {
    // Fitur UX, bukan security control → lanjut tanpa tray bila gagal.
    logger.error?.(
      "tray gagal dibuat, lanjut tanpa tray:",
      err?.message || err,
    );
    tray = null;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on("before-quit", () => {
    isQuitting = true;
  });

  app.whenReady().then(async () => {
    await initLogger();
    logger.info?.("ayesh-desktop starting", app.getVersion?.() || "");
    loadLocalSettings();
    grpcClient = createGrpcClient();
    setupIpcHandlers();
    createWindow();
    setupTray();
    checkForUpdates();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
