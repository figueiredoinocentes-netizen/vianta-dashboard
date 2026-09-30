
CREATE TABLE public.ghl_notes_cache (
  contact_id TEXT NOT NULL PRIMARY KEY,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ghl_notes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.ghl_notes_cache FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.ghl_notes_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.ghl_notes_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.ghl_notes_cache FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_ghl_notes_cache_fetched_at ON public.ghl_notes_cache (fetched_at);
