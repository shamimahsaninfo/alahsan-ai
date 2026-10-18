// Per-user long-term memory stored in the database (user_memories table).
export type MemoryItem = { id?: string; text: string; kind: string; at: string };

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function loadMemory(userId: string, limit = 80): Promise<MemoryItem[]> {
  const db = await admin();
  const { data, error } = await db
    .from("user_memories")
    .select("id,text,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).reverse().map((r) => ({ id: r.id, text: r.text, kind: "preference", at: r.created_at }));
}

export async function addMemory(userId: string, items: { text: string; kind: string }[]) {
  if (!items.length) return;
  const db = await admin();
  await db.from("user_memories").insert(items.map((i) => ({ user_id: userId, text: i.text })));
}

export async function deleteMemory(userId: string, id: string) {
  const db = await admin();
  await db.from("user_memories").delete().eq("user_id", userId).eq("id", id);
}
