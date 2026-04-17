"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic, MicOff, Settings, X, Radio, Github, ChevronRight, AlertCircle, Tv,
} from "lucide-react";

function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    const v = u.searchParams.get("v");
    if (v) return v;
    const pathMatch = u.pathname.match(/\/(?:live|embed|shorts|v)\/([^/?&]+)/);
    if (pathMatch) return pathMatch[1];
  } catch {
    if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  }
  return null;
}

type WaveformState = "idle" | "thinking" | "active";

interface Persona {
  id: string; name: string; role: string; avatarUrl: string;
  color: string; systemPrompt: string; cooldownMs: number;
}
interface PersonaState {
  waveformState: WaveformState; response: string; visible: boolean; cooldownUntil: number;
}
interface TranscriptSegment { id: string; text: string; timestamp: number; isFinal: boolean; }

const PERSONAS: Persona[] = [
  {
    id: "fact-checker", name: "The Producer", role: "Fact-Check Machine",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/png?seed=FactChecker&size=80&backgroundColor=dbeafe&facialHairType=beardMedium&clothingColor=262e33&accessories=prescription02",
    color: "#3b82f6",
    systemPrompt: "You are a stern, no-nonsense fact-checker. Correct wrong numbers, names, or stats instantly. Be professional but blunt. Never more than 2 sentences. Don't introduce yourself.",
    cooldownMs: 12000,
  },
  {
    id: "cynical-troll", name: "The Troll", role: "Cynical Roaster",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/png?seed=CynicalTroll&size=80&backgroundColor=fee2e2&facialHairType=moustacheFancy&clothingColor=b71c1c&skinColor=ae5d29",
    color: "#ef4444",
    systemPrompt: "You are a cynical troll. Mock bad ideas, call out hype, be sarcastic and cutting but also funny. Never more than 2 sentences. Don't introduce yourself.",
    cooldownMs: 10000,
  },
  {
    id: "chaos-agent", name: "Chaos Agent", role: "Wild Card",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/png?seed=ChaosAgent&size=80&backgroundColor=f3e8ff&hairType=shaggyMullet&clothingColor=4a148c&skinColor=d08b5b",
    color: "#a855f7",
    systemPrompt: "You are the chaos agent. Drop wild tangents, unexpected context bombs, or completely off-the-wall observations. Never more than 2 sentences. Don't introduce yourself.",
    cooldownMs: 14000,
  },
  {
    id: "joke-writer", name: "Jackie", role: "Joke Writer",
    avatarUrl: "https://api.dicebear.com/9.x/avataaars/png?seed=JokeWriter&size=80&backgroundColor=fef3c7&facialHairType=beardLight&hairColor=b58143&clothingColor=e65100&accessories=round",
    color: "#f59e0b",
    systemPrompt: "You are a joke writer. Generate one-liners, puns, or quick zingers based on exactly what was just said. One joke only. Don't introduce yourself.",
    cooldownMs: 9000,
  },
];

const defaultPersonaStates = (): Record<string, PersonaState> =>
  Object.fromEntries(PERSONAS.map((p) => [p.id, { waveformState: "idle", response: "", visible: false, cooldownUntil: 0 }]));

function WaveformCanvas({ state, color, width = 80, height = 28 }: { state: WaveformState; color: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const ampRef = useRef(3);
  const targetAmpRef = useRef(3);
  const jitterTimerRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const draw = () => {
      let targetAmp = 3, speed = 0.012, opacity = 0.35;
      if (state === "thinking") { targetAmp = 9; speed = 0.026; opacity = 0.65; }
      else if (state === "active") {
        targetAmp = 18; speed = 0.048; opacity = 1.0;
        jitterTimerRef.current++;
        if (jitterTimerRef.current % 8 === 0) targetAmp = 15 + Math.random() * 8;
      }
      targetAmpRef.current = targetAmp;
      ampRef.current += (targetAmpRef.current - ampRef.current) * 0.08;
      phaseRef.current += speed;
      ctx.clearRect(0, 0, width, height);
      for (const wave of [{ phaseOffset: 0, alpha: opacity }, { phaseOffset: Math.PI / 2, alpha: opacity * 0.5 }]) {
        ctx.beginPath();
        for (let x = 0; x <= width; x++) {
          const y = height / 2 + Math.sin(x * 0.12 + phaseRef.current + wave.phaseOffset) * ampRef.current;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color; ctx.globalAlpha = wave.alpha; ctx.lineWidth = 1.5;
        if (state === "active") { ctx.shadowColor = color; ctx.shadowBlur = 6; } else ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [state, color, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="block" style={{ imageRendering: "crisp-edges" }} />;
}

function PersonaCard({ persona, state }: { persona: Persona; state: PersonaState }) {
  const isActive = state.waveformState !== "idle";
  return (
    <div className={`rounded-xl border transition-all duration-300 overflow-hidden ${isActive ? "border-opacity-60 shadow-lg" : "border-neutral-800 opacity-80"}`}
      style={{ borderColor: isActive ? persona.color : undefined, boxShadow: isActive ? `0 0 16px ${persona.color}30` : undefined, background: "rgb(18 18 20)" }}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="w-10 h-10 rounded-full flex-shrink-0 border-2 transition-all duration-300 overflow-hidden"
          style={{ borderColor: isActive ? persona.color : "rgb(64 64 64)", boxShadow: isActive ? `0 0 8px ${persona.color}60` : undefined }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={persona.avatarUrl} alt={persona.name} width={40} height={40} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-none mb-0.5" style={{ color: isActive ? persona.color : "rgb(229 229 229)" }}>{persona.name}</div>
          <div className="text-xs text-neutral-500 truncate">{persona.role}</div>
        </div>
        <WaveformCanvas state={state.waveformState} color={persona.color} width={64} height={24} />
        <div className="w-2 h-2 rounded-full flex-shrink-0 transition-all duration-300"
          style={{ background: state.waveformState === "active" ? persona.color : state.waveformState === "thinking" ? `${persona.color}80` : "rgb(64 64 64)", boxShadow: state.waveformState === "active" ? `0 0 6px ${persona.color}` : undefined }} />
      </div>
      {state.response.length > 0 && (
        <div className="px-3 pb-3 text-sm leading-relaxed text-neutral-300 border-t border-neutral-800 pt-2">
          {state.response}
          {state.waveformState === "active" && <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse" style={{ background: persona.color }} />}
        </div>
      )}
      {state.response.length === 0 && state.waveformState === "thinking" && (
        <div className="px-3 pb-3 border-t border-neutral-800 pt-2 flex gap-1">
          {[0,1,2].map((i) => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: persona.color, animationDelay: `${i*150}ms`, opacity: 0.7 }} />)}
        </div>
      )}
    </div>
  );
}

function TranscriptPanel({ segments, interimText }: { segments: TranscriptSegment[]; interimText: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [segments, interimText]);
  const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="h-full flex flex-col bg-neutral-950 rounded-xl border border-neutral-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Transcript</span>
        <span className="text-xs text-neutral-600">{segments.length} segment{segments.length !== 1 ? "s" : ""}</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {segments.length === 0 && !interimText && (
          <div className="text-neutral-600 text-center mt-8 text-xs">
            <Mic className="w-5 h-5 mx-auto mb-2 opacity-40" />Start listening to see the transcript here
          </div>
        )}
        {segments.map((seg) => (
          <div key={seg.id} className="flex gap-3">
            <span className="text-neutral-600 text-xs pt-0.5 flex-shrink-0">{fmt(seg.timestamp)}</span>
            <span className="text-neutral-200 leading-relaxed">{seg.text}</span>
          </div>
        ))}
        {interimText && (
          <div className="flex gap-3">
            <span className="text-neutral-600 text-xs pt-0.5 flex-shrink-0">live</span>
            <span className="text-neutral-500 italic leading-relaxed">{interimText}<span className="inline-block w-0.5 h-3.5 ml-0.5 bg-cyan-400 align-middle animate-pulse" /></span>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ wordThreshold, setWordThreshold, streamUrl, setStreamUrl, onClose }:
  { wordThreshold: number; setWordThreshold: (n: number) => void; streamUrl: string; setStreamUrl: (u: string) => void; onClose: () => void }) {
  const [localThreshold, setLocalThreshold] = useState(wordThreshold);
  const [localStream, setLocalStream] = useState(streamUrl);
  const save = () => {
    setWordThreshold(localThreshold);
    setStreamUrl(localStream.trim());
    try { if (localStream.trim()) localStorage.setItem("sidecast_stream_url", localStream.trim()); } catch {}
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Settings</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Stream URL <span className="text-neutral-500 font-normal">(YouTube)</span></label>
            <input type="url" value={localStream} onChange={(e) => setLocalStream(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or video ID"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500 transition-colors" />
            <p className="text-xs text-neutral-500 mt-1.5">Paste a YouTube URL to embed the stream alongside the sidebar.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Trigger threshold: <span className="text-pink-400">{localThreshold} words</span></label>
            <input type="range" min={8} max={40} value={localThreshold} onChange={(e) => setLocalThreshold(Number(e.target.value))} className="w-full accent-pink-500" />
            <div className="flex justify-between text-xs text-neutral-600 mt-1"><span>8 (reactive)</span><span>40 (calm)</span></div>
          </div>
        </div>
        <div className="p-5 border-t border-neutral-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} className="px-4 py-2 text-sm bg-pink-500 hover:bg-pink-400 text-white rounded-lg font-medium transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

export default function SidecastClient() {
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [personaStates, setPersonaStates] = useState<Record<string, PersonaState>>(defaultPersonaStates);
  const [showSettings, setShowSettings] = useState(false);
  const [wordThreshold, setWordThreshold] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [audioMode, setAudioMode] = useState<"tab" | "mic">("tab");
  const [showTabHelp, setShowTabHelp] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newWordCountRef = useRef(0);
  const recentTranscriptRef = useRef<string[]>([]);
  const personaStatesRef = useRef(personaStates);
  const wordThresholdRef = useRef(wordThreshold);

  useEffect(() => { personaStatesRef.current = personaStates; }, [personaStates]);
  useEffect(() => { wordThresholdRef.current = wordThreshold; }, [wordThreshold]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidecast_stream_url");
      if (saved) { setStreamUrl(saved); }
      else {
        fetch("/api/pod/latest-episode").then((r) => r.json())
          .then(({ videoId }: { videoId: string | null }) => { if (videoId) setStreamUrl(`https://www.youtube.com/watch?v=${videoId}`); })
          .catch(() => {});
      }
    } catch {}
  }, []);

  const streamPersonaResponse = useCallback(async (persona: Persona, transcript: string) => {
    const now = Date.now();
    const state = personaStatesRef.current[persona.id];
    if (state.cooldownUntil > now || state.waveformState === "thinking" || state.waveformState === "active") return;
    setPersonaStates((prev) => ({ ...prev, [persona.id]: { ...prev[persona.id], waveformState: "thinking", response: "", visible: true } }));
    try {
      const res = await fetch("/api/pod", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, systemPrompt: persona.systemPrompt }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ error: "API error" })); throw new Error(e.error ?? `HTTP ${res.status}`); }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "", buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const token = json.choices?.[0]?.delta?.content;
            if (token) { fullText += token; setPersonaStates((prev) => ({ ...prev, [persona.id]: { ...prev[persona.id], waveformState: "active", response: fullText } })); }
          } catch { /* ignore malformed SSE */ }
        }
      }
      setPersonaStates((prev) => ({ ...prev, [persona.id]: { ...prev[persona.id], waveformState: "idle", response: fullText, cooldownUntil: Date.now() + persona.cooldownMs } }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setPersonaStates((prev) => ({ ...prev, [persona.id]: { ...prev[persona.id], waveformState: "idle", response: `⚠ ${msg.slice(0, 80)}`, cooldownUntil: Date.now() + 5000 } }));
    }
  }, []);

  const triggerPersonas = useCallback((transcript: string) => {
    PERSONAS.forEach((persona, i) => setTimeout(() => streamPersonaResponse(persona, transcript), i * 300));
  }, [streamPersonaResponse]);

  const transcribeChunk = useCallback(async (blob: Blob) => {
    if (blob.size < 500) return;
    const form = new FormData();
    form.append("audio", blob, "chunk.webm");
    try {
      const res = await fetch("/api/pod/transcribe", { method: "POST", body: form });
      if (!res.ok) return;
      const { text } = (await res.json()) as { text: string };
      if (!text?.trim()) return;
      const seg: TranscriptSegment = { id: `${Date.now()}-${Math.random()}`, text: text.trim(), timestamp: Date.now(), isFinal: true };
      setSegments((prev) => [...prev.slice(-200), seg]);
      setInterimText("");
      const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
      newWordCountRef.current += wordCount;
      recentTranscriptRef.current.push(text.trim());
      if (recentTranscriptRef.current.length > 10) recentTranscriptRef.current.shift();
      if (newWordCountRef.current >= wordThresholdRef.current) { newWordCountRef.current = 0; triggerPersonas(recentTranscriptRef.current.join(" ")); }
    } catch (err) { console.error("[Sidecast] transcribe error:", err); }
  }, [triggerPersonas]);

  const startListening = useCallback(async () => {
    setError(null);
    try {
      let stream: MediaStream;
      if (audioMode === "tab") {
        const constraints: DisplayMediaStreamOptions & { preferCurrentTab?: boolean } = {
          preferCurrentTab: true, video: true,
          audio: { echoCancellation: false, noiseSuppression: false, suppressLocalAudioPlayback: false } as MediaTrackConstraints,
        };
        const display = await navigator.mediaDevices.getDisplayMedia(constraints);
        display.getVideoTracks().forEach((t) => t.stop());
        const audioTracks = display.getAudioTracks();
        if (audioTracks.length === 0) { setError("No tab audio captured — make sure 'Share tab audio' was checked in the dialog."); return; }
        stream = new MediaStream(audioTracks);
      } else { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      streamRef.current = stream;
      const startChunk = () => {
        const chunks: Blob[] = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => { if (chunks.length > 0) await transcribeChunk(new Blob(chunks, { type: mimeType })); if (streamRef.current) startChunk(); };
        recorder.start();
        setInterimText("🎙 Listening…");
        chunkTimerRef.current = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 6000);
      };
      startChunk();
      setIsListening(true);
    } catch { setError("Could not access audio. Please allow microphone access and try again."); }
  }, [transcribeChunk, audioMode]);

  const stopListening = useCallback(() => {
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    mediaRecorderRef.current = null; setIsListening(false); setInterimText("");
  }, []);

  const clearAll = useCallback(() => {
    setSegments([]); setInterimText(""); recentTranscriptRef.current = []; newWordCountRef.current = 0; setPersonaStates(defaultPersonaStates());
  }, []);

  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-pink-500/20 border border-pink-500/40 flex items-center justify-center"><Radio className="w-3.5 h-3.5 text-pink-400" /></div>
          <div>
            <span className="font-bold text-white text-sm">Sidecast</span>
            <span className="text-neutral-500 text-xs ml-2 hidden sm:inline">AI Podcast Sidebar</span>
          </div>
          {isListening && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-full px-2.5 py-0.5 ml-1">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-400 text-xs font-medium">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a href="https://github.com/bmdhodl/sidecast" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1.5">
            <Github className="w-3.5 h-3.5" /><span className="hidden sm:inline">GitHub</span>
          </a>
          <button onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-neutral-800">
            <Settings className="w-3.5 h-3.5" /><span>Settings</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto flex-shrink-0 text-red-400 hover:text-red-200"><X className="w-4 h-4" /></button>
            </div>
          )}
          {(() => {
            const videoId = parseYouTubeId(streamUrl);
            return videoId ? (
              <div className="flex-shrink-0 rounded-xl overflow-hidden border border-neutral-800 bg-black">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen title="Stream" />
                </div>
              </div>
            ) : (
              <div className="flex-shrink-0 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 flex flex-col items-center justify-center gap-2 py-8 cursor-pointer hover:border-neutral-500 transition-colors"
                onClick={() => setShowSettings(true)}>
                <Tv className="w-7 h-7 text-neutral-600" />
                <p className="text-xs text-neutral-500 text-center">No stream connected — <span className="text-pink-400 underline">open Settings</span> to paste a YouTube URL</p>
              </div>
            );
          })()}
          <div className="h-40 lg:h-48 flex-shrink-0"><TranscriptPanel segments={segments} interimText={interimText} /></div>

          <div className="flex items-center gap-3 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
            {!isListening && (
              <div className="flex rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0">
                <button onClick={() => setAudioMode("tab")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${audioMode === "tab" ? "bg-pink-500 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"}`}>Tab Audio</button>
                <button onClick={() => setAudioMode("mic")} className={`px-3 py-1.5 text-xs font-medium transition-colors ${audioMode === "mic" ? "bg-pink-500 text-white" : "text-neutral-400 hover:text-white hover:bg-neutral-800"}`}>Mic</button>
              </div>
            )}
            <button onClick={isListening ? stopListening : audioMode === "tab" ? () => setShowTabHelp(true) : startListening}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all ${isListening ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20" : "bg-pink-500 hover:bg-pink-400 text-white shadow-lg shadow-pink-500/20"}`}>
              {isListening ? (<><MicOff className="w-4 h-4" />Stop Listening</>) : (<><Mic className="w-4 h-4" />Start Listening</>)}
            </button>
            {segments.length > 0 && <button onClick={clearAll} className="px-4 py-2.5 text-sm text-neutral-500 hover:text-white transition-colors">Clear</button>}
            <div className="ml-auto text-right hidden sm:block">
              <div className="text-xs text-neutral-600">{audioMode === "tab" ? "Pick your tab → check 'Share tab audio'" : "Captures microphone input"}</div>
              <div className="text-xs text-neutral-700">Powered by Whisper</div>
            </div>
          </div>
          <details className="group">
            <summary className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 cursor-pointer select-none">
              <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />Using with OBS / desktop audio
            </summary>
            <div className="mt-2 p-3 bg-neutral-900 rounded-lg border border-neutral-800 text-xs text-neutral-500 space-y-1.5 ml-5">
              <p>1. Install <strong className="text-neutral-400">VB-Audio Virtual Cable</strong> (Windows) or <strong className="text-neutral-400">BlackHole</strong> (Mac).</p>
              <p>2. Route your podcast audio source to the virtual cable as output.</p>
              <p>3. Set your system input to the virtual cable — this browser tab picks it up via Mic mode.</p>
              <p>4. Capture this browser window in OBS as a <strong className="text-neutral-400">Window Capture</strong> source to overlay it on your stream.</p>
            </div>
          </details>
        </div>

        <div className="lg:w-80 flex flex-col gap-3">
          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider px-1">AI Commentators</div>
          {PERSONAS.map((persona) => <PersonaCard key={persona.id} persona={persona} state={personaStates[persona.id]} />)}
        </div>
      </main>

      {showTabHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
            <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-white font-semibold text-sm">Capture Tab Audio</h2>
              <button onClick={() => setShowTabHelp(false)} className="text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-xs text-neutral-400">A browser dialog will open. Follow these two steps:</p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 bg-neutral-800 rounded-lg p-3">
                  <span className="text-pink-400 font-bold text-sm">1</span>
                  <p className="text-xs text-neutral-300">Select <strong className="text-white">this tab</strong> (it should already be highlighted)</p>
                </div>
                <div className="flex items-start gap-3 bg-pink-500/10 border border-pink-500/30 rounded-lg p-3">
                  <span className="text-pink-400 font-bold text-sm">2</span>
                  <p className="text-xs text-neutral-300">Check the <strong className="text-pink-400">☑ Share tab audio</strong> checkbox — this is required</p>
                </div>
              </div>
              <p className="text-xs text-neutral-600">Then click Share in the dialog.</p>
            </div>
            <div className="p-5 border-t border-neutral-800">
              <button onClick={() => { setShowTabHelp(false); startListening(); }}
                className="w-full py-2.5 bg-pink-500 hover:bg-pink-400 text-white text-sm font-semibold rounded-lg transition-colors">
                Got it — Open Dialog
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal wordThreshold={wordThreshold} setWordThreshold={setWordThreshold}
          streamUrl={streamUrl} setStreamUrl={setStreamUrl} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
