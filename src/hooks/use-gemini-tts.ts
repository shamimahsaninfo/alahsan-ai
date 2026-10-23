import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeGeminiSpeech } from "@/lib/gemini-tts.functions";

const MAX_SPEECH_CHARS = 1200;
const FIRST_CHUNK_TARGET_CHARS = 220;

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
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    generation.current++;
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

  const speak = useCallback(
    async (raw: string) => {
      stop();
      setError(null);
      const run = generation.current;
      const chunks = prepareSpeechChunks(raw);
      if (!chunks.length) return;

      setSpeaking(true);

      try {
        // প্লেব্যাকে অডিও সারিবদ্ধ রাখা ও প্রিলোড করার পাইপলাইন
        let pendingAudioPromise: Promise<{ audioBase64: string; mimeType: string }> | null = null;

        for (let i = 0; i < chunks.length; i++) {
          if (generation.current !== run) return;

          const currentChunk = chunks[i];
          if (!currentChunk) continue;

          // বর্তমান চাংকের জন্য রিকোয়েস্ট নেওয়া
          const chunkPromise = pendingAudioPromise ?? synthesize({ data: { text: currentChunk } });
          pendingAudioPromise = null;

          // পরবর্তী চাংক থাকলে ব্যাকগ্রাউন্ডে আগে থেকেই কল করে রাখা (পাইপলাইনিং) যাতে মাঝে কোনো বিরতি না থাকে
          const nextChunk = chunks[i + 1];
          if (nextChunk) {
            pendingAudioPromise = synthesize({ data: { text: nextChunk } });
          }

          const result = await chunkPromise;
          if (generation.current !== run) return;

          const url = URL.createObjectURL(
            new Blob([toBase64Bytes(result.audioBase64)], { type: result.mimeType }),
          );
          currentUrl.current = url;
          const audio = new Audio(url);
          currentAudio.current = audio;

          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error("অডিও চালানো যায়নি।"));
            void audio.play().catch(reject);
          });

          URL.revokeObjectURL(url);
          if (currentUrl.current === url) currentUrl.current = null;
          if (currentAudio.current === audio) currentAudio.current = null;
        }
      } catch (failure) {
        if (generation.current === run) {
          setError(failure instanceof Error ? failure.message : "ভয়েস চালানো যায়নি।");
          setSpeaking(false);
        }
        return;
      }

      if (generation.current === run) {
        setSpeaking(false);
      }
    },
    [stop, synthesize],
  );

  return { speak, stop, speaking, error };
}
