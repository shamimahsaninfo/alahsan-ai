import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeGeminiSpeech } from "@/lib/gemini-tts.functions";

const MAX_SPEECH_CHARS = 1200;
const FIRST_CHUNK_TARGET_CHARS = 120;

function stripMarkdownAndNoise(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/```[\s\S]*?(```|$)/g, " কোড অংশ। ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*`_>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepareSpeechChunks(raw: string): string[] {
  const clean = stripMarkdownAndNoise(raw).slice(0, MAX_SPEECH_CHARS).trim();
  if (!clean) return [];

  // ছোট লেখা হলে এক টুকরোতেই পাঠিয়ে দ্রুত চালানো
  if (clean.length <= FIRST_CHUNK_TARGET_CHARS + 60) {
    return [clean];
  }

  // বাক্যভিত্তিক বিভাজন (বাংলা দাঁড়ি, প্রশ্নবোধক, বিস্ময়বোধক ও ইংরেজি যতিচিহ্ন)
  const sentencePattern = /[^।.!?\n]+[।.!?]?/g;
  const sentences = clean.match(sentencePattern) || [clean];

  const chunks: string[] = [];
  let current = "";

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if (!current) {
      current = trimmed;
      continue;
    }

    // প্রথম চাংকটি ছোট (~220 অক্ষর) রাখলে ২-৩ সেকেন্ডের মধ্যেই প্রথম অডিও ফিরে এসে বাজতে শুরু করে
    const limit = chunks.length === 0 ? FIRST_CHUNK_TARGET_CHARS : 450;
    if ((current + " " + trimmed).length > limit) {
      chunks.push(current);
      current = trimmed;
    } else {
      current += " " + trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.slice(0, 4);
}

function toBase64Bytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function useGeminiTts() {
  const synthesize = useServerFn(synthesizeGeminiSpeech);
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const currentUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const queue = useRef<string[]>([]);
  const queuedCharacters = useRef(0);
  const pumping = useRef(false);
  const finishedRun = useRef<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    generation.current++;
    queue.current = [];
    queuedCharacters.current = 0;
    finishedRun.current = null;
    pumping.current = false;
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.onended = null;
      currentAudio.current.onerror = null;
      currentAudio.current = null;
    }
    if (currentUrl.current) {
      URL.revokeObjectURL(currentUrl.current);
      currentUrl.current = null;
    }
    setSpeaking(false);
  }, []);

  const pump = useCallback(async (run: number) => {
    if (pumping.current) return;
    pumping.current = true;
    try {
      while (generation.current === run && queue.current.length) {
        const text = queue.current.shift();
        if (!text) continue;
        const result = await synthesize({ data: { text } });
        if (generation.current !== run) return;
        const url = URL.createObjectURL(new Blob([toBase64Bytes(result.audioBase64)], { type: result.mimeType }));
        currentUrl.current = url;
        const audio = new Audio(url);
        currentAudio.current = audio;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("অডিও চালানো যায়নি।"));
          audio.onpause = () => { if (generation.current !== run) resolve(); };
          void audio.play().catch(reject);
        });
        URL.revokeObjectURL(url);
        if (currentUrl.current === url) currentUrl.current = null;
        if (currentAudio.current === audio) currentAudio.current = null;
      }
    } catch (failure) {
      if (generation.current === run) {
        queue.current = [];
        finishedRun.current = run;
        setError(failure instanceof Error ? failure.message : "ভয়েস চালানো যায়নি।");
      }
    } finally {
      if (generation.current === run) {
        pumping.current = false;
        if (finishedRun.current === run && queue.current.length === 0) setSpeaking(false);
      }
    }
  }, [synthesize]);

  const beginStream = useCallback(() => {
    stop();
    setError(null);
    const run = generation.current;
    queue.current = [];
    queuedCharacters.current = 0;
    finishedRun.current = null;
    setSpeaking(true);
    return run;
  }, [stop]);

  const enqueue = useCallback((raw: string, run: number) => {
    if (generation.current !== run || !raw.trim()) return;
    const remaining = MAX_SPEECH_CHARS - queuedCharacters.current;
    if (remaining <= 0) return;
    const accepted = raw.slice(0, remaining);
    queuedCharacters.current += accepted.length;
    queue.current.push(...prepareSpeechChunks(accepted));
    void pump(run);
  }, [pump]);

  const finishStream = useCallback((remaining: string, run: number) => {
    if (generation.current !== run) return;
    const budget = MAX_SPEECH_CHARS - queuedCharacters.current;
    if (budget > 0 && remaining.trim()) {
      const accepted = remaining.slice(0, budget);
      queuedCharacters.current += accepted.length;
      queue.current.push(...prepareSpeechChunks(accepted));
    }
    finishedRun.current = run;
    void pump(run);
  }, [pump]);

  const speak = useCallback(async (raw: string) => {
    const run = beginStream();
    finishStream(raw, run);
  }, [beginStream, finishStream]);

  return { speak, beginStream, enqueue, finishStream, stop, speaking, error };
}
