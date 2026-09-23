import React, { useState, useEffect } from 'react';

interface Config {
  provider: string;
  model: string;
  host: string;
  port: number;
}

export function SettingsPage() {
  const [config, setConfig] = useState<Config>({ provider: '', model: '', host: '', port: 8080 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (window as any).ayesh.getConfig().then((c: Config) => setConfig(c));
  }, []);

  const handleSave = async () => {
    await (window as any).ayesh.setConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-page">
      <h2>Settings</h2>
      <div>
        <label>Provider:</label>
        <input
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value })}
        />
      </div>
      <div>
        <label>Model:</label>
        <input
          value={config.model}
          onChange={(e) => setConfig({ ...config, model: e.target.value })}
        />
      </div>
      <button onClick={handleSave}>{saved ? '✅ Saved!' : 'Save'}</button>
    </div>
  );
}
