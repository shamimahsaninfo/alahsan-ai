import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeGeminiSpeech } from "@/lib/gemini-tts.functions";


const MAX_SPEECH_CHARS = 1200;
function prepareSpeechText(text: string) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "").replace(/```[\s\S]*?(```|$)/g, " কোড অংশ। ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/https?:\/\/\S+/g, " ").replace(/[#*`_>|~]/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_SPEECH_CHARS);
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
    currentAudio.current?.pause();
    currentAudio.current = null;
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
    setSpeaking(false);
  }, []);
  const speak = useCallback(async (raw: string) => {
    stop(); setError(null);
    const run = generation.current;
    const text = prepareSpeechText(raw);
    if (!text) return;
    setSpeaking(true);
    try {
      const result = await synthesize({ data: { text } });
      if (generation.current !== run) return;
      const url = URL.createObjectURL(new Blob([toBase64Bytes(result.audioBase64)], { type: result.mimeType }));
      currentUrl.current = url;
      const audio = new Audio(url); currentAudio.current = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve(); audio.onerror = () => reject(new Error("অডিও চালানো যায়নি।"));
        void audio.play().catch(reject);
      });
      URL.revokeObjectURL(url);
      if (currentUrl.current === url) currentUrl.current = null;
      if (currentAudio.current === audio) currentAudio.current = null;
    } catch (failure) {
      if (generation.current === run) { setError(failure instanceof Error ? failure.message : "ভয়েস চালানো যায়নি।"); setSpeaking(false); }
      return;
    }
    if (generation.current === run) setSpeaking(false);
  }, [stop, synthesize]);
  return { speak, stop, speaking, error };
}
