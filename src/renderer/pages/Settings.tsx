import { useState, useEffect } from "react";

interface Config {
  provider: string;
  api_key: string;
  model: string;
  host: string;
  port: number;
  grpc_host: string;
  grpc_port: number;
  grpc_tls?: boolean;
  grpc_tls_enabled?: boolean;
  grpc_tls_ca?: string;
}

const DEFAULT_CONFIG: Config = {
  provider: "",
  api_key: "",
  model: "",
  host: "",
  port: 8080,
  grpc_host: "localhost",
  grpc_port: 50051,
  grpc_tls: false,
  grpc_tls_enabled: false,
  grpc_tls_ca: "",
};

export function SettingsPage({ onSaved }: { onSaved?: () => void }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    (window as any).ayesh
      .getConfig()
      .then((c: Partial<Config>) => setConfig((prev) => ({ ...prev, ...c })))
      .catch((e: any) => setError(e?.message || String(e)));
  }, []);

  const setField = (key: keyof Config, value: string | number) =>
    setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError("");
    setSaved("");
    setWarning("");
    try {
      const payload: Partial<Config> = {
        ...config,
        port: Number(config.port) || 0,
        grpc_port: Number(config.grpc_port) || 0,
        grpc_tls: config.grpc_tls_enabled === true,
        grpc_tls_ca: (config.grpc_tls_ca || "").trim(),
      };
      if (apiKeyInput.trim()) {
        payload.api_key = apiKeyInput.trim();
      } else {
        delete payload.api_key;
      }
      const res = await (window as any).ayesh.setConfig(payload);
      setApiKeyInput("");
      if (res?.warning) {
        // SetConfig best-effort: perubahan lokal (target/TLS) sudah tersimpan,
        // hanya server yang tak merespons; tetap di sini agar warning terbaca.
        setWarning(`${res.warning} (pengaturan lokal tersimpan)`);
        return;
      }
      setSaved(res?.reconnected ? "Tersimpan (reconnect)" : "Tersimpan");
      setTimeout(() => onSaved?.(), 900);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div
        className="message assistant"
        style={{ maxWidth: "100%", fontSize: "0.9em" }}
      >
        <strong>Quick start</strong>
        <ol>
          <li>
            Jalankan ayesh-core: <code>python main.py</code> (butuh PostgreSQL +
            Redis + LLM key di <code>.env</code>)
          </li>
          <li>
            Isi alamat server di gRPC Host/Port (default localhost:50051 untuk
            server di komputer ini)
          </li>
          <li>Klik Save, klien reconnect otomatis lalu pindah ke tab Chat</li>
        </ol>
      </div>

      <h3>Model</h3>
      <div className="field">
        <label>Provider:</label>
        <input
          value={config.provider}
          onChange={(e) => setField("provider", e.target.value)}
        />
      </div>
      <div className="field">
        <label>Model:</label>
        <input
          value={config.model}
          onChange={(e) => setField("model", e.target.value)}
        />
      </div>
      <div className="field">
        <label>API Key:</label>
        <input
          type="password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder={
            config.api_key
              ? `tersimpan: ${config.api_key}`
              : "API key (kosongkan jika tidak diubah)"
          }
        />
      </div>

      <h3>Koneksi gRPC</h3>
      <div className="field">
        <label>gRPC Host:</label>
        <input
          value={config.grpc_host}
          onChange={(e) => setField("grpc_host", e.target.value)}
        />
      </div>
      <div className="field">
        <label>gRPC Port:</label>
        <input
          type="number"
          value={config.grpc_port}
          onChange={(e) => setField("grpc_port", Number(e.target.value))}
        />
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={config.grpc_tls_enabled === true}
            onChange={(e) =>
              setConfig((prev) => ({
                ...prev,
                grpc_tls_enabled: e.target.checked,
              }))
            }
          />{" "}
          gRPC TLS (disimpan lokal di klien)
        </label>
      </div>
      <div className="field">
        <label>CA PEM (opsional):</label>
        <input
          value={config.grpc_tls_ca || ""}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, grpc_tls_ca: e.target.value }))
          }
          placeholder="/path/ca.pem (kosong = system roots)"
        />
      </div>
      {config.grpc_tls && config.grpc_tls_enabled !== true && (
        <p style={{ color: "#ffa94d" }}>
          Server melaporkan TLS aktif tapi klien TLS masih mati. Koneksi akan
          gagal. Centang gRPC TLS lalu Save.
        </p>
      )}
      {config.grpc_tls && config.grpc_tls_enabled === true && (
        <p style={{ color: "#51cf66" }}>Server: TLS aktif, klien TLS aktif</p>
      )}
      <button onClick={handleSave}>{saved || "Save"}</button>
      {warning && <p style={{ color: "#ffa94d" }}>{warning}</p>}
      {error && <p style={{ color: "#ff6b6b" }}>{error}</p>}
      <small>
        Aplikasi ini adalah klien: isi alamat server ayesh-core di gRPC
        Host/Port (default localhost:50051 untuk server di komputer ini).
        Host/Port baru dipakai otomatis setelah Save, tanpa restart aplikasi.
      </small>
    </div>
  );
}
