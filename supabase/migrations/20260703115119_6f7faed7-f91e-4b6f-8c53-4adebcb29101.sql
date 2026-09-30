CREATE TABLE public.meta_creative_cache (
  ad_id TEXT NOT NULL PRIMARY KEY,
  ad_name TEXT NOT NULL,
  ad_status TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.meta_creative_cache TO anon, authenticated;
GRANT ALL ON public.meta_creative_cache TO service_role;

ALTER TABLE public.meta_creative_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.meta_creative_cache
  FOR SELECT TO anon, authenticated USING (true);