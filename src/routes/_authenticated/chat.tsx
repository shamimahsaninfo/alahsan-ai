import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { withStorageShim } from "@/lib/page-shim";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
const urlT = (u: string) => (u.startsWith("data:image/") ? u : defaultUrlTransform(u));
import remarkGfm from "remark-gfm";
import { 
  Mic, MicOff, Send, Plus, Trash2, Volume2, VolumeX, LogOut, Shield, Menu, 
  Square, Copy, Check, Search, Printer, Download, Maximize2, Code2, MonitorPlay, 
  ExternalLink, ImagePlus, Compass, Paperclip, Bookmark as BookmarkIcon, 
  BookmarkCheck, Share2, Globe, Sparkles, Brain, Loader2, Moon, Sun, Pencil, 
  Pin, PinOff, Archive, ArchiveRestore, RotateCcw, Phone, Camera, MonitorUp, 
  ChevronDown, Smartphone, Monitor 
} from "lucide-react";

import { VoiceCallDialog } from "@/components/chat/VoiceCallDialog";
import { Button } from "@/components/ui/button";
import { serviceError } from "@/lib/service-errors";
import { toast } from "sonner";
import { extractDocText, loadBookmarks, saveBookmarks, downloadShareCard, type Bookmark } from "@/lib/extras";
import { ChartBlock } from "@/components/ChartBlock";
import { LOVABLE_MODELS } from "@/lib/models";
import { Settings as SettingsIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { LiveCamera } from "@/components/LiveCamera";
import { useIsAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "কথোপকথন — আল আহসান এআই" },
      { name: "description", content: "আল আহসান এআই-এর সাথে লিখে বা কথা বলে কথোপকথন করুন।" },
    ],
  }),
  component: ChatPage,
});

type Msg = { role: "user" | "assistant"; content: string; image?: string; images?: string[]; error?: boolean };
type Conv = { id: string; title: string; pinned: boolean; archived: boolean };

const MODES = [
  {id: "islamic",label: "ইসলামিক গবেষণা",hint: "কোরআন, নির্ভরযোগ্য হাদিস, তাফসির, উসুলুল ফিকহ ও স্বীকৃত ফিকহি মতামতের আলোকে গভীর গবেষণা করো। আরবি মূল পাঠ, সঠিক সূত্র, হাদিসের মান, প্রাসঙ্গিকতা ও আলেমদের মতপার্থক্য যাচাই করে দলিলভিত্তিক বিশ্লেষণ দাও।"},
  {id: "fast",label: "ফ্ল্যাশ-দ্রুত",hint: "তুমি আল আহসান AI-এর অতি-দ্রুত, নির্ভুল ও দক্ষ উত্তর ইঞ্জিন। প্রধান লক্ষ্য হলো সম্ভব হলে ১–২ সেকেন্ডের মধ্যে উত্তর তৈরি ও পাঠানো। অগ্রাধিকার: গতি, প্রাসঙ্গিকতা, নির্ভুলতা এবং স্পষ্টতা।"},
  {id: "creative",label: "সৃজনশীল চিন্তা ",hint: "বিশ্বমানের উদ্ভাবক, গবেষক ও কৌশলবিদের মতো চিন্তা করো। বিজ্ঞান, প্রযুক্তি, ইতিহাস, প্রকৃতি, মহাবিশ্ব ও বর্তমান বিশ্বসহ যেকোনো বিষয়ে গভীর বিশ্লেষণ করো।"},
  {id: "truth",label: "সত্য ও নির্ভুলতা",hint: "সর্বোচ্চ গুরুত্ব দিয়ে প্রতিটি তথ্য, তত্ত্ব ও যুক্তি যাচাই করো। কখনো মিথ্যা, মনগড়া তথ্য, বিভ্রান্তিকর দাবি বা ভিত্তিহীন উত্তর দেবে না।"},
  {id: "study",label: "স্মার্ট স্টাডি",hint: "দক্ষ শিক্ষকের মতো গণিতের সূত্র ও সমাধান, আরবি নাহু-সরফ, পদার্থবিজ্ঞান, জীববিজ্ঞান, রসায়ন ও ইংরেজিসহ সব বিষয় সহজভাবে ধাপে ধাপে শেখাও।"},
  {id: "write",label: "সাহিত্যিক লেখালেখি",hint: "প্রথিতযশা সাহিত্যিক ও অভিজ্ঞ গ্রন্থকারের মতো ভাষার সৌন্দর্য, গভীরতা, আবেগ ও সৃজনশীলতা দিয়ে লেখো।"},
  {id: "doctor",label: "মেডিকেল বিশেষজ্ঞ",hint: "অভিজ্ঞ চিকিৎসকের মতো উপসর্গ, রোগের সম্ভাব্য কারণ, পরীক্ষার রিপোর্ট ও চিকিৎসাসংক্রান্ত তথ্য বৈজ্ঞানিক প্রমাণের ভিত্তিতে বিশ্লেষণ করো।"},
  {id: "websearch",label: "ইন্টারনেট সার্চ",hint: "যেকোনো বিষয়ে ইন্টারনেটে গভীর অনুসন্ধান করো। সর্বশেষ খবর, বিজ্ঞান, প্রযুক্তি, ইতিহাস, গবেষণা, পণ্য ও বিশ্বসংক্রান্ত তথ্য নির্ভরযোগ্য একাধিক উৎস থেকে খুঁজে যাচাই করো।"},
  {id: "code",label: "আল্টিমেট কোডিং",hint: "বিশ্বমানের AI সফটওয়্যার ইঞ্জিনিয়ার ও অ্যাপ বিল্ডারের মতো কাজ করো। জটিল ওয়েব অ্যাপ তৈরি, সম্পূর্ণ প্রজেক্ট বাস্তবায়ন, UI/UX ডিজাইন, API ও ডেটাবেস সংযোগ, বাগ ফিক্স এবং কোড অপ্টিমাইজেশন করো।"},
];

const STAGE_CONFIG: Record<string, { label: string; sub: string; icon: string }> = {
  geo: { label: "ভৌগোলিক অবস্থান শনাক্ত হচ্ছে", sub: "স্থানীয় প্রসঙ্গ মেলানো হচ্ছে...", icon: "globe" },
  think: { label: "আপনার প্রশ্ন বিশ্লেষণ করা হচ্ছে", sub: "মূল বিষয়বস্তু ও প্রয়োজনীয়তা যাচাই হচ্ছে...", icon: "brain" },
  search: { label: "অনলাইনে লাইভ তথ্য অনুসন্ধান চলছে", sub: "ইন্টারনেট থেকে সর্বশেষ ডেটা খোঁজা হচ্ছে...", icon: "globe" },
  verify: { label: "উৎস ও প্রামাণ্য দলীলসমূহ যাচাই হচ্ছে", sub: "তথ্য যাচাই করে মূল পয়েন্ট সংকলন হচ্ছে...", icon: "search" },
  code: { label: "সফটওয়্যারের কোড প্রস্তুত হচ্ছে", sub: "রেসপনসিভ ডিজাইন ও আর্কিটেকচার তৈরি হচ্ছে...", icon: "code" },
  image: { label: "ছবি ও কনটেন্ট প্রস্তুত হচ্ছে", sub: "ভিজ্যুয়াল প্রসেসিং চলছে...", icon: "sparkles" },
  fallback: { label: "বিকল্প সংযোগে চেষ্টা চলছে", sub: "নির্ভরযোগ্য উত্তর আনা হচ্ছে...", icon: "sparkles" },
  write: { label: "চূড়ান্ত উত্তর প্রস্তুত ও লেখা হচ্ছে", sub: "সাবলীল ভাষায় পূর্ণাঙ্গ উত্তর সাজানো হচ্ছে...", icon: "sparkles" },
  build: { label: "ওয়েবসাইট লাইভ ডেপ্লয় হচ্ছে", sub: "হোস্টিং সার্ভারে সংযুক্ত হচ্ছে...", icon: "code" },
  test: { label: "লাইভ লিংক পরীক্ষা করা হচ্ছে", sub: "ব্রাউজার প্রিভিউ প্রস্তুত হচ্ছে...", icon: "sparkles" },
  done: { label: "সম্পূর্ণ কাজ সফলভাবে সম্পন্ন হয়েছে", sub: "উত্তর প্রস্তুত!", icon: "check" },
};

const WAIT_HINTS = [
  { label: "প্রশ্নের গভীর বিশ্লেষণ চলছে", sub: "গুরুত্বপূর্ণ বিষয়গুলো চিহ্নিত হচ্ছে..." },
  { label: "প্রয়োজনীয় তথ্য গোছানো হচ্ছে", sub: "উৎসসমূহ যাচাই করা হচ্ছে..." },
  { label: "উত্তরের কাঠামো তৈরি হচ্ছে", sub: "বিশদ ও সাবলীল উপস্থাপনা সাজানো হচ্ছে..." },
  { label: "চূড়ান্ত রূপ দেওয়া হচ্ছে", sub: "একটুখানি অপেক্ষা করুন..." },
];

const siteSlugRef = { current: "" };

// --- Helper Functions ---
function splitFollowups(t: string): { body: string; followups: string[] } {
  const followups: string[] = [];
  const body = t.replace(/\[\[প্রশ্ন:\s*([^\]]+)\]\]/g, (_m, q) => { followups.push(String(q).trim()); return ""; }).replace(/\n+\s*(পরবর্তী প্রশ্ন|ফলো-আপ)[^\n]*\s*$/m, "").trimEnd();
  return { body, followups: followups.slice(0, 3) };
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function makePdf(sections: { title?: string; text: string }[], name: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:-10000px;top:0;width:760px;padding:32px;background:#ffffff;color:#111111;font-family:'Hind Siliguri',sans-serif;font-size:16px;line-height:1.8";
  box.innerHTML = `<h2 style="margin:0 0 16px;color:#0b6b3a">আল আহসান এআই</h2>` + sections.map((s) => `${s.title ? `<div style="font-weight:700;margin-top:14px">${esc(s.title)}</div>` : ""}<div style="white-space:pre-wrap;word-break:break-word">${esc(s.text)}</div>`).join("");
  document.body.appendChild(box);
  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const canvas = await html2canvas(box, { scale: 2, backgroundColor: "#ffffff" });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const pagePx = Math.floor((canvas.width * ph) / pw);
    for (let y = 0, p = 0; y < canvas.height; y += pagePx, p++) {
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = Math.min(pagePx, canvas.height - y);
      part.getContext("2d")!.drawImage(canvas, 0, -y);
      if (p) pdf.addPage();
      pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pw, (part.height * pw) / canvas.width);
    }
    saveBlob(pdf.output("blob"), name);
  } catch { alert("PDF তৈরি করা যায়নি, আবার চেষ্টা করুন।"); }
  finally { box.remove(); }
}

async function exportAnswer(content: string, kind: "md" | "doc" | "pdf") {
  if (kind === "pdf") return makePdf([{ text: content }], "al-ahsan-answer.pdf");
  if (kind === "md") return saveBlob(new Blob([content], { type: "text/markdown;charset=utf-8" }), "al-ahsan-answer.md");
  try {
    const { Document, Packer, Paragraph, TextRun } = await import("docx");
    const d = new Document({ sections: [{ children: content.split("\n").map((l) => new Paragraph({ children: [new TextRun({ text: l, font: "Nirmala UI", size: 24 })] })) }] });
    saveBlob(await Packer.toBlob(d), "al-ahsan-answer.docx");
  } catch { alert("Word ফাইল তৈরি করা যায়নি।"); }
}

function stripEmoji(t: string): string {
  return t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, "");
}

function pickVoice(bn: boolean): SpeechSynthesisVoice | undefined {
  const all = window.speechSynthesis.getVoices();
  if (bn) return all.find((x) => /^bn[-_]BD/i.test(x.lang)) || all.find((x) => /^bn/i.test(x.lang));
  return all.find((x) => /^en/i.test(x.lang));
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const clean = stripEmoji(text)
    .replace(/```[\s\S]*?(```|$)/g, " কোড অংশ। ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*`_>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  if (!clean) return;
  const parts = clean.match(/[^।.!?\n]+[।.!?]?/g) || [clean];
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > 180 && cur) { chunks.push(cur); cur = p; } else cur += p;
  }
  if (cur.trim()) chunks.push(cur);
  const run = () => {
    if (/[\u0980-\u09FF]/.test(clean) && !pickVoice(true)) { alert("আপনার ডিভাইসে বাংলা ভয়েস প্যাক নেই।"); return; }
    chunks.forEach((c) => {
      const u = new SpeechSynthesisUtterance(c.trim());
      const bn = /[\u0980-\u09FF]/.test(c);
      u.lang = bn ? "bn-BD" : "en-US";
      const v = pickVoice(bn);
      if (v) u.voice = v;
      u.rate = 1;
      synth.speak(u);
    });
  };
  if (synth.getVoices().length) run();
  else {
    let done = false;
    const go = () => { if (!done) { done = true; run(); } };
    synth.addEventListener("voiceschanged", go, { once: true });
    setTimeout(go, 600);
  }
}

// --- Components ---

function WorkflowStepper({ stages, current }: { stages: string[]; current: number }) {
  const finished = current >= stages.length;
  const [sec, setSec] = useState(0);

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [finished]);

  if (finished) return null;

  const curStageKey = stages[Math.min(current, stages.length - 1)] ?? "think";
  const rawInfo = curStageKey === "think" && sec >= 4
      ? WAIT_HINTS[Math.min(Math.floor((sec - 4) / 4), WAIT_HINTS.length - 1)]
      : STAGE_CONFIG[curStageKey];

  const label = rawInfo?.label || "আপনার প্রশ্ন বিশ্লেষণ করা হচ্ছে";
  const bnNum = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);

  return (
    <div className="not-prose my-3.5 py-1 pl-1 animate-in fade-in duration-300">
      <div className="inline-block text-base font-semibold live-status-shimmer tracking-normal">
        {label.replace(/\.+$/, "").trim()}
      </div>
      <div className="mt-1.5 text-sm text-muted-foreground tabular-nums">
        {bnNum(sec)} সেকেন্ড
      </div>
    </div>
  );
}

function HtmlPreview({ code, streaming }: { code: string; streaming?: boolean }) {
  const [tab, setTab] = useState<"run" | "code">("run");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [ok, setOk] = useState(false);
  const [restore, setRestore] = useState<"" | "busy" | "done" | "err">("");

  const restoreVersion = async () => {
    if (!siteSlugRef.current) return;
    setRestore("busy");
    const { data: s } = await supabase.auth.getSession();
    const r = await fetch("/api/pages", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` }, body: JSON.stringify({ title: "পুনরুদ্ধার করা ভার্সন", html: code.trim(), slug: siteSlugRef.current }) }).catch(() => null);
    setRestore(r?.ok ? "done" : "err");
    setTimeout(() => setRestore(""), 2500);
  };

  if (streaming) {
    return (
      <div className="not-prose my-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-primary bg-muted/30">
          <span className="typing"><i /><i /><i /></span> ওয়েবসাইট তৈরি হচ্ছে… ({code.length} অক্ষর)
        </div>
        <pre className="h-[200px] overflow-hidden p-3 text-xs text-muted-foreground bg-zinc-950 text-zinc-300"><code>{code.slice(-1500)}</code></pre>
      </div>
    );
  }

  const openFull = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/html" }));
    window.open(url, "_blank");
  };

  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-border bg-card shadow-md transition-all">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs bg-muted/30">
        <div className="flex bg-background rounded-md border border-border p-0.5">
          <button onClick={() => setTab("run")} className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors ${tab === "run" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><MonitorPlay size={14} /> প্রিভিউ</button>
          <button onClick={() => setTab("code")} className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-colors ${tab === "code" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Code2 size={14} /> কোড</button>
        </div>
        
        {tab === "run" && (
          <div className="flex bg-background rounded-md border border-border p-0.5 ml-2 hidden sm:flex">
            <button onClick={() => setDevice("desktop")} className={`p-1 rounded ${device === "desktop" ? "bg-muted text-foreground" : "text-muted-foreground"}`} title="Desktop View"><Monitor size={14} /></button>
            <button onClick={() => setDevice("mobile")} className={`p-1 rounded ${device === "mobile" ? "bg-muted text-foreground" : "text-muted-foreground"}`} title="Mobile View"><Smartphone size={14} /></button>
          </div>
        )}

        <span className="flex-1" />
        
        <button onClick={async () => { await navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); }} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary transition-colors">{ok ? <Check size={14} className="text-green-500"/> : <Copy size={14} />} কপি</button>
        <button onClick={openFull} className="flex items-center gap-1 px-2 py-1 text-muted-foreground hover:text-primary transition-colors"><Maximize2 size={14} /> ফুলস্ক্রিন</button>
        <button onClick={restoreVersion} disabled={restore === "busy"} className="flex items-center gap-1 px-2 py-1 text-primary hover:text-primary/80 font-medium transition-colors" title="এই ভার্সনটি লাইভ লিংকে বসান">{restore === "done" ? <><Check size={14} /> লাইভ হয়েছে</> : restore === "err" ? "ব্যর্থ" : restore === "busy" ? <Loader2 size={14} className="animate-spin" /> : <><Globe size={14} /> লাইভ করুন</>}</button>
      </div>
      
      <div className="bg-zinc-100 dark:bg-zinc-900 flex justify-center items-start overflow-hidden">
        {tab === "run" ? (
          <div className={`transition-all duration-300 ease-in-out ${device === "mobile" ? "w-[375px] border-x border-border shadow-2xl" : "w-full"}`}>
            <iframe title="ওয়েবসাইট প্রিভিউ" srcDoc={withStorageShim(code)} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-[70vh] min-h-[520px] w-full bg-white sm:h-[80vh] sm:min-h-[650px]" />
          </div>
        ) : (
          <pre className="w-full max-h-[70vh] min-h-[520px] overflow-auto p-4 text-sm bg-zinc-950 text-zinc-50 sm:max-h-[80vh] sm:min-h-[650px] font-mono leading-relaxed"><code>{code}</code></pre>
        )}
      </div>
    </div>
  );
}

// Custom Code Block Component for Markdown
function CodeBlock({ className, children, ...rest }: any) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "code";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="not-prose my-4 rounded-xl overflow-hidden border border-border bg-zinc-950 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">{lang}</span>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          {copied ? <Check size={14} className="text-green-400"/> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <code className={`text-sm font-mono text-zinc-50 ${className || ""}`} {...rest}>
          {children}
        </code>
      </div>
    </div>
  );
}

function LiveLinkCard({ href }: { href: string }) {
  const [ok, setOk] = useState(false);
  return (
    <span className="not-prose my-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary font-medium">
        <Globe size={16} /> আপনার লাইভ ওয়েবসাইট প্রস্তুত
      </div>
      <span className="break-all text-sm text-muted-foreground bg-background p-2 rounded border border-border font-mono">{href}</span>
      <span className="flex flex-wrap gap-2 mt-1">
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors no-underline"><ExternalLink size={16} /> ভিজিট করুন</a>
        <button onClick={async () => { await navigator.clipboard.writeText(href); setOk(true); setTimeout(() => setOk(false), 1500); }} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">{ok ? <Check size={16} className="text-green-500"/> : <Copy size={16} />}{ok ? "কপি হয়েছে" : "লিংক কপি"}</button>
      </span>
    </span>
  );
}

const makeMd = (streaming: boolean) => ({
  code({ node, inline, className, children, ...rest }: any) {
    const text = String(children ?? "");
    if (!inline && /language-html/.test(className || "") && /<(html|body|!doctype)/i.test(text)) return <HtmlPreview code={text} streaming={streaming} />;
    if (!inline && /language-chart/.test(className || "") && !streaming) return <ChartBlock json={text} />;
    if (!inline) return <CodeBlock className={className} {...rest}>{children}</CodeBlock>;
    return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary" {...rest}>{children}</code>;
  },
  a({ href, children }: any) {
    const h = String(href ?? "");
    if (typeof window !== "undefined" && h.startsWith(window.location.origin) && /\/(project\d+|p\/)/.test(h)) return <LiveLinkCard href={h} />;
    return <a href={h} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{children}</a>;
  },
});
const mdDone = makeMd(false);
const mdStreaming = makeMd(true);

// --- Main Page Component ---

function ChatPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const admin = useIsAdmin(user.id);
  
  // State
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [callOpen, setCallOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [customSlug, setCustomSlug] = useState("");
  const [doc, setDoc] = useState<{ name: string; text: string } | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<{ stages: string[]; current: number } | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);
  const [dark, setDark] = useState(false);
  const [listening, setListening] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [cfg, setCfg] = useState<{ welcome_title?: string; welcome_subtitle?: string; suggestions?: string }>({});
  const [speaking, setSpeaking] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Refs
  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Effects
  useEffect(() => { setMode(localStorage.getItem("ahsan-mode") || ""); }, []);
  useEffect(() => { setModel(localStorage.getItem("ahsan-model") ?? ""); }, []);
  useEffect(() => { setBookmarks(loadBookmarks()); }, []);
  useEffect(() => { const d = localStorage.getItem("theme") === "dark"; setDark(d); document.documentElement.classList.toggle("dark", d); }, []);
  useEffect(() => { siteSlugRef.current = customSlug.trim() || (active ? `site-${String(active).slice(0, 8)}` : ""); }, [customSlug, active]);
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setCfg).catch(() => {}); }, []);
  useEffect(() => { loadConvs(); }, []);
  
  // Auto-scroll logic
  useEffect(() => {
    if (loading) {
      endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [msgs, loading]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  // Auto-resize textarea
  const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (input === "" && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

  const toggleDark = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d); localStorage.setItem("theme", d ? "dark" : "light"); };
  const pushStage = (st: string, finish = false) => setFlow((f) => { const stages = f ? (f.stages.includes(st) ? f.stages : [...f.stages, st]) : [st]; return { stages, current: finish ? stages.length : stages.indexOf(st) }; });
  const copy = async (t: string, i: number) => { await navigator.clipboard.writeText(t); setCopied(i); setTimeout(() => setCopied(null), 1500); };

  const loadConvs = async () => {
    const { data } = await supabase.from("conversations").select("id,title,pinned,archived").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setConvs(data ?? []);
  };

  const openConv = async (id: string) => {
    setCallOpen(false);
    setActive(id);
    setSidebar(false);
    const { data } = await supabase.from("messages").select("role,content").eq("conversation_id", id).order("created_at");
    setMsgs((data ?? []) as Msg[]);
    setTimeout(scrollToBottom, 100);
  };

  const newChat = () => {
    setCallOpen(false);
    setActive(null);
    setMsgs([]);
    setSidebar(false);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const delConv = async (id: string) => {
    if (!confirm("এই কথোপকথনটি মুছে ফেলবেন?")) return;
    await supabase.from("conversations").delete().eq("id", id);
    if (active === id) newChat();
    loadConvs();
  };

  const patchConv = async (id: string, patch: { title?: string; pinned?: boolean; archived?: boolean }) => {
    const { error } = await supabase.from("conversations").update(patch).eq("id", id);
    if (error) toast.error("পরিবর্তন সংরক্ষণ করা যায়নি।");
    loadConvs();
  };

  const renameConv = (c: Conv) => {
    const t = prompt("নতুন নাম লিখুন", c.title)?.trim();
    if (t && t !== c.title) patchConv(c.id, { title: t.slice(0, 80) });
  };

  const toggleBookmark = (content: string) => {
    setBookmarks((prev) => {
      const next = prev.some((b) => b.content === content) ? prev.filter((b) => b.content !== content) : [{ id: crypto.randomUUID(), content, at: Date.now() }, ...prev];
      saveBookmarks(next);
      return next;
    });
  };

  const pickImages = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return toast.error("শুধু ছবি ফাইল পাঠানো যাবে।");
    if (images.length + files.length > 5) toast.warning("সর্বোচ্চ ৫টি ছবি একসাথে পাঠানো যাবে।");
    
    const remainingSlots = Math.max(0, 5 - images.length);
    const toProcess = files.slice(0, remainingSlots);
    toProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const im = new Image();
        im.onload = () => {
          const scale = Math.min(1, 1280 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = Math.round(im.width * scale);
          c.height = Math.round(im.height * scale);
          c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL("image/jpeg", 0.85);
          setImages((prev) => (prev.length < 5 ? [...prev, dataUrl] : prev));
        };
        im.onerror = () => toast.error("ছবিটি খোলা যায়নি।");
        im.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  };

  const pickDoc = async (file: File) => {
    if (file.size > 20_000_000) return toast.error("ফাইলটি ২০ MB-এর বেশি বড়।");
    setDocBusy(true);
    try {
      const t = (await extractDocText(file)).trim();
      if (!t) toast.error("ফাইলে পড়ার মতো লেখা পাওয়া যায়নি। স্ক্যান করা পাতা হলে ছবি হিসেবে পাঠান।");
      else setDoc({ name: file.name, text: t });
    } catch (e: any) { toast.error(e?.message || "ফাইলটি পড়া যায়নি।"); }
    setDocBusy(false);
  };

  const captureFrame = async (src: "camera" | "screen") => {
    const md = navigator.mediaDevices as MediaDevices | undefined;
    if (src === "screen" && (!md?.getDisplayMedia || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))) {
      toast.info("ফোনে সরাসরি স্ক্রিন দেখানো যায় না। আগে স্ক্রিনশট নিন, তারপর সেটি আপলোড করুন।");
      if (!input.trim()) setInput("আমার স্ক্রিনে কী দেখা যাচ্ছে, বিশ্লেষণ করুন।");
      fileRef.current?.click();
      return;
    }
    if (!md || (src === "camera" && !md.getUserMedia)) return toast.error("এই ব্রাউজারে ক্যামেরা চালু করা যাচ্ছে না।");
    
    let stream: MediaStream | null = null;
    try {
      stream = src === "screen" ? await md.getDisplayMedia({ video: true }) : await md.getUserMedia({ video: { facingMode: "environment" } });
      const v = document.createElement("video");
      v.srcObject = stream; v.muted = true; v.playsInline = true;
      await v.play();
      await new Promise((r) => setTimeout(r, src === "camera" ? 700 : 300));
      const scale = Math.min(1, 1280 / (v.videoWidth || 1280));
      const c = document.createElement("canvas");
      c.width = Math.round((v.videoWidth || 1280) * scale); c.height = Math.round((v.videoHeight || 720) * scale);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", 0.8);
      setImages((prev) => (prev.length < 5 ? [...prev, url] : prev));
      if (!input.trim()) setInput(src === "screen" ? "আমার স্ক্রিনে কী দেখা যাচ্ছে, বিশ্লেষণ করুন।" : "ক্যামেরায় কী দেখা যাচ্ছে, বিশ্লেষণ করুন।");
    } catch {
      toast.error("অনুমতি দেওয়া হয়নি বা চালু করা যায়নি।");
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  };

  const toggleMic = () => {
    const KB_HELP = "এই অ্যাপে সরাসরি মাইক চালু করা যাচ্ছে না। সহজ উপায়: লেখার ঘরে চাপ দিন, তারপর কিবোর্ডের মাইক (🎤) বোতাম চেপে বাংলায় বলুন।";
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const isWebView = /; wv\)|AppsGeyser|WebView/i.test(navigator.userAgent);
    if (!SR) return toast.info(KB_HELP);
    if (listening) return recRef.current?.stop();
    
    let rec: any;
    try { rec = new SR(); } catch { return toast.info(KB_HELP); }
    rec.lang = "bn-BD";
    rec.interimResults = true;
    rec.continuous = false;
    const base = input;
    
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput((base ? base + " " : "") + t);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error === "service-not-allowed" || (isWebView && e?.error === "not-allowed") || e?.error === "network" || e?.error === "audio-capture") toast.info(KB_HELP);
      else if (e?.error === "not-allowed") toast.error("মাইক্রোফোনের অনুমতি দিন।");
      else if (e?.error === "no-speech") toast.error("কোনো কথা শোনা যায়নি, আবার চেষ্টা করুন।");
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); toast.info(KB_HELP); }
  };

  const send = async (override?: string, base?: Msg[], regen = false) => {
    const cur = base ?? msgs;
    const imgs = override !== undefined ? [] : images;
    const d = override !== undefined ? null : doc;
    const typed = override !== undefined ? override.trim() : input.trim() || (imgs.length ? "এই ছবিগুলো বিশ্লেষণ করুন।" : d ? "এই ফাইলটির সারসংক্ষেপ ও বিশ্লেষণ দিন।" : "");
    
    const text = d ? `${typed}\n\n[সংযুক্ত ফাইল: ${d.name}]` : typed;
    const modeHint = MODES.find((x) => x.id === mode)?.hint;
    const baseText = d ? `${typed}\n\n=== সংযুক্ত ফাইল: ${d.name} ===\n${d.text.slice(0, 32000)}` : typed;
    const apiText = modeHint ? `[নির্দেশ: ${modeHint}]\n\n${baseText}` : baseText;
    
    if (!typed || loading || docBusy) return;
    
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setImages([]);
    setDoc(null);
    setLoading(true);
    
    const sessionP = supabase.auth.getSession();
    let convId = active;
    
    if (!convId) {
      const { data, error } = await supabase.from("conversations").insert({ title: text.slice(0, 60), user_id: user.id }).select("id").single();
      if (error || !data) { setInput(typed); setImages(imgs); setDoc(d); setLoading(false); toast.error(`কথোপকথন তৈরি করা যায়নি: ${error?.message ?? ""}`); return; }
      convId = data.id;
      setActive(convId);
    }
    
    const imgPayload: Partial<Pick<Msg, "images" | "image">> = imgs[0] ? { images: imgs, image: imgs[0] } : {};
    const history: Msg[] = [...cur.filter((m) => !m.error && m.content.trim()), { role: "user", content: text, ...imgPayload }];
    
    const siteMsgs = cur.filter((m) => m.role === "assistant" && /```html/i.test(m.content));
    const prevSiteMessage = siteMsgs.at(-1);
    const prevSite = prevSiteMessage ? [...prevSiteMessage.content.matchAll(/```html\s*\n([\s\S]*?)```/gi)].map((x) => x[1]).join("\n") : "";
    const siteVersion = siteMsgs.length + 1;
    
    setMsgs([...cur, { role: "user", content: text, ...imgPayload }, { role: "assistant", content: "" }]);
    setFlow({ stages: ["think"], current: 0 });
    setLoading(true);
    
    if (regen) {
      const { data: last } = await supabase.from("messages").select("id,role").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(1);
      if (last?.[0]?.role === "assistant") await supabase.from("messages").delete().eq("id", last[0].id);
    } else {
      void supabase.from("messages").insert({ conversation_id: convId, role: "user", content: imgs.length ? `[${imgs.length}টি ছবি সংযুক্ত] ${text}` : text, user_id: user.id }).then(({ error }) => { if (error) console.error("save user msg", error.message); });
    }

    let full = "";
    let failed = false;
    let wrote = false;
    
    const showErr = (msg: string) => { failed = true; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full ? `${full}\n\n${msg}` : msg, error: true }]); };
    
    try {
      const { data: s } = await sessionP;
      abortRef.current = new AbortController();
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token}` },
        body: JSON.stringify({ messages: history.slice(-8).map((m, i, arr) => { const last = i === arr.length - 1; let content = (last ? (prevSite ? `${apiText}\n\n=== বর্তমান ওয়েবসাইট (ভার্সন ${siteVersion - 1}) ===\nনির্দেশ: ব্যবহারকারী এই সাইটে পরিবর্তন চাইলে শূন্য থেকে নতুন সাইট বানাবে না; নিচের কোডের ওপরই শুধু চাওয়া অংশ বদলে বাকি সব ডিজাইন, লেখা, ছবি, তথ্য হুবহু রেখে সম্পূর্ণ নতুন ভার্সন (ভার্সন ${siteVersion}) একটি পূর্ণ \`\`\`html ব্লকে দেবে। আগের ভার্সনে ফিরতে বললে সেই ভার্সনটি হুবহু দেবে।\n\`\`\`html\n${prevSite.slice(0, 60000)}\n\`\`\`` : apiText) : m.content).replace(/!\[[^\]]*\]\(data:image[^)]+\)/g, "[ছবি]"); content = last ? content.slice(0, 100000) : content.length > 3000 ? content.slice(0, 2500) + "\n...[সংক্ষেপিত]" : content; return last ? { ...m, content } : { role: m.role, content }; }), ...(model ? { model } : {}) }),
        signal: abortRef.current.signal,
      });
      
      if (!res.ok || !res.body) { const detail = await res.text(); const message = /[\u0980-\u09ff]/.test(detail) ? detail.slice(0, 1200) : serviceError(res.status, detail); toast.error(message); throw new Error(message); }
      
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      
      const handle = (raw: string) => {
        const line = raw.trim();
        if (!line.startsWith("data:")) return;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") return;
        try {
          const j = JSON.parse(d);
          if (j.stage) return pushStage(j.stage);
          if (j.error) { const message = serviceError(j.error.status ?? j.error.code ?? 503, typeof j.error === "string" ? j.error : j.error.message ?? ""); toast.error(message); showErr(message); return; }
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            if (!wrote) { wrote = true; pushStage("write"); }
            full += delta;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
          }
        } catch { /* ignore */ }
      };
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          handle(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      }
      buf += dec.decode();
      buf.split("\n").forEach(handle);
    } catch (e: any) {
      if (e?.name !== "AbortError") showErr(`ত্রুটি: ${e?.message || "ত্রুটি হয়েছে"}। আবার চেষ্টা করুন।`);
    }
    
    setLoading(false);
    
    if (full && !failed) {
      if (((full.match(/```/g) || []).length) % 2 === 1) {
        full += "\n```";
        setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
      }
      
      const grab = (lang: string) => [...full.matchAll(new RegExp("```(?:" + lang + ")\\s*\\n([\\s\\S]*?)```", "gi"))].map((m) => m[1]!).join("\n");
      let htmlCode: string | undefined = grab("html");
      const css = grab("css"), js = grab("javascript|js");
      
      if (htmlCode || (css && js)) {
        if (!/<html/i.test(htmlCode)) htmlCode = `<!DOCTYPE html>\n<html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>\n${htmlCode}\n</body></html>`;
        if (css) htmlCode = /<\/head>/i.test(htmlCode) ? htmlCode.replace(/<\/head>/i, `<style>\n${css}\n</style>\n</head>`) : `<style>${css}</style>` + htmlCode;
        if (js) htmlCode = /<\/body>/i.test(htmlCode) ? htmlCode.replace(/<\/body>(?![\s\S]*<\/body>)/i, `<script>\n${js}\n</script>\n</body>`) : htmlCode + `<script>${js}</script>`;
      } else htmlCode = undefined;
      
      if (htmlCode && /<html/i.test(htmlCode)) {
        pushStage("build");
        try {
          const { data: s2 } = await supabase.auth.getSession();
          const pr = await fetch("/api/pages", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s2.session?.access_token}` },
            body: JSON.stringify({
              title: text.slice(0, 80),
              html: htmlCode.trim(),
              slug: (siteSlugRef.current = customSlug.trim() || `site-${convId.slice(0, 8)}`),
            }),
          });
          if (pr.ok) {
            const { url } = await pr.json();
            const liveUrl = `${window.location.origin}${url}`;
            full += `\n\n---\n\n### লাইভ লিংক তৈরি হয়েছে — ভার্সন ${siteVersion}\n\n[${liveUrl}](${liveUrl})\n\nলিংকে চাপ দিলেই ওয়েবসাইটটি সরাসরি খুলবে। আরও পরিবর্তন চাইলে শুধু লিখুন — একই লিংকে নতুন ভার্সন আপডেট হবে।`;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
            pushStage("test");
            const chk = await fetch(url).catch(() => null);
            if (!chk?.ok) { full += `\n\nসতর্কতা: লাইভ লিংক এখনো সাড়া দিচ্ছে না, কিছুক্ষণ পর আবার খুলুন।`; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]); }
          } else {
            full += `\n\nলাইভ লিংক তৈরি করা যায়নি (${pr.status})। আবার চেষ্টা করুন।`;
            setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]);
          }
        } catch { full += "\n\nলাইভ লিংক তৈরির সময় সংযোগ বিচ্ছিন্ন হয়েছে।"; setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]); }
      }
      
      if (voiceOut) speak(full);
      await supabase.from("messages").insert({ conversation_id: convId, role: "assistant", content: full, user_id: user.id });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
      supabase.auth.getSession().then(({ data: s3 }) =>
        fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s3.session?.access_token}` },
          body: JSON.stringify({ action: "extract", user: text.slice(0, 4000), assistant: full.slice(0, 4000) }),
        }).catch(() => {}),
      );
    }
    pushStage("done", true);
    setTimeout(() => setFlow(null), 2500);
    loadConvs();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="flex h-dvh w-full max-w-full overflow-hidden bg-background text-foreground selection:bg-primary/20">
      {/* Sidebar */}
      <aside className={`${sidebar ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-border/50 bg-card/50 backdrop-blur-xl md:static md:flex transition-all duration-300 ease-in-out shadow-2xl md:shadow-none`}>
        <div className="flex items-center gap-3 p-5 border-b border-border/50">
          <Logo size={36} />
          <span className="font-display text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">আল আহসান</span>
        </div>
        
        <div className="p-4">
          <button onClick={newChat} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground px-4 py-3 font-medium transition-all duration-200 shadow-sm hover:shadow-md">
            <Plus size={18} /> নতুন চ্যাট শুরু করুন
          </button>
        </div>

        <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search size={16} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="চ্যাট খুঁজুন…" className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70" />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          {convs.filter((c) => c.archived === showArchived && c.title.toLowerCase().includes(q.toLowerCase())).map((c) => (
            <div key={c.id} className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors cursor-pointer ${active === c.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground/80"}`}>
              {c.pinned && <Pin size={14} className="shrink-0 text-primary" />}
              <button onClick={() => openConv(c.id)} className="flex-1 truncate text-left">{c.title}</button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); patchConv(c.id, { pinned: !c.pinned }); }} className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-background" title={c.pinned ? "পিন সরান" : "পিন করুন"}>
                  {c.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); renameConv(c); }} className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-background" title="নাম পরিবর্তন"><Pencil size={14} /></button>
                <button onClick={(e) => { e.stopPropagation(); patchConv(c.id, { archived: !c.archived }); }} className="p-1 text-muted-foreground hover:text-primary rounded hover:bg-background" title={c.archived ? "আর্কাইভ থেকে ফেরান" : "আর্কাইভ করুন"}>
                  {c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); delConv(c.id); }} className="p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10" title="মুছুন"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <button onClick={() => setShowArchived((v) => !v)} className="mt-4 w-full rounded-lg px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
            {showArchived ? "← সক্রিয় চ্যাটে ফিরুন" : `আর্কাইভ দেখুন (${convs.filter((c) => c.archived).length})`}
          </button>
        </div>

        {bookmarks.length > 0 && (
          <div className="max-h-48 overflow-y-auto border-t border-border/50 px-3 py-3 text-sm bg-muted/10">
            <div className="px-2 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">সংরক্ষিত উত্তর ({bookmarks.length})</div>
            {bookmarks.map((b) => (
              <div key={b.id} className="group flex items-center rounded-lg px-2 py-2 hover:bg-background border border-transparent hover:border-border/50 transition-all cursor-pointer mb-1">
                <button onClick={() => { setActive(null); setMsgs([{ role: "assistant", content: b.content }]); setSidebar(false); }} className="flex-1 truncate text-left text-foreground/80 text-xs">{b.content.replace(/[#*`>]/g, "").slice(0, 50)}...</button>
                <button onClick={(e) => { e.stopPropagation(); toggleBookmark(b.content); }} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded hover:bg-destructive/10 transition-all"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1 border-t border-border/50 p-4 text-sm bg-card/30">
          <div className="mb-3 rounded-xl border border-border/60 bg-background/50 p-3 text-xs shadow-sm">
            <div className="mb-2 flex items-center justify-between font-medium text-foreground">
              <span className="flex items-center gap-1.5 text-primary">
                <Globe size={14} /> কাস্টম ইউআরএল
              </span>
              {customSlug && (
                <button type="button" onClick={() => setCustomSlug("")} className="text-[10px] text-destructive hover:underline bg-destructive/10 px-1.5 py-0.5 rounded">মুছুন</button>
              )}
            </div>
            <input
              type="text"
              value={customSlug}
              onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="যেমন: my-school (ঐচ্ছিক)"
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
            />
            {customSlug && <p className="mt-1.5 truncate text-[10px] text-muted-foreground font-mono bg-muted/50 p-1 rounded">/{customSlug}</p>}
          </div>
          
          <Link to="/salat" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors">
            <Compass size={16} className="text-primary/70" /> নামাজের সময় ও কিবলা
          </Link>
          {admin && (
            <Link to="/admin" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors">
              <Shield size={16} className="text-primary/70" /> অ্যাডমিন প্যানেল
            </Link>
          )}
          <Link to="/profile" className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-foreground/80 hover:text-primary hover:bg-primary/10 transition-colors truncate">
            <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">{user.email?.charAt(0).toUpperCase()}</div>
            <span className="truncate">{user.email}</span>
          </Link>
          <button onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors mt-2">
            <LogOut size={16} /> লগআউট
          </button>
        </div>
      </aside>

      {sidebar && <div className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden transition-opacity" onClick={() => setSidebar(false)} />}
      
      {/* Main Chat Area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/95 relative">
        {/* Header */}
        <header className="flex min-w-0 items-center justify-between gap-2 bg-background/80 backdrop-blur-md px-4 py-3 border-b border-border/40 z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors" onClick={() => setSidebar(!sidebar)}><Menu size={20} /></button>
            <span className="font-display text-lg font-semibold text-foreground tracking-tight">আল আহসান এআই</span>
          </div>
          
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {msgs.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 mr-2 border-r border-border/50 pr-2">
                <Button variant="ghost" size="icon" onClick={() => printChat(msgs)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="প্রিন্ট / PDF"><Printer size={16} /></Button>
                <Button variant="ghost" size="icon" onClick={() => downloadChat(msgs)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="ডাউনলোড"><Download size={16} /></Button>
              </div>
            )}
            
            <Popover>
              <PopoverTrigger asChild>
                <button className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${mode || model ? "border-primary/50 bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`} title="সেটিংস">
                  <SettingsIcon size={14} /> <span className="hidden sm:inline">সেটিংস</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-4 space-y-4 rounded-xl shadow-xl border-border/60">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">কাজের ধরন</label>
                  <select value={mode} onChange={(e) => { setMode(e.target.value); localStorage.setItem("ahsan-mode", e.target.value); }} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                    <option value="">সাধারণ (ডিফল্ট)</option>
                    {MODES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI মডেল</label>
                  <select value={model} onChange={(e) => { setModel(e.target.value); localStorage.setItem("ahsan-model", e.target.value); }} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all">
                    <option value="">স্বয়ংক্রিয় (দ্রুত ও স্মার্ট)</option>
                    {LOVABLE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
              </PopoverContent>
            </Popover>
            
            <button onClick={toggleDark} className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm" title="ডার্ক / লাইট মোড">
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            
            <button onClick={() => { setVoiceOut(!voiceOut); window.speechSynthesis?.cancel(); }} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors shadow-sm ${voiceOut ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
              {voiceOut ? <Volume2 size={16} /> : <VolumeX size={16} />} <span className="hidden sm:inline">ভয়েস</span>
            </button>
          </div>
        </header> 
        
        {/* Chat Messages Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative"
        >
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 min-h-full flex flex-col">

            {msgs.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500 py-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-50"></div>
                  <Logo size={80} className="relative z-10 drop-shadow-xl" />
                </div>
                <h2 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">{cfg.welcome_title || "আসসালামু আলাইকুম"}</h2>
                <p className="mt-3 text-lg text-muted-foreground max-w-md">{cfg.welcome_subtitle || "আজ আমি কীভাবে সাহায্য করতে পারি? লিখুন অথবা মাইক চেপে বলুন।"}</p>
                
                <div className="mt-10 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
                  {(cfg.suggestions ? cfg.suggestions.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 6) : [
                    "সূরা ফাতিহার তাফসীর সংক্ষেপে বলুন", 
                    "আমার স্কুলের জন্য একটি ওয়েবসাইট বানিয়ে দিন", 
                    "এই ইংরেজি বাক্যটি বাংলায় অনুবাদ করুন", 
                    "Python দিয়ে একটি ক্যালকুলেটর বানান"
                  ]).map((p, i) => (
                    <button 
                      key={p} 
                      onClick={() => {
                        setInput(p);
                        if (textareaRef.current) {
                          textareaRef.current.value = p;
                          handleInputResize({ target: textareaRef.current } as any);
                          textareaRef.current.focus();
                        }
                      }} 
                      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-4 text-left text-sm transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-md"
                      style={{ animationDelay: `${i * 100}ms` }}
                    >
                      <span className="relative z-10 text-foreground/80 group-hover:text-foreground">{p}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`mb-8 flex gap-4 ${m.role === "user" ? "justify-end" : "justify-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                {m.role === "assistant" && (
                  <div className="mt-1 shrink-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                      <Logo size={20} />
                    </div>
                  </div>
                )}
                
                <div className={`relative group ${m.role === "user" ? "max-w-[85%] sm:max-w-[75%]" : "min-w-0 max-w-full flex-1"}`}>
                  <div className={`
                    ${m.role === "user" 
                      ? "rounded-2xl rounded-tr-sm bg-primary px-5 py-3.5 text-primary-foreground shadow-md" 
                      : "prose-ai break-words text-foreground"
                    }
                  `}>
                    {m.role === "user" ? (
                      <>
                        {((m.images && m.images.length > 0) ? m.images : m.image ? [m.image] : []).length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {((m.images && m.images.length > 0) ? m.images : m.image ? [m.image] : []).map((src, idx) => (
                              <img key={idx} src={src} alt={`ছবি ${idx + 1}`} className="max-h-48 rounded-xl border border-primary-foreground/20 object-cover shadow-sm" />
                            ))}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      </>
                    ) : (
                      <>
                        {i === msgs.length - 1 && flow && <WorkflowStepper stages={flow.stages} current={flow.current} />}
                        {m.content ? (() => {
                          const { body, followups } = splitFollowups(stripEmoji(m.content));
                          const streamingNow = loading && i === msgs.length - 1;
                          return (
                          <>
                            <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlT} components={streamingNow ? mdStreaming : mdDone}>{body}</ReactMarkdown>
                            
                            {!streamingNow && followups.length > 0 && i === msgs.length - 1 && (
                              <div className="not-prose mt-6 flex flex-col gap-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">সম্পর্কিত প্রশ্ন</span>
                                {followups.map((f) => (
                                  <button key={f} onClick={() => {
                                    setInput(f);
                                    if (textareaRef.current) {
                                      textareaRef.current.value = f;
                                      handleInputResize({ target: textareaRef.current } as any);
                                      textareaRef.current.focus();
                                    }
                                  }} className="rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-left text-sm text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm">{f}</button>
                                ))}
                              </div>
                            )}
                          </>
                          );
                        })() : null}
                      </>
                    )}
                  </div>

                  {/* Action Buttons below message */}
                  {!loading && (
                    <div className={`mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      {m.role === "user" ? (
                        <>
                          <button onClick={() => copy(m.content, i)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="কপি করুন">
                            {copied === i ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
                          </button>
                          <button onClick={() => {
                            const cleanContent = m.content.replace(/\n\n\[সংযুক্ত ফাইল: [^\]]*\]$/, "");
                            setInput(cleanContent);
                            if (textareaRef.current) {
                              textareaRef.current.value = cleanContent;
                              handleInputResize({ target: textareaRef.current } as any);
                              textareaRef.current.focus();
                            }
                          }} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="এডিট করুন">
                            <Pencil size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => copy(stripEmoji(m.content), i)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            {copied === i ? <Check size={14} className="text-green-500"/> : <Copy size={14} />} {copied === i ? "কপি হয়েছে" : "কপি"}
                          </button>
                          <button onClick={() => { if (speaking === i) { window.speechSynthesis?.cancel(); setSpeaking(null); } else { speak(stripEmoji(m.content)); setSpeaking(i); } }} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${speaking === i ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                            {speaking === i ? <><Square size={14} className="fill-current"/> থামা</> : <><Volume2 size={14} /> শুনুন</>}
                          </button>
                          {i === msgs.length - 1 && i > 0 && msgs[i - 1]?.role === "user" && (
                            <button onClick={() => { const prev = msgs[i - 1]!; send(prev.content, msgs.slice(0, i - 1), true); }} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <RotateCcw size={14} /> আবার লিখুন
                            </button>
                          )}
                          <button onClick={() => toggleBookmark(stripEmoji(m.content))} className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${bookmarks.some((b) => b.content === stripEmoji(m.content)) ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                            {bookmarks.some((b) => b.content === stripEmoji(m.content)) ? <BookmarkCheck size={14} /> : <BookmarkIcon size={14} />}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} className="h-4" />
          </div>
        </div>

        {/* Floating Scroll to Bottom Button */}
        {showScrollButton && (
          <button 
            onClick={scrollToBottom}
            className="absolute bottom-32 right-8 z-20 p-2 rounded-full bg-background border border-border shadow-lg text-foreground hover:bg-muted transition-all animate-in fade-in zoom-in"
            aria-label="নিচে যান"
          >
            <ChevronDown size={20} />
          </button>
        )}

        {callOpen && <VoiceCallDialog messages={msgs.filter(message => !message.error)} onClose={() => setCallOpen(false)} />}
        
        {/* Input Area */}
        <div className="shrink-0 bg-background/80 backdrop-blur-xl border-t border-border/40 px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 z-10">
          <div className="mx-auto w-full max-w-4xl">
            
            {/* Previews (Images/Docs) */}
            {(doc || docBusy || images.length > 0) && (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                {images.map((src, idx) => (
                  <div key={idx} className="relative group rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                    <img src={src} alt={`ছবি ${idx + 1}`} className="h-16 w-16 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button type="button" onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))} className="text-white bg-destructive/80 rounded-full p-1 hover:bg-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {docBusy && <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-muted-foreground shadow-sm"><Loader2 size={16} className="animate-spin"/> ফাইল পড়া হচ্ছে...</div>}
                {doc && (
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
                    <Paperclip size={16} className="text-primary" />
                    <span className="max-w-[200px] truncate font-medium text-foreground">{doc.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{Math.round(doc.text.length/1000)}k chars</span>
                    <button type="button" onClick={() => setDoc(null)} className="ml-2 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Main Input Box */}
            <div className={`relative flex items-end gap-2 rounded-2xl border bg-background p-2 transition-all duration-200 shadow-sm ${loading ? "border-border" : "border-border/80 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-md"}`}>
              
              {/* Hidden Inputs */}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) pickImages(e.target.files); e.target.value = ""; }} />
              <input ref={docRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,.html" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickDoc(f); e.target.value = ""; }} />
              
              {/* Plus Menu */}
              <Popover open={plusOpen} onOpenChange={setPlusOpen}>
                <PopoverTrigger asChild>
                  <button className={`shrink-0 rounded-xl p-2.5 transition-colors ${listening ? "animate-pulse bg-destructive/10 text-destructive" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`} aria-label="আরও অপশন">
                    <Plus size={22} className={plusOpen ? "rotate-45 transition-transform" : "transition-transform"} />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-60 p-2 rounded-xl shadow-xl border-border/60 mb-2">
                  <div className="space-y-1">
                    <button disabled={loading || listening} onClick={() => { setPlusOpen(false); setCallOpen(true); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors group">
                      <Phone size={18} className="text-primary group-hover:text-primary-foreground" /> ভয়েস কল
                    </button>
                    <div className="h-px bg-border my-1" />
                    {[
                      { icon: <Camera size={18} />, label: "সরাসরি ক্যামেরা", run: () => setCamOpen(true) },
                      { icon: <ImagePlus size={18} />, label: "ছবি যুক্ত করুন", run: () => fileRef.current?.click() },
                      { icon: <Paperclip size={18} />, label: "PDF / ডকুমেন্ট", run: () => docRef.current?.click() },
                      { icon: listening ? <MicOff size={18} className="text-destructive"/> : <Mic size={18} />, label: listening ? "ভয়েস থামান" : "ভয়েসে বলুন", run: toggleMic },
                      { icon: <MonitorUp size={18} />, label: "স্ক্রিন দেখান", run: () => captureFrame("screen") },
                    ].map((o, i) => (
                      <button key={i} onClick={() => { setPlusOpen(false); o.run(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors">
                        <span className="text-muted-foreground">{o.icon}</span>{o.label}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              {camOpen && <LiveCamera onClose={() => setCamOpen(false)} onCapture={(url) => { setImages((prev) => (prev.length < 5 ? [...prev, url] : prev)); if (!input.trim()) setInput("ক্যামেরায় কী দেখা যাচ্ছে, বিশ্লেষণ করুন।"); }} />}
              
              {/* Auto-resizing Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputResize}
                onKeyDown={(e) => { 
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { 
                    e.preventDefault(); 
                    send(); 
                  } 
                }}
                rows={1}
                disabled={callOpen}
                placeholder={listening ? "শুনছি... কথা বলুন" : "আপনার প্রশ্ন লিখুন..."}
                className="max-h-[200px] min-h-[44px] w-full resize-none bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground/60 custom-scrollbar"
                style={{ overflowY: input.split('\n').length > 8 ? 'auto' : 'hidden' }}
              />
              
              {/* Send / Stop Button */}
              {loading ? (
                <button 
                  onClick={() => abortRef.current?.abort()} 
                  className="shrink-0 rounded-xl bg-destructive/10 text-destructive p-3 hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center justify-center" 
                  title="থামান"
                >
                  <Square size={20} className="fill-current" />
                </button>
              ) : (
                <button 
                  onClick={() => send()} 
                  disabled={callOpen || (!input.trim() && !images.length && !doc) || docBusy} 
                  className="shrink-0 rounded-xl bg-primary p-3 text-primary-foreground shadow-sm transition-all disabled:opacity-50 disabled:shadow-none hover:bg-primary/90 hover:shadow-md active:scale-95 flex items-center justify-center" 
                  aria-label="পাঠান"
                >
                  <Send size={20} className={input.trim() || images.length || doc ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
                </button>
              )}
            </div>
            
            <div className="mt-2 text-center text-[11px] text-muted-foreground/60">
              আল আহসান এআই ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করে নিন।
            </div>
          </div>
        </div>   
      </main>
    </div>
  );
}
