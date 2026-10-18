import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin status comes only from protected server-side role records. */
export function useIsAdmin(userId?: string) {
  const [admin, setAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { data: has } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (alive) setAdmin(!!has);
    })().catch(() => alive && setAdmin(false));
    return () => {
      alive = false;
    };
  }, [userId]);
  return admin;
}
