import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("memory_conversations")
    .select("role, content")
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ messages: data });
}

export async function POST(request: Request) {
  const { role, content } = await request.json();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("memory_conversations")
    .insert({ role, content });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("memory_conversations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // 全件削除

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
