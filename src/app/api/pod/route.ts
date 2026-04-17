import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { transcript, systemPrompt } = body as {
    transcript: string;
    systemPrompt: string;
  };

  if (!transcript || !systemPrompt) {
    return new Response(
      JSON.stringify({ error: "transcript and systemPrompt are required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY is not set. Add it to your .env.local file." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 120,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Recent podcast transcript:\n\n${transcript}\n\nRespond in character with a brief reaction (1-2 punchy sentences max).`,
        },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "API error");
    return new Response(
      JSON.stringify({ error: `OpenAI error ${openaiRes.status}: ${errText.slice(0, 200)}` }),
      { status: openaiRes.status, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(openaiRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
