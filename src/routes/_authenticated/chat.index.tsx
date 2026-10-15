import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({
  beforeLoad: async ({ context }) => {
    const userId = (context as { user: { id: string } }).user.id;
    const { data: latest } = await supabase
      .from("threads")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    let id = latest?.id;
    if (!id) {
      const { data, error } = await supabase.from("threads").insert({ user_id: userId }).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    throw redirect({ to: "/chat/$threadId", params: { threadId: id } });
  },
});
