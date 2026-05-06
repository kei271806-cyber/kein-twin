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

const TypingDot = ({ delay }) => (
  <span style={{
    width: "5px", height: "5px", background: "#b8ff3a",
    borderRadius: "50%", display: "inline-block",
    animation: "kpulse 1.2s ease-in-out infinite",
    animationDelay: delay, opacity: 0.6,
  }} />
);

const INITIAL_INTERVIEW_MESSAGE = {
  role: "assistant",
  content: "はじめまして。KEINさんのことをもっとよく知るためにいくつか質問させてください。\n\nまず、KEINさんが今一番力を入れていることや、最近取り組んでいるプロジェクトについて教えてもらえますか？",
};

export default function KeinTwin() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");

  // memory interview state — Supabase から復元
  const [memMessages, setMemMessages] = useState([INITIAL_INTERVIEW_MESSAGE]);
  const [memInput, setMemInput] = useState("");
  const [memLoading, setMemLoading] = useState(false);
  const [memInitLoading, setMemInitLoading] = useState(true);
  const [recentSaved, setRecentSaved] = useState([]);
  const [totalSaved, setTotalSaved] = useState(0);

  // file upload state
  const [uploadCategory, setUploadCategory] = useState("experience");
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef(null);

  // prompt tab state
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef(null);
  const memBottomRef = useRef(null);
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const memTextareaRef = useRef(null);
  const memInputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    memBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [memMessages, memLoading]);

  // 起動時に Supabase から会話履歴を読み込む
  useEffect(() => {
    fetch("/api/conversation")
      .then(r => r.json())
      .then(data => {
        if (data.messages?.length > 0) setMemMessages(data.messages);
      })
      .catch(() => {})
      .finally(() => setMemInitLoading(false));
  }, []);

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        const isRateLimit = res.status === 429;
        setMessages([...newMessages, {
          role: "assistant",
          content: isRateLimit
            ? `レート制限に達した。少し待ってから再送してくれ。\n\n詳細: ${data.error}`
            : `APIエラー (${res.status}): ${data.error}`,
        }]);
        return;
      }
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "ネットワークエラーが発生した。" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const saveConversationMessage = (role, content) =>
    fetch("/api/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, content }),
    }).catch(() => {});

  const sendMemMessage = async () => {
    const text = memInput.trim();
    if (!text || memLoading) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...memMessages, userMsg];
    setMemMessages(newMessages);
    setMemInput("");
    if (memTextareaRef.current) memTextareaRef.current.style.height = "42px";
    setMemLoading(true);
    setRecentSaved([]);
    saveConversationMessage("user", text);
    try {
      const res = await fetch("/api/memory-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMemMessages([...newMessages, { role: "assistant", content: `エラー: ${data.error}` }]);
        return;
      }
      const reply = data.reply;
      setMemMessages([...newMessages, { role: "assistant", content: reply }]);
      saveConversationMessage("assistant", reply);
      if (data.savedMemories?.length > 0) {
        setRecentSaved(data.savedMemories);
        setTotalSaved(prev => prev + data.savedMemories.length);
      }
    } catch {
      setMemMessages([...newMessages, { role: "assistant", content: "ネットワークエラーが発生した。" }]);
    } finally {
      setMemLoading(false);
      memInputRef.current?.focus();
    }
  };

  const handleMemKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMemMessage(); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("アップロード中...");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("category", uploadCategory);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setUploadMsg(`エラー: ${data.error}`); return; }
      setUploadMsg(`完了 — ${data.saved} 件の記憶を保存した`);
      setTotalSaved(prev => prev + data.saved);
    } catch {
      setUploadMsg("アップロードに失敗した。");
    } finally {
      setUploading(false);
      e.target.value = "";
      setTimeout(() => setUploadMsg(""), 5000);
    }
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
        textarea,input,select { font-family: 'IBM Plex Mono', monospace; }
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
        {["chat", "memory", "prompt"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 18px",
            fontSize: 11, letterSpacing: "0.1em", fontFamily: "'IBM Plex Mono', monospace",
            color: activeTab === tab ? accent : "#383838",
            borderBottom: activeTab === tab ? `1px solid ${accent}` : "1px solid transparent",
            marginBottom: "-1px", transition: "all 0.15s",
          }}>
            {tab === "memory"
              ? `MEMORY${totalSaved > 0 ? ` (${totalSaved})` : ""}`
              : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, width: "100%", margin: "0 auto" }}>

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
              MEMORYタブで会話して記憶を蓄積すると回答精度が上がります。
            </p>
          </div>
        )}

        {/* MEMORY TAB — インタビューチャット */}
        {activeTab === "memory" && (
          <>
            {/* ファイルアップロード */}
            <div style={{ padding: "12px 24px", borderBottom: `1px solid ${border}`, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#555", padding: "6px 10px", fontSize: 10, letterSpacing: "0.06em" }}
              >
                {["experience", "belief", "skill", "qa"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" onChange={handleFileUpload} style={{ display: "none" }} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  background: "none", border: `1px solid ${uploading ? "#1e1e1e" : "#2a2a2a"}`,
                  color: uploading ? "#2a2a2a" : "#555", padding: "6px 14px", fontSize: 10,
                  letterSpacing: "0.08em", cursor: uploading ? "default" : "pointer",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {uploading ? "UPLOADING..." : "UPLOAD FILE"}
              </button>
              <span style={{ fontSize: 10, color: "#2a2a2a", letterSpacing: "0.04em" }}>txt / md / pdf</span>
              {uploadMsg && (
                <span style={{ fontSize: 10, color: uploadMsg.startsWith("エラー") ? "#ff5555" : accent, letterSpacing: "0.06em" }}>
                  {uploadMsg}
                </span>
              )}
            </div>

            {/* 保存通知 */}
            {recentSaved.length > 0 && (
              <div style={{ padding: "10px 24px", borderBottom: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 10, color: accent, letterSpacing: "0.08em" }}>// {recentSaved.length}件の記憶を保存した</span>
                {recentSaved.map((m, i) => (
                  <span key={i} style={{ fontSize: 11, color: "#3a3a3a", paddingLeft: 12 }}>— [{m.category}] {m.content.slice(0, 60)}{m.content.length > 60 ? "..." : ""}</span>
                ))}
              </div>
            )}

            {/* メッセージ一覧 */}
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ fontSize: 10, color: "#252525", letterSpacing: "0.08em", textAlign: "center" }}>
                {memInitLoading ? "// 会話履歴を読み込み中..." : "// MEMORY INTERVIEW — 会話内容から自動で記憶を抽出します"}
              </div>
              {memMessages.map((msg, i) => (
                <div key={i} style={{ display: "flex", gap: 12, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                  <div style={{
                    width: 26, height: 26, flexShrink: 0,
                    border: `1px solid ${msg.role === "user" ? "#222" : "#2a3a1a"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: msg.role === "user" ? "#444" : "#6a8a4a", marginTop: 2,
                  }}>
                    {msg.role === "user" ? "U" : "I"}
                  </div>
                  <div style={{
                    background: msg.role === "user" ? "#0f0f0f" : "#0b0d0a",
                    border: `1px solid ${msg.role === "user" ? "#1c1c1c" : "#1a2010"}`,
                    padding: "11px 15px", fontSize: 13, lineHeight: 1.8,
                    color: msg.role === "user" ? "#777" : "#b0c8a0",
                    maxWidth: "78%", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {memLoading && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, border: "1px solid #2a3a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#6a8a4a" }}>I</div>
                  <div style={{ background: "#0b0d0a", border: "1px solid #1a2010", padding: "14px 16px", display: "flex", gap: 5, alignItems: "center" }}>
                    <TypingDot delay="0s" /><TypingDot delay="0.2s" /><TypingDot delay="0.4s" />
                  </div>
                </div>
              )}
              <div ref={memBottomRef} />
            </div>

            {/* 入力欄 */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${border}`, display: "flex", gap: 10, alignItems: "flex-end", background: bg }}>
              <textarea
                ref={e => { memInputRef.current = e; memTextareaRef.current = e; }}
                rows={1} placeholder="答えを入力..."
                value={memInput}
                onChange={e => setMemInput(e.target.value)}
                onKeyDown={handleMemKey}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
                style={{ flex: 1, background: "#0f0f0f", border: "1px solid #1e1e1e", color: "#d4d4d4", padding: "11px 14px", fontSize: 13, lineHeight: 1.5, maxHeight: 120, minHeight: 42 }}
              />
              <button
                onClick={sendMemMessage}
                disabled={!memInput.trim() || memLoading}
                style={{
                  background: memInput.trim() && !memLoading ? accent : "#111",
                  border: "none", color: memInput.trim() && !memLoading ? bg : "#2a2a2a",
                  padding: "11px 16px", cursor: memInput.trim() && !memLoading ? "pointer" : "default",
                  fontSize: 11, letterSpacing: "0.08em", flexShrink: 0, transition: "all 0.15s",
                  alignSelf: "flex-end",
                }}
              >
                SEND
              </button>
            </div>
          </>
        )}

        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <>
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
      </div>
    </div>
  );
}
