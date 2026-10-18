import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("extract"), user: z.string().max(4000), assistant: z.string().max(4000) }),
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
        const { data: u, error: ue } = await pub.auth.getUser(token);
        if (ue || !u.user) return new Response("Unauthorized", { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("ভুল অনুরোধ", { status: 400 });

        const m = await import("@/lib/memory.server");
        const uid = u.user.id;
        try {
          const d = parsed.data;
          if (d.action === "delete") await m.deleteMemory(uid, d.id);
          if (d.action === "add") await m.addMemory(uid, [{ text: d.text.trim(), kind: "preference" }]);
          if (d.action === "extract") {
            const items = await m.loadMemory(uid, 200);
            const facts = await m.gatekeep(d.user, d.assistant, items);
            await m.addMemory(uid, facts);
            return Response.json({ added: facts.length });
          }
          return Response.json({ items: await m.loadMemory(uid, 200) });
        } catch (e: any) {
          return new Response(e?.message || "স্মৃতি ত্রুটি", { status: 502 });
        }
      },
    },
  },
});
