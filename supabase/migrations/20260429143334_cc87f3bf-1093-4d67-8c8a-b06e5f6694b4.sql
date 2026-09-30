CREATE TABLE public.sales_playbooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  source_url text,
  source_doc_id text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.sales_playbooks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.sales_playbooks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.sales_playbooks FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.sales_playbooks FOR DELETE TO anon, authenticated USING (true);