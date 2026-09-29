import React, { useState, useEffect, useRef } from "react";

interface ChatChunk {
  sessionId?: string;
  token: string;
  toolCalls: Array<{
    name: string;
    status: string;
    progress: number;
    result?: string;
  }>;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  };
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function ChatPage({
  sessionId,
  onNewSession,
}: {
  sessionId: string;
  onNewSession: (id: string) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [toolCalls, setToolCalls] = useState<ChatChunk["toolCalls"]>([]);
  const [usage, setUsage] = useState<ChatChunk["usage"] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = (window as any).ayesh.onChunk((chunk: ChatChunk) => {
      // Chunk dari sesi lain (stream lama / sesi berbeda) diabaikan.
      if (chunk.sessionId && chunk.sessionId !== sessionId) return;
      if (chunk.toolCalls && chunk.toolCalls.length > 0)
        setToolCalls(chunk.toolCalls);
      if (chunk.token) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              content: last.content + chunk.token,
            };
          } else {
            next.push({ role: "assistant", content: chunk.token });
          }
          return next;
        });
      }
      if (chunk.done) {
        setIsStreaming(false);
        if (chunk.usage) setUsage(chunk.usage);
      }
    });
    return () => unsub();
  }, [sessionId]);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      (window as any).ayesh
        .healthCheck()
        .then((h: any) => {
          if (alive) setHealth(h);
        })
        .catch(() => {
          if (alive) setHealth(null);
        });
    poll();
    const timer = setInterval(poll, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // State (messages/toolCalls/usage/dll) di-reset oleh remount berkat key={sessionId} di App;
  // effect ini hanya menghidrasi riwayat sesi dari server (setState asinkron di callback ✓).
  useEffect(() => {
    let alive = true;
    (window as any).ayesh
      .getSession(sessionId)
      .then((s: any) => {
        if (!alive || !s?.history) return;
        try {
          const hist = JSON.parse(s.history);
          if (!Array.isArray(hist)) return;
          const restored: Msg[] = hist
            .filter(
              (m: any) =>
                m &&
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content,
            )
            .map((m: any) => ({ role: m.role, content: m.content }));
          setMessages(restored);
        } catch {
          /* history bukan JSON valid → mulai kosong */
        }
      })
      .catch(() => {
        /* sesi belum ada di server / offline → mulai kosong */
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const dropEmptyReply = () =>
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant" && !last.content) next.pop();
      return next;
    });

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setIsStreaming(true);
    setError(null);
    setToolCalls([]);
    setUsage(null);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);
    setInput("");
    try {
      await (window as any).ayesh.sendMessage(text, sessionId);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("DIINTERUPSI")) {
        // Interrupt manual: pesan user & konten parsial tetap, tanpa panel error.
        dropEmptyReply();
        setIsStreaming(false);
        return;
      }
      if (msg.includes("digantikan")) {
        // Stream baru mengambil alih sesi ini; biarkan alur baru yang mengatur state.
        return;
      }
      console.error("Chat error:", err);
      dropEmptyReply();
      setError(msg);
      setIsStreaming(false);
    }
  };

  const handleInterrupt = async () => {
    try {
      await (window as any).ayesh.interruptChat(sessionId);
      setIsStreaming(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  };

  const startNewSession = () => {
    if (isStreaming) return;
    onNewSession(
      `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    );
  };

  return (
    <div className="chat-container">
      {health && (
        <div className="health-bar">
          <span className={`dot ${health.healthy ? "on" : "off"}`} />
          <span>{health.healthy ? "Connected" : "Disconnected"}</span>
          <span>v{health.version}</span>
          <span>sesi: {sessionId}</span>
        </div>
      )}
      <div className="messages">
        {messages.length === 0 && !isStreaming && (
          <div className="chat-empty">
            <p className="chat-empty-title">Belum ada pesan</p>
            <p className="chat-empty-hint">
              Ketik pertanyaan di kolom bawah untuk memulai percakapan.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            {m.content}
          </div>
        ))}
        {error && (
          <div
            className="message assistant"
            style={{ color: "#ff6b6b", maxWidth: "100%" }}
          >
            Error: {error}
          </div>
        )}
        {toolCalls.length > 0 && (
          <div
            className="message assistant"
            style={{ maxWidth: "100%", fontSize: "0.85em" }}
          >
            {toolCalls.map((tc, i) => (
              <div key={i}>
                {tc.name} · {tc.status}{" "}
                {tc.progress <= 1
                  ? Math.round(tc.progress * 100)
                  : Math.round(tc.progress)}
                %{tc.result ? ` · ${tc.result}` : ""}
              </div>
            ))}
          </div>
        )}
        {usage && !isStreaming && (
          <div
            className="message assistant"
            style={{ maxWidth: "100%", fontSize: "0.85em", color: "#888" }}
          >
            tokens: {usage.prompt_tokens}+{usage.completion_tokens} · $
            {(usage.cost_usd ?? 0).toFixed(4)}
          </div>
        )}
        {isStreaming && (
          <div className="message assistant">
            <span className="typing">mengetik</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          disabled={isStreaming}
          placeholder="Ketik pesan (Enter kirim, Shift+Enter baris baru)"
        />
        <button onClick={sendMessage} disabled={isStreaming}>
          {isStreaming ? "Streaming..." : "Kirim"}
        </button>
        {isStreaming && (
          <button onClick={handleInterrupt} className="interrupt">
            Interrupt
          </button>
        )}
        <button
          onClick={startNewSession}
          disabled={isStreaming}
          title="Mulai sesi chat baru"
        >
          + Sesi baru
        </button>
      </div>
    </div>
  );
}
