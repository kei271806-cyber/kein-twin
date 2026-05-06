import { getSupabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

function chunkText(text: string, maxSize = 400): string[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

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
      const buffer = Buffer.from(await file.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = await import("pdf-parse") as any;
      const parsed = await (pdfParse.default ?? pdfParse)(buffer);
      text = parsed.text;
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      return Response.json({ error: "ファイルからテキストを抽出できなかった" }, { status: 400 });
    }

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return Response.json({ error: "有効なテキストが見つからなかった" }, { status: 400 });
    }

    const supabase = getSupabase();
    let savedCount = 0;

    for (const chunk of chunks) {
      try {
        const embedding = await embedText(chunk);
        await supabase
          .from("memories")
          .insert({ content: chunk, category, embedding });
        savedCount++;
      } catch {
        // 個別チャンクの失敗は無視して続行
      }
    }

    return Response.json({ saved: savedCount, total: chunks.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
