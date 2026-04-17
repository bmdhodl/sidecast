export const dynamic = "force-dynamic";

// Set YOUTUBE_CHANNEL_ID in your .env.local to auto-load the latest episode on page open.
// Get your channel ID from: youtube.com/channel/<ID> or the channel About page > Share > Copy channel ID
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID ?? "";

export async function GET() {
  if (!CHANNEL_ID) {
    return Response.json({ videoId: null, title: null });
  }

  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
    const res = await fetch(rssUrl, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);

    const xml = await res.text();
    const videoIdMatch = xml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const videoId = videoIdMatch?.[1] ?? null;

    const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)];
    const title = titles[1]?.[1] ?? null;

    return Response.json({ videoId, title });
  } catch (err) {
    console.error("[Sidecast] latest-episode error:", err);
    return Response.json({ videoId: null, title: null }, { status: 500 });
  }
}
