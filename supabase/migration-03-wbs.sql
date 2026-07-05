-- ============================================================
-- NÂNG CẤP 03: WBS - Dự án / Gói thầu -> Nhóm công việc -> Task
-- Chạy TOÀN BỘ file này 1 lần trong Supabase SQL Editor,
-- TRƯỚC KHI bản frontend mới được deploy.
-- KHÔNG mất dữ liệu: chỉ thêm bảng/cột, task hiện có được tự
-- động gán vào Dự án "General" / Nhóm "General".
-- Chạy lại lần 2 cũng không lỗi.
-- ============================================================

-- 1. Trạng thái dự án
do $$ begin
  create type project_status as enum ('dang_thuc_hien', 'hoan_thanh', 'luu_tru');
exception when duplicate_object then null; end $$;

-- 2. Bảng Dự án / Gói thầu
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  status      project_status not null default 'dang_thuc_hien',
  created_at  timestamptz not null default now()
);

-- 3. Bảng Nhóm công việc (mỗi nhóm thuộc 1 dự án)
create table if not exists task_groups (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_groups_project on task_groups(project_id);

-- 4. RLS (giống các bảng hiện có)
alter table projects enable row level security;
alter table task_groups enable row level security;
do $$ begin
  create policy anon_all on projects for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy anon_all on task_groups for all to anon using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 5. Realtime
do $$ begin
  alter publication supabase_realtime add table projects;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table task_groups;
exception when duplicate_object then null; end $$;

-- 6. Seed dự án + nhóm mặc định "General"
insert into projects (name, description)
select 'General', 'Dự án mặc định cho các task chưa phân loại'
where not exists (select 1 from projects where name = 'General');

insert into task_groups (project_id, name)
select p.id, 'General'
from projects p
where p.name = 'General'
  and not exists (
    select 1 from task_groups g where g.project_id = p.id and g.name = 'General'
  );

-- 7. Gắn task vào nhóm.
--    ON DELETE RESTRICT: nhóm/dự án còn task thì KHÔNG thể xóa (chống mất dữ liệu)
alter table tasks add column if not exists
  group_id uuid references task_groups(id) on delete restrict;

-- 8. Backfill: toàn bộ task hiện có -> General/General
update tasks
set group_id = (
  select g.id
  from task_groups g
  join projects p on p.id = g.project_id
  where p.name = 'General' and g.name = 'General'
  limit 1
)
where group_id is null;

-- 9. Siết NOT NULL sau khi backfill xong
alter table tasks alter column group_id set not null;

create index if not exists idx_tasks_group on tasks(group_id);
