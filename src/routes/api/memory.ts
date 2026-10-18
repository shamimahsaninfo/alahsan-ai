import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("add"), text: z.string().min(3).max(300) }),
]);

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await pub.auth.getUser(token);
        if (!u.user) return new Response("Unauthorized", { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const uid = u.user.id;
        const d = parsed.data;

        if (d.action === "delete") {
          await supabaseAdmin.from("user_memories").delete().eq("user_id", uid).eq("id", d.id);
        } else if (d.action === "add") {
          await supabaseAdmin.from("user_memories").insert({ user_id: uid, text: d.text.trim() });
        }

        const { data: list } = await supabaseAdmin.from("user_memories").select("id,text").eq("user_id", uid).order("created_at", { ascending: false });
        return Response.json({ items: list ?? [] });
      },
    },
  },
});
