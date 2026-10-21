import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { ArrowUp, Square, Copy, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const SUGGESTIONS = [
  "নিউটনের গতির তিনটি সূত্র সহজভাবে বুঝিয়ে দাও",
  "2x + 5 = 17 সমীকরণটি ধাপে ধাপে সমাধান করো",
  "Translate to English: আমি প্রতিদিন বই পড়ি",
  "Python-এ একটি ফাইবোনাচি ফাংশন লিখে দাও",
];

export function ChatWindow({
  threadId,
  initialMessages,
  onFinished,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onFinished: () => void;
}) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId },
      headers: async () => {
        const { data } = await supabase.auth.getSession();
        return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
      },
    }),
    onError: (e) => toast.error(readError(e)),
    onFinish: () => {
      onFinished();
      inputRef.current?.focus();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {messages.length === 0 && (
            <div className="pt-12 text-center">
              <img src={logo} alt="" className="mx-auto h-20 w-20 rounded-full" />
              <h2 className="mt-4 text-2xl font-bold">আসসালামু আলাইকুম! কীভাবে সাহায্য করতে পারি?</h2>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border bg-card p-3 text-left text-sm hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageView key={m.id} m={m} />
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              <span className="ml-1">ভাবছে…</span>
            </div>
          )}
          {error && status === "error" && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {readError(error)}
            </p>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mx-auto w-full max-w-3xl px-4 pb-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={8000}
            placeholder="আপনার প্রশ্ন লিখুন…"
            aria-label="বার্তা লিখুন"
            className="max-h-48 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 outline-none"
          />
          {busy ? (
            <Button type="button" size="icon" onClick={() => stop()} aria-label="থামান">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} aria-label="পাঠান">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          AI ভুল করতে পারে। গুরুত্বপূর্ণ তথ্য যাচাই করে নিন।
        </p>
      </form>
    </div>
  );
}

function readError(e: Error) {
  try {
    const parsed = JSON.parse(e.message) as { error?: string };
    if (parsed.error) return parsed.error;
  } catch {
    /* not json */
  }
  if (e.message?.includes("Failed to fetch")) return "ইন্টারনেট সংযোগ পরীক্ষা করুন।";
  return e.message || "কিছু একটা সমস্যা হয়েছে।";
}

function MessageView({ m }: { m: UIMessage }) {
  const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">
          {text}
        </div>
      </div>
    );
  }
  const reasoning = m.parts.filter((p) => p.type === "reasoning").map((p) => (p as { text: string }).text).join("\n");
  return (
    <div className="flex gap-3">
      <img src={logo} alt="" className="mt-1 h-7 w-7 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        {reasoning.trim() && (
          <details className="mb-2 text-sm text-muted-foreground">
            <summary className="cursor-pointer">চিন্তার ধাপ</summary>
            <div className="mt-1 whitespace-pre-wrap border-l-2 pl-3">{reasoning}</div>
          </details>
        )}
        <div className="prose-chat">
          <Streamdown>{text}</Streamdown>
        </div>
        {text && (
          <div className="mt-1 flex gap-1 text-muted-foreground">
            <button
              aria-label="কপি"
              className="rounded p-1 hover:bg-accent"
              onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("কপি হয়েছে"))}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="শুনুন"
              className="rounded p-1 hover:bg-accent"
              onClick={() => {
                speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(text.replace(/[#*`_>]/g, ""));
                u.lang = /[\u0980-\u09FF]/.test(text) ? "bn-BD" : "en-US";
                speechSynthesis.speak(u);
              }}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
