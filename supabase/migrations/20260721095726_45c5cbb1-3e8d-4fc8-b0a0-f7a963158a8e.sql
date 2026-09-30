
CREATE TABLE public.meta_insights_daily (
  date DATE NOT NULL,
  ad_id TEXT NOT NULL,
  ad_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  campaign_id TEXT,
  campaign_name TEXT,
  impressions INTEGER,
  reach INTEGER,
  frequency NUMERIC,
  cpm NUMERIC,
  ctr NUMERIC,
  clicks INTEGER,
  spend NUMERIC,
  landing_page_views INTEGER,
  leads INTEGER,
  cost_per_lead NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, ad_id)
);

GRANT SELECT ON public.meta_insights_daily TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_insights_daily TO authenticated;
GRANT ALL ON public.meta_insights_daily TO service_role;

ALTER TABLE public.meta_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read meta_insights_daily"
  ON public.meta_insights_daily FOR SELECT
  USING (true);

CREATE INDEX idx_meta_insights_daily_date ON public.meta_insights_daily(date);
CREATE INDEX idx_meta_insights_daily_ad_id ON public.meta_insights_daily(ad_id);
