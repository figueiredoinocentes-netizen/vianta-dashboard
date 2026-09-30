
CREATE TABLE public.pipeline_stage_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_name text NOT NULL,
  stage_key text NOT NULL,
  stage_label text NOT NULL,
  position integer NOT NULL,
  rule_type text NOT NULL,
  rule_params jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(pipeline_name, stage_key)
);

ALTER TABLE public.pipeline_stage_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.pipeline_stage_configs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.pipeline_stage_configs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.pipeline_stage_configs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.pipeline_stage_configs FOR DELETE TO anon, authenticated USING (true);

INSERT INTO public.pipeline_stage_configs (pipeline_name, stage_key, stage_label, position, rule_type, rule_params) VALUES
  ('Aluguer', 'mql', 'MQL', 0, 'match_stages', '{"stages": ["Nova Lead", "Nova Lead Qualificada"]}'),
  ('Aluguer', 'contactos', 'Contactos Feitos Atendidos', 1, 'contacted', '{"mql_stages": ["Nova Lead", "Nova Lead Qualificada"], "exclude_prefix": "Não Atendeu"}'),
  ('Aluguer', 'sql', 'SQL', 2, 'reached_any', '{"stages": ["DM Whatsapp", "Visita Marcada", "Visita Efetivada", "Fechado"]}'),
  ('Aluguer', 'dm', 'DM Whatsapp', 3, 'match_stages', '{"stages": ["DM Whatsapp"]}'),
  ('Aluguer', 'visita_marcada', 'Visita Marcada', 4, 'match_stages', '{"stages": ["Visita Marcada"]}'),
  ('Aluguer', 'visita_efetivada', 'Visita Efetivada', 5, 'match_stages', '{"stages": ["Visita Efetivada"]}'),
  ('Aluguer', 'fechado', 'Fechado', 6, 'match_stages', '{"stages": ["Fechado"]}'),
  ('Venda', 'mql', 'MQL', 0, 'match_stages', '{"stages": ["Nova Lead", "Nova Lead Qualificada"]}'),
  ('Venda', 'contactos', 'Contactos Feitos Atendidos', 1, 'contacted', '{"mql_stages": ["Nova Lead", "Nova Lead Qualificada"], "exclude_prefix": "Não Atendeu"}'),
  ('Venda', 'sql', 'SQL', 2, 'reached_any', '{"stages": ["DM Whatsapp", "Visita Marcada", "Visita Efetivada", "Fechado"]}'),
  ('Venda', 'dm', 'DM Whatsapp', 3, 'match_stages', '{"stages": ["DM Whatsapp"]}'),
  ('Venda', 'visita_marcada', 'Visita Marcada', 4, 'match_stages', '{"stages": ["Visita Marcada"]}'),
  ('Venda', 'visita_efetivada', 'Visita Efetivada', 5, 'match_stages', '{"stages": ["Visita Efetivada"]}'),
  ('Venda', 'fechado', 'Fechado', 6, 'match_stages', '{"stages": ["Fechado"]}');
