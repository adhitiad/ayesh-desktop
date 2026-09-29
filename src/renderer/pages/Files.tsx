import React, { useEffect, useState } from "react";

interface FileEntry {
  name: string;
  type: string;
  size: number;
}

interface WriteResult {
  success: boolean;
  message: string;
}

const joinPath = (base: string, name: string) =>
  `${base.replace(/[\\/]+$/, "")}/${name}`;

export function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [path, setPath] = useState(".");
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  const loadFiles = async (dir: string) => {
    try {
      setFiles(await (window as any).ayesh.listFiles(dir));
      setError("");
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (window as any).ayesh
      .listFiles(".")
      .then((list: FileEntry[]) => {
        if (!alive) return;
        setFiles(list);
        setError("");
      })
      .catch((e: any) => {
        if (alive) setError(e?.message || String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openEntry = async (file: FileEntry) => {
    const full = joinPath(path, file.name);
    if (file.type === "directory") {
      setPath(full);
      setSelected(null);
      setLoading(true);
      await loadFiles(full);
      return;
    }
    try {
      const text = await (window as any).ayesh.readFile(full);
      setSelected(full);
      setContent(text);
      setSaved(false);
      setError("");
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const saveFile = async () => {
    if (!selected) return;
    try {
      const res: WriteResult = await (window as any).ayesh.writeFile(
        selected,
        content,
      );
      if (res && res.success === false)
        throw new Error(res.message || "gagal menyimpan");
      setSaved(true);
      setError("");
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  const createFile = async () => {
    const name = newName.trim();
    if (!name) return;
    if (name.includes("/") || name.includes("\\")) {
      setError(
        "Nama file tidak boleh berisi path; buat file di folder yang sedang dibuka.",
      );
      return;
    }
    try {
      const full = joinPath(path, name);
      const res: WriteResult = await (window as any).ayesh.writeFile(full, "");
      if (res && res.success === false)
        throw new Error(res.message || "gagal membuat file");
      setNewName("");
      setError("");
      setLoading(true);
      await loadFiles(path);
      setSelected(full);
      setContent("");
      setSaved(false);
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
        <button
          onClick={() => {
            setLoading(true);
            void loadFiles(path);
          }}
        >
          Muat ulang
        </button>
        {path !== "." && (
          <button
            onClick={() => {
              const parent =
                path.replace(/[\\/]+$/, "").replace(/\/[^/]+$/, "") || ".";
              setPath(parent);
              setSelected(null);
              setLoading(true);
              void loadFiles(parent);
            }}
          >
            Naik
          </button>
        )}
      </div>
      <div>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="nama-file-baru.txt"
        />
        <button onClick={createFile} disabled={!newName.trim()}>
          Buat file
        </button>
      </div>
      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      {loading && files.length === 0 && !error && <p>Memuat daftar file...</p>}
      <ul>
        {files.map((file) => (
          <li key={file.name}>
            <button
              onClick={() => openEntry(file)}
              style={{
                background: "none",
                border: "none",
                color: "#00d4aa",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {file.type === "directory" ? `${file.name}/` : file.name}
            </button>{" "}
            ({(file.size / 1024).toFixed(1)}KB)
          </li>
        ))}
      </ul>
      {!loading && !error && files.length === 0 && (
        <p className="page-empty">
          Folder ini kosong. Masukkan path lain di atas lalu klik Load.
        </p>
      )}
      {selected && (
        <div>
          <h3>
            {selected} <small>(server path, otoritas file ada di server)</small>
          </h3>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={16}
            style={{
              width: "100%",
              background: "#1a1a1a",
              color: "#e0e0e0",
              border: "1px solid #444",
            }}
          />
          <div>
            <button onClick={saveFile}>{saved ? "Tersimpan" : "Simpan"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
