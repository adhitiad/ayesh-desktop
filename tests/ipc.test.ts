import { test, expect, mock } from 'bun:test';

process.env.NODE_ENV = 'development';

const handlers = new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>();

const fakeGrpc = {
  clients: [] as Array<{ target: string; closed: boolean }>,
  lastSetConfig: null as Record<string, unknown> | null,
  lastGetSession: null as { id: string } | null,
  lastListFiles: null as { path: string } | null,
  lastChatStream: null as FakeChatStream | null,
  lastInstallSkill: null as { name: string; uninstall: boolean } | null,
};

class FakeWebContents {
  sent: Array<{ ch: string; data: unknown }> = [];
  setWindowOpenHandler() {}
  on() {}
  openDevTools() {}
  send(ch: string, data: unknown) {
    this.sent.push({ ch, data });
  }
}

class FakeBrowserWindow {
  static instances: FakeBrowserWindow[] = [];
  webContents = new FakeWebContents();
  constructor() {
    FakeBrowserWindow.instances.push(this);
  }
  loadURL() {
    return Promise.resolve();
  }
  loadFile() {
    return Promise.resolve();
  }
  static getAllWindows() {
    return FakeBrowserWindow.instances;
  }
}

class FakeChatStream {
  static autoDone = true;
  handlers: Record<string, Array<(arg: unknown) => void>> = {};
  written: Array<Record<string, unknown>> = [];
  ended = false;
  on(ev: string, cb: (arg: unknown) => void) {
    (this.handlers[ev] ||= []).push(cb);
  }
  write(msg: Record<string, unknown>) {
    this.written.push(msg);
    if (FakeChatStream.autoDone) {
      queueMicrotask(() => {
        (this.handlers.data || []).forEach((f) =>
          f({ token: 'halo', tool_calls: [], done: true, usage: null })
        );
      });
    }
  }
  end() {
    this.ended = true;
    (this.handlers.end || []).forEach((f) => f(undefined));
  }
  emit(ev: string, arg: unknown) {
    (this.handlers[ev] || []).forEach((f) => f(arg));
  }
}

class FakeAyesh {
  target: string;
  constructor(target: string) {
    this.target = target;
    fakeGrpc.clients.push({ target, closed: false });
  }
  close() {
    const last = fakeGrpc.clients[fakeGrpc.clients.length - 1];
    if (last) last.closed = true;
  }
  GetConfig(_req: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, {
      provider: 'groq',
      api_key: 'sk-abcdef123456',
      model: 'llama-3',
      host: '',
      port: 8080,
      grpc_host: 'localhost',
      grpc_port: 50051,
    });
  }
  SetConfig(req: { config: Record<string, unknown> }, cb: (e: null, r: unknown) => void) {
    fakeGrpc.lastSetConfig = req.config;
    cb(null, { success: true, message: 'ok' });
  }
  GetSession(req: { id: string }, cb: (e: null, r: unknown) => void) {
    fakeGrpc.lastGetSession = req;
    cb(null, { id: req.id, agent_type: 'code', created_at: 't', last_message: 'm' });
  }
  ListSessions(_req: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, { sessions: [{ id: 's1', agent_type: 'chat', created_at: 't', last_message: 'm' }] });
  }
  ListFiles(req: { path: string }, cb: (e: null, r: unknown) => void) {
    fakeGrpc.lastListFiles = req;
    cb(null, { files: [] });
  }
  ReadFile(_r: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, { content: 'x', encoding: 'utf-8' });
  }
  WriteFile(_r: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, { success: true, message: '' });
  }
  ListSkills(_r: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, { skills: [] });
  }
  InstallSkill(req: { name: string; uninstall: boolean }, cb: (e: null, r: unknown) => void) {
    fakeGrpc.lastInstallSkill = req;
    cb(null, { success: true, message: 'ok' });
  }
  HealthCheck(_r: unknown, cb: (e: null, r: unknown) => void) {
    cb(null, { healthy: true, version: 'test', postgres_connected: true, redis_connected: true });
  }
  ChatStream() {
    const stream = new FakeChatStream();
    fakeGrpc.lastChatStream = stream;
    return stream;
  }
}

mock.module('electron', () => ({
  app: {
    whenReady: () => Promise.resolve(),
    on: () => {},
    quit: () => {},
    getPath: () => '',
    requestSingleInstanceLock: () => true,
    getVersion: () => 'test',
  },
  BrowserWindow: FakeBrowserWindow,
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, fn);
    },
    on: () => {},
  },
}));

mock.module('@grpc/grpc-js', () => ({
  default: {
    credentials: { createInsecure: () => ({}) },
    loadPackageDefinition: () => ({ ayesh: { AyeshService: FakeAyesh } }),
  },
  credentials: { createInsecure: () => ({}) },
  loadPackageDefinition: () => ({ ayesh: { AyeshService: FakeAyesh } }),
}));

mock.module('@grpc/proto-loader', () => ({
  default: { loadSync: () => ({}) },
  loadSync: () => ({}),
}));

await import('../src/main.js');
await new Promise((r) => setTimeout(r, 20));

const invoke = (channel: string, ...args: unknown[]) =>
  (handlers.get(channel) as (e: unknown, ...a: unknown[]) => Promise<unknown>)({}, ...args);

const invokeNoArgs = (channel: string) =>
  (handlers.get(channel) as () => Promise<unknown>)();

test('semua channel IPC terdaftar', () => {
  for (const ch of [
    'chat:send',
    'chat:interrupt',
    'files:list',
    'files:read',
    'files:write',
    'sessions:list',
    'sessions:get',
    'skills:list',
    'skills:install',
    'config:get',
    'config:set',
    'health:check',
  ]) {
    expect(handlers.has(ch)).toBe(true);
  }
});

test('config:get meng-mask api_key', async () => {
  const cfg = (await invokeNoArgs('config:get')) as { api_key: string; provider: string };
  expect(cfg.provider).toBe('groq');
  expect(cfg.api_key).toBe('sk-a***56');
  expect(cfg.api_key).not.toContain('abcdef1234');
});

test('config:set tanpa api_key memakai key asli dari cache', async () => {
  await invokeNoArgs('config:get');
  const res = (await invoke('config:set', { provider: 'groq', model: 'baru' })) as {
    success: boolean;
    reconnected: boolean;
  };
  expect(res.success).toBe(true);
  expect(fakeGrpc.lastSetConfig?.api_key).toBe('sk-abcdef123456');
  expect(res.reconnected).toBe(false);
});

test('config:set menolak port tidak valid (fail-closed)', async () => {
  await expect(invoke('config:set', { port: 'bukan-angka' })).rejects.toThrow('port tidak valid');
  await expect(invoke('config:set', { grpc_port: 99999 })).rejects.toThrow('tidak valid');
  await expect(invoke('config:set', { model: 123 })).rejects.toThrow('harus string');
});

test('config:set grpc_host:port baru → klien di-reconnect', async () => {
  await invokeNoArgs('config:get');
  const before = fakeGrpc.clients.length;
  const res = (await invoke('config:set', { grpc_host: '10.1.2.3', grpc_port: 60051 })) as {
    reconnected: boolean;
  };
  expect(res.reconnected).toBe(true);
  expect(fakeGrpc.clients.length).toBe(before + 1);
  expect(fakeGrpc.clients[before - 1].closed).toBe(true);
  expect(fakeGrpc.clients[before].target).toBe('10.1.2.3:60051');
});

test('config:set host/grpc_host dengan karakter aneh → fail-closed', async () => {
  await expect(invoke('config:set', { grpc_host: 'bad host!' })).rejects.toThrow('tidak valid');
  await expect(invoke('config:set', { host: 'x/y' })).rejects.toThrow('tidak valid');
});

test('skills:install valid → InstallSkill dipanggil', async () => {
  const res = (await invoke('skills:install', { name: 'code-review', uninstall: false })) as {
    success: boolean;
  };
  expect(res.success).toBe(true);
  expect(fakeGrpc.lastInstallSkill).toEqual({ name: 'code-review', uninstall: false });
  await invoke('skills:install', { name: 'code-review', uninstall: true });
  expect(fakeGrpc.lastInstallSkill?.uninstall).toBe(true);
});

test('skills:install nama kosong → tolak', async () => {
  await expect(invoke('skills:install', { name: '  ' })).rejects.toThrow('tidak valid');
});

test('sessions:get valid → GetSession dipanggil dengan id', async () => {
  const s = (await invoke('sessions:get', 'abc-123')) as { id: string };
  expect(s.id).toBe('abc-123');
  expect(fakeGrpc.lastGetSession?.id).toBe('abc-123');
});

test('sessions:get id kosong → tolak', async () => {
  await expect(invoke('sessions:get', '  ')).rejects.toThrow('tidak valid');
});

test('files:list path kosong → tolak', async () => {
  await expect(invoke('files:list', '')).rejects.toThrow('tidak valid');
});

test('chat:send argumen tidak valid → tolak', async () => {
  await expect(invoke('chat:send', { message: '', sessionId: 's' })).rejects.toThrow(
    'tidak valid'
  );
  await expect(invoke('chat:send', { message: 'hi' })).rejects.toThrow('tidak valid');
});

test('chat:send valid → stream ditulis, chunk.done resolve, chunk terkirim ke renderer', async () => {
  const done = invoke('chat:send', { message: 'halo', sessionId: 'sess-1' });
  await done;
  const stream = fakeGrpc.lastChatStream!;
  expect(stream.written[0]).toEqual({ message: 'halo', session_id: 'sess-1', interrupt: false });
  const sent = FakeBrowserWindow.instances[0].webContents.sent.filter((s) => s.ch === 'chat:chunk');
  expect(sent.length).toBeGreaterThan(0);
  expect((sent[sent.length - 1].data as { token: string }).token).toBe('halo');
});

test('chat:interrupt tanpa stream aktif → {interrupted:false}', async () => {
  const res = (await invoke('chat:interrupt', { sessionId: 'tidak-ada' })) as {
    interrupted: boolean;
  };
  expect(res.interrupted).toBe(false);
});

test('chat:interrupt stream aktif → interrupt:true di stream yang sama + end', async () => {
  FakeChatStream.autoDone = false;
  try {
    const pending = invoke('chat:send', { message: 'x', sessionId: 'sess-2' });
    pending.catch(() => {});
    await new Promise((r) => setTimeout(r, 5));
    const stream = fakeGrpc.lastChatStream!;
    const res = (await invoke('chat:interrupt', { sessionId: 'sess-2' })) as {
      interrupted: boolean;
    };
    expect(res.interrupted).toBe(true);
    const last = stream.written[stream.written.length - 1];
    expect(last.interrupt).toBe(true);
    expect(last.session_id).toBe('sess-2');
    expect(stream.ended).toBe(true);
  } finally {
    FakeChatStream.autoDone = true;
  }
});

test('health:check → healthy dari server', async () => {
  const h = (await invokeNoArgs('health:check')) as { healthy: boolean; version: string };
  expect(h.healthy).toBe(true);
  expect(h.version).toBe('test');
});
