import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.png";
import { authError } from "@/lib/auth-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "লগইন — Al Ahsan AI" },
      { name: "description", content: "Al Ahsan AI-তে লগইন বা অ্যাকাউন্ট তৈরি করুন।" },
      { property: "og:title", content: "লগইন — Al Ahsan AI" },
      { property: "og:description", content: "Al Ahsan AI-তে লগইন বা অ্যাকাউন্ট তৈরি করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [linkKind, setLinkKind] = useState<"signup" | "magic">("signup");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/chat" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(authError(error)); return; }
      navigate({ to: "/chat" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setBusy(false);
      if (error) { toast.error(authError(error)); return; }
      setLinkKind("signup");
      setSent(true);
    }
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  async function magicLink() {
    if (busy) return;
    if (!email) { toast.error("আগে উপরে আপনার ইমেইল লিখুন।"); return; }
    setBusy(true);
    try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: true },
    });
    setBusy(false);
    if (error) toast.error(authError(error));
    else { setLinkKind("magic"); setSent(true); toast.success("লগইন লিংক আপনার ইমেইলে পাঠানো হয়েছে।"); }
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  async function resend() {
    if (busy) return;
    if (linkKind === "magic") return magicLink();
    setBusy(true);
    try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(authError(error));
    else toast.success("লিংক আবার পাঠানো হয়েছে।");
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  async function forgot() {
    if (busy) return;
    if (!email) { toast.error("আগে উপরে আপনার ইমেইল লিখুন।"); return; }
    setBusy(true);
    try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(authError(error));
    else toast.success("পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে।");
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    try {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google লগইন ব্যর্থ হয়েছে।");
    else if (!r.redirected) navigate({ to: "/chat" });
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <img src={logo} alt="Al Ahsan লোগো" className="mx-auto h-20 w-20 rounded-full" />
        <h1 className="mt-4 text-center text-2xl font-bold font-display">Al Ahsan AI</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "in" ? "আপনার অ্যাকাউন্টে প্রবেশ করুন" : "নতুন অ্যাকাউন্ট তৈরি করুন"}
        </p>
        {sent ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">
              {email} ঠিকানায় {linkKind === "signup" ? "ইমেইল নিশ্চিতকরণ" : "লগইন"} লিংক পাঠানো হয়েছে। ইনবক্সে না পেলে Spam ফোল্ডার দেখুন।
            </p>
            <Button variant="outline" className="w-full" disabled={busy} onClick={resend}>লিংক আবার পাঠান</Button>
            <button type="button" className="w-full text-center text-sm text-muted-foreground hover:underline" onClick={() => setSent(false)}>
              অন্য ইমেইল ব্যবহার করুন
            </button>
          </div>
        ) : (
          <>
            <Button variant="outline" className="mt-6 w-full" disabled={busy} onClick={google}>
              Google দিয়ে চালিয়ে যান
            </Button>
            <div className="my-4 text-center text-xs text-muted-foreground">অথবা</div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="email">ইমেইল</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="pw">পাসওয়ার্ড</Label>
                <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "অপেক্ষা করুন…" : mode === "in" ? "লগইন" : "সাইন আপ"}
              </Button>
            </form>
            <Button type="button" variant="secondary" className="mt-3 w-full" disabled={busy} onClick={magicLink}>
              পাসওয়ার্ড ছাড়া ইমেইলে লগইন লিংক পান
            </Button>
            {mode === "in" && (
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-muted-foreground hover:underline"
                onClick={forgot}
              >
                পাসওয়ার্ড ভুলে গেছেন?
              </button>
            )}
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "in" ? "up" : "in")}
            >
              {mode === "in" ? "অ্যাকাউন্ট নেই? সাইন আপ করুন" : "আগেই অ্যাকাউন্ট আছে? লগইন করুন"}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
