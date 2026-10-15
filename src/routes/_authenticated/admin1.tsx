import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/admin";
import { GOOGLE_MODELS, LOVABLE_MODELS, OPENAI_MODELS, type Provider } from "@/lib/models";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [s, setS] = useState<any>(null);
  const [gKey, setGKey] = useState("");
  const [oKey, setOKey] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return setIsAdmin(false);
      supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" }).then(({ data: has }) => {
        setIsAdmin(!!has);
      });
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("ai_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS(data);
    });
    supabase.from("ai_keys").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) {
        setGKey(data.google_key || "");
        setOKey(data.openai_key || "");
      }
    });
  }, [isAdmin]);

  if (isAdmin === null) return <div className="min-h-screen bg-background p-8">যাচাই হচ্ছে…</div>;
  if (!isAdmin) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-center">
      <h1 className="text-2xl font-bold">প্রবেশাধিকার নেই</h1>
      <Link to="/" className="mt-4 text-primary underline">মূল পাতায় ফিরে যান</Link>
    </div>
  );
  if (!s) return <div className="min-h-screen bg-background p-8">লোড হচ্ছে…</div>;

  const save = async () => {
    setStatus("সংরক্ষণ হচ্ছে…");
    await supabase.from("ai_settings").upsert({ ...s, id: 1, updated_at: new Date().toISOString() });
    await supabase.from("ai_keys").upsert({ id: 1, google_key: gKey.trim(), openai_key: oKey.trim(), updated_at: new Date().toISOString() });
    setStatus("✓ সফলভাবে সংরক্ষিত হয়েছে।");
    setTimeout(() => setStatus(""), 3000);
  };

  const card = "mt-6 rounded-2xl border bg-card p-6 shadow-sm";
  const input = "w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background p-4 pb-28 text-foreground sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-10 w-10 rounded-full" />
            <h1 className="text-2xl font-bold">অ্যাডমিন ও এআই সেটিংস</h1>
          </div>
          <Link to="/" className="flex items-center gap-1 text-sm text-primary"><ArrowLeft size={16} /> চ্যাট</Link>
        </div>

        <section className={card}>
          <h2 className="text-lg font-bold text-primary">১. এআই-কে স্থায়ী নির্দেশনা (Admin Note)</h2>
          <p className="mt-1 text-xs text-muted-foreground">এখানে যা লিখবেন, এআই সবার আগে সেটি মানবে।</p>
          <textarea rows={4} value={s.admin_note || ""} onChange={(e) => setS({ ...s, admin_note: e.target.value })} className={`${input} mt-2`} />
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold text-primary">২. এআই মোড ও মডেল নির্বাচন</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["lovable", "google", "openai"] as const).map((p) => (
              <button key={p} onClick={() => setS({ ...s, provider: p, model: p === "lovable" ? LOVABLE_MODELS[0].id : p === "google" ? GOOGLE_MODELS[0].id : OPENAI_MODELS[0].id })}
                className={`rounded-lg border p-2.5 text-sm font-medium ${s.provider === p ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>
                {p === "lovable" ? "বিল্ট-ইন (Lovable)" : p === "google" ? "Google Gemini" : "OpenAI"}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs text-muted-foreground">মডেল</label>
          <input value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })} className={`${input} mt-1`} />
        </section>

        <section className={card}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">৩. এপিআই কী (API Keys)</h2>
            <button onClick={() => setShow(!show)} className="flex items-center gap-1 text-xs text-muted-foreground">
              {show ? <EyeOff size={14} /> : <Eye size={14} />} {show ? "লুকান" : "দেখুন"}
            </button>
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">Google Gemini API Key</label>
          <input type={show ? "text" : "password"} value={gKey} onChange={(e) => setGKey(e.target.value)} className={`${input} mt-1`} />
          <label className="mt-3 block text-xs text-muted-foreground">OpenAI API Key</label>
          <input type={show ? "text" : "password"} value={oKey} onChange={(e) => setOKey(e.target.value)} className={`${input} mt-1`} />
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold text-primary">৪. ব্যবহার সীমা (Limits)</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">ঘন্টায় সর্বোচ্চ প্রশ্ন</label>
              <input type="number" value={s.hourly_limit} onChange={(e) => setS({ ...s, hourly_limit: +e.target.value })} className={`${input} mt-1`} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">দিনে সর্বোচ্চ প্রশ্ন</label>
              <input type="number" value={s.daily_limit} onChange={(e) => setS({ ...s, daily_limit: +e.target.value })} className={`${input} mt-1`} />
            </div>
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 border-t bg-background/90 p-4 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <button onClick={save} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-semibold text-primary-foreground">
              <Save size={18} /> সংরক্ষণ করুন
            </button>
            <span className="text-sm font-medium text-emerald-600">{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
