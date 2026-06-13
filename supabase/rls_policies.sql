-- ============================================================
-- RLS Policies — פורטל סוכנים
-- הרץ ב-SQL Editor של Supabase
-- ============================================================

-- פונקציה עזר: האם המשתמש הנוכחי הוא אדמין?
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  )
$$;

-- פונקציה עזר: מה ה-agent_id של המשתמש הנוכחי?
create or replace function my_agent_id()
returns text language sql security definer stable as $$
  select coalesce(
    (select id::text from agents where user_id = auth.uid()::text limit 1),
    ''
  )
$$;

-- ── מחק פוליסות ישנות ──────────────────────────────────────
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'profiles','agents','categories','deals','expenses','vendors',
    'payments','recurring_expenses','activity_logs','documents','clients','projects'
  ] loop
    execute format('drop policy if exists "authenticated_full_access" on %I', tbl);
  end loop;
end $$;

-- ── Profiles ──────────────────────────────────────────────
-- כל משתמש מאומת יכול לראות ולעדכן רק את הפרופיל שלו
-- אדמין יכול לראות ולעדכן הכל
create policy "profiles_select" on profiles for select to authenticated
  using (id = auth.uid() or is_admin());

create policy "profiles_update" on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy "profiles_insert" on profiles for insert to authenticated
  with check (id = auth.uid());

-- ── Agents ────────────────────────────────────────────────
-- אדמין: הכל | סוכן: קריאה בלבד
create policy "agents_select" on agents for select to authenticated using (true);
create policy "agents_write" on agents for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── Categories ────────────────────────────────────────────
-- כולם קוראים | רק אדמין כותב
create policy "categories_select" on categories for select to authenticated using (true);
create policy "categories_write" on categories for all to authenticated
  using (is_admin()) with check (is_admin());

-- ── Deals ─────────────────────────────────────────────────
-- אדמין: הכל | סוכן: רואה רק עסקאות שלו
create policy "deals_select" on deals for select to authenticated
  using (is_admin() or agent_id = my_agent_id());

create policy "deals_insert" on deals for insert to authenticated
  with check (is_admin() or agent_id = my_agent_id());

create policy "deals_update" on deals for update to authenticated
  using (is_admin() or agent_id = my_agent_id())
  with check (is_admin() or agent_id = my_agent_id());

create policy "deals_delete" on deals for delete to authenticated
  using (is_admin());

-- ── Expenses ──────────────────────────────────────────────
-- אדמין: הכל | סוכן: רואה רק הוצאות שלו
create policy "expenses_select" on expenses for select to authenticated
  using (is_admin() or agent_id = my_agent_id() or created_by_id = auth.uid()::text);

create policy "expenses_insert" on expenses for insert to authenticated
  with check (true);

create policy "expenses_update" on expenses for update to authenticated
  using (is_admin() or agent_id = my_agent_id() or created_by_id = auth.uid()::text);

create policy "expenses_delete" on expenses for delete to authenticated
  using (is_admin());

-- ── Payments ──────────────────────────────────────────────
-- מקושר לעסקאות — אדמין: הכל | סוכן: רק עסקאות שלו
create policy "payments_select" on payments for select to authenticated
  using (is_admin() or deal_id in (select id::text from deals where agent_id = my_agent_id()));

create policy "payments_insert" on payments for insert to authenticated
  with check (is_admin() or deal_id in (select id::text from deals where agent_id = my_agent_id()));

create policy "payments_delete" on payments for delete to authenticated
  using (is_admin());

-- ── שאר הטבלאות — כל מאומת יכול לקרוא, אדמין בלבד כותב ──

-- Vendors — agents can create/update (auto-sync from receipts); only admins can delete
drop policy if exists "vendors_write" on vendors;
drop policy if exists "vendors_select" on vendors;
drop policy if exists "vendors_insert" on vendors;
drop policy if exists "vendors_update" on vendors;
drop policy if exists "vendors_delete" on vendors;
create policy "vendors_select" on vendors for select to authenticated using (true);
create policy "vendors_insert" on vendors for insert to authenticated with check (true);
create policy "vendors_update" on vendors for update to authenticated using (true) with check (true);
create policy "vendors_delete" on vendors for delete to authenticated using (is_admin());

-- Recurring Expenses
create policy "recurring_select" on recurring_expenses for select to authenticated using (true);
create policy "recurring_write" on recurring_expenses for all to authenticated
  using (is_admin()) with check (is_admin());

-- Activity Logs
create policy "logs_select" on activity_logs for select to authenticated using (is_admin());
create policy "logs_insert" on activity_logs for insert to authenticated with check (true);

-- Documents
create policy "docs_select" on documents for select to authenticated using (true);
create policy "docs_write" on documents for all to authenticated using (true) with check (true);

-- Clients & Projects
create policy "clients_all" on clients for all to authenticated using (true) with check (true);
create policy "projects_all" on projects for all to authenticated using (true) with check (true);
