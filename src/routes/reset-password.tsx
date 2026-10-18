import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authError } from "@/lib/auth-errors";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "নতুন পাসওয়ার্ড — Al Ahsan AI" },
      { name: "description", content: "Al Ahsan AI অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট করুন।" },
      { property: "og:title", content: "নতুন পাসওয়ার্ড — Al Ahsan AI" },
      { property: "og:description", content: "Al Ahsan AI অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY" && s) { setReady(true); setInvalid(false); }
    });
    const timer = setTimeout(() => setInvalid(true), 8000);
    return () => { clearTimeout(timer); data.subscription.unsubscribe(); };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (pw !== confirm) { toast.error("দুটি পাসওয়ার্ড মেলেনি।"); return; }
    setBusy(true);
    try {
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { toast.error(authError(error)); return; }
    toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে।");
    navigate({ to: "/chat" });
    } catch (error) { toast.error(authError(error)); } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold">নতুন পাসওয়ার্ড</h1>
        {!ready ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {invalid ? "লিংকটি মেয়াদোত্তীর্ণ, ব্যবহার হয়েছে অথবা সঠিক রিসেট লিংক নয়।" : "ইমেইলের রিসেট লিংক থেকে এই পেজে আসুন। লিংক যাচাই হচ্ছে…"}
            {invalid && <Link to="/auth" className="mt-3 block text-primary">নতুন রিসেট লিংক চান</Link>}
          </p>
        ) : (
          <form onSubmit={save} className="mt-6 space-y-3">
            <Label htmlFor="npw">নতুন পাসওয়ার্ড</Label>
            <Input id="npw" type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
            <Label htmlFor="confirm-pw">পাসওয়ার্ড আবার লিখুন</Label>
            <Input id="confirm-pw" type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "অপেক্ষা করুন…" : "সেভ করুন"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
