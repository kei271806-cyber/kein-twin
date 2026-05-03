import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

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

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    let systemPrompt = SYSTEM_PROMPT;

    if (lastUser) {
      try {
        const embedding = await embedText(lastUser.content);
        const { data: memories } = await supabase.rpc("match_memories", {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 5,
        });

        if (memories && memories.length > 0) {
          const memoryBlock = memories
            .map((m: { content: string }) => `- ${m.content}`)
            .join("\n");
          systemPrompt += `\n\n## KEINの記憶・経験\n以下はこの質問に関連するKEINの記憶です。回答の参考にしてください。\n\n${memoryBlock}`;
        }
      } catch {
        // 記憶検索に失敗しても会話は続ける
      }
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return Response.json(
        { error: data.error?.message ?? `HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const reply = data.choices?.[0]?.message?.content ?? "（応答なし）";
    return Response.json({ reply });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
