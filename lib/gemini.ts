export async function embedText(text: string): Promise<number[]> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Gemini embedding error: ${err.error?.message ?? res.status}`);
  }
  const data = await res.json();
  return data.embedding.values as number[];
}
