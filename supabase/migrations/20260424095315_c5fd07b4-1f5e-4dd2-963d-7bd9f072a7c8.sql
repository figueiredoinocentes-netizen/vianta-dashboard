CREATE TABLE public.assistant_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.assistant_conversations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow public insert" ON public.assistant_conversations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.assistant_conversations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.assistant_conversations FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX idx_assistant_conversations_updated_at ON public.assistant_conversations(updated_at DESC);