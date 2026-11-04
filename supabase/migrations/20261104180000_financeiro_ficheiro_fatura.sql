-- Ficheiro original de cada fatura, guardado no Supabase Storage (bucket privado `faturas`).
--   ficheiro      = caminho do objeto dentro do bucket (ex.: 2026/10/1730000000000-ab12cd-fatura.pdf)
--   ficheiro_nome = nome original do ficheiro
-- O ficheiro só se abre por URL assinado temporário (função netlify `fatura-ficheiro`).
alter table public.financeiro
  add column if not exists ficheiro text,
  add column if not exists ficheiro_nome text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'faturas',
  'faturas',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
