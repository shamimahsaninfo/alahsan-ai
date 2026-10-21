import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Permanent links for chat-uploaded images (stored in a private bucket, served here).
export const Route = createFileRoute("/img/$")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const path = params._splat ?? "";
        if (!/^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(path)) return new Response("Not found", { status: 404 });
        const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
        if (!token) return new Response("লগইন করুন।", { status: 401, headers: { "Cache-Control": "no-store" } });
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return new Response("সেবা অনুপলব্ধ।", { status: 503 });
        const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
        const { data: auth, error } = await client.auth.getUser(token);
        if (error || !auth.user) return new Response("লগইন করুন।", { status: 401 });
        if (path.split("/")[0] !== auth.user.id) return new Response("Not found", { status: 404 });
        const { data } = await client.storage.from("chat-images").download(path);
        if (!data) return new Response("Not found", { status: 404 });
        return new Response(data, { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
      },
    },
  },
});
