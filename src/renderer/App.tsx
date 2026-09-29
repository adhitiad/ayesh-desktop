import React, { useEffect, useState } from "react";
import { ChatPage } from "./pages/Chat";
import { SkillsPage } from "./pages/Skills";
import { FilesPage } from "./pages/Files";
import { SessionsPage } from "./pages/Sessions";
import { SettingsPage } from "./pages/Settings";

const newSessionId = () =>
  `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function App() {
  const [page, setPage] = useState("chat");
  const [sessionId, setSessionId] = useState(newSessionId);

  useEffect(() => {
    void (async () => {
      try {
        const h = await (window as any).ayesh.healthCheck();
        if (!h?.healthy) setPage("settings");
      } catch {
        setPage("settings");
      }
    })();
  }, []);

  const openSession = (id: string) => {
    setSessionId(id);
    setPage("chat");
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Ayesh</h1>
        <nav>
          <button type="button" onClick={() => setPage("chat")}>
            Chat
          </button>
          <button type="button" onClick={() => setPage("sessions")}>
            Sessions
          </button>
          <button type="button" onClick={() => setPage("skills")}>
            Skills
          </button>
          <button type="button" onClick={() => setPage("files")}>
            Files
          </button>
          <button type="button" onClick={() => setPage("settings")}>
            Settings
          </button>
        </nav>
      </header>
      <main>
        {/* Chat selalu ter-mount (display toggle) agar listener stream tidak terputus
            saat berpindah tab; token yang datang di tab lain tetap diterima. */}
        <div style={{ display: page === "chat" ? "contents" : "none" }}>
          {/* key → remount per sesi: reset state Chat + re-subscribe stream listener */}
          <ChatPage
            key={sessionId}
            sessionId={sessionId}
            onNewSession={openSession}
          />
        </div>
        {page === "sessions" && <SessionsPage onOpen={openSession} />}
        {page === "skills" && <SkillsPage />}
        {page === "files" && <FilesPage />}
        {page === "settings" && (
          <SettingsPage onSaved={() => setPage("chat")} />
        )}
      </main>
    </div>
  );
}

export default App;
