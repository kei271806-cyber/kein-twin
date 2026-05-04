import { getSupabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

const INTERVIEWER_PROMPT = `あなたはKEINと自然な会話をしながら、KEINのことを深く理解しようとするAIです。

## 目的
KEINの経験・価値観・思考・スキルを引き出し、AI Twinの精度を高めること。
ただし「インタビュー」ではなく「対話」として進める。

## 会話のスタイル
- 相手の話に本当に興味を持って反応する
- 話が面白い方向に展開したら、そちらを深掘りする
- 自分の考えや仮説を投げかけて、KEINの反応を引き出す
- 質問だけでなく、「それって〇〇ということ？」「俺はそれ意外だったな」みたいな反応もする
- 話の流れで自然につながる次のテーマへ移る
- 会話が一段落したら、新しい角度から話題を広げる

## カバーしたいテーマ（自然な流れで）
- 技術・スキル（得意なこと、使っているツール、考え方）
- 経験（転機、失敗、印象に残っていること）
- 価値観・信念（何を大切にしているか、何が嫌いか）
- よくある質問への答え方

## 制約
- 日本語で話す
- 答えを繰り返したり要約したりしない
- 一度に話題を複数投げない
- 「KEINさん」と呼ぶ
- 絵文字は使わない
- 長くなりすぎない（3〜4文以内）`;

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
