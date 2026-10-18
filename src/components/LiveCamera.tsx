import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";

// সরাসরি ক্যামেরা দেখা যাবে; "ছবি তুলুন" চাপলে ফ্রেমটি AI-এর জন্য যুক্ত হবে
export function LiveCamera({ onCapture, onClose }: { onCapture: (url: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [err, setErr] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    setErr("");
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("x");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      } catch {
        setErr("ক্যামেরা চালু করা যায়নি। ব্রাউজারে ক্যামেরার অনুমতি দিন।");
      }
    })();
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  const snap = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, 1280 / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    onCapture(c.toDataURL("image/jpeg", 0.8));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between p-3">
        <span className="text-base font-medium">সরাসরি ক্যামেরা</span>
        <button onClick={onClose} aria-label="বন্ধ করুন" className="rounded-full p-2 hover:bg-secondary"><X size={22} /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted">
        {err ? <p className="p-6 text-center text-muted-foreground">{err}</p> : <video ref={videoRef} playsInline muted className="h-full w-full object-contain" />}
      </div>
      <div className="flex items-center justify-around p-5">
        <button onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))} aria-label="ক্যামেরা ঘোরান" className="rounded-full border border-border p-3"><RefreshCw size={22} /></button>
        <button onClick={snap} disabled={!!err} aria-label="ছবি তুলুন" className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"><Camera size={28} /></button>
        <span className="w-12" />
      </div>
    </div>
  );
}
