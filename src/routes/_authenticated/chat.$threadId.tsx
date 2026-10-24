import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { Menu, Plus, Search, Trash2, Pencil, LogOut, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { AiSettings } from "@/components/chat/AiSettings";
import { useTheme } from "@/components/theme";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({
    meta: [
      { title: "চ্যাট — Al Ahsan AI" },
      { name: "description", content: "Al Ahsan AI-এর সাথে বাংলা ও ইংরেজিতে কথা বলুন।" },
      { property: "og:title", content: "চ্যাট — Al Ahsan AI" },
      { property: "og:description", content: "Al Ahsan AI-এর সাথে বাংলা ও ইংরেজিতে কথা বলুন।" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const { user } = Route.useRouteContext() as { user: { id: string; email?: string } };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threads")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("ui_id,role,parts")
        .eq("thread_id", threadId)
        .order("created_at");
      if (error) throw error;
      return data.map((m) => ({ id: m.ui_id, role: m.role, parts: m.parts }) as unknown as UIMessage);
    },
    staleTime: Infinity,
  });

  async function newChat() {
    const { data, error } = await supabase.from("threads").insert({ user_id: user.id }).select("id").single();
    if (error) { toast.error("নতুন চ্যাট তৈরি করা যায়নি।"); return; }
    await qc.invalidateQueries({ queryKey: ["threads"] });
    setOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  async function rename(id: string, current: string) {
    const title = window.prompt("নতুন নাম দিন", current)?.trim();
    if (!title) return;
    const { error } = await supabase.from("threads").update({ title: title.slice(0, 100) }).eq("id", id);
    if (error) { toast.error("নাম পরিবর্তন ব্যর্থ।"); return; }
    qc.invalidateQueries({ queryKey: ["threads"] });
  }

  async function remove(id: string) {
    if (!window.confirm("এই চ্যাটটি স্থায়ীভাবে মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("threads").delete().eq("id", id);
    if (error) { toast.error("মুছে ফেলা যায়নি।"); return; }
    await qc.invalidateQueries({ queryKey: ["threads"] });
    if (id === threadId) navigate({ to: "/chat" });
  }

  const filtered = (threads.data ?? []).filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-dvh bg-background text-foreground">
      <aside
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-30 w-72 flex-col border-r bg-sidebar text-sidebar-foreground md:static md:flex`}
      >
        <div className="flex items-center gap-2 p-4">
          <img src={logo} alt="" className="h-9 w-9 rounded-full" />
          <span className="text-lg font-bold">Al Ahsan AI</span>
        </div>
        <div className="px-3">
          <Button onClick={newChat} className="w-full justify-start gap-2">
            <Plus className="h-4 w-4" /> নতুন চ্যাট
          </Button>
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="চ্যাট খুঁজুন…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="চ্যাট খুঁজুন"
            />
          </div>
        </div>
        <nav className="mt-3 flex-1 overflow-y-auto px-2" aria-label="চ্যাটের ইতিহাস">
          {filtered.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center rounded-md ${t.id === threadId ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"}`}
            >
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                onClick={() => setOpen(false)}
                className="flex-1 truncate px-3 py-2 text-sm"
              >
                {t.title}
              </Link>
              <button aria-label="নাম পরিবর্তন" className="p-1.5 opacity-60 hover:opacity-100" onClick={() => rename(t.id, t.title)}>
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button aria-label="মুছুন" className="p-1.5 pr-2 opacity-60 hover:text-destructive hover:opacity-100" onClick={() => remove(t.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {threads.isSuccess && filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">কোনো চ্যাট পাওয়া যায়নি</p>
          )}
        </nav>
        <div className="border-t pt-3">
          <AiSettings />
        </div>
        <div className="flex items-center gap-1 border-t p-3 text-sm">
          <span className="flex-1 truncate text-muted-foreground">{user.email}</span>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="থিম পরিবর্তন">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" aria-label="লগআউট" onClick={() => supabase.auth.signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b p-2 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="মেনু">
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Al Ahsan AI</span>
        </header>
        {messages.isSuccess ? (
          <ChatWindow
            key={threadId}
            threadId={threadId}
            initialMessages={messages.data}
            onFinished={() => qc.invalidateQueries({ queryKey: ["threads"] })}
          />
        ) : messages.isError ? (
          <p className="m-auto text-destructive">বার্তা লোড করা যায়নি।</p>
        ) : (
          <p className="m-auto text-muted-foreground">লোড হচ্ছে…</p>
        )}
      </main>
    </div>
  );
}
