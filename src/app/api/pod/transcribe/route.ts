import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("audio") as File | null;

  if (!audio) return Response.json({ text: "" }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ text: "" }, { status: 500 });

  const openaiForm = new FormData();
  openaiForm.append("file", audio, "audio.webm");
  openaiForm.append("model", "whisper-1");
  openaiForm.append("language", "en");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: openaiForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[Sidecast] Whisper error:", res.status, err);
    return Response.json({ text: "" }, { status: res.status });
  }

  const data = (await res.json()) as { text?: string };
  return Response.json({ text: data.text ?? "" });
}
