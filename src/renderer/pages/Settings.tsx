import React, { useState, useEffect } from 'react';

interface Config {
  provider: string;
  api_key: string;
  model: string;
  host: string;
  port: number;
  grpc_host: string;
  grpc_port: number;
}

const DEFAULT_CONFIG: Config = {
  provider: '',
  api_key: '',
  model: '',
  host: '',
  port: 8080,
  grpc_host: 'localhost',
  grpc_port: 50051,
};

export function SettingsPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (window as any).ayesh
      .getConfig()
      .then((c: Partial<Config>) => setConfig((prev) => ({ ...prev, ...c })))
      .catch((e: any) => setError(e?.message || String(e)));
  }, []);

  const setField = (key: keyof Config, value: string | number) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError('');
    setSaved('');
    try {
      const payload: Partial<Config> = {
        ...config,
        port: Number(config.port) || 0,
        grpc_port: Number(config.grpc_port) || 0,
      };
      if (apiKeyInput.trim()) {
        payload.api_key = apiKeyInput.trim();
      } else {
        delete payload.api_key;
      }
      const res = await (window as any).ayesh.setConfig(payload);
      setApiKeyInput('');
      setSaved(res?.reconnected ? '✅ Saved · gRPC reconnect' : '✅ Saved!');
      setTimeout(() => setSaved(''), 2500);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div className="message assistant" style={{ maxWidth: '100%', fontSize: '0.9em' }}>
        <strong>Quick start (backend remote-first)</strong>
        <ol>
          <li>
            Jalankan ayesh-core: <code>python main.py</code> (butuh PostgreSQL + Redis + LLM key di{' '}
            <code>.env</code>)
          </li>
          <li>Isi gRPC Host/Port di bawah (default localhost:50051 untuk dev lokal)</li>
          <li>Klik Save → klien reconnect otomatis → kembali ke tab Chat</li>
        </ol>
      </div>
      <div>
        <label>Provider:</label>
        <input value={config.provider} onChange={(e) => setField('provider', e.target.value)} />
      </div>
      <div>
        <label>Model:</label>
        <input value={config.model} onChange={(e) => setField('model', e.target.value)} />
      </div>
      <div>
        <label>API Key:</label>
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder={config.api_key ? `tersimpan: ${config.api_key}` : 'API key — kosongkan jika tidak diubah'}
        />
      </div>
      <div>
        <label>REST Host:</label>
        <input value={config.host} onChange={(e) => setField('host', e.target.value)} />
      </div>
      <div>
        <label>REST Port:</label>
        <input
          type="number"
          value={config.port}
          onChange={(e) => setField('port', Number(e.target.value))}
        />
      </div>
      <div>
        <label>gRPC Host:</label>
        <input value={config.grpc_host} onChange={(e) => setField('grpc_host', e.target.value)} />
      </div>
      <div>
        <label>gRPC Port:</label>
        <input
          type="number"
          value={config.grpc_port}
          onChange={(e) => setField('grpc_port', Number(e.target.value))}
        />
      </div>
      <button onClick={handleSave}>{saved || 'Save'}</button>
      {error && <p style={{ color: '#ff6b6b' }}>⚠️ {error}</p>}
      <small>
        Backend remote-first: isi alamat server ayesh-core di gRPC Host/Port (default
        localhost:50051 untuk dev lokal). Host:port baru → klien reconnect otomatis setelah save.
      </small>
    </div>
  );
}
