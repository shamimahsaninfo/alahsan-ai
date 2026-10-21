import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "আমার প্রোফাইল ও তথ্য — আল আহসান এআই" },
      { name: "description", content: "নিজের অ্যাকাউন্ট, এআই-এর মনে রাখা কথা ও চ্যাট দেখুন এবং মুছুন।" },
      { property: "og:title", content: "আমার প্রোফাইল — আল আহসান এআই" },
      { property: "og:description", content: "নিজের তথ্য নিজের নিয়ন্ত্রণে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

type Mem = { id: string; text: string; kind: string; created_at: string };

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const [mems, setMems] = useState<Mem[]>([]);
  const [chatCount, setChatCount] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const load = async () => {
    const [m, c] = await Promise.all([
      supabase.from("user_memories").select("id,text,kind,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    setMems((m.data as Mem[]) ?? []);
    setChatCount(c.count ?? 0);
  };
  useEffect(() => { void load(); }, []);

  const delMem = async (id: string) => {
    const { error } = await supabase.from("user_memories").delete().eq("id", id);
    if (error) return setStatus("মোছা যায়নি। আবার চেষ্টা করুন।");
    setMems((x) => x.filter((m) => m.id !== id));
  };
  const delAllMems = async () => {
    if (!confirm("এআই-এর মনে রাখা সব কথা মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("user_memories").delete().eq("user_id", user.id);
    setStatus(error ? "মোছা যায়নি। আবার চেষ্টা করুন।" : "সব মনে রাখা কথা মুছে ফেলা হয়েছে।");
    if (!error) setMems([]);
  };
  const delAllChats = async () => {
    if (!confirm("আপনার সব কথোপকথন চিরতরে মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("conversations").delete().eq("user_id", user.id);
    setStatus(error ? "মোছা যায়নি। আবার চেষ্টা করুন।" : "সব কথোপকথন মুছে ফেলা হয়েছে।");
    if (!error) setChatCount(0);
  };
  const signOut = async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); };

  return (
    <div className="mx-auto min-h-screen max-w-2xl space-y-6 p-4">
      <Link to="/chat" className="inline-flex items-center gap-2 text-primary"><ArrowLeft size={16} /> চ্যাটে ফিরুন</Link>
      <h1 className="text-2xl font-bold">আমার প্রোফাইল</h1>
      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <div className="text-sm text-muted-foreground">ইমেইল</div>
        <div className="break-all font-medium">{user.email}</div>
        <div className="text-sm text-muted-foreground">যোগ দিয়েছেন: {new Date(user.created_at).toLocaleDateString("bn-BD")}</div>
        <div className="text-sm text-muted-foreground">মোট কথোপকথন: {chatCount ?? "…"}</div>
        <button onClick={signOut} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 hover:bg-accent"><LogOut size={16} /> লগআউট</button>
      </section>
      {status && <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">{status}</p>}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">এআই যা মনে রেখেছে ({mems.length})</h2>
          {mems.length > 0 && <button onClick={delAllMems} className="text-sm text-destructive">সব মুছুন</button>}
        </div>
        {mems.length === 0 && <p className="text-sm text-muted-foreground">এখনো কিছু মনে রাখা হয়নি।</p>}
        {mems.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 border-t border-border pt-2">
            <p className="text-sm">{m.text}</p>
            <button onClick={() => delMem(m.id)} aria-label="মুছুন" className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>
      <section className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4">
        <h2 className="font-semibold">তথ্য নিয়ন্ত্রণ</h2>
        <button onClick={delAllChats} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-destructive-foreground"><Trash2 size={16} /> সব কথোপকথন মুছুন</button>
      </section>
    </div>
  );
}
