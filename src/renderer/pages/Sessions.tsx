import React, { useState, useEffect } from "react";

interface Session {
  id: string;
  agent_type: string;
  created_at: string;
  last_message: string;
}

export function SessionsPage({
  onOpen,
}: {
  onOpen: (sessionId: string) => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [detail, setDetail] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const list = await (window as any).ayesh.listSessions();
      setSessions(list);
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
      .listSessions()
      .then((list: Session[]) => {
        if (!alive) return;
        setSessions(list);
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

  const showDetail = async (id: string) => {
    try {
      const session = await (window as any).ayesh.getSession(id);
      setDetail(session);
      setError("");
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  return (
    <div className="sessions-page">
      <h2>Sessions</h2>
      <button
        onClick={() => {
          setLoading(true);
          void load();
        }}
      >
        Muat ulang
      </button>
      {error && <p style={{ color: "#ff6b6b" }}>Error: {error}</p>}
      <ul>
        {sessions.map((s) => (
          <li key={s.id}>
            <strong>{s.id}</strong> · {s.agent_type || "agent"} · {s.created_at}
            <br />
            <small>{s.last_message}</small>{" "}
            <button onClick={() => showDetail(s.id)}>Detail</button>{" "}
            <button onClick={() => onOpen(s.id)}>Buka</button>
          </li>
        ))}
      </ul>
      {loading && <p>Memuat daftar sesi...</p>}
      {sessions.length === 0 && !error && !loading && (
        <p className="page-empty">
          Belum ada sesi. Buka tab Chat dan kirim pesan pertama untuk membuat
          sesi.
        </p>
      )}
      {detail && (
        <div className="message assistant" style={{ maxWidth: "100%" }}>
          <strong>Session detail</strong>
          <br />
          id: {detail.id}
          <br />
          agent: {detail.agent_type}
          <br />
          created: {detail.created_at}
          <br />
          last: {detail.last_message}
        </div>
      )}
    </div>
  );
}
