import { createFileRoute } from "@tanstack/react-router";

// Live links for AI-built websites: /project1 ... or any customer-chosen address.
export const Route = createFileRoute("/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const nf = () => new Response("পেজটি পাওয়া যায়নি", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        const slug = params.slug.toLowerCase();
        if (!/^[a-z0-9-]{1,60}$/.test(slug)) return nf();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const m = /^project(\d{1,12})$/.exec(slug);
        const q = supabaseAdmin.from("pages").select("html");
        const { data } = await (m ? q.eq("num", Number(m[1])) : q.ilike("slug", slug)).maybeSingle();
        if (!data) return nf();
        const { withStorageShim } = await import("@/lib/page-shim");
        return new Response(withStorageShim(data.html), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=60",
            "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals",
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    },
  },
});
