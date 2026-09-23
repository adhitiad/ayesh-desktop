import React, { useState, useEffect, useRef } from 'react';

interface ChatChunk {
  token: string;
  toolCalls: Array<{
    name: string;
    status: string;
    progress: number;
  }>;
  done: boolean;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    cost_usd: number;
  };
}

export function ChatPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [health, setHealth] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = (window as any).ayesh.onChunk((chunk: ChatChunk) => {
      if (chunk.done) {
        setIsStreaming(false);
      } else {
        setMessages(prev => {
          const last = prev[prev.length - 1] || '';
          return [...prev.slice(0, -1), last + chunk.token];
        });
      }
    });

    (window as any).ayesh.healthCheck().then((h: any) => setHealth(h));

    return () => unsub();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;
    setIsStreaming(true);
    setMessages(prev => [...prev, input, '']);
    setInput('');
    try {
      await (window as any).ayesh.sendMessage(input, 'session-1');
    } catch (err) {
      console.error('Chat error:', err);
      setIsStreaming(false);
    }
  };

  const handleInterrupt = () => {
    (window as any).ayesh.interruptChat('session-1');
    setIsStreaming(false);
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {health && (
          <div className="message assistant" style={{ maxWidth: '100%' }}>
            <small>Status: {health.healthy ? '🟢 Connected' : '🔴 Disconnected'} | v{health.version}</small>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${i % 2 === 0 ? 'user' : 'assistant'}`}>
            {msg}
          </div>
        ))}
        {isStreaming && (
          <div className="message assistant">
            <span className="typing">⏳ ...typing</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isStreaming}
          placeholder="Ketik pesan..."
        />
        <button onClick={sendMessage} disabled={isStreaming}>
          {isStreaming ? 'Streaming...' : 'Kirim'}
        </button>
        {isStreaming && (
          <button onClick={handleInterrupt} className="interrupt">
            ⏹ Interrupt
          </button>
        )}
      </div>
    </div>
  );
}
