import { useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Logo } from "@/components/Logo";
import { useGeminiVoice } from "@/hooks/use-gemini-voice";

export function VoiceCallDialog({ onClose }: { onClose: () => void }) {
  const [caption, setCaption] = useState("");
  const [thinking, setThinking] = useState(false);
  const call = useGeminiVoice({ onEvent(event) {
    if (event.type === "app.delegation.pending") setThinking(true);
    const delta = event["delta"];
    if (event.type === "session.output_transcript.delta" && typeof delta === "string") {
      setThinking(false);
      setCaption(previous => (previous + delta).slice(-1800));
    }
    if (event.type === "session.input_transcript.delta") setCaption("");
  } });
  const canStart = call.status === "idle" || call.status === "closed";
  const status = { idle: "ভয়েস কল", connecting: "সংযোগ হচ্ছে…", connected: thinking ? "প্রশ্ন বিশ্লেষণ করছি…" : "শুনছি…", stopping: "কল শেষ হচ্ছে…", closed: "কল শেষ হয়েছে" }[call.status];
  return <Dialog open onOpenChange={open => { if (!open) { call.stop(); onClose(); } }}>
    <DialogContent className="max-w-md bg-background">
      <DialogHeader><DialogTitle>আল আহসান — ভয়েস কল</DialogTitle></DialogHeader>
      <audio ref={call.audioRef} autoPlay className="hidden" />
      <div className="flex flex-col items-center gap-5 py-5">
        <Logo size={80} />
        <p role="status" className="text-lg font-medium">{status}</p>
        <div className="h-32 w-full overflow-y-auto text-center text-sm leading-relaxed text-muted-foreground" aria-live="polite">{caption}</div>
        {call.error && <p role="alert" className="w-full break-words text-sm text-destructive">{call.error}</p>}
        <div className="flex items-center justify-center gap-3">
          {canStart ? <Button onClick={() => { setCaption(""); setThinking(false); window.speechSynthesis?.cancel(); call.start(); }}><Phone />{call.status === "closed" ? "আবার কল করুন" : "কল শুরু করুন"}</Button> : <>
            <Button variant="outline" size="icon" disabled={call.status === "stopping"} onClick={() => call.setMuted(!call.muted)} aria-label={call.muted ? "মাইক চালু করুন" : "মাইক বন্ধ করুন"} title={call.muted ? "মাইক চালু করুন" : "মাইক বন্ধ করুন"}>{call.muted ? <MicOff /> : <Mic />}</Button>
            <Button variant="destructive" disabled={call.status === "stopping"} onClick={call.stop}><PhoneOff />কল শেষ করুন</Button>
          </>}
          {call.playbackBlocked && <Button variant="outline" onClick={call.resumePlayback}><Play />শুনুন</Button>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}