import React, { useState } from 'react';

interface FileEntry {
  name: string;
  type: string;
  size: number;
}

export function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [path, setPath] = useState('.');

  const loadFiles = async () => {
    const f = await (window as any).ayesh.listFiles(path);
    setFiles(f);
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
        <button onClick={loadFiles}>Load</button>
      </div>
      <ul>
        {files.map((file, i) => (
          <li key={i}>
            {file.type === 'directory' ? '📁' : '📄'} {file.name} ({(file.size / 1024).toFixed(1)}KB)
          </li>
        ))}
      </ul>
    </div>
  );
}
