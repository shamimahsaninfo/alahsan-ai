import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";
import type { VoiceContextMessage } from "@/lib/voice-context";

export function VoiceCallDialog({ onClose, messages = [] }: { onClose: () => void; messages?: VoiceContextMessage[] }) {
  const [turns, setTurns] = useState<VoiceContextMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const call = useGeminiVoice({ messages, onEvent(event) {
    if (event.type === "app.delegation.pending") setThinking(true);
    const delta = event["delta"];
    if (typeof delta === "string" && (event.type === "session.output_transcript.delta" || event.type === "session.input_transcript.delta")) {
      const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
      setThinking(role === "user");
      setTurns((previous): VoiceContextMessage[] => {
        const last = previous.at(-1);
        const next: VoiceContextMessage[] = last?.role === role
          ? [...previous.slice(0, -1), { role, content: (last.content + delta).slice(-4000) }]
          : [...previous, { role, content: delta }];
        return next.slice(-20);
      });
    }
    if (event.type === "app.turn.complete") setThinking(false);
  } });
  const canStart = call.status === "idle" || call.status === "closed";
  const status = { idle: "ভয়েস কল", connecting: "সংযোগ হচ্ছে…", connected: thinking ? "প্রশ্ন বিশ্লেষণ করছি…" : "শুনছি…", stopping: "কল শেষ হচ্ছে…", closed: "কল শেষ হয়েছে" }[call.status];
  return <section aria-label="চ্যাটের ভয়েস কল" className="shrink-0 border-t border-border bg-background px-3 py-3 sm:px-6">
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-3"><Logo size={32} /><h2 className="flex-1 font-medium">আল আহসান — ভয়েস কল</h2><Button variant="ghost" size="icon" aria-label="ভয়েস কল বন্ধ করুন" title="ভয়েস কল বন্ধ করুন" onClick={() => { call.stop(); onClose(); }}><X /></Button></div>
      <audio ref={call.audioRef} autoPlay className="hidden" />
      <div className="flex flex-col gap-3 py-2">
        <p role="status" className="text-sm text-muted-foreground">{status}</p>
        {turns.length > 0 && <div className="max-h-40 space-y-2 overflow-y-auto text-sm leading-relaxed" aria-live="polite">{turns.map((turn, index) => <p key={index} className={turn.role === "user" ? "text-right text-primary" : "text-foreground"}><span className="mr-2 text-xs text-muted-foreground">{turn.role === "user" ? "আপনি" : "আল আহসান"}</span>{turn.content}</p>)}</div>}
        {call.error && <p role="alert" className="w-full break-words text-sm text-destructive">{call.error}</p>}
        <div className="flex items-center justify-center gap-3">
          {canStart ? <Button onClick={() => { setTurns([]); setThinking(false); window.speechSynthesis?.cancel(); call.start(); }}><Phone />{call.status === "closed" ? "আবার কল করুন" : "কল শুরু করুন"}</Button> : <>
            <Button variant="outline" size="icon" disabled={call.status === "stopping"} onClick={() => call.setMuted(!call.muted)} aria-label={call.muted ? "মাইক চালু করুন" : "মাইক বন্ধ করুন"} title={call.muted ? "মাইক চালু করুন" : "মাইক বন্ধ করুন"}>{call.muted ? <MicOff /> : <Mic />}</Button>
            <Button variant="destructive" disabled={call.status === "stopping"} onClick={call.stop}><PhoneOff />কল শেষ করুন</Button>
          </>}
          {call.playbackBlocked && <Button variant="outline" onClick={call.resumePlayback}><Play />শুনুন</Button>}
        </div>
      </div>
    </div>
  </section>;
}