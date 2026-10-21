CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.assign_founder_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'alahsanfoundation.info@gmail.com' AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_founder_admin AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_founder_admin();
INSERT INTO public.user_roles(user_id, role)
  SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'alahsanfoundation.info@gmail.com' AND email_confirmed_at IS NOT NULL
  ON CONFLICT DO NOTHING;

CREATE TABLE public.ai_settings (
  id int PRIMARY KEY CHECK (id = 1),
  admin_note text NOT NULL DEFAULT '',
  hourly_limit int NOT NULL DEFAULT 40,
  daily_limit int NOT NULL DEFAULT 200,
  image_daily_limit int NOT NULL DEFAULT 10,
  chat_enabled boolean NOT NULL DEFAULT true,
  web_search boolean NOT NULL DEFAULT true,
  url_reader boolean NOT NULL DEFAULT true,
  site_builder boolean NOT NULL DEFAULT true,
  image_gen boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read settings" ON public.ai_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert settings" ON public.ai_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update settings" ON public.ai_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.ai_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'chat',
  ok boolean NOT NULL DEFAULT true,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_usage TO authenticated;
GRANT ALL ON public.chat_usage TO service_role;
ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert own usage" ON public.chat_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "read own or admin usage" ON public.chat_usage FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX ON public.chat_usage(user_id, created_at DESC);
CREATE INDEX ON public.chat_usage(created_at DESC);

CREATE TABLE public.user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.user_memories TO authenticated;
GRANT ALL ON public.user_memories TO service_role;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own memories" ON public.user_memories FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX ON public.user_memories(user_id, created_at DESC);

CREATE TABLE public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  num bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL,
  slug text UNIQUE,
  title text,
  html text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pages" ON public.pages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.fatwa_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL DEFAULT '',
  reference text NOT NULL DEFAULT '',
  original_text text NOT NULL DEFAULT '',
  ruling text NOT NULL,
  keywords text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fatwa_records TO authenticated;
GRANT ALL ON public.fatwa_records TO service_role;
ALTER TABLE public.fatwa_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage fatwa" ON public.fatwa_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));