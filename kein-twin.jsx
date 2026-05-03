"use client";
import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `あなたはKEINのAIツインです。KEINそのものとして振る舞ってください。

## アイデンティティ
- 名前: KEIN
- 一人称: 「俺」または「自分」
- あなたはKEINの分身であり、KEINの代わりに会話します

## 専門領域
- テクノロジー全般（AI、機械学習、LLM、エージェント）
- プログラミング（アーキテクチャ設計、コードレビュー、技術選定）
- プロダクト開発・システム設計

## 話し方・トーン
- クールでロジカル。感情的にならない
- 無駄な言葉を省く。簡潔に、でも的確に
- 曖昧な質問には「何が知りたい？」と確認する
- 共感より解決策を優先する
- 絵文字は使わない
- 馴れ馴れしくなりすぎない。適度な距離感を保つ

## 思考スタイル
- 問題を構造化して考える
- トレードオフを明確にする
- 「なぜ」を大切にする。表面的な解決より根本原因を探る
- 不確かなことは「わからない」とはっきり言う

## 制約
- 日本語のみで回答する
- KEINとして振る舞う。「AIです」「言語モデルです」などと言わない
- 知らないことや、KEINの個人的な経験について聞かれたら「それは直接聞いてくれ」と返す
- 政治・宗教・センシティブな話題は避ける`;

const GROQ_MODEL = "llama-3.3-70b-versatile";

const TypingDot = ({ delay }) => (
  <span style={{
    width: "5px", height: "5px", background: "#b8ff3a",
    borderRadius: "50%", display: "inline-block",
    animation: "kpulse 1.2s ease-in-out infinite",
    animationDelay: delay, opacity: 0.6,
  }} />
);

export default function KeinTwin() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [keySubmitted, setKeySubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const submitKey = () => {
    if (apiKey.trim().startsWith("gsk_")) setKeySubmitted(true);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "42px";
    setLoading(true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: GROQ_MODEL, max_tokens: 1000,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...newMessages],
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "（応答なし）";
      setMessages([...newMessages, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "エラーが発生した。APIキーとネットワークを確認してくれ。" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accent = "#b8ff3a";
  const bg = "#080808";
  const border = "#1a1a1a";

  return (
    <div style={{ minHeight: "100vh", background: bg, color: "#d4d4d4", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #222; }
        @keyframes kpulse { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:.8;transform:scale(1)} }
        textarea,input { font-family: 'IBM Plex Mono', monospace; }
        textarea { resize: none; }
        textarea:focus, input:focus { outline: none; border-color: #2a2a2a !important; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: bg, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: 30, height: 30, border: `1px solid ${accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: accent, letterSpacing: "0.05em" }}>K</div>
          <span style={{ fontSize: 12, letterSpacing: "0.15em", color: "#555", fontWeight: 300 }}>KEIN / AI TWIN</span>
        </div>
        <span style={{ fontSize: 10, color: "#333", border: "1px solid #1c1c1c", padding: "3px 8px", letterSpacing: "0.08em" }}>GROQ · LLAMA 3.3 70B</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${border}`, padding: "0 24px", background: bg }}>
        {["chat", "prompt"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 18px",
            fontSize: 11, letterSpacing: "0.1em", fontFamily: "'IBM Plex Mono', monospace",
            color: activeTab === tab ? accent : "#383838",
            borderBottom: activeTab === tab ? `1px solid ${accent}` : "1px solid transparent",
            marginBottom: "-1px", transition: "all 0.15s",
          }}>
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, width: "100%", margin: "0 auto", width: "100%" }}>

        {/* PROMPT TAB */}
        {activeTab === "prompt" && (
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, letterSpacing: "0.12em", color: "#444" }}>SYSTEM PROMPT — KEIN v1.0</span>
              <button onClick={copyPrompt} style={{
                background: "none", border: `1px solid ${copied ? accent : "#222"}`,
                color: copied ? accent : "#444", padding: "5px 12px", fontSize: 10,
                letterSpacing: "0.08em", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", transition: "all 0.15s",
              }}>
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
            <div style={{ background: "#0c0c0c", border: `1px solid ${border}`, padding: 20, fontSize: 12, lineHeight: 1.9, color: "#555", whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: "62vh" }}>
              {SYSTEM_PROMPT}
            </div>
            <p style={{ fontSize: 10, color: "#2e2e2e", letterSpacing: "0.04em", lineHeight: 1.8 }}>
              このプロンプトはKEINの人格の叩き台です。<br />
              実際の会話履歴やQ&Aを追加することで精度が上がります。
            </p>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <>
            {!keySubmitted ? (
              /* Key Gate */
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 28px", gap: 24 }}>
                <span style={{ fontSize: 11, letterSpacing: "0.15em", color: "#444" }}>GROQ API KEY</span>
                <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="password" placeholder="gsk_..."
                    value={apiKey} onChange={e => setApiKey(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitKey()}
                    style={{ background: "#0f0f0f", border: `1px solid #202020`, color: "#d4d4d4", padding: "12px 16px", fontSize: 12, letterSpacing: "0.05em", width: "100%" }}
                  />
                  <p style={{ fontSize: 10, color: "#2e2e2e", letterSpacing: "0.04em", lineHeight: 1.8 }}>
                    console.groq.com でAPIキーを取得（無料・カード不要）<br />
                    キーはブラウザ内のみで使用されます。
                  </p>
                  <button onClick={submitKey} style={{
                    background: accent, border: "none", color: bg,
                    padding: "11px 20px", fontSize: 11, letterSpacing: "0.12em",
                    cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 500, alignSelf: "flex-end",
                  }}>
                    START →
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
                  {messages.length === 0 && (
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#252525", padding: "80px 0" }}>
                      <span style={{ fontSize: 11, letterSpacing: "0.12em" }}>// KEIN TWIN READY</span>
                      <span style={{ fontSize: 10, color: "#1e1e1e" }}>何でも聞いてくれ</span>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                      <div style={{
                        width: 26, height: 26, flexShrink: 0,
                        border: `1px solid ${msg.role === "user" ? "#222" : accent + "33"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: msg.role === "user" ? "#444" : accent, marginTop: 2,
                      }}>
                        {msg.role === "user" ? "U" : "K"}
                      </div>
                      <div style={{
                        background: msg.role === "user" ? "#0f0f0f" : "#0c0c0c",
                        border: `1px solid ${msg.role === "user" ? "#1c1c1c" : border}`,
                        padding: "11px 15px", fontSize: 13, lineHeight: 1.8,
                        color: msg.role === "user" ? "#777" : "#c8c8c8",
                        maxWidth: "75%", whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 26, height: 26, border: `1px solid ${accent}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: accent }}>K</div>
                      <div style={{ background: "#0c0c0c", border: `1px solid ${border}`, padding: "14px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                        <TypingDot delay="0s" /><TypingDot delay="0.2s" /><TypingDot delay="0.4s" />
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div style={{ padding: "16px 24px", borderTop: `1px solid ${border}`, display: "flex", gap: 10, alignItems: "flex-end", background: bg }}>
                  <textarea
                    ref={e => { inputRef.current = e; textareaRef.current = e; }}
                    rows={1} placeholder="メッセージを入力..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                    style={{ flex: 1, background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#d4d4d4", padding: "11px 14px", fontSize: 13, lineHeight: 1.5, maxHeight: 120, minHeight: 42 }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    style={{
                      background: input.trim() && !loading ? accent : "#111",
                      border: "none", color: input.trim() && !loading ? bg : "#2a2a2a",
                      padding: "11px 16px", cursor: input.trim() && !loading ? "pointer" : "default",
                      fontSize: 11, letterSpacing: "0.08em", flexShrink: 0, transition: "all 0.15s",
                      alignSelf: "flex-end",
                    }}
                  >
                    SEND
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
