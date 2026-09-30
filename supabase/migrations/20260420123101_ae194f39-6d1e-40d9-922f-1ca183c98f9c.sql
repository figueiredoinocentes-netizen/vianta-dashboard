-- Sanitize funnel_visual_config.aliases
WITH current_stages AS (
  SELECT pipeline, array_agg(stage) AS stages
  FROM public.funnel_visual_config
  GROUP BY pipeline
),
exploded AS (
  SELECT
    f.id,
    f.pipeline,
    f.stage,
    cs.stages AS current_stage_names,
    a AS alias
  FROM public.funnel_visual_config f
  JOIN current_stages cs ON cs.pipeline = f.pipeline
  CROSS JOIN LATERAL unnest(COALESCE(f.aliases, ARRAY[]::text[])) AS a
),
filtered AS (
  SELECT
    id,
    stage,
    current_stage_names,
    btrim(alias) AS alias
  FROM exploded
  WHERE btrim(alias) <> ''
    AND btrim(alias) <> stage
    AND btrim(alias) NOT IN ('MQL','SQL','Fecho','Fechos','Contactados','Contactos Feitos Atendidos')
    AND NOT (btrim(alias) = ANY (current_stage_names))
),
deduped AS (
  SELECT id, array_agg(DISTINCT alias ORDER BY alias) AS clean_aliases
  FROM filtered
  GROUP BY id
)
UPDATE public.funnel_visual_config f
SET aliases = COALESCE(d.clean_aliases, ARRAY[]::text[])
FROM (
  SELECT f2.id, d2.clean_aliases
  FROM public.funnel_visual_config f2
  LEFT JOIN deduped d2 ON d2.id = f2.id
) d
WHERE f.id = d.id;