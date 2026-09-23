import React, { useEffect, useState } from 'react';

interface FileEntry {
  name: string;
  type: string;
  size: number;
}

interface WriteResult {
  success: boolean;
  message: string;
}

const joinPath = (base: string, name: string) => `${base.replace(/[\\/]+$/, '')}/${name}`;

export function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [path, setPath] = useState('.');
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadFiles = async (dir: string) => {
    try {
      setFiles(await (window as any).ayesh.listFiles(dir));
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        setFiles(await (window as any).ayesh.listFiles('.'));
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
  }, []);

  const openEntry = async (file: FileEntry) => {
    const full = joinPath(path, file.name);
    if (file.type === 'directory') {
      setPath(full);
      setSelected(null);
      await loadFiles(full);
      return;
    }
    try {
      const text = await (window as any).ayesh.readFile(full);
      setSelected(full);
      setContent(text);
      setSaved(false);
      setError('');
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    try {
      const res: WriteResult = await (window as any).ayesh.writeFile(selected, content);
      if (res && res.success === false) throw new Error(res.message || 'gagal menyimpan');
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="files-page">
      <h2>Files</h2>
      <div>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Path..."
        />
        <button onClick={() => loadFiles(path)}>Load</button>
        {path !== '.' && (
          <button
            onClick={() => {
              const parent = path.replace(/[\\/]+$/, '').replace(/\/[^/]+$/, '') || '.';
              setPath(parent);
              setSelected(null);
              loadFiles(parent);
            }}
          >
            ↑ Up
          </button>
        )}
      </div>
      {error && <p style={{ color: '#ff6b6b' }}>⚠️ {error}</p>}
      <ul>
        {files.map((file) => (
          <li key={file.name}>
            <button
              onClick={() => openEntry(file)}
              style={{ background: 'none', border: 'none', color: '#00d4aa', cursor: 'pointer', padding: 0 }}
            >
              {file.type === 'directory' ? '📁' : '📄'} {file.name}
            </button>{' '}
            ({(file.size / 1024).toFixed(1)}KB)
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h3>
            {selected} <small>(server path — otoritas file ada di server)</small>
          </h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            style={{ width: '100%', background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #444' }}
          />
          <div>
            <button onClick={saveFile}>{saved ? '✅ Saved!' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
