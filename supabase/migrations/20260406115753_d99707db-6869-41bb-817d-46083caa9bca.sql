
-- source_mapping table
CREATE TABLE public.source_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_crm text NOT NULL,
  canal_dashboard text NOT NULL,
  tipo text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.source_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.source_mapping FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.source_mapping FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.source_mapping FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.source_mapping FOR DELETE TO anon, authenticated USING (true);

-- funnel_visual_config table
CREATE TABLE public.funnel_visual_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline text NOT NULL,
  stage text NOT NULL,
  ordem integer NOT NULL,
  visivel boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.funnel_visual_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.funnel_visual_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.funnel_visual_config FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.funnel_visual_config FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.funnel_visual_config FOR DELETE TO anon, authenticated USING (true);

-- Seed source_mapping
INSERT INTO public.source_mapping (fonte_crm, canal_dashboard, tipo) VALUES
  ('Facebook', 'Meta Ads', 'Paid Media'),
  ('Form LP Compra Stock', 'Meta Ads', 'Paid Media'),
  ('Form LP Compra Consultoria', 'Meta Ads', 'Paid Media'),
  ('Referência', 'Referência', 'Orgânico'),
  ('Contacto Pessoal', 'Contacto Pessoal', 'Orgânico');
