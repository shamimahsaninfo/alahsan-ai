import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Calculator, Languages, Code2 } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { authError } from "@/lib/auth-errors";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Al Ahsan AI — বাংলা ও ইংরেজি AI সহকারী" },
      { name: "description", content: "পড়াশোনা, গণিত, বিজ্ঞান, অনুবাদ, লেখালেখি ও প্রোগ্রামিংয়ে সাহায্যকারী বাংলা AI সহকারী।" },
      { property: "og:title", content: "Al Ahsan AI — বাংলা ও ইংরেজি AI সহকারী" },
      { property: "og:description", content: "পড়াশোনা, গণিত, বিজ্ঞান, অনুবাদ, লেখালেখি ও প্রোগ্রামিংয়ে সাহায্যকারী বাংলা AI সহকারী।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: BookOpen, t: "পড়াশোনা ও বিজ্ঞান", d: "যেকোনো বিষয় সহজ ভাষায় বুঝে নিন।" },
  { icon: Calculator, t: "গণিত", d: "ধাপে ধাপে সমাধান।" },
  { icon: Languages, t: "অনুবাদ ও লেখা", d: "বাংলা, ইংরেজি ও আরও ভাষায়।" },
  { icon: Code2, t: "প্রোগ্রামিং", d: "কোড লেখা, ব্যাখ্যা ও ডিবাগিং।" },
];

function Index() {
  const navigate = useNavigate();
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: "/chat" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const google = async () => {
    setBusy(true); setErr("");
    try {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { setErr("Google লগইন ব্যর্থ হয়েছে।"); setBusy(false); return; }
    if (!r.redirected) navigate({ to: "/chat" });
    } catch (error) { setErr(authError(error)); } finally { setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(""); setInfo("");
    try {
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      setBusy(false);
      if (error) setErr(authError(error));
      else navigate({ to: "/chat" });
    } else {
      const { error } = await supabase.auth.signUp({ email, password: pw, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (error) setErr(authError(error));
      else setInfo("আপনার ইমেইলে একটি নিশ্চিতকরণ লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে তারপর লগইন করুন।");
    }
    } catch (error) { setErr(authError(error)); } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <img src={logo} alt="Al-Ahsan Foundation লোগো" className="mx-auto h-32 w-32 rounded-full shadow-lg" />
        <h1 className="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Al Ahsan AI</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          আপনার বিশ্বস্ত বাংলা AI সহকারী — প্রশ্ন করুন, শিখুন, সমাধান খুঁজুন।
        </p>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mt-8 inline-flex rounded-full bg-primary px-8 py-3 font-semibold text-primary-foreground shadow hover:opacity-90"
          >
            চ্যাট শুরু করুন
          </button>
        ) : (
          <div className="mx-auto mt-8 w-full max-w-sm rounded-2xl border bg-card p-6 text-left shadow-sm">
            <p className="text-center text-sm text-muted-foreground">
              {mode === "in" ? "আপনার অ্যাকাউন্টে প্রবেশ করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন"}
            </p>
            <button onClick={google} disabled={busy} className="mt-4 w-full rounded-md border bg-background py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
              Google দিয়ে চালিয়ে যান
            </button>
            <div className="my-4 text-center text-xs text-muted-foreground">অথবা</div>
            <form onSubmit={submit} className="space-y-3">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ইমেইল" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="পাসওয়ার্ড" className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              <button type="submit" disabled={busy} className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {busy ? "অপেক্ষা করুন…" : mode === "in" ? "লগইন" : "সাইন আপ"}
              </button>
            </form>
            <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-center text-sm text-primary hover:underline">
              {mode === "in" ? "অ্যাকাউন্ট নেই? সাইন আপ করুন" : "আগেই অ্যাকাউন্ট আছে? লগইন করুন"}
            </button>
            {info && <p className="mt-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground">{info}</p>}
            {err && <p className="mt-3 text-center text-sm text-destructive">{err}</p>}
          </div>
        )}

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="rounded-2xl border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 font-semibold">{f.t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="pb-8 text-center text-sm text-muted-foreground">© Al-Ahsan Foundation, Bangladesh</footer>
    </main>
  );
}
