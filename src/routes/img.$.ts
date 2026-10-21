import { createFileRoute } from "@tanstack/react-router";

// Permanent links for chat-uploaded images (stored in a private bucket, served here).
export const Route = createFileRoute("/img/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!/^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path)) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin.storage.from("chat-images").download(path);
        if (!data) return new Response("Not found", { status: 404 });
        return new Response(data, { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
      },
    },
  },
});
