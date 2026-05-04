import { getSupabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

const INTERVIEWER_PROMPT = `あなたはKEINについて情報を収集するインタビュアーAIです。

## 役割
KEINの記憶・経験・思考・スキルを引き出すための自然な会話を行ってください。
KEINの「AI Twin」を作るために、できるだけ具体的な情報を集めます。

## 質問のテーマ（バランスよく聞く）
- 技術的な経験・得意なこと（skill）
- 人生経験・転機になった出来事（experience）
- 価値観・信念・考え方（belief）
- よく聞かれる質問とその答え（qa）

## ルール
- 日本語で話す
- 1回に1つだけ質問する
- ユーザーの回答を繰り返したり要約したりしない。すぐ次の質問に移る
- 短い相槌（「なるほど」「わかりました」程度）を挟んでも良いが、内容の繰り返しは厳禁
- 具体的なエピソードを引き出すよう深掘りする
- 「KEINさん」と呼ぶ
- 絵文字は使わない`;

const EXTRACTOR_PROMPT = `以下のユーザーの発言から、KEINについての記憶として保存すべき事実を抽出してください。

ルール：
- 具体的で価値のある情報のみ抽出する
- 「わからない」「特にない」「そうですね」など情報のない発言は抽出しない
- JSON配列のみ返す: [{"content": "...", "category": "experience" | "qa" | "belief" | "skill"}]
- 抽出できる情報がない場合は [] のみ返す
- JSON以外は一切出力しない`;

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    const { messages }: { messages: Message[] } = await request.json();

    const lastUser = [...messages].reverse().find((m) => m.role === "user");

    // 会話継続 + 記憶抽出を並列実行
    const [interviewRes, extractRes] = await Promise.all([
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 800,
          messages: [{ role: "system", content: INTERVIEWER_PROMPT }, ...messages],
        }),
      }),
      lastUser
        ? fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              max_tokens: 500,
              messages: [
                { role: "system", content: EXTRACTOR_PROMPT },
                { role: "user", content: lastUser.content },
              ],
            }),
          })
        : Promise.resolve(null),
    ]);

    const interviewData = await interviewRes.json();
    if (!interviewRes.ok) {
      return Response.json(
        { error: interviewData.error?.message ?? `HTTP ${interviewRes.status}` },
        { status: interviewRes.status }
      );
    }
    const reply = interviewData.choices?.[0]?.message?.content ?? "...";

    // 記憶の抽出と保存
    const savedMemories: { content: string; category: string }[] = [];
    if (extractRes) {
      try {
        const extractData = await extractRes.json();
        const raw = extractData.choices?.[0]?.message?.content ?? "[]";
        const extracted: { content: string; category: string }[] = JSON.parse(raw);

        if (extracted.length > 0) {
          const supabase = getSupabase();
          await Promise.all(
            extracted.map(async (item) => {
              try {
                const embedding = await embedText(item.content);
                const { data } = await supabase
                  .from("memories")
                  .insert({ content: item.content, category: item.category, embedding })
                  .select("id, content, category")
                  .single();
                if (data) savedMemories.push(data);
              } catch {
                // 個別エラーは無視して続行
              }
            })
          );
        }
      } catch {
        // 抽出失敗は無視して会話を続ける
      }
    }

    return Response.json({ reply, savedMemories });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
