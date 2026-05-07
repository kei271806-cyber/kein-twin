import { getSupabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

export const maxDuration = 60;

function chunkText(text: string, maxSize = 400): string[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxSize && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // 段落分割で残ったまま大きいものをさらに分割
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxSize) {
      result.push(chunk);
    } else {
      const sentences = chunk.split(/(?<=[。．！？\.\!\?])\s*/);
      let buf = "";
      for (const s of sentences) {
        if (buf.length + s.length > maxSize && buf.length > 0) {
          result.push(buf.trim());
          buf = s;
        } else {
          buf += s;
        }
      }
      if (buf.trim()) result.push(buf.trim());
    }
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "experience";

    if (!file) return Response.json({ error: "file is required" }, { status: 400 });

    const supportedTypes = [
      "text/plain",
      "text/markdown",
      "application/pdf",
      "application/octet-stream",
    ];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = file.type === "application/pdf" || ext === "pdf";
    const isText = ["txt", "md", "markdown"].includes(ext ?? "");

    if (!isPdf && !isText) {
      return Response.json(
        { error: "対応ファイル形式: .txt .md .pdf" },
        { status: 400 }
      );
    }

    let text = "";

    if (isPdf) {
      const { extractText } = await import("unpdf");
      const buffer = new Uint8Array(await file.arrayBuffer());
      // mergePages: false で pages 配列を取得して結合する
      const result = await extractText(buffer, { mergePages: false });
      const pages = result.text;
      text = Array.isArray(pages) ? pages.join("\n\n") : String(pages ?? "");
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      return Response.json({
        error: "テキストを抽出できなかった。スキャンされたPDF（画像PDF）は非対応です。テキストベースのPDFを使用してください。",
      }, { status: 400 });
    }

    const chunks = chunkText(text).slice(0, 50); // 最大50チャンク
    if (chunks.length === 0) {
      return Response.json({ error: `テキストは取得できたが有効なチャンクがなかった（文字数: ${text.length}）` }, { status: 400 });
    }

    const supabase = getSupabase();

    // 10件ずつ並列処理してタイムアウトを防ぐ
    const BATCH = 10;
    let savedCount = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (chunk) => {
          try {
            const embedding = await embedText(chunk);
            await supabase.from("memories").insert({ content: chunk, category, embedding });
            savedCount++;
          } catch {
            // 個別チャンクの失敗は無視
          }
        })
      );
    }

    return Response.json({ saved: savedCount, total: chunks.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
