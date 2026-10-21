import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GoogleGenAI, type Session, type LiveServerMessage } from "@google/genai";
import { createGeminiLiveToken } from "@/lib/gemini-live.functions";
import { geminiLiveConfig } from "@/lib/gemini-live-config";
import { encodePcm, decodePcm } from "@/lib/pcm-audio";
import { voiceError } from "@/lib/service-errors";
import type { LiveEvent } from "./use-live-voice";

export function useGeminiVoice({ onEvent }: { onEvent: (event: LiveEvent) => void }) {
  const mint = useServerFn(createGeminiLiveToken);
  const latest = useRef(onEvent);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "stopping" | "closed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, updateMuted] = useState(false);
  const [playbackBlocked, setBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const session = useRef<Session | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const mutedRef = useRef(false);
  const nextPlay = useRef(0);
  useEffect(() => { latest.current = onEvent; });

  const clearPlayback = useCallback(() => {
    for (const source of sources.current) { try { source.stop(); } catch { /* already ended */ } }
    sources.current.clear();
    nextPlay.current = 0;
  }, []);
  const stop = useCallback(() => {
    if (!active.current && !ctx.current && !session.current) return;
    active.current = false;
    generation.current++;
    session.current?.close(); session.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    worklet.current?.disconnect(); worklet.current = null;
    clearPlayback();
    void ctx.current?.close().catch(() => {}); ctx.current = null;
    setStatus("closed"); updateMuted(false); mutedRef.current = false; setBlocked(false);
  }, [clearPlayback]);
  const resumePlayback = useCallback(async () => {
    if (!active.current) return;
    try { await ctx.current?.resume(); setBlocked(ctx.current?.state !== "running"); } catch { setBlocked(true); }
  }, []);
  useEffect(() => {
    const restore = () => { if (document.visibilityState === "visible") void resumePlayback(); };
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", restore);
    return () => { window.removeEventListener("pagehide", stop); document.removeEventListener("visibilitychange", restore); stop(); };
  }, [stop, resumePlayback]);

  const start = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    const attempt = ++generation.current;
    setStatus("connecting"); setError(null);
    const valid = () => active.current && attempt === generation.current;
    try {
      const context = new AudioContext(); ctx.current = context;
      await context.resume();
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (!valid()) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      const token = await mint();
      if (!valid()) return;
      const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1alpha" } });
      const receive = (message: LiveServerMessage) => {
        if (!valid()) return;
        const content = message.serverContent;
        if (content?.interrupted) { clearPlayback(); latest.current({ type: "app.interrupted" }); }
        const input = content?.inputTranscription?.text;
        const output = content?.outputTranscription?.text;
        if (input) latest.current({ type: "session.input_transcript.delta", delta: input });
        if (output) latest.current({ type: "session.output_transcript.delta", delta: output });
        for (const part of content?.modelTurn?.parts ?? []) {
          if (!part.inlineData?.data || content?.interrupted) continue;
          const pcm = decodePcm(part.inlineData.data);
          const buffer = context.createBuffer(1, pcm.length, 24000); buffer.getChannelData(0).set(pcm);
          const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
          sources.current.add(source); source.onended = () => sources.current.delete(source);
          const when = Math.max(context.currentTime, nextPlay.current);
          source.start(when); nextPlay.current = when + buffer.duration;
          if (context.state !== "running") setBlocked(true);
        }
        if (message.goAway) { setError("Google ভয়েস সেশনের সময় শেষ হচ্ছে। কল শেষ করে নতুন কল শুরু করুন।"); }
      };
      const connection = await ai.live.connect({ model: token.model, config: { ...geminiLiveConfig, systemInstruction: token.systemInstruction }, callbacks: {
        onmessage: receive,
        onerror: () => { if (valid()) { setError("Google ভয়েস সংযোগে সমস্যা হয়েছে। Google কী, বিলিং ও কোটা যাচাই করুন।"); stop(); } },
        onclose: event => { if (valid()) { setError(event.code === 1000 ? "Google ভয়েস কল শেষ হয়েছে।" : "Google ভয়েস সংযোগ বন্ধ হয়েছে। কী, কোটা ও ইন্টারনেট যাচাই করে নতুন কল করুন।"); stop(); } },
      } });
      if (!valid()) { connection.close(); return; }
      session.current = connection;
      await context.audioWorklet.addModule("/audio-capture.js");
      if (!valid()) return;
      const capture = new AudioWorkletNode(context, "pcm-capture"); worklet.current = capture;
      const mic = context.createMediaStreamSource(media);
      mic.connect(capture); capture.connect(context.destination);
      let pending: number[] = [];
      capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (!valid() || mutedRef.current) { pending = []; return; }
        pending.push(...event.data);
        if (pending.length < context.sampleRate / 10) return;
        connection.sendRealtimeInput({ audio: { data: encodePcm(new Float32Array(pending), context.sampleRate), mimeType: "audio/pcm;rate=16000" } });
        pending = [];
      };
      media.getTracks().forEach(track => track.addEventListener("ended", stop));
      setStatus("connected");
      connection.sendClientContent({ turns: [{ role: "user", parts: [{ text: "আসসালামু আলাইকুম।" }] }], turnComplete: true });
    } catch (failure) { if (valid()) { setError(voiceError(failure)); stop(); } }
  }, [clearPlayback, mint, stop]);
  const setMuted = (value: boolean) => { mutedRef.current = value; updateMuted(value); stream.current?.getAudioTracks().forEach(t => { t.enabled = !value; }); if (value) session.current?.sendRealtimeInput({ audioStreamEnd: true }); };
  return { status, error, muted, playbackBlocked, audioRef, start, stop, setMuted, resumePlayback, finalized: true };
}