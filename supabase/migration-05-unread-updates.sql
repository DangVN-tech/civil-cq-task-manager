-- ============================================================
-- MIGRATION 05: Hệ thống "Nhận biết cập nhật công việc" (Unread Updates)
-- Cài mới thì KHÔNG cần file này — schema.sql đã gộp sẵn.
--
-- QUAN TRỌNG: Postgres không cho phép dùng giá trị enum mới thêm
-- trong CÙNG 1 lần chạy (transaction) — phải chạy 2 bước riêng biệt:
--   BƯỚC 1: chạy khối "1. Mở rộng activity_type" bên dưới, bấm Run.
--   BƯỚC 2: sau khi Bước 1 chạy xong, chạy toàn bộ phần còn lại (từ
--           mục 2 trở đi), bấm Run.
-- ============================================================

-- ===== BƯỚC 1 (chạy riêng, bấm Run, rồi mới sang Bước 2) =====
-- 1. Mở rộng activity_type để phủ các loại cập nhật cần theo dõi
alter type activity_type add value if not exists 'comment';
alter type activity_type add value if not exists 'deadline_changed';
alter type activity_type add value if not exists 'returned';
alter type activity_type add value if not exists 'file_uploaded';

-- ===== BƯỚC 2 (chạy sau khi Bước 1 đã chạy xong) =====
-- 2. activity_log: thêm actor_id (ai thực hiện) — null với deadline_changed/returned
--    (2 loại này luôn do Trưởng phòng thật thực hiện, UI tự gán nhãn, không cần lưu actor)
alter table activity_log add column if not exists actor_id uuid references users(id) on delete set null;

-- 3. Bảng "đã đọc" theo từng user + từng dòng activity_log
--    (đủ mịn để đánh dấu unread từng cập nhật riêng lẻ, giống Outlook)
create table if not exists activity_reads (
  activity_id bigint not null references activity_log(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (activity_id, user_id)
);
alter table activity_reads enable row level security;
drop policy if exists anon_all on activity_reads;
create policy anon_all on activity_reads for all to anon using (true) with check (true);
alter publication supabase_realtime add table activity_reads;

-- 4. Nhật ký xử lý -> activity_log (bỏ qua "Lý do trả về:" vì đã có event 'returned' riêng)
create or replace function fn_comment_activity() returns trigger
language plpgsql security definer as $$
begin
  if new.content like 'Lý do trả về:%' then return new; end if;
  insert into activity_log(task_id, event_type, actor_id, detail)
  values (new.task_id, 'comment', new.user_id, new.content);
  return new;
end $$;
drop trigger if exists trg_comment_activity on comments;
create trigger trg_comment_activity after insert on comments
  for each row execute function fn_comment_activity();

-- 5. Upload file -> activity_log
create or replace function fn_file_activity() returns trigger
language plpgsql security definer as $$
begin
  insert into activity_log(task_id, event_type, actor_id, detail)
  values (new.task_id, 'file_uploaded', new.uploader_id, 'Đã upload file: ' || new.file_name);
  return new;
end $$;
drop trigger if exists trg_file_activity on files;
create trigger trg_file_activity after insert on files
  for each row execute function fn_file_activity();

-- 6. Mở rộng fn_task_updated (đã có sẵn, chỉ thêm 2 insert activity_log
--    ngay cạnh 2 insert notifications hiện có cho case "trả về" và "đổi deadline")
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
    -- Nếu là "Trả về" (có lý do mới) -> thông báo người tham gia + ghi activity_log
    if new.last_return_reason is distinct from old.last_return_reason
       and new.last_return_reason is not null then
      insert into notifications(user_id, task_id, type, message)
      select ta.user_id, new.id, 'returned',
             'Task "' || new.title || '" bị trả về. Lý do: ' || new.last_return_reason
      from task_assignees ta where ta.task_id = new.id;

      insert into activity_log(task_id, event_type, detail)
      values (new.id, 'returned', 'Trả về. Lý do: ' || new.last_return_reason);
    end if;
  end if;

  -- Deadline thay đổi (kể cả thêm mới hoặc bỏ deadline)
  if new.deadline is distinct from old.deadline then
    -- Xóa các mốc nhắc deadline cũ để hệ thống nhắc lại theo deadline mới
    delete from notifications
    where task_id = new.id
      and type in ('deadline_24h', 'deadline_8h', 'deadline_2h');
    insert into notifications(user_id, task_id, type, message)
    select ta.user_id, new.id, 'deadline_changed',
           case
             when new.deadline is null then
               'Task "' || new.title || '" không còn deadline (công việc thường xuyên).'
             else
               'Deadline task "' || new.title || '" đã đổi thành ' ||
               to_char(new.deadline at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
           end
    from task_assignees ta where ta.task_id = new.id;

    insert into activity_log(task_id, event_type, detail)
    values (new.id, 'deadline_changed',
            case
              when new.deadline is null then 'Bỏ deadline (chuyển thành công việc thường xuyên)'
              else 'Deadline đổi thành ' ||
                   to_char(new.deadline at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
            end);
  end if;

  return new;
end $$;
-- Trigger trg_task_updated đã tồn tại (before update on tasks), không cần tạo lại.

-- 7. RPC duy nhất: feed hoạt động cho 1 user, JOIN sẵn tên task/dự án/đầu mục + cờ is_read
--    (PostgREST không biểu đạt được anti-join NOT EXISTS nên cần RPC)
create or replace function fn_activity_feed(p_user_id uuid, p_limit int default 200)
returns table(
  id bigint, task_id uuid, task_title text, project_name text, group_name text,
  event_type activity_type, detail text, actor_id uuid, actor_name text,
  actor_is_truong_phong boolean, created_at timestamptz, is_read boolean
)
language sql stable as $$
  select al.id, al.task_id, t.title, p.name, g.name,
         al.event_type, al.detail, al.actor_id, u.full_name,
         coalesce(u.role = 'truong_phong' and not u.is_admin, false),
         al.created_at,
         exists(select 1 from activity_reads r where r.activity_id = al.id and r.user_id = p_user_id)
  from activity_log al
  join tasks t on t.id = al.task_id and t.status = 'dang_thuc_hien'
  join task_groups g on g.id = t.group_id
  join projects p on p.id = g.project_id
  left join users u on u.id = al.actor_id
  where al.event_type in ('comment','deadline_changed','returned','file_uploaded')
  order by al.created_at desc
  limit p_limit
$$;
