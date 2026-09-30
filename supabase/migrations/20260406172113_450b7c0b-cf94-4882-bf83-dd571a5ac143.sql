CREATE TABLE public.monthly_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes date NOT NULL,
  oferta text NOT NULL,
  revenue_alvo numeric NOT NULL DEFAULT 0,
  fechos_alvo integer NOT NULL DEFAULT 0,
  sqls_alvo integer NOT NULL DEFAULT 0,
  leads_alvo integer NOT NULL DEFAULT 0,
  budget_alvo numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (mes, oferta)
);

ALTER TABLE public.monthly_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.monthly_objectives FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.monthly_objectives FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.monthly_objectives FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.monthly_objectives FOR DELETE TO anon, authenticated USING (true);