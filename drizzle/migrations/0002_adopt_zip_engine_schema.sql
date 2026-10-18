CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'নতুন চ্যাট',
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX IF NOT EXISTS conversations_user_idx ON public.conversations(user_id, updated_at DESC);
INSERT INTO public.conversations(id,user_id,title,created_at,updated_at) SELECT id,user_id,title,created_at,updated_at FROM public.threads ON CONFLICT DO NOTHING;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '';
ALTER TABLE public.messages ALTER COLUMN thread_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN ui_id DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN parts DROP NOT NULL;
UPDATE public.messages m SET conversation_id = m.thread_id,
  content = COALESCE((SELECT string_agg(p->>'text','') FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.parts)='array' THEN m.parts ELSE '[]'::jsonb END) p WHERE p->>'type'='text'),'')
  WHERE m.conversation_id IS NULL;
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages(conversation_id, created_at);
DROP POLICY IF EXISTS "Users manage own messages" ON public.messages;
CREATE POLICY "Users manage own messages" ON public.messages FOR ALL TO authenticated USING (user_id = (select auth.uid()) AND (conversation_id IS NULL OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = (select auth.uid())))) WITH CHECK (user_id = (select auth.uid()) AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = (select auth.uid())));

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'lovable',
  ADD COLUMN IF NOT EXISTS reasoning_effort text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS suggestions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS system_prompt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS welcome_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS welcome_subtitle text NOT NULL DEFAULT '';
DROP POLICY IF EXISTS "signed in read settings" ON public.ai_settings;
CREATE POLICY "Admins read settings" ON public.ai_settings FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'));

ALTER TABLE public.user_memories ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'preference';
GRANT UPDATE ON public.user_memories TO authenticated;

CREATE TABLE IF NOT EXISTS public.ai_keys (
  id int PRIMARY KEY CHECK (id = 1),
  google_key text NOT NULL DEFAULT '',
  openai_key text NOT NULL DEFAULT '',
  key_pool jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_keys TO authenticated;
GRANT ALL ON public.ai_keys TO service_role;
ALTER TABLE public.ai_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage keys" ON public.ai_keys FOR ALL TO authenticated USING (public.has_role((select auth.uid()), 'admin')) WITH CHECK (public.has_role((select auth.uid()), 'admin'));
INSERT INTO public.ai_keys(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.health_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_checks TO authenticated;
GRANT ALL ON public.health_checks TO service_role;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read health" ON public.health_checks FOR SELECT TO authenticated USING (public.has_role((select auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_founder_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'); $$;
REVOKE ALL ON FUNCTION public.claim_founder_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_founder_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Public read chat images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own chat images" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own chat images" ON storage.objects;
DROP POLICY IF EXISTS "Owners read chat images" ON storage.objects;
DROP POLICY IF EXISTS "Owners upload chat images" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete chat images" ON storage.objects;
CREATE POLICY "Owners read chat images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-images' AND owner_id = (select auth.uid()::text) AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Owners upload chat images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-images' AND owner_id = (select auth.uid()::text) AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Owners delete chat images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-images' AND owner_id = (select auth.uid()::text) AND (storage.foldername(name))[1] = (select auth.uid()::text));