-- ============================================================
-- Civil&CQ Task Manager - Database Schema
-- Chạy TOÀN BỘ file này 1 lần trong Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ============================================================
-- 1. ENUMS
-- ============================================================
create type user_role as enum ('truong_phong', 'pho_phong', 'nhan_vien');
create type task_priority as enum ('khan', 'gap', 'thuong');
create type task_status as enum ('dang_thuc_hien', 'hoan_thanh');
create type mark_color as enum ('vang', 'xanh_la', 'tim');
create type assign_role as enum ('chu_tri', 'phoi_hop');
create type notif_type as enum (
  'assigned', 'deadline_24h', 'deadline_8h', 'deadline_2h',
  'deadline_changed', 'returned'
);
create type activity_type as enum ('created', 'progress', 'completed');

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Nhân sự
create table users (
  id          uuid primary key default gen_random_uuid(),
  login_id    text not null unique check (login_id ~ '^[a-z0-9]+$'),
  full_name   text not null,
  role        user_role not null default 'nhan_vien',
  pin_hash    text,               -- chỉ dùng cho trưởng phòng (SHA-256 hex)
  pin_changed boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Task
create table tasks (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text not null default '',
  assigned_date      date not null default current_date,
  deadline           timestamptz not null,
  priority           task_priority not null default 'thuong',
  status             task_status not null default 'dang_thuc_hien',
  progress           int not null default 0 check (progress between 0 and 100),
  created_by         uuid references users(id) on delete set null,
  completed_at       timestamptz,
  completed_by       uuid references users(id) on delete set null,
  last_return_reason text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Người tham gia task (chủ trì / phối hợp)
create table task_assignees (
  task_id     uuid not null references tasks(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  assign_role assign_role not null default 'phoi_hop',
  primary key (task_id, user_id)
);
-- Mỗi task chỉ có đúng 1 chủ trì
create unique index task_one_chu_tri on task_assignees(task_id) where assign_role = 'chu_tri';

-- Màu đánh dấu cá nhân
create table task_marks (
  user_id uuid not null references users(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  color   mark_color not null,
  primary key (user_id, task_id)
);

-- File đính kèm
create table files (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  uploader_id  uuid references users(id) on delete set null,
  file_name    text not null,
  ext          text not null,
  size_bytes   bigint not null default 0,
  storage_path text not null,
  is_reference boolean not null default false,  -- file tham khảo lúc tạo task
  uploaded_at  timestamptz not null default now()
);

-- Comment (chỉ khi task đang thực hiện)
create table comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid references users(id) on delete set null,
  content    text not null,
  created_at timestamptz not null default now()
);

-- Activity log: chỉ 3 sự kiện (tạo / tiến độ / hoàn thành)
create table activity_log (
  id         bigint generated always as identity primary key,
  task_id    uuid not null references tasks(id) on delete cascade,
  event_type activity_type not null,
  detail     text not null default '',
  created_at timestamptz not null default now()
);

-- Thông báo
create table notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references users(id) on delete cascade,
  task_id       uuid references tasks(id) on delete cascade,
  type          notif_type not null,
  message       text not null,
  is_read       boolean not null default false,
  snoozed_until timestamptz,
  created_at    timestamptz not null default now()
);
-- Chống trùng thông báo deadline (24h/8h/2h chỉ gửi 1 lần / user / task)
create unique index notif_deadline_once
  on notifications(user_id, task_id, type)
  where type in ('deadline_24h', 'deadline_8h', 'deadline_2h');

create index idx_tasks_status on tasks(status);
create index idx_assignees_user on task_assignees(user_id);
create index idx_files_task on files(task_id);
create index idx_comments_task on comments(task_id);
create index idx_activity_task on activity_log(task_id);
create index idx_notif_user on notifications(user_id, is_read);

-- ============================================================
-- 3. TRIGGERS & FUNCTIONS
-- ============================================================

-- 3.1 Trưởng phòng mới -> tự gán PIN mặc định 0000 (bắt buộc đổi lần đầu)
create or replace function fn_default_pin() returns trigger
language plpgsql security definer
set search_path = public, extensions as $$
begin
  if new.role = 'truong_phong' and new.pin_hash is null then
    new.pin_hash := encode(digest('0000', 'sha256'), 'hex');
    new.pin_changed := false;
  end if;
  if new.role <> 'truong_phong' then
    new.pin_hash := null;
    new.pin_changed := false;
  end if;
  return new;
end $$;
create trigger trg_default_pin before insert or update of role on users
  for each row execute function fn_default_pin();

-- 3.2 Task mới -> activity log 'created'
create or replace function fn_task_created() returns trigger
language plpgsql security definer as $$
begin
  insert into activity_log(task_id, event_type, detail)
  values (new.id, 'created', 'Task được tạo');
  return new;
end $$;
create trigger trg_task_created after insert on tasks
  for each row execute function fn_task_created();

-- 3.3 Gán người tham gia -> thông báo 'assigned' (chỉ khi task đang thực hiện)
create or replace function fn_assignee_added() returns trigger
language plpgsql security definer as $$
declare v_title text;
begin
  select title into v_title from tasks where id = new.task_id and status = 'dang_thuc_hien';
  if v_title is not null then
    insert into notifications(user_id, task_id, type, message)
    values (new.user_id, new.task_id, 'assigned',
            'Bạn được giao task: ' || v_title ||
            case when new.assign_role = 'chu_tri' then ' (Chủ trì)' else ' (Phối hợp)' end);
  end if;
  return new;
end $$;
create trigger trg_assignee_added after insert on task_assignees
  for each row execute function fn_assignee_added();

-- 3.4 Cập nhật task: tiến độ / hoàn thành / trả về / đổi deadline
create or replace function fn_task_updated() returns trigger
language plpgsql security definer as $$
begin
  new.updated_at := now();

  -- Tiến độ thay đổi
  if new.progress is distinct from old.progress and new.status = 'dang_thuc_hien' then
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'progress', 'Tiến độ cập nhật: ' || new.progress || '%');
  end if;

  -- Hoàn thành
  if new.status = 'hoan_thanh' and old.status = 'dang_thuc_hien' then
    new.completed_at := now();
    new.progress := 100;
    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'completed', 'Hoàn thành');
  end if;

  -- Quay lại đang thực hiện (Trả về hoặc chủ trì bấm Sửa)
  if new.status = 'dang_thuc_hien' and old.status = 'hoan_thanh' then
    new.completed_at := null;
    new.completed_by := null;
    -- Nếu là "Trả về" (có lý do mới) -> thông báo người tham gia
    if new.last_return_reason is distinct from old.last_return_reason
       and new.last_return_reason is not null then
      insert into notifications(user_id, task_id, type, message)
      select ta.user_id, new.id, 'returned',
             'Task "' || new.title || '" bị trả về. Lý do: ' || new.last_return_reason
      from task_assignees ta where ta.task_id = new.id;
    end if;
  end if;

  -- Deadline thay đổi
  if new.deadline is distinct from old.deadline then
    -- Xóa các mốc nhắc deadline cũ để hệ thống nhắc lại theo deadline mới
    delete from notifications
    where task_id = new.id
      and type in ('deadline_24h', 'deadline_8h', 'deadline_2h');
    insert into notifications(user_id, task_id, type, message)
    select ta.user_id, new.id, 'deadline_changed',
           'Deadline task "' || new.title || '" đã đổi thành ' ||
           to_char(new.deadline at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
    from task_assignees ta where ta.task_id = new.id;
  end if;

  return new;
end $$;
create trigger trg_task_updated before update on tasks
  for each row execute function fn_task_updated();

-- ============================================================
-- 4. RPC (gọi từ client)
-- ============================================================

-- 4.1 Kiểm tra PIN trưởng phòng (client gửi SHA-256 hex của PIN)
create or replace function fn_verify_pin(p_login_id text, p_pin_hash text)
returns boolean language plpgsql security definer as $$
declare v_ok boolean;
begin
  select (pin_hash = p_pin_hash) into v_ok
  from users where login_id = p_login_id and role = 'truong_phong';
  return coalesce(v_ok, false);
end $$;

-- 4.2 Đổi PIN
create or replace function fn_change_pin(p_login_id text, p_old_hash text, p_new_hash text)
returns boolean language plpgsql security definer as $$
declare v_count int;
begin
  update users
  set pin_hash = p_new_hash, pin_changed = true
  where login_id = p_login_id and role = 'truong_phong' and pin_hash = p_old_hash;
  get diagnostics v_count = row_count;
  return v_count > 0;
end $$;

-- 4.3 Tổng dung lượng kho file đã dùng (bytes)
create or replace function fn_storage_usage()
returns bigint language sql security definer as $$
  select coalesce(sum(size_bytes), 0)::bigint from files;
$$;

-- 4.4 Quét deadline, chèn thông báo 24h / 8h / 2h (pg_cron gọi mỗi 15 phút)
create or replace function fn_deadline_notifications()
returns void language plpgsql security definer as $$
declare r record;
begin
  for r in
    select t.id, t.title, t.deadline, ta.user_id,
           extract(epoch from (t.deadline - now())) / 3600.0 as hours_left
    from tasks t
    join task_assignees ta on ta.task_id = t.id
    where t.status = 'dang_thuc_hien'
      and t.deadline > now()
      and t.deadline <= now() + interval '24 hours'
  loop
    if r.hours_left <= 2 then
      insert into notifications(user_id, task_id, type, message)
      values (r.user_id, r.id, 'deadline_2h',
              'Task "' || r.title || '" còn chưa đầy 2 giờ đến deadline!')
      on conflict (user_id, task_id, type)
        where type in ('deadline_24h','deadline_8h','deadline_2h') do nothing;
    elsif r.hours_left <= 8 then
      insert into notifications(user_id, task_id, type, message)
      values (r.user_id, r.id, 'deadline_8h',
              'Task "' || r.title || '" còn chưa đầy 8 giờ đến deadline.')
      on conflict (user_id, task_id, type)
        where type in ('deadline_24h','deadline_8h','deadline_2h') do nothing;
    else
      insert into notifications(user_id, task_id, type, message)
      values (r.user_id, r.id, 'deadline_24h',
              'Task "' || r.title || '" còn chưa đầy 24 giờ đến deadline.')
      on conflict (user_id, task_id, type)
        where type in ('deadline_24h','deadline_8h','deadline_2h') do nothing;
    end if;
  end loop;
end $$;

-- Lịch chạy 15 phút / lần
select cron.schedule('deadline-notifications', '*/15 * * * *',
                     $$select fn_deadline_notifications()$$);

-- ============================================================
-- 5. RLS (mô hình nội bộ: mở cho anon, đã chốt với người dùng)
-- ============================================================
alter table users          enable row level security;
alter table tasks          enable row level security;
alter table task_assignees enable row level security;
alter table task_marks     enable row level security;
alter table files          enable row level security;
alter table comments       enable row level security;
alter table activity_log   enable row level security;
alter table notifications  enable row level security;

create policy anon_all on users          for all to anon using (true) with check (true);
create policy anon_all on tasks          for all to anon using (true) with check (true);
create policy anon_all on task_assignees for all to anon using (true) with check (true);
create policy anon_all on task_marks     for all to anon using (true) with check (true);
create policy anon_all on files          for all to anon using (true) with check (true);
create policy anon_all on comments       for all to anon using (true) with check (true);
create policy anon_all on activity_log   for all to anon using (true) with check (true);
create policy anon_all on notifications  for all to anon using (true) with check (true);

-- Bảo vệ cột pin_hash: client KHÔNG BAO GIỜ đọc/ghi trực tiếp
revoke select, insert, update on users from anon;
grant select (id, login_id, full_name, role, pin_changed, created_at) on users to anon;
grant insert (login_id, full_name, role) on users to anon;
grant update (login_id, full_name, role) on users to anon;
grant delete on users to anon;

-- ============================================================
-- 6. REALTIME
-- ============================================================
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_assignees;
alter publication supabase_realtime add table files;
alter publication supabase_realtime add table comments;
alter publication supabase_realtime add table activity_log;
alter publication supabase_realtime add table notifications;

-- ============================================================
-- 7. STORAGE
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-files', 'task-files', false, 52428800)  -- 50 MB / file
on conflict (id) do nothing;

create policy anon_storage_select on storage.objects
  for select to anon using (bucket_id = 'task-files');
create policy anon_storage_insert on storage.objects
  for insert to anon with check (bucket_id = 'task-files');
create policy anon_storage_delete on storage.objects
  for delete to anon using (bucket_id = 'task-files');

-- ============================================================
-- 8. SEED: tài khoản Trưởng phòng đầu tiên
--    ID: admin | PIN mặc định: 0000 (bắt buộc đổi lần đầu)
-- ============================================================
insert into users (login_id, full_name, role)
values ('admin', 'Quản trị viên', 'truong_phong');
