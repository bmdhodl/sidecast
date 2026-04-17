# Sidecast — AI Podcast Sidebar

Sidecast listens to a podcast in real-time and generates live reactions from four AI personas. You watch the show; the sidebar adds a running commentary — fact-checks, jokes, chaos, and roasts — all streamed token by token as the words come in.

Built as an entry for the [TWiST $5k AI Sidebar Challenge](https://twitter.com/twistartups).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/bmdhodl/sidecast&env=OPENAI_API_KEY&envDescription=Your%20OpenAI%20API%20key)

---

## How it works

There are three moving pieces: audio capture, transcription, and AI response streaming.

### 1. Audio capture

The browser captures audio using native Web APIs — no backend, no WebSocket, no extra dependencies. Two modes:

**Tab Audio** uses `getDisplayMedia` (the same API as screen sharing). The user picks the tab playing the podcast and checks "Share tab audio." The browser hands back a `MediaStream` of the tab's audio only — video tracks are immediately discarded.

**Mic mode** uses `getUserMedia` — useful when audio is playing through speakers in the same room.

### 2. Chunked transcription via Whisper

`MediaRecorder` records the audio stream in 6-second chunks. When each chunk ends, it's POSTed as an `audio/webm` blob to `/api/pod/transcribe`, which forwards it to OpenAI Whisper and returns plain text.

6 seconds is long enough for Whisper to get useful context but short enough that lag stays under ~2 seconds.

The client accumulates a rolling word count. Once the threshold is hit (default: 20 words), it fires all AI personas with the last ~10 transcript segments as context.

### 3. Streaming AI persona responses

`/api/pod` receives the recent transcript and a system prompt for one persona. It calls GPT-4o-mini with `stream: true` and pipes the Server-Sent Events response directly back to the client — no buffering, no JSON wrapping.

The client reads the SSE stream token by token and appends each chunk to the persona card as it arrives, so the text appears to type itself in real-time.

All four personas are triggered in parallel with a 300ms stagger to avoid hitting the API simultaneously. Each persona has its own cooldown timer so it can't fire again until it resets.

### Architecture

```
Browser
  │
  ├─ getDisplayMedia / getUserMedia
  │       └─ MediaRecorder (6s chunks)
  │               └─ POST /api/pod/transcribe
  │                       └─ OpenAI Whisper → text
  │                               └─ word threshold hit?
  │                                       └─ POST /api/pod (×4 personas, staggered)
  │                                               └─ GPT-4o-mini stream: true
  │                                                       └─ SSE tokens → persona cards update live
  │
  └─ YouTube iframe (from Settings or /api/pod/latest-episode RSS fetch)
```

---

## Setup

### Prerequisites

- Node.js 18+
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Local dev

```bash
git clone https://github.com/bmdhodl/sidecast
cd sidecast
npm install
cp .env.example .env.local
# edit .env.local — add your OPENAI_API_KEY
npm run dev
# open http://localhost:3000
```

### Deploy to Vercel

Click the Deploy button at the top, or:

```bash
npx vercel --prod
```

Add `OPENAI_API_KEY` as an environment variable in the Vercel dashboard under Settings → Environment Variables. It's used server-side only — never sent to the browser.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Used for Whisper transcription and GPT-4o-mini persona responses |
| `YOUTUBE_CHANNEL_ID` | No | Auto-loads the latest video from this channel on page open |

---

## Customizing personas

Open `src/app/SidecastClient.tsx` and find the `PERSONAS` array. Each entry:

```ts
{
  id: "fact-checker",
  name: "The Producer",
  role: "Fact-Check Machine",
  avatarUrl: "...",          // any image URL — DiceBear works great
  color: "#3b82f6",          // hex for border, waveform glow, text
  systemPrompt: "You are …", // the entire persona lives here
  cooldownMs: 12000,         // ms before this persona can fire again
}
```

Change `systemPrompt` to reshape any persona completely. Add or remove entries to change how many commentators appear. No backend changes needed.

---

## Tech stack

- **Next.js 15** (App Router) — routing and API routes
- **React 19** — UI
- **Tailwind CSS v4** — styling
- **OpenAI Whisper** (`whisper-1`) — speech-to-text
- **OpenAI GPT-4o-mini** — persona responses, streamed via SSE
- **DiceBear** — generated cartoon avatars
- **Web APIs**: `MediaRecorder`, `getDisplayMedia`, `getUserMedia`, `ReadableStream`

No database. No auth. No external state. The entire session lives in browser memory.

---

## License

MIT
