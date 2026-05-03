import { supabase } from "@/lib/supabase";
import { embedText } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const { content, category } = await request.json();
    if (!content?.trim()) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const embedding = await embedText(content);

    const { data, error } = await supabase
      .from("memories")
      .insert({ content, category, embedding })
      .select("id, content, category, created_at")
      .single();

    if (error) throw error;
    return Response.json({ memory: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
