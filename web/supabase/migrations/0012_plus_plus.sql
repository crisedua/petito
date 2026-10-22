-- Petito Plus+ plans: allow pro_monthly / pro_annual in subscriptions.plan.
alter table subscriptions drop constraint if exists subscriptions_plan_check;
alter table subscriptions add constraint subscriptions_plan_check
  check (plan in ('monthly', 'annual', 'pro_monthly', 'pro_annual'));
