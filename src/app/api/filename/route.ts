export async function POST(request: Request) {
  const { prompt } = await request.json();
  if (!prompt) {
    return Response.json({ filename: "image" });
  }

  const apiKey = process.env.ROUTERHUB_API_KEY;
  if (!apiKey) {
    return Response.json({ filename: fallback(prompt) });
  }

  try {
    const res = await fetch("https://api.routerhub.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          {
            role: "system",
            content:
              "Generate a short filename (2-5 Chinese words, no extension, no spaces, no special characters, use underscores to separate words) that summarizes the user's image generation prompt. Output ONLY the filename, nothing else.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return Response.json({ filename: fallback(prompt) });
    }

    const json = await res.json();
    let name = (json?.choices?.[0]?.message?.content ?? "").trim();
    name = name.replace(/[^\w一-鿿]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    return Response.json({ filename: name || fallback(prompt) });
  } catch {
    return Response.json({ filename: fallback(prompt) });
  }
}

function fallback(prompt: string): string {
  return (
    prompt
      .slice(0, 20)
      .replace(/[^\w一-鿿]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "image"
  );
}
