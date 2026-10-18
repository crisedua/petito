-- One round trip for /api/admin/metrics.
create or replace function admin_metrics()
returns table (total_stories bigint, paid_stories bigint, total_cost_usd numeric)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where status <> 'draft'),
    count(*) filter (where status = 'paid'),
    coalesce(sum(ai_cost_usd), 0)
  from stories;
$$;
revoke all on function admin_metrics() from public, anon, authenticated;
