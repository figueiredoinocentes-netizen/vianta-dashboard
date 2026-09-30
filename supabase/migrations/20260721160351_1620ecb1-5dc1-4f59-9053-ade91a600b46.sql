
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  priority text,
  status text NOT NULL DEFAULT 'todo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO anon, authenticated;
GRANT ALL ON public.action_items TO service_role;

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.action_items FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.action_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.action_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.action_items FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_action_items_updated_at
BEFORE UPDATE ON public.action_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
