import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { normalizeSlug, slugError } from "@/lib/slug";

const Body = z.object({
  title: z.string().max(200).optional(),
  html: z.string().min(50).max(500000),
  slug: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/pages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("অনুমোদন নেই", { status: 401 });

        const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u, error: ue } = await pub.auth.getUser(token);
        if (ue || !u.user) return new Response("অনুমোদন নেই", { status: 401 });

        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("ভুল ইনপুট", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const slug = parsed.data.slug ? normalizeSlug(parsed.data.slug) : "";
        if (slug) {
          const err = slugError(slug);
          if (err) return new Response(err, { status: 400 });
          const { data: ex } = await supabaseAdmin.from("pages").select("id,user_id").ilike("slug", slug).maybeSingle();
          if (ex && ex.user_id !== u.user.id) return new Response("এই লিংকটি অন্য কেউ ব্যবহার করছেন।", { status: 409 });
          if (ex) {
            await supabaseAdmin.from("pages").update({ html: parsed.data.html, title: parsed.data.title ?? null }).eq("id", ex.id);
            return Response.json({ id: ex.id, url: `/${slug}` });
          }
        }

        const { data, error } = await supabaseAdmin
          .from("pages")
          .insert({ user_id: u.user.id, title: parsed.data.title ?? null, html: parsed.data.html, slug: slug || null })
          .select("id,num")
          .single();

        if (error) return new Response(`ওয়েবসাইট সংরক্ষণ করা যায়নি: ${error.message}`, { status: 500 });
        return Response.json({ id: data.id, url: slug ? `/${slug}` : `/project${data.num}` });
      },
    },
  },
});
